# Embellit la ville dans Blender, sur le GLB importé : façades de jour au lieu des textures de nuit, nouveaux véhicules.
# Les véhicules ont l'avant vers +Y (Blender), une seule matière et une palette : le blanc prend la couleur de chaque voiture en jeu.
import bpy, colorsys, math
import numpy as np

# Une façade garde ses zones : on repart de la teinte de nuit, éclaircie et adoucie, en laissant intacts enseignes et vitrines.
DAY_FALLBACK = {'Rue_joka1': (.93, .78, .60), 'Rue_joka3': (.95, .90, .78), 'Rue_joka4': (.72, .85, .90)}


def base_image(material):
    node = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    link = node.inputs['Base Color'].links[0].from_node if node and node.inputs['Base Color'].is_linked else None
    stack = [link] if link else []
    while stack:
        n = stack.pop()
        if n.type == 'TEX_IMAGE': return n.image
        stack += [i.links[0].from_node for i in n.inputs if i.is_linked]
    return None


def to_day(image, fallback):
    w, h = image.size
    px = np.empty(w * h * 4, np.float32); image.pixels.foreach_get(px); px = px.reshape(-1, 4)
    rgb = px[:, :3]
    lum = rgb @ np.array((.2126, .7152, .0722))
    mx, mn = rgb.max(1), rgb.min(1)
    sat = np.where(mx > 1e-3, (mx - mn) / np.maximum(mx, 1e-3), 0)
    # Teinte conservée pour les zones colorées, couleur de secours pour les zones presque noires.
    hue = np.array([colorsys.rgb_to_hsv(*c)[0] for c in rgb[::1]])
    pastel = np.array([colorsys.hsv_to_rgb(a, .34, .86) for a in hue])
    colored = np.clip((mx - .035) / .05, 0, 1) * np.clip(sat / .25, 0, 1)
    wall = pastel * colored[:, None] + np.array(fallback) * (1 - colored[:, None])
    grain = np.clip(lum / max(np.percentile(lum, 60), .02), .75, 1.2)
    # Les enseignes et les vitrines (pixels clairs) restent, à peine relevées.
    keep = np.clip((lum - .2) / .25, 0, 1)[:, None]
    px[:, :3] = wall * grain[:, None] * (1 - keep) + np.power(np.clip(rgb, 0, 1), .8) * keep
    out = bpy.data.images.new(image.name.replace('_Night', '') + ' Jour', w, h, alpha=True)
    out.pixels.foreach_set(px.ravel()); out.pack(); out.file_format = 'PNG'
    return out


def lift(image, gamma=.72, gain=1.08):
    """Éclaircit une texture trop sombre sans en changer le dessin."""
    w, h = image.size
    px = np.empty(w * h * 4, np.float32); image.pixels.foreach_get(px); px = px.reshape(-1, 4)
    px[:, :3] = np.clip(np.power(np.clip(px[:, :3], 0, 1), gamma) * gain, 0, 1)
    out = bpy.data.images.new(image.name + ' clair', w, h, alpha=True)
    out.pixels.foreach_set(px.ravel()); out.pack(); out.file_format = 'PNG'
    return out


def swap_image(material, image):
    for n in material.node_tree.nodes:
        if n.type == 'TEX_IMAGE': n.image = image


def brighten_facades():
    done = []
    for name, fallback in DAY_FALLBACK.items():
        m = bpy.data.materials.get(name)
        if m and base_image(m): swap_image(m, to_day(base_image(m), fallback)); done.append(name)
    for name in ('Rue_joka2', 'Fapmous'):
        m = bpy.data.materials.get(name)
        if m and base_image(m): swap_image(m, lift(base_image(m))); done.append(name)
    return done


# Palette en cases : les faces échantillonnent le centre d'une case.
PALETTE = {'paint': (1, 1, 1), 'glass': (.10, .17, .22), 'tire': (.05, .05, .055), 'hub': (.62, .64, .66), 'dark': (.13, .13, .14),
           'head': (1, .97, .82), 'tail': (.75, .07, .05), 'sign': (1, .98, .9), 'plate': (.92, .92, .86), 'seat': (.28, .24, .2)}
KEYS = list(PALETTE)


