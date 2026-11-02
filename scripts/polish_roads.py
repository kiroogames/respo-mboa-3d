# Libère la chaussée : à lancer dans Blender sur public/models/mboa-wsp.glb importé.
# Déplace le moins possible chaque bâtiment posé sur la route peinte, sans le poser sur un voisin, sur l'eau ou sur une pente.
# Le masque de route vient de scripts/extract-road-network.py (road_mask), les coordonnées sont celles du monde glTF.
import bpy, json, math, re
import numpy as np
from pathlib import Path

SKIP = re.compile(r'^WSP (Arbre|Couronne|Tronc|Passant|Pied|Assise banc|Dossier|Sol|Socle|Surface|Horizon|Pont|Rive|Pile|Ligne|Touche|Acces|Bordure|Traffic|Assise|Baies|Cadres|Pelouse|Lanterne|Lampadaire|Arbuste|Bac)|^(Voiture|Moto|Bus|Avion)$')
# Lieux trop étendus ou liés au relief : ils restent en place.
FIXED = {'stadium', 'presidence', 'Mougabiang statue', 'marché', 'office2'}
# Le marché est un ensemble ouvert et le panneau se place à part (place_billboards) : ils ne forment pas de groupe.
LOOSE = {'marché', 'panneau PUB', 'Panneau 22 export'}
MARGINS, SEARCH = (1.0, .4, 0.0), 34


class Roads:
    def __init__(self, mask, meta, network):
        self.mask, self.cu, self.cv = mask, meta['cu'], meta['cv']
        self.h, self.w = mask.shape
        # On ne garde que la peinture proche du réseau : les parcelles de même couleur ne sont pas des routes.
        near = np.zeros_like(mask)
        for path in network['paths']:
            for a, b in zip(path, path[1:]):
                n = max(2, int(math.dist(a, b) / .8))
                for t in np.linspace(0, 1, n):
                    i, j = self.pixel(a[0] + (b[0] - a[0]) * t, -(a[1] + (b[1] - a[1]) * t))
                    if 0 <= i < self.h and 0 <= j < self.w:
                        near[max(0, i - 12):i + 13, max(0, j - 12):j + 13] = True
        self.road = mask & near
        self.heights = network['heights']

    def pixel(self, x, y):
        z = -y
        return int((x * self.cv[0] + z * self.cv[1] + self.cv[2]) * self.h), int((x * self.cu[0] + z * self.cu[1] + self.cu[2]) * self.w)

    def height(self, x, y):
        g = self.heights
        j, i = int(round((x - g['x0']) / g['step'])), int(round((-y - g['z0']) / g['step']))
        return g['values'][max(0, min(g['rows'] - 1, i)) * g['cols'] + max(0, min(g['cols'] - 1, j))]


def hull(points):
    pts = sorted(set((round(p[0], 2), round(p[1], 2)) for p in points))
    if len(pts) < 3: return pts
    def half(seq):
        out = []
        for p in seq:
            while len(out) > 1 and (out[-1][0] - out[-2][0]) * (p[1] - out[-2][1]) - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0]) <= 0: out.pop()
            out.append(p)
        return out[:-1]
    return half(pts) + half(pts[::-1])


def footprint(obj):
    m = obj.matrix_world
    return [tuple((m @ v.co)[:2]) for v in obj.data.vertices]


def raster(roads, poly, dx=0, dy=0, margin=0.0):
    """Pixels du masque couverts par le polygone convexe, élargi de margin."""
    p = np.array(poly)
    c = p.mean(0)
    grown = c + (p - c) * (1 + margin / max(.5, np.hypot(*(p - c).T).mean())) + (dx, dy)
    z = -grown[:, 1]
    u = (grown[:, 0] * roads.cu[0] + z * roads.cu[1] + roads.cu[2]) * roads.w
    v = (grown[:, 0] * roads.cv[0] + z * roads.cv[1] + roads.cv[2]) * roads.h
    j0, j1, i0, i1 = int(u.min()), int(u.max()) + 1, int(v.min()), int(v.max()) + 1
    if i0 < 0 or j0 < 0 or i1 >= roads.h or j1 >= roads.w: return None
    jj, ii = np.meshgrid(np.arange(j0, j1 + 1), np.arange(i0, i1 + 1))
    inside = np.ones(jj.shape, bool)
    # Le signe dépend du sens du polygone après passage en pixels.
    sign = np.sign(sum(u[k] * v[(k + 1) % len(u)] - u[(k + 1) % len(u)] * v[k] for k in range(len(u)))) or 1
    for k in range(len(u)):
        a, b = (u[k], v[k]), (u[(k + 1) % len(u)], v[(k + 1) % len(u)])
        inside &= sign * ((b[0] - a[0]) * (ii - a[1]) - (b[1] - a[1]) * (jj - a[0])) >= 0
    return ii[inside], jj[inside]


