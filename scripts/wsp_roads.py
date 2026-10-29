# Reconstruit un masque routier à partir de la texture et des couloirs tracés.
# Les conversions relient pixels de référence, UV et coordonnées Blender ; la distance au bord sécurise les placements.

"""Road semantics separated from paved building plots in the WSP artwork."""
import math
import heapq
import json
from pathlib import Path
from collections import deque
import numpy as np


class StreetMap:
    def __init__(self, pixels, ground_uv, native_bounds, scale):
        self.uv = ground_uv
        self.scale = scale
        self.height, self.width = pixels.shape[:2]
        self.dx = 391.55 * scale / self.width
        self.dy = 261.28 * scale / self.height
        gray = pixels.max(axis=2) - pixels.min(axis=2)
        candidate = (gray < .19) & (pixels[:, :, 0] > .21) & (pixels[:, :, 0] < .9)
        # Paved private plots are not streets. Remove original buildings, but not
        # vehicles and signs that were placed on the road in the source scene.
        for name, (a, b, c, d) in native_bounds.items():
            if name in ['Voiture', 'Moto', 'Bus', 'Avion'] or 'panneau' in name.lower():
                continue
            inset = min(.5, (c-a)/8, (d-b)/8)
            x0, y0, x1, y1 = self.pixel_rectangle(((a+inset)*scale, (b+inset)*scale,
                                                  (c-inset)*scale, (d-inset)*scale))
            candidate[y0:y1+1, x0:x1+1] = False
        locations = np.argwhere(candidate)
        road = np.zeros_like(candidate)
        queue = deque()
        for x, y in [(-17,-13), (63,51), (71,70), (-113,-106)]:
            u, v = self.pixel(x*scale, y*scale)
            j, i = locations[np.argmin((locations[:, 1]-u)**2+(locations[:, 0]-v)**2)]
            if not road[j, i]:
                road[j, i] = True
                queue.append((int(i), int(j)))
        while queue:
            i, j = queue.popleft()
            for di, dj in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
                a, b = i+di, j+dj
                if 0 <= a < self.width and 0 <= b < self.height and candidate[b, a] and not road[b, a]:
                    road[b, a] = True
                    queue.append((a, b))
        # Explicit street corridors traced from the unmodified ground artwork.
        # These also protect dirt streets, disconnected branches, and pixels
        # previously hidden by the source building footprint exclusions.
        corridors=json.loads(Path(__file__).with_name('wsp-streets.json').read_text())
        width,height=corridors['reference_size']
        yy,xx=np.mgrid[0:self.height,0:self.width]
        px=xx/(self.width-1)*width;py=(1-yy/(self.height-1))*height
        reserved=np.zeros_like(road)
        for path in corridors['paths']:
            for a,b in zip(path,path[1:]):
                vx=b[0]-a[0];vy=b[1]-a[1];length=vx*vx+vy*vy
                t=np.clip(((px-a[0])*vx+(py-a[1])*vy)/max(length,.0001),0,1)
                reserved|=(px-a[0]-t*vx)**2+(py-a[1]-t*vy)**2<=corridors['half_width_pixels']**2
        self.reserved=reserved
        road |= reserved
        self.mask = road
        self.distance = np.where(road, np.inf, 0).astype(np.float32)
        interior = road.copy()
        for di, dj in [(1,0),(-1,0),(0,1),(0,-1)]:
            interior &= np.roll(road, (dj, di), axis=(0,1))
        frontier = []
        for j, i in np.argwhere(road & ~interior):
            self.distance[j, i] = min(self.dx, self.dy)/2
            frontier.append((float(self.distance[j,i]), int(i), int(j)))
        heapq.heapify(frontier)
        steps = [(di,dj,math.hypot(di*self.dx,dj*self.dy)) for di,dj in
                 [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]]
        while frontier:
            dist, i, j = heapq.heappop(frontier)
            if dist > self.distance[j,i]+.0001:
                continue
            for di,dj,cost in steps:
                a,b=i+di,j+dj
                if 0<=a<self.width and 0<=b<self.height and road[b,a] and dist+cost<self.distance[b,a]:
                    self.distance[b,a]=dist+cost
                    heapq.heappush(frontier,(float(self.distance[b,a]),a,b))

    def world_from_reference(self,x,y):
        target=np.array([x/1800,1-y/1161],dtype=float)
        origin=np.array(self.uv(0.,0.));u=np.array(self.uv(1.,0.))-origin;v=np.array(self.uv(0.,1.))-origin
        return tuple(float(n) for n in np.linalg.solve(np.column_stack([u,v]),target-origin))

    def pixel(self, x, y):
        u,v = self.uv(float(x),float(y))
        return int(round(u*(self.width-1))), int(round(v*(self.height-1)))

    def pixel_rectangle(self, rect):
        a,b,c,d=rect
        points=[self.pixel(x,y) for x in [a,c] for y in [b,d]]
        return (max(0,min(p[0] for p in points)),max(0,min(p[1] for p in points)),
                min(self.width-1,max(p[0] for p in points)),min(self.height-1,max(p[1] for p in points)))

    # Teste aussi la marge de sécurité autour de la parcelle pour empêcher les maisons de mordre sur le bitume.
    def intersects(self, rect, padding=.6):
        a,b,c,d=rect
        x0,y0,x1,y1=self.pixel_rectangle((a-padding,b-padding,c+padding,d+padding))
        return bool(self.mask[y0:y1+1,x0:x1+1].any())

    def clearance(self, x, y):
        i,j=self.pixel(x,y)
        return float(self.distance[j,i]) if 0<=i<self.width and 0<=j<self.height else 0.0

    def is_road(self,x,y):
        return self.clearance(x,y)>0

    def report(self):
        return {'street_pixels':int(self.mask.sum()),'source_plot_paving_excluded':True,'explicit_street_corridors':int(self.reserved.sum()),
                'maximum_half_width':float(self.distance.max())}