def palette_image():
    img = bpy.data.images.get('WSP Palette vehicules')
    if img: return img
    n = len(KEYS); img = bpy.data.images.new('WSP Palette vehicules', n, 1, alpha=False)
    def srgb(c): return c * 12.92 if c <= .0031308 else 1.055 * c ** (1 / 2.4) - .055
    img.pixels.foreach_set(np.array([v for k in KEYS for v in (*PALETTE[k], 1)], np.float32))
    img.pack(); img.file_format = 'PNG'
    return img


def vehicle_material():
    m = bpy.data.materials.get('WSP Vehicule')
    if m: return m
    m = bpy.data.materials.new('WSP Vehicule'); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'); p.inputs['Roughness'].default_value = .55
    t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = palette_image(); t.interpolation = 'Closest'
    m.node_tree.links.new(t.outputs['Color'], p.inputs['Base Color'])
    return m


class Builder:
    def __init__(self): self.v, self.f, self.c = [], [], []
    def face(self, idx, color): self.f.append(idx); self.c.append(color)
    def loft(self, stations, color, caps=True, top=None):
        """stations : (y, demi-largeur bas, demi-largeur haut, z bas, z haut), de l'arrière vers l'avant."""
        start = len(self.v)
        for y, wb, wt, z0, z1 in stations:
            self.v += [(-wb, y, z0), (wb, y, z0), (wt, y, z1), (-wt, y, z1)]
        for k in range(len(stations) - 1):
            a = start + k * 4; b = a + 4
            self.face((a, a + 1, b + 1, b), color)          # dessous
            self.face((a + 1, a + 2, b + 2, b + 1), color)  # droite
            self.face((a + 2, a + 3, b + 3, b + 2), top or color)  # dessus
            self.face((a + 3, a, b, b + 3), color)          # gauche
        if caps:
            self.face((start + 3, start + 2, start + 1, start), color)
            e = start + (len(stations) - 1) * 4
            self.face((e, e + 1, e + 2, e + 3), color)
    def box(self, x, y, z, w, d, h, color):
        self.loft([(y - d / 2, w / 2, w / 2, z, z + h), (y + d / 2, w / 2, w / 2, z, z + h)], color)
        for i in range(len(self.v) - 8, len(self.v)):
            p = self.v[i]; self.v[i] = (p[0] + x, p[1], p[2])
    def wheel(self, x, y, r, w, n=12):
        for part, radius, width, color in (('tire', r, w, 'tire'), ('hub', r * .55, w + .03, 'hub')):
            start = len(self.v)
            for side in (-1, 1):
                for i in range(n):
                    a = math.tau * i / n
                    self.v.append((x + side * width / 2, y + radius * math.cos(a), r + radius * math.sin(a)))
            for i in range(n):
                j = (i + 1) % n
                self.face((start + i, start + j, start + n + j, start + n + i), color)
            self.face(tuple(start + i for i in range(n)), color)
            self.face(tuple(start + n + i for i in reversed(range(n))), color)
    def build(self, name):
        mesh = bpy.data.meshes.new(name); mesh.from_pydata(self.v, [], self.f); mesh.update()
        mesh.materials.append(vehicle_material())
        uv = mesh.uv_layers.new(name='UVMap').data
        for poly, color in zip(mesh.polygons, self.c):
            u = (KEYS.index(color) + .5) / len(KEYS)
            for loop in poly.loop_indices: uv[loop].uv = (u, .5)
        # Sens des faces cohérent, quelle que soit la façon dont elles ont été décrites.
        import bmesh
        bm = bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(mesh); bm.free()
        obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj)
        return obj


def lights(b, hw, y_front, y_back, z, h):
    for side in (-1, 1):
        b.box(side * (hw - .24), y_front, z, .36, .05, h, 'head')
        b.box(side * (hw - .22), y_back, z, .34, .05, h, 'tail')


def wheels(b, hw, y_front, y_back, r=.33, w=.24):
    for y in (y_front, y_back):
        for side in (-1, 1): b.wheel(side * (hw - w / 2 + .02), y, r, w)


def pillars(b, y_rear, y_front, hw_low, hw_top, z0, z1, ys):
    for y in ys:
        t = (y - y_rear) / (y_front - y_rear)
        for side in (-1, 1): b.box(side * ((hw_low + hw_top) / 2 + .01), y, z0, .07, .09, z1 - z0, 'paint')