def groups():
    """Bâtiments qui se chevauchent franchement : ils forment un seul ensemble et bougent ensemble."""
    items = [o for o in bpy.data.objects if o.type == 'MESH' and o.data.vertices and not SKIP.search(o.name) and o.name != 'WSP Assise presidence']
    boxes = {}
    for o in items:
        f = np.array(footprint(o))
        boxes[o.name] = (*f.min(0), *f.max(0))
    parent = {o.name: o.name for o in items}
    def find(a):
        while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
        return a
    names = list(boxes)
    for i, a in enumerate(names):
        if a in LOOSE: continue
        A = boxes[a]; area_a = (A[2] - A[0]) * (A[3] - A[1])
        for b in names[i + 1:]:
            if b in LOOSE: continue
            B = boxes[b]
            w, h = min(A[2], B[2]) - max(A[0], B[0]), min(A[3], B[3]) - max(A[1], B[1])
            if w > 0 and h > 0 and w * h > .22 * min(area_a, (B[2] - B[0]) * (B[3] - B[1])): parent[find(a)] = find(b)
    out = {}
    for n in names: out.setdefault(find(n), []).append(n)
    return list(out.values())


def attached(name):
    """Fenêtres, cadres et socle fabriqués pour ce bâtiment."""
    return [o for o in (bpy.data.objects.get(f'WSP {kind} {name}') for kind in ('Baies', 'Cadres', 'Assise')) if o]


def solve(roads, apply=True):
    groups_ = groups()
    info = []
    occupied = np.zeros(roads.mask.shape, bool)
    for names in groups_:
        pts = [p for n in names for p in footprint(bpy.data.objects[n])]
        poly = hull(pts)
        hit = raster(roads, poly)
        over = int(roads.road[hit].sum()) if hit else 0
        info.append({'names': names, 'poly': poly, 'over': over, 'pixels': len(hit[0]) if hit else 0})
        # Les panneaux se placent après les bâtiments : ils ne leur bloquent pas la place.
        if hit and not (set(names) & {'panneau PUB', 'Panneau 22 export'}): occupied[hit] = True
    moved, stuck = [], []
    # Les grands ensembles d'abord : ils ont le moins de possibilités.
    todo = sorted((g for g in info if g['over'] > 0 and not (set(g['names']) & FIXED)), key=lambda g: -g['pixels'])
    offsets = sorted(((dx, dy) for dx in range(-SEARCH, SEARCH + 1) for dy in range(-SEARCH, SEARCH + 1)), key=lambda d: d[0] ** 2 + d[1] ** 2)
    for g in todo:
        here = raster(roads, g['poly'])
        if here: occupied[here] = False
        cx, cy = np.array(g['poly']).mean(0)
        best = None
        for margin in MARGINS:
            for dx, dy in offsets:
                if not dx and not dy: continue
                cells = raster(roads, g['poly'], dx, dy, margin)
                if cells is None or roads.road[cells].any() or occupied[cells].any(): continue
                if abs(roads.height(cx + dx, cy + dy) - roads.height(cx, cy)) > .35: continue
                best = (dx, dy); break
            if best: break
        if best is None:
            stuck.append({'names': g['names'], 'over': g['over']})
            if here: occupied[here] = True
            continue
        cells = raster(roads, g['poly'], *best)
        occupied[cells] = True
        moved.append({'names': g['names'], 'move': best, 'over': g['over'], 'poly': g['poly']})
        if apply:
            for n in g['names']:
                for o in [bpy.data.objects[n], *attached(n)]:
                    o.location.x += best[0]; o.location.y += best[1]
    return {'groups': len(info), 'moved': moved, 'stuck': stuck, 'occupied': occupied}


def centerline(roads_network):
    segs = np.array([[a[0], -a[1], b[0], -b[1]] for p in roads_network['paths'] for a, b in zip(p, p[1:])], float)
    A, B = segs[:, :2], segs[:, 2:]; AB = B - A; L = (AB ** 2).sum(1) + 1e-9
    def nearest(q):
        q = np.array(q, float)
        t = np.clip(((q - A) * AB).sum(1) / L, 0, 1); P = A + AB * t[:, None]; d = np.hypot(*(P - q).T); i = int(d.argmin())
        return float(d[i]), P[i]
    return nearest


def rotate_about(obj, center, angle):
    from mathutils import Matrix, Vector
    c = Vector((center[0], center[1], 0))
    obj.matrix_world = Matrix.Translation(c) @ Matrix.Rotation(angle, 4, 'Z') @ Matrix.Translation(-c) @ obj.matrix_world


