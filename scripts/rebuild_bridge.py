# Refait le pont dans Blender, sur le GLB importé : simple pont de béton, bas et usé, centré sur la voie de circulation.
# Le tablier garde sa matière « WSP Tablier du pont » et des sommets rapprochés : extract-road-network.py y lit la hauteur de la route.
import bpy, bmesh, math, random, re
from mathutils import Vector

# Départ à la jonction de la route sur la rive et arrivée au tunnel, en coordonnées Blender (x, y). Mêmes valeurs dans extract-road-network.py.
START, END = (139.81, 145.67), (216.91, 274.37)
ROAD, WALK, THICK = 8.6, .9, .8
RISE, RAMP_IN, RAMP_OUT, ARRIVAL = 3.2, 30.0, 20.0, 1.2


def srgb(h): return [(lambda c: c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4)(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5)]


def material(name, color):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*srgb(color), 1); p.inputs['Roughness'].default_value = .9
    m.diffuse_color = (*srgb(color), 1)
    return m


class Parts:
    def __init__(self, name, mat): self.name, self.mat, self.v, self.f = name, mat, [], []
    def loft(self, rings, closed=True):
        """Anneaux de même nombre de points, reliés entre eux et fermés aux deux bouts."""
        s = len(self.v); n = len(rings[0])
        for ring in rings: self.v += ring
        for k in range(len(rings) - 1):
            for i in range(n):
                j = (i + 1) % n; a = s + k * n
                self.f.append((a + i, a + j, a + n + j, a + n + i))
        if closed:
            self.f.append(tuple(s + i for i in reversed(range(n))))
            self.f.append(tuple(s + (len(rings) - 1) * n + i for i in range(n)))
    def beam(self, p, q, w, h=None):
        """Poutre de section carrée entre deux points."""
        h = h or w; a, b = Vector(p), Vector(q); d = (b - a).normalized()
        u = d.cross(Vector((0, 0, 1)))
        if u.length < 1e-4: u = Vector((1, 0, 0))
        u.normalize(); t = u.cross(d).normalized()
        ring = lambda c: [tuple(c + u * x * w / 2 + t * y * h / 2) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        self.loft([ring(a), ring(b)])
    def column(self, x, y, z0, z1, r0, r1=None, n=10):
        r1 = r0 if r1 is None else r1
        self.loft([[(x + r * math.cos(math.tau * i / n), y + r * math.sin(math.tau * i / n), z) for i in range(n)] for z, r in ((z0, r0), (z1, r1))])
    def build(self):
        mesh = bpy.data.meshes.new(self.name); mesh.from_pydata(self.v, [], self.f); mesh.update(); mesh.materials.append(self.mat)
        bm = bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(mesh); bm.free()
        obj = bpy.data.objects.new(self.name, mesh); bpy.context.collection.objects.link(obj)
        return obj


def rebuild():
    for o in [o for o in bpy.data.objects if re.match(r'WSP (Pont|Rive pont|Pile du pont)', o.name)]: bpy.data.objects.remove(o)
    a, b = Vector(START), Vector(END); length = (b - a).length; d = (b - a).normalized(); n = Vector((-d.y, d.x))
    def smooth(t): t = max(0, min(1, t)); return t * t * (3 - 2 * t)
    def top(s): return .08 + RISE * smooth(s / RAMP_IN) - (RISE - ARRIVAL) * smooth((s - (length - RAMP_OUT)) / RAMP_OUT)
    def at(s, side=0.0, z=0.0):
        p = a + d * s + n * side; return (p.x, p.y, top(s) + z)
    half = ROAD / 2 + WALK
    stations = [i * 2.0 for i in range(int(length / 2) + 1)] + [length]
    random.seed(4)

    road, walk, rail = Parts('WSP Pont', material('WSP Tablier du pont', '#6F7276')), Parts('WSP Rive pont trottoir', material('WSP Trottoir du pont', '#B9B3A5')), Parts('WSP Rive pont', material('WSP Garde corps', '#A9A497'))
    under = Parts('WSP Pile du pont', material('WSP Beton du pont', '#A39C8E')); patch = Parts('WSP Pont rustines', material('WSP Rustines du pont', '#4C4F52')); holes = Parts('WSP Pont trous', material('WSP Trous du pont', '#35332F'))
    land = Parts('WSP Pont rive', material('WSP Terre du pont', '#C9834F')); green = Parts('WSP Pont rive vert', material('WSP Herbe du pont', '#6E9F4C')); trunk = Parts('WSP Pont rive troncs', material('WSP Troncs du pont', '#6F4A2E'))

    # Tablier : la bande de roulement porte la hauteur de la route, avec des sommets au centre, aux voies et aux bords.
    across = (-ROAD / 2, -ROAD / 4, 0, ROAD / 4, ROAD / 2)
    road.loft([[at(s, x) for x in across] + [at(s, ROAD / 2, -THICK), at(s, -ROAD / 2, -THICK)] for s in stations])
    for side in (-1, 1):
        lo, hi = side * ROAD / 2, side * half
        walk.loft([[at(s, lo, .12), at(s, hi, .12), at(s, hi, -THICK), at(s, lo, -THICK)] for s in stations])
        # Parapet plein en béton, par panneaux, dont quelques-uns manquent.
        s = 0.0
        while s < length - 3:
            if random.random() > .1:
                u = min(length, s + 2.8)
                rail.loft([[at(t, hi - side * .1, .12), at(t, hi + side * .1, .12), at(t, hi + side * .1, .78), at(t, hi - side * .1, .78)] for t in (s, u)])
            else:
                rail.beam(at(s, hi, .1), at(s, hi, .7), .18)
            s += 3.0
    # Pas de marquage : seulement des rustines et des nids-de-poule sur la chaussée.
    s = 5.0
    while s < length - 4:
        span = random.uniform(1.6, 5.5); side = random.uniform(-2.6, 2.6); w = random.uniform(.8, 2.6)
        patch.loft([[at(u, side - w / 2, .02), at(u, side + w / 2, .02), at(u, side + w / 2, .004), at(u, side - w / 2, .004)] for u in (s, s + span)])
        s += span + random.uniform(4, 13)
    s = 3.0
    while s < length - 3:
        x, y, z = at(s, random.uniform(-3.8, 3.8), .012); holes.column(x, y, z, z + .012, random.uniform(.18, .62), n=7)
        s += random.expovariate(1 / 6.0) + 1

    # Piles simples : deux poteaux et un chevêtre, tous les 15 m.
    s = 15.0
    while s < length - 5:
        for side in (-1, 1):
            x, y, z = at(s, side * 3.2, -THICK - .4); under.column(x, y, -3, z, .65, .55, n=8)
        under.beam(at(s, -half + .2, -THICK - .2), at(s, half - .2, -THICK - .2), .7, .5)
        s += 15.0

    # Rive d'en face : terre basse et arbres, sous lesquels la route disparaît.
    c = a + d * (length + 13); e = top(length)
    for r0, r1, z0, z1 in ((27, 22, -3, e - .9), (22, 18, e - .9, e - .35)):
        land.column(c.x, c.y, z0, z1, r0, r1, n=16)
    green.column(c.x + d.x * 3, c.y + d.y * 3, e - .35, e - .2, 17.5, 17, n=16)
    for side, off, radius, high in ((-.5, -7, 3.4, 5.2), (.5, -7, 3.2, 5.0), (0, -5, 3.8, 6.2), (-1.5, -2, 3.3, 5.0), (1.5, -3, 3.6, 5.6), (-2.7, 3, 3.2, 4.8), (2.6, 2, 3.0, 4.6), (-.8, 5, 4.0, 6.0), (1.2, 7, 3.6, 5.4), (-2.2, 11, 3.0, 4.6), (2.2, 12, 3.2, 5.0)):
        p = c + n * side * 4.2 + d * off
        trunk.column(p.x, p.y, e - .3, e + high - 1.2, .28, .2, n=6)
        green.column(p.x, p.y, e + high - 1.6, e + high + 1.7, radius, radius * .22, n=9)
    # La chaussée entre sous les arbres.
    road.loft([[(c2.x + n.x * x, c2.y + n.y * x, e - .02) for x in across] + [(c2.x + n.x * ROAD / 2, c2.y + n.y * ROAD / 2, e - .5), (c2.x - n.x * ROAD / 2, c2.y - n.y * ROAD / 2, e - .5)] for c2 in (a + d * length, a + d * (length + 7))])

    made = [p.build() for p in (road, walk, rail, under, patch, holes, land, green, trunk)]
    return {'length': round(length, 1), 'objects': [o.name for o in made], 'faces': sum(len(o.data.polygons) for o in made)}