def sedan():
    """Berline de taxi : capot et coffre distincts, habitacle vitré, enseigne de toit."""
    b, hw = Builder(), .95
    b.loft([(-2.15, hw - .12, hw - .2, .3, .78), (-1.9, hw, hw - .06, .24, .94), (-1.0, hw, hw - .02, .22, 1.0), (1.05, hw, hw - .02, .22, .97), (1.9, hw, hw - .08, .24, .82), (2.2, hw - .14, hw - .26, .3, .68)], 'paint')
    b.loft([(-1.5, hw - .1, hw - .26, .96, 1.46), (-1.05, hw - .08, hw - .24, .98, 1.52), (.35, hw - .08, hw - .24, .98, 1.52), (.98, hw - .08, hw - .3, .96, 1.0)], 'glass', top='glass')
    b.loft([(-1.12, hw - .24, hw - .28, 1.5, 1.56), (.38, hw - .24, hw - .28, 1.5, 1.56)], 'paint')
    pillars(b, -1.5, .98, hw - .08, hw - .24, 1.0, 1.5, (-1.08, -.32, .36))
    b.box(0, -.3, 1.56, .55, .26, .17, 'sign')
    b.box(0, 2.16, .3, hw * 1.5, .14, .13, 'dark'); b.box(0, -2.17, .32, hw * 1.5, .12, .12, 'dark')
    b.box(0, -2.2, .47, .42, .03, .12, 'plate'); b.box(0, 2.2, .52, hw * 1.1, .03, .13, 'dark')
    lights(b, hw, 2.2, -2.18, .58, .14)
    wheels(b, hw, 1.32, -1.32)
    return b.build('WSP Traffic prototype')


def suv():
    """Véhicule haut : cabine longue et galerie de toit."""
    b, hw = Builder(), 1.0
    b.loft([(-2.2, hw - .08, hw - .1, .36, 1.1), (1.15, hw, hw - .03, .3, 1.12), (2.0, hw, hw - .06, .32, 1.02), (2.25, hw - .1, hw - .16, .36, .86)], 'paint')
    b.loft([(-2.15, hw - .1, hw - .2, 1.08, 1.86), (.55, hw - .08, hw - .2, 1.1, 1.86), (1.18, hw - .08, hw - .3, 1.1, 1.14)], 'glass')
    b.loft([(-2.17, hw - .18, hw - .22, 1.84, 1.92), (.58, hw - .18, hw - .22, 1.84, 1.92)], 'paint')
    pillars(b, -2.15, 1.18, hw - .08, hw - .2, 1.1, 1.85, (-2.12, -1.0, .1, .56))
    for side in (-1, 1): b.box(side * (hw - .3), -.8, 1.92, .07, 2.2, .08, 'dark')
    b.box(0, 2.23, .36, hw * 1.7, .14, .16, 'dark'); b.box(0, -2.22, .36, hw * 1.7, .12, .16, 'dark')
    b.box(0, 2.27, .68, hw * 1.2, .03, .2, 'dark'); b.box(0, -2.25, .55, .42, .03, .12, 'plate')
    lights(b, hw, 2.26, -2.23, .76, .16)
    wheels(b, hw, 1.38, -1.38, r=.4, w=.28)
    return b.build('WSP Traffic prototype SUV')


def minibus():
    """Minibus de ligne : long, haut, grandes vitres, galerie à bagages."""
    b, hw = Builder(), 1.08
    b.loft([(-2.9, hw - .04, hw - .06, .32, 1.28), (2.15, hw, hw - .04, .3, 1.26), (2.75, hw, hw - .1, .34, 1.1), (2.95, hw - .1, hw - .22, .38, .82)], 'paint')
    b.loft([(-2.85, hw - .06, hw - .1, 1.26, 2.12), (2.1, hw - .04, hw - .12, 1.26, 2.12), (2.72, hw - .08, hw - .26, 1.24, 1.3)], 'glass')
    b.loft([(-2.88, hw - .08, hw - .12, 2.1, 2.26), (2.14, hw - .08, hw - .14, 2.1, 2.26)], 'paint')
    pillars(b, -2.85, 2.72, hw - .05, hw - .1, 1.26, 2.12, (-2.82, -1.65, -.45, .75, 2.08))
    b.box(0, -.4, 2.26, hw * 1.5, 3.4, .06, 'dark'); b.box(0, -.8, 2.32, hw * 1.2, 1.4, .3, 'seat')
    b.box(0, 2.93, .38, hw * 1.7, .12, .14, 'dark'); b.box(0, -2.92, .38, hw * 1.7, .1, .14, 'dark')
    b.box(0, -2.94, .58, .42, .03, .12, 'plate')
    lights(b, hw, 2.94, -2.92, .78, .16)
    wheels(b, hw, 1.9, -1.8, r=.38, w=.26)
    return b.build('WSP Traffic prototype Minibus')