def place_billboard(name, roads, occupied, nearest, clearance=1.0, reach=40):
    """Panneau dégagé de tout bâtiment, en bord de route et tourné vers elle."""
    from mathutils import Vector
    bpy.context.view_layer.update()
    obj = bpy.data.objects[name]
    pts = np.array(footprint(obj)); center = (pts.min(0) + pts.max(0)) / 2
    # Le panneau est plat : sa normale horizontale est l'axe le moins étendu de ses sommets.
    values, vectors = np.linalg.eigh(np.cov((pts - center).T)); normal = vectors[:, 0]; width = math.sqrt(max(values[1], 1e-6)) * 2
    own = raster(roads, hull(pts))
    if own: occupied[own] = False
    tries = sorted(((dx, dy) for dx in range(-reach, reach + 1) for dy in range(-reach, reach + 1)), key=lambda d: d[0] ** 2 + d[1] ** 2)
    for dx, dy in tries:
        q = center + (dx, dy); dist, foot = nearest(q)
        if not 5.5 <= dist <= 13: continue
        facing = np.array(foot) - q; facing /= np.hypot(*facing)
        # Empreinte après rotation : le panneau, parallèle à la route, plus une marge autour.
        side = np.array((-facing[1], facing[0])); half = float(np.abs((pts - center) @ vectors[:, 1]).max()) + clearance; thick = 1.0 + clearance
        rect = [q + side * half + facing * thick, q - side * half + facing * thick, q - side * half - facing * thick, q + side * half - facing * thick]
        cells = raster(roads, [tuple(c) for c in rect])
        if cells is None or occupied[cells].any() or roads.road[cells].any(): continue
        if normal @ facing < 0: normal = -normal
        angle = math.atan2(facing[1], facing[0]) - math.atan2(normal[1], normal[0])
        obj.location.x += dx; obj.location.y += dy
        bpy.context.view_layer.update()
        rotate_about(obj, q, angle)
        bpy.context.view_layer.update()
        occupied[cells] = True
        return {'name': name, 'move': (dx, dy), 'turn': round(math.degrees(angle)), 'road': round(dist, 1)}
    if own: occupied[own] = True
    return {'name': name, 'move': None}


def clear_props(roads, occupied, nearest, keep=4.8):
    """Mobilier, lampadaires et véhicules garés : hors des voies, et arbres retirés des bâtiments déplacés."""
    from mathutils import Vector
    bpy.context.view_layer.update()
    removed = 0
    for tree in [o for o in bpy.data.objects if o.name.startswith('WSP Arbre')]:
        c = sum((tree.matrix_world @ Vector(b) for b in tree.bound_box), Vector()) / 8
        i, j = roads.pixel(c.x, c.y)
        if 0 <= i < roads.h and 0 <= j < roads.w and (occupied[i, j] or roads.road[i, j]):
            suffix = tree.name[len('WSP Arbre'):]
            for n in ('WSP Arbre', 'WSP Couronne secondaire', 'WSP Tronc'):
                o = bpy.data.objects.get(n + suffix)
                if o: bpy.data.objects.remove(o); removed += 1
    props = [o for o in bpy.data.objects if o.type == 'MESH' and re.match(r'^(WSP (Lampadaire|Lanterne|Arbuste|Bac plante|Assise banc|Dossier banc|Pied banc|Passant)|Voiture$|Moto$|Bus$)', o.name)]
    centers = {o.name: (sum((o.matrix_world @ Vector(b) for b in o.bound_box), Vector()) / 8) for o in props}
    clusters, seen = [], set()
    for o in props:
        if o.name in seen: continue
        stack, members = [o], []
        seen.add(o.name)
        while stack:
            a = stack.pop(); members.append(a)
            for b in props:
                if b.name not in seen and (centers[a.name].xy - centers[b.name].xy).length < 1.6: seen.add(b.name); stack.append(b)
        clusters.append(members)
    moved = 0
    for members in clusters:
        c = np.mean([centers[m.name].xy for m in members], axis=0); d, foot = nearest(c)
        i, j = roads.pixel(*c)
        on_road = 0 <= i < roads.h and 0 <= j < roads.w and roads.road[i, j]
        if d >= keep and not on_road: continue
        away = c - foot; n = np.hypot(*away)
        if n < 1e-3: away, n = np.array((1., 0.)), 1.
        away /= n
        for extra in np.arange(max(keep - d, 1.), max(keep - d, 1.) + 16, 1.):
            q = c + away * extra
            if nearest(q)[0] < keep: continue
            i, j = roads.pixel(*q)
            if not (0 <= i < roads.h and 0 <= j < roads.w) or occupied[i, j] or roads.road[i, j]: continue
            for m in members: m.location.x += q[0] - c[0]; m.location.y += q[1] - c[1]
            moved += 1; break
    return {'trees_removed': removed // 3, 'prop_clusters': len(clusters), 'props_moved': moved}
