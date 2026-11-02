# Réseau électrique aérien, dans Blender : poteaux en bois un peu de travers et fils qui pendent, le long des trottoirs de road-network.json.
# Les noms contiennent « reseau » : extract-road-network.py ne les compte pas comme des bâtiments.
import bpy, bmesh, json, math, random
from mathutils import Vector

SPACING, POLE_HEIGHT, SAG = 21.0, 7.2, .7


def srgb(h): return [(lambda c: c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4)(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5)]


def material(name, color):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*srgb(color), 1); p.inputs['Roughness'].default_value = .95
    return m


class Parts:
    def __init__(self, name, mat): self.name, self.mat, self.v, self.f = name, mat, [], []
    def beam(self, p, q, w, h=None):
        h = h or w; a, b = Vector(p), Vector(q); d = (b - a).normalized()
        u = d.cross(Vector((0, 0, 1)))
        if u.length < 1e-4: u = Vector((1, 0, 0))
        u.normalize(); t = u.cross(d).normalized(); s = len(self.v)
        for c in (a, b):
            for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                self.v.append(tuple(c + u * x * w / 2 + t * y * h / 2))
        for i in range(4):
            j = (i + 1) % 4; self.f.append((s + i, s + j, s + 4 + j, s + 4 + i))
        self.f += [(s + 3, s + 2, s + 1, s), (s + 4, s + 5, s + 6, s + 7)]
    def build(self):
        mesh = bpy.data.meshes.new(self.name); mesh.from_pydata(self.v, [], self.f); mesh.update(); mesh.materials.append(self.mat)
        bm = bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(mesh); bm.free()
        obj = bpy.data.objects.new(self.name, mesh); bpy.context.collection.objects.link(obj)
        return obj


def build(network_path):
    for name in ('WSP Poteaux reseau', 'WSP Fils reseau', 'WSP Boitiers reseau'):
        old = bpy.data.objects.get(name)
        if old: bpy.data.objects.remove(old)
    random.seed(9)
    network = json.load(open(network_path, encoding='utf8')); g = network['heights']
    def height(x, y):
        z = -y; j, i = round((x - g['x0']) / g['step']), round((z - g['z0']) / g['step'])
        return g['values'][max(0, min(g['rows'] - 1, i)) * g['cols'] + max(0, min(g['cols'] - 1, j))]
    poles, wires, boxes = Parts('WSP Poteaux reseau', material('WSP Bois des poteaux', '#6B4E36')), Parts('WSP Fils reseau', material('WSP Fils electriques', '#26282B')), Parts('WSP Boitiers reseau', material('WSP Transformateurs', '#8E9599'))
    placed = []
    def head(p): return Vector((p[0] + p[3], p[1] + p[4], p[2] + POLE_HEIGHT * p[5]))
    count = 0
    for run in sorted(network['walks'], key=len, reverse=True):
        # Blender : y = -z. Le pont n'a pas de poteaux, et un seul côté de chaque rue en porte.
        points = [(x, -z) for x, z in run if not (x > 125 and z < -135)]
        if len(points) < 5 or all(min(math.dist(q, o) for o in placed) < 9 for q in points[::2] if placed) and placed: continue
        cum = [0.0]
        for a, b in zip(points, points[1:]): cum.append(cum[-1] + math.dist(a, b))
        line, s = [], 0.0
        while s <= cum[-1]:
            i = next((k for k in range(1, len(cum)) if cum[k] >= s), len(cum) - 1); t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) or 1)
            x, y = points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t
            if not placed or min(math.dist((x, y), o) for o in placed) > 9:
                # Chaque poteau penche un peu, et sa hauteur varie.
                line.append((x, y, height(x, y), random.uniform(-.28, .28), random.uniform(-.28, .28), random.uniform(.92, 1.08)))
            s += SPACING * random.uniform(.85, 1.15)
        for p in line:
            top = head(p); count += 1
            poles.beam((p[0], p[1], p[2]), tuple(top), .2)
            forward = Vector((1, 0, 0)); index = line.index(p)
            other = line[index + 1] if index + 1 < len(line) else line[index - 1] if index else None
            if other: forward = Vector((other[0] - p[0], other[1] - p[1], 0)).normalized()
            arm = Vector((-forward.y, forward.x, 0))
            poles.beam(tuple(top - Vector((0, 0, .45)) - arm * .85), tuple(top - Vector((0, 0, .45)) + arm * .85), .12)
            if random.random() < .14:
                c = top - Vector((0, 0, 1.6)); boxes.beam(tuple(c - Vector((0, 0, .45))), tuple(c + Vector((0, 0, .45))), .55)
        # Fils : trois conducteurs qui pendent entre deux poteaux, plus parfois un fil en trop qui passe de travers.
        for p, q in zip(line, line[1:]):
            if math.dist(p[:2], q[:2]) > SPACING * 2: continue
            pa, qa = head(p) - Vector((0, 0, .45)), head(q) - Vector((0, 0, .45)); dirn = Vector((q[0] - p[0], q[1] - p[1], 0)).normalized(); arm = Vector((-dirn.y, dirn.x, 0))
            for lateral in (-.78, 0, .78):
                sag = SAG * random.uniform(.7, 1.5); steps = 7; previous = None
                for k in range(steps + 1):
                    t = k / steps; c = pa.lerp(qa, t) + arm * lateral - Vector((0, 0, sag * 4 * t * (1 - t)))
                    if previous is not None: wires.beam(tuple(previous), tuple(c), .055)
                    previous = c
        placed += [(p[0], p[1]) for p in line]
    made = [x.build() for x in (poles, wires, boxes)]
    return {'poles': count, 'faces': sum(len(o.data.polygons) for o in made)}
