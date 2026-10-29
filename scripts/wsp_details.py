# Ajoute architecture, mobilier et parcours de circulation à la ville exportée.
# Les chemins sont vérifiés contre les empreintes des bâtiments et le masque des rues avant le lissage.

"""Architectural detail, street furniture, water and collision-aware traffic for WSP."""
import bpy,math,json,heapq,random
import numpy as np
from mathutils import Vector,Matrix

def enhance_city(root,source,footprints,painted_color,height,material,mesh,box,cylinder,ellipsoid,bounds,layout_scale=1.0,streets=None):
    rng=random.Random(217)
    stone=bpy.data.materials['WSP Fondations']
    windows=material('WSP Fenetres habitees','#52747D');trim=material('WSP Encadrements','#F1E4CA');red=material('WSP Signal rouge','#B95446')
    civic={'presidence','house_player','Rich home 3','Rich home 2','hopital','Hopital 2','Hopital 3','Hopital 4','eglise','Mboabet'}
    window_count=0
    for obj in source:
        if obj.name not in civic:continue
        vs=[];fs=[];fv=[];ff=[]
        for face in obj.data.polygons:
            normal=face.normal.copy()
            if abs(normal.z)>.08 or face.area<9:continue
            u=Vector((-normal.y,normal.x,0)).normalized();up=Vector((0,0,1));corners=[obj.data.vertices[i].co for i in face.vertices]
            xs=[v.dot(u) for v in corners];zs=[v.z for v in corners];lo,hi=min(xs),max(xs);bottom,top=min(zs),max(zs)
            if hi-lo<2.3 or top-bottom<3:continue
            polygon=[(v.dot(u),v.z) for v in corners]
            def inside(x,z):
                hit=False
                for a,b in zip(polygon,polygon[1:]+polygon[:1]):
                    if (a[1]>z)!=(b[1]>z) and x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:hit=not hit
                return hit
            def panel(vertices,faces,p,w,h,offset):
                q=p+normal*offset;i=len(vertices)
                vertices.extend([tuple(q-u*w/2-up*h/2),tuple(q+u*w/2-up*h/2),tuple(q+u*w/2+up*h/2),tuple(q-u*w/2+up*h/2)]);faces.append((i,i+1,i+2,i+3))
            for row in range(max(1,int((top-bottom-1)/2.4))):
                z=bottom+1.8+row*2.4
                for col in range(max(1,int((hi-lo-1)/1.9))):
                    x=lo+1.2+col*1.9
                    if z+.65>top-.3 or not all(inside(x+dx,z+dz) for dx in [-.45,.45] for dz in [-.6,.6]):continue
                    p=face.center+u*(x-face.center.dot(u))+up*(z-face.center.z)
                    panel(fv,ff,p,1.03,1.43,.025);panel(vs,fs,p,.79,1.18,.047);window_count+=1
        if vs:mesh('WSP Baies '+obj.name,vs,fs,[windows]);mesh('WSP Cadres '+obj.name,fv,ff,[trim])
    # A water surface lies above the painted sea, with its own reflections and animated normal map.
    sea=material('WSP Mer vivante','#3FA8AE');x0,x1,y0,y1=bounds;step=2.5*layout_scale;vs=[];fs=[]
    def is_water(x,y):
        r,g,b=painted_color(x,y)
        return b>r*1.22 and g>r*1.3 and b>.24
    for j in range(math.ceil((y1-y0)/step)):
        y=y0+j*step
        for i in range(math.ceil((x1-x0)/step)):
            x=x0+i*step;points=[(x,y),(x+step,y),(x+step,y+step),(x,y+step)]
            if not all(is_water(a,b) for a,b in points):continue
            k=len(vs);vs.extend((a,b,.055) for a,b in points);fs.append((k,k+1,k+2,k+3))
    if fs:mesh('WSP Surface de la mer',vs,fs,[sea])
    # Plan traffic through the actual painted streets and around all building footprints.
    grid_step=1.0*layout_scale;gx0=-128*layout_scale;gy0=-130*layout_scale;nx=253;ny=275;blocked=set();cost={}
    def occupied(x,y,pad=1.8):return any(a-pad<x<c+pad and b-pad<y<d+pad for a,b,c,d in footprints)
    for j in range(ny):
        for i in range(nx):
            x=gx0+i*grid_step;y=gy0+j*grid_step;r,g,b=painted_color(x,y)
            if occupied(x,y) or is_water(x,y) or streets.clearance(x,y)<1.25:blocked.add((i,j));continue
            road=max(r,g,b)-min(r,g,b)<.14 and .19<r<.87
            cost[i,j]=1+2/(streets.clearance(x,y)+.3)
    def nearest(point):
        choices=[(math.hypot(gx0+i*grid_step-point[0],gy0+j*grid_step-point[1])+cost[i,j]*1.1,(i,j)) for i in range(nx) for j in range(ny) if (i,j) not in blocked]
        return min(choices)[1]
    def path(start,end):
        frontier=[(0,start)];distance={start:0};parent={}
        while frontier:
            _,node=heapq.heappop(frontier)
            if node==end:
                result=[node]
                while node in parent:node=parent[node];result.append(node)
                return list(reversed(result))
            for dx,dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1)]:
                nxt=(node[0]+dx,node[1]+dy)
                if nxt not in cost:continue
                if dx and dy and ((node[0]+dx,node[1]) in blocked or (node[0],node[1]+dy) in blocked):continue
                ax=gx0+node[0]*grid_step;ay=gy0+node[1]*grid_step
                if any(streets.clearance(ax+dx*grid_step*t,ay+dy*grid_step*t)<1.25 or occupied(ax+dx*grid_step*t,ay+dy*grid_step*t) for t in [.2,.4,.6,.8]):continue
                value=distance[node]+cost[nxt]*math.hypot(dx,dy)
                if value<distance.get(nxt,1e9):
                    parent[nxt]=node;distance[nxt]=value
                    heuristic=math.hypot(nxt[0]-end[0],nxt[1]-end[1]);heapq.heappush(frontier,(value+heuristic,nxt))
        return []
    # One-way city block circuit: square, western avenue, ministry district,
    # northern junction, eastern avenue, then back to the square.
    anchors=[streets.world_from_reference(x,y) for x,y in [(786,596),(647,490),(664,433),(827,376),(932,297),(1045,388),(938,502),(902,599),(844,657),(786,596)]];route=[]
    for a,b in zip(anchors,anchors[1:]):
        segment=path(nearest(a),nearest(b))
        assert segment, f'No collision-free route between {a} and {b}'
        route.extend(segment if not route else segment[1:])
    points=[]
    for k,node in enumerate(route):
        if 0<k<len(route)-1 and (node[0]-route[k-1][0],node[1]-route[k-1][1])==(route[k+1][0]-node[0],route[k+1][1]-node[1]):continue
        x=gx0+node[0]*grid_step;y=gy0+node[1]*grid_step;points.append([x,height(x,y)+.075,-y])
    assert len(points)>8,'No valid street route for traffic'
    raw=[(p[0],-p[2]) for p in points[:-1]]
    def safe(p):return streets.clearance(*p)>=1.15 and not occupied(*p,1.5)
    # Le lissage ne peut pas couper un virage à travers une maison : tout le segment est échantillonné.
    def segment_safe(a,b):
        n=max(1,math.ceil(math.dist(a,b)/.4))
        return all(safe((a[0]+(b[0]-a[0])*t/n,a[1]+(b[1]-a[1])*t/n)) for t in range(n+1))
    # Remove grid stair steps using visibility checks, rather than cutting corners.
    simple=[raw[0]];i=0
    while i<len(raw)-1:
        j=min(len(raw)-1,i+30)
        while j>i+1 and (not segment_safe(raw[i],raw[j]) or sum(math.dist(raw[k],raw[k+1]) for k in range(i,j))>1.12*math.dist(raw[i],raw[j])):j-=1
        simple.append(raw[j]);i=j
    smooth=[]
    for i,b in enumerate(simple):
        a=simple[i-1];c=simple[(i+1)%len(simple)]
        ab=math.dist(a,b);bc=math.dist(b,c)
        if min(ab,bc)<.01:continue
        cut=min(5,ab*.42,bc*.42)
        for attempt in range(8):
            start=tuple(b[k]+(a[k]-b[k])*cut/ab for k in range(2))
            end=tuple(b[k]+(c[k]-b[k])*cut/bc for k in range(2))
            curve=[tuple((1-t)**2*start[k]+2*(1-t)*t*b[k]+t*t*end[k] for k in range(2)) for t in np.linspace(0,1,17)]
            if all(segment_safe(a,b) for a,b in zip(curve,curve[1:])):break
            cut*=.5
        smooth.extend(curve)
    smooth.append(smooth[0])
    assert all(segment_safe(a,b) for a,b in zip(smooth,smooth[1:])), 'Rounded street route crosses a building or road edge'
    assert sum(math.dist(a,b) for a,b in zip(smooth,smooth[1:]))>90, "Traffic circuit too short for six cars"
    points=[[x,height(x,y)+.075,-y] for x,y in smooth]
    traffic_path=root/'public/data/wsp-traffic.json';traffic_path.parent.mkdir(exist_ok=True)
    home=next(obj for obj in source if obj.name=='house_player');hx=(min(v.co.x for v in home.data.vertices)+max(v.co.x for v in home.data.vertices))/2;hy=(min(v.co.y for v in home.data.vertices)+max(v.co.y for v in home.data.vertices))/2
    traffic_path.write_text(json.dumps({'route':points,'closed':True,'source':'WSP painted streets; building footprints excluded','layout':{'scale':layout_scale,'home':[hx,-hy]}},separators=(',',':')),encoding='utf8')
    # Reuse the actual car mesh as the animated vehicle prototype, aligned along Blender +Y.
    car=next(o for o in source if o.name=='Voiture');data=car.data.copy();positions=np.array([tuple(v.co) for v in data.vertices]);center=(positions.min(axis=0)+positions.max(axis=0))/2
    positions[:,:2]-=center[:2];positions[:,2]-=positions[:,2].min()
    values,vectors=np.linalg.eigh(np.cov(positions[:,:2],rowvar=False));axis=vectors[:,np.argmax(values)];angle=math.pi/2-math.atan2(axis[1],axis[0]);rotation=Matrix.Rotation(angle,4,'Z')
    for v,p in zip(data.vertices,positions):v.co=rotation@Vector(p)
    data.update();prototype=bpy.data.objects.new('WSP Traffic prototype',data);bpy.context.collection.objects.link(prototype);prototype.location.z=-20
    # Benches, planted tubs and small pedestrians occupy clear edges of streets.
    bench=material('WSP Bancs','#997550');metal=material('WSP Mobilier vert','#415E4F');shrubs=material('WSP Jardins','#608B43')
    clothes=[material('WSP Habit '+str(i),c) for i,c in enumerate(['#E6CDA2','#C46D4C','#597A8B','#64764B'])];skin=material('WSP Peau','#996444')
    furniture=0;people=0;occupied_props=[]
    for k in range(3,len(route)-3,11):
        i,j=route[k];x=gx0+i*grid_step;y=gy0+j*grid_step
        a=route[k-1];b=route[k+1];dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy) or 1
        x+=dy/length*2.5;y-=dx/length*2.5
        if occupied(x,y,2.0) or is_water(x,y):continue
        if any(math.hypot(x-a,y-b)<7 for a,b in occupied_props):continue
        z=height(x,y);angle=math.atan2(dy,dx)
        if furniture%2==0:
            box('WSP Assise banc',x,y,z+.6,2,.62,.16,bench,angle)
            for side in [-.72,.72]:
                xx=x+side*math.cos(angle);yy=y+side*math.sin(angle)
                box('WSP Pied banc',xx,yy,z,.16,.54,.6,metal,angle)
            box('WSP Dossier banc',x-math.sin(angle)*.26,y+math.cos(angle)*.26,z+.73,2,.1,.55,bench,angle)
        else:
            cylinder('WSP Bac plante',x,y,z,.7,.55,stone,12);ellipsoid('WSP Arbuste',x,y,z+1.1,.8,.75,.9,shrubs)
        furniture+=1;occupied_props.append((x,y))
        px=x+1.5;py=y+.6
        if not occupied(px,py,.35):
            cylinder('WSP Passant corps',px,py,z+.5,.21,.65,clothes[people%4],8)
            ellipsoid('WSP Passant tete',px,py,z+1.4,.22,.22,.25,skin)
            for side in [-.12,.12]:box('WSP Passant jambe',px+side,py,z,.14,.18,.55,metal)
            people+=1
    return {'facade_windows':window_count,'water_quads':len(fs),'traffic_route_points':len(points),'furniture':furniture,'pedestrians':people,'traffic_collision_check':'route cells exclude expanded building footprints'}