def moto():
    """Moto-taxi (bendskin) et son conducteur : le réservoir et la selle prennent la couleur, le reste garde la palette."""
    b, r = Builder(), .3
    b.wheel(.08, .82, r, .09, n=10); b.wheel(.08, -.82, r, .09, n=10)
    b.box(0, 0, .3, .22, 1.2, .14, 'dark')
    b.box(0, .25, .46, .3, .55, .26, 'paint')
    b.box(0, -.38, .5, .32, .75, .14, 'seat')
    b.box(0, -.72, .42, .26, .3, .16, 'paint')
    b.box(0, .78, .36, .08, .16, .62, 'hub')
    b.box(0, .72, .95, .62, .07, .06, 'dark')
    b.box(0, .84, .8, .2, .08, .16, 'head')
    b.box(0, -.9, .54, .14, .05, .08, 'tail')
    # Conducteur.
    b.box(0, -.18, .62, .42, .32, .62, 'sign')
    b.box(0, -.18, 1.24, .2, .2, .12, 'seat')
    b.box(0, -.15, 1.34, .3, .32, .28, 'dark')
    for side in (-1, 1):
        b.box(side * .26, .25, .92, .1, .75, .1, 'sign')
        b.box(side * .24, -.05, .3, .12, .45, .38, 'dark')
    return b.build('WSP Traffic prototype Moto')


def add_moto():
    made = moto(); made.location.z = -20
    bpy.context.view_layer.update()
    return made.name


def build_vehicles():
    old = bpy.data.objects.get('WSP Traffic prototype')
    parked = bpy.data.objects.get('Voiture')
    spot = (parked.matrix_world.translation.copy(), parked.rotation_euler.copy()) if parked else None
    if old: bpy.data.objects.remove(old)
    made = [sedan(), suv(), minibus()]
    for o in made: o.location.z = -20
    if spot:
        # La voiture garée reprend le nouveau modèle, à la même place.
        bb = [parked.matrix_world @ v.co for v in parked.data.vertices]
        cx, cy = sum(p.x for p in bb) / len(bb), sum(p.y for p in bb) / len(bb)
        bpy.data.objects.remove(parked)
        copy = bpy.data.objects.new('Voiture', made[0].data.copy()); bpy.context.collection.objects.link(copy)
        copy.location = (cx, cy, 0)
    return [o.name for o in made]


# Défauts techniques des bâtiments d'origine : forme et textures inchangées.
FLIPPED = ('bank', 'comissariat', 'contenair_police', 'station')
FLOATING = ('comissariat', 'contenair_police', 'HotelDePolilce fontaine')


def fix_building_defects():
    """Remet à l'endroit les faces retournées (le jeu ne dessine pas leur dos) et pose au sol ce qui flotte."""
    import bmesh
    for name in FLIPPED:
        mesh = bpy.data.objects[name].data
        bm = bmesh.new(); bm.from_mesh(mesh); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(mesh); bm.free(); mesh.update()
    for name in FLOATING:
        obj = bpy.data.objects[name]
        obj.location.z -= min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
    bpy.context.view_layer.update()


def raise_church_walls(extra=2.6):
    """Le toit de l'église tombait à 1 m du sol : on allonge les murs, sans changer sa forme ni son dessin."""
    church = bpy.data.objects['eglise']
    for v in church.data.vertices:
        if v.co.z >= .95: v.co.z += extra
    church.data.update()
    for name in ('WSP Baies eglise', 'WSP Cadres eglise'): bpy.data.objects[name].location.z += extra
    bpy.context.view_layer.update()


def plane_prototype():
    """L'avion garé devient le modèle animé : centré, nez vers +Y, roues à z = 0, rangé sous le sol comme les véhicules."""
    from mathutils import Matrix, Vector
    plane = bpy.data.objects['Avion']
    world = [plane.matrix_world @ v.co for v in plane.data.vertices]
    lo = Vector((min(p.x for p in world), min(p.y for p in world), min(p.z for p in world)))
    hi = Vector((max(p.x for p in world), max(p.y for p in world), max(p.z for p in world)))
    center = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    nose = Vector((-.397, -.918, 0))
    turn = Matrix.Rotation(math.atan2(nose.x, nose.y), 4, 'Z')
    for v, p in zip(plane.data.vertices, world): v.co = turn @ (p - center)
    plane.data.update(); plane.matrix_world = Matrix.Translation((0, 0, -20)); plane.name = 'WSP Avion prototype'
    bpy.context.view_layer.update()


# Fenêtres allumées la nuit : une texture d'émission par façade, uniquement sur ce qui ressemble à du vitrage.
NIGHT_SKIP = ('WSP', 'bg.', 'Panneau', 'Outline', 'taxi', 'Avion', 'N116', 'WM ', 'Material', 'Marché', 'Stadium', 'Chantier', 'Fapmous')
NIGHT_SOURCES = {'Rue_joka1': 'Rue_Joka_1_Night.png', 'Rue_joka2': 'Rue_Joka_2_Night.png', 'Rue_joka3': 'Rue_Joka_3_Night.png', 'Rue_joka4': 'Rue_Joka_4_Night.png'}


def night_windows(textures_dir):
    """Rue du Njoka : les néons d'origine. Autres façades : vitrages en lumière chaude, par blocs irréguliers."""
    done = []
    rng = np.random.default_rng(5)
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        for old in [n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and n.image.name.endswith(' nuit')]:
            m.node_tree.nodes.remove(old)
        if m.name.startswith(NIGHT_SKIP): continue
        principled = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        image = base_image(m)
        if not principled or not image or not m.users: continue
        if m.name in NIGHT_SOURCES:
            night = bpy.data.images.load(textures_dir + NIGHT_SOURCES[m.name], check_existing=True)
            w, h = night.size; px = np.empty(w * h * 4, np.float32); night.pixels.foreach_get(px); px = px.reshape(h, w, 4)
            lum = px[..., :3].max(2)
            out = np.zeros_like(px); out[..., :3] = px[..., :3] * np.clip((lum - .32) / .25, 0, 1)[..., None] * 1.15
        else:
            w, h = image.size; px = np.empty(w * h * 4, np.float32); image.pixels.foreach_get(px); px = px.reshape(h, w, 4)
            r, g, b = px[..., 0], px[..., 1], px[..., 2]
            mx = px[..., :3].max(2); sat = (mx - px[..., :3].min(2)) / np.maximum(mx, 1e-3)
            # Vitrage : seulement les carreaux sombres et bleutés ; un mur clair ou gris reste éteint.
            glass = (b >= r * 1.12) & (mx < .46) & (mx > .05) & (sat > .14) & (px[..., 3] > .5)
            if glass.mean() < .002 or glass.mean() > .25: continue
            cell = max(3, w // 64)
            lit = rng.random((h // cell + 2, w // cell + 2)) < .4
            on = np.kron(lit, np.ones((cell, cell), bool))[:h, :w]
            warm = rng.random((h // cell + 2, w // cell + 2))
            tone = np.kron(warm, np.ones((cell, cell), np.float32))[:h, :w]
            out = np.zeros_like(px); mask = (glass & on).astype(np.float32)
            out[..., 0] = mask * (.85 + .15 * tone); out[..., 1] = mask * (.6 + .2 * tone); out[..., 2] = mask * (.22 + .22 * tone)
        out[..., 3] = 1
        glow = bpy.data.images.new(m.name.strip() + ' nuit', w, h, alpha=False)
        glow.pixels.foreach_set(out.astype(np.float32).ravel()); glow.pack(); glow.file_format = 'JPEG'
        node = m.node_tree.nodes.new('ShaderNodeTexImage'); node.image = glow
        # Mêmes coordonnées de texture que la façade.
        base = next((n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n is not node), None)
        if base and base.inputs['Vector'].is_linked: m.node_tree.links.new(base.inputs['Vector'].links[0].from_socket, node.inputs['Vector'])
        m.node_tree.links.new(node.outputs['Color'], principled.inputs['Emission Color'])
        principled.inputs['Emission Strength'].default_value = 1
        done.append(m.name)
    return done
