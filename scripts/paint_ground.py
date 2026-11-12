# Repeint la texture du sol, à partir de la peinture d'origine (scripts/data/large-map-original.jpg) et du réseau routier.
# Centre-ville : herbe, terre et parcelles en aplats propres, routes nettes aux dimensions des voies.
# Aéroport, stade, colline, plantations et bord de mer gardent leur peinture : ce sont des détails dessinés, pas des taches.
# Usage : python -I scripts/paint_ground.py <fichier-de-sortie.jpg> [--clean]
# --clean : routes propres (pas de terre, de nids-de-poule ni de trottoirs cassés, marquage complet)
#           et zones du sol en grands aplats, sans petits îlots.
import heapq, json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1])
CLEAN = '--clean' in sys.argv[2:]
W, H = 6144, 3964
# Correspondance monde (x, z) -> UV du sol, relevée sur les sommets du maillage par extract-road-network.py.
CU = (1.59622906e-03, 8.85175441e-07, 5.08740826e-01)
CV = (-1.82580104e-19, 2.39208295e-03, 5.16219151e-01)
PX = (CU[0] * W + CV[1] * H) / 2  # pixels par unité du monde, en moyenne
ROAD, WALK = 8.6, 12.0
# Extrémités du tronçon entretenu : sortie de l'aéroport et pied de la route de la présidence.
# Le tronçon passe par la statue de Mougabiang.
AIRPORT, STATUE, PRESIDENCY = (113, -90), (-25.4, 1.1), (-170, -62)
PALETTE = {'grass': (124, 180, 70), 'earth': (235, 152, 88), 'plaza': (222, 216, 204), 'track': (216, 186, 158), 'road': (116, 120, 124), 'walk': (236, 231, 219), 'curb': (178, 170, 156), 'line': (246, 244, 234), 'edge': (192, 184, 168), 'ink': (72, 58, 50), 'bare': (196, 138, 96), 'hole': (58, 54, 50), 'mud': (128, 92, 66), 'crumble': (146, 146, 142)}


def pixel(x, z, scale=1):
    return ((x * CU[0] + z * CU[1] + CU[2]) * W * scale, (x * CV[0] + z * CV[1] + CV[2]) * H * scale)


def polygon_mask(points, blur):
    """Masque d'une zone du monde, bords adoucis."""
    small = Image.new('L', (W // 4, H // 4), 0)
    ImageDraw.Draw(small).polygon([pixel(x, z, .25) for x, z in points], fill=255)
    return np.asarray(small.filter(ImageFilter.GaussianBlur(blur * PX / 4)).resize((W, H), Image.BICUBIC)).astype(np.float32) / 255


def noise(rng, cells, low, high):
    small = rng.uniform(low, high, (max(2, cells * H // W), cells)).astype(np.float32)
    return np.asarray(Image.fromarray(small, 'F').resize((W, H), Image.BICUBIC))


def surfaces(original, rng):
    """Garde le tracé peint, pistes comprises : chaque zone reçoit une couleur propre et un bord net."""
    work = original.resize((W // 2, H // 2), Image.LANCZOS).filter(ImageFilter.MedianFilter(7))
    small = np.asarray(work).astype(np.float32)
    r, g, b = small[..., 0], small[..., 1], small[..., 2]
    spread = small.max(2) - small.min(2)
    grass = g >= r * 1.03
    plaza = ~grass & (spread < 30)
    track = ~grass & ~plaza & (r >= 172) & (r <= 248) & (b >= 98) & (r - b <= 105) & (g - b <= 55) & (r - g <= 75)
    earth = ~grass & ~plaza & ~track
    fields = [np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)).resize((W, H), Image.BICUBIC)) for m in (grass, earth, plaza, track)]
    kind = np.argmax(np.stack(fields), axis=0).astype(np.uint8)
    del fields
    if CLEAN:
        # Grands aplats : chaque pixel prend la zone majoritaire autour de lui ; les petits îlots disparaissent.
        small_kind = np.asarray(Image.fromarray(kind * 60).resize((W // 4, H // 4), Image.NEAREST).filter(ImageFilter.ModeFilter(9))) // 60
        # Bords arrondis : chaque zone est agrandie en douceur puis la plus présente l'emporte.
        smooth = [np.asarray(Image.fromarray(((small_kind == c) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)).resize((W, H), Image.BICUBIC)) for c in range(4)]
        kind = np.argmax(np.stack(smooth), axis=0).astype(np.uint8)
        del smooth
    # Îlot du rond-point : pelouse autour de la statue.
    y, x = np.mgrid[0:H // 2, 0:W // 2].astype(np.float32) * 2
    wx, wz = (x / W - CU[2]) / CU[0], (y / H - CV[2]) / CV[1]
    island = np.asarray(Image.fromarray((np.hypot(wx + 25.4, wz - 1.1) < 11).astype(np.uint8) * 255).resize((W, H), Image.NEAREST)) > 127
    kind[island] = 0
    colors = np.stack([PALETTE['grass'], PALETTE['earth'], PALETTE['plaza'], PALETTE['track']]).astype(np.float32)
    out = colors[kind]
    width = max(3, int(.3 * PX)) | 1
    ring = (np.asarray(Image.fromarray(((kind == 2) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(width))) > 127) & (kind != 2)
    out[ring] = PALETTE['edge']
    # Trait d'encre entre les zones, comme un dessin.
    ink_width = max(3, int(.26 * PX)) | 1
    k = Image.fromarray(kind * 60)
    outline = np.asarray(k.filter(ImageFilter.MaxFilter(ink_width))).astype(np.int16) != np.asarray(k.filter(ImageFilter.MinFilter(ink_width))).astype(np.int16)
    out[outline] = out[outline] * .62
    amount = np.where(kind == 2, .12, .22)[..., None].astype(np.float32)
    broad = noise(rng, 90, .96, 1.04)[..., None]; fine = noise(rng, 1800, .97, 1.03)[..., None]
    return np.clip(out * (1 + (broad - 1) * amount) * (1 + (fine - 1) * amount), 0, 255)


def relax(path, step=3.0, passes=10):
    """Le dessin des routes : mêmes extrémités que les voies, sans les ondulations du squelette."""
    cum = [0.0]
    for a, b in zip(path, path[1:]): cum.append(cum[-1] + math.dist(a, b))
    if cum[-1] < step * 3: return [tuple(q) for q in path]
    n = int(cum[-1] / step); pts = np.column_stack([np.interp(np.linspace(0, cum[-1], n + 1), cum, [q[i] for q in path]) for i in (0, 1)])
    for _ in range(passes):
        for factor in (.5, -.53): pts[1:-1] += factor * ((pts[:-2] + pts[2:]) / 2 - pts[1:-1])
    return [tuple(q) for q in pts]


def stroke(paths, width, scale=2):
    im = Image.new('L', (W * scale, H * scale), 0); d = ImageDraw.Draw(im); w = int(round(width * PX * scale)); r = w / 2
    for path in paths:
        pts = [pixel(x, z, scale) for x, z in path]
        d.line(pts, fill=255, width=w)
        for x, y in pts: d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    return np.asarray(im.resize((W, H), Image.BOX))


def along(path):
    cum = [0.0]
    for a, b in zip(path, path[1:]): cum.append(cum[-1] + math.dist(a, b))
    def at(s):
        s = max(0, min(cum[-1], s)); i = 1
        while i < len(cum) - 1 and cum[i] < s: i += 1
        t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] or 1); a, b = path[i - 1], path[i]; n = math.dist(a, b) or 1
        return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), ((b[0] - a[0]) / n, (b[1] - a[1]) / n)
    return cum[-1], at


def markings(paths, degree, scale=2):
    im = Image.new('L', (W * scale, H * scale), 0); d = ImageDraw.Draw(im)
    def rect(c, u, length, width):
        ax, az = u[0] * length / 2, u[1] * length / 2; bx, bz = -u[1] * width / 2, u[0] * width / 2
        d.polygon([pixel(c[0] + i * ax + j * bx, c[1] + i * az + j * bz, scale) for i, j in ((1, 1), (1, -1), (-1, -1), (-1, 1))], fill=255)
    for path in paths:
        length, at = along(path); s = 11.0
        while s < length - 11:
            c, u = at(s); rect(c, u, 2.2, .24); s += 5.2
        for end, sign in ((0.0, 1), (length, -1)):
            node = path[0] if end == 0 else path[-1]
            if degree.get((round(node[0]), round(node[1])), 0) < 3 or length < 22: continue
            c, u = at(end + sign * 8.5); n = (-u[1], u[0])
            for i in range(-3, 4): rect((c[0] + n[0] * i * 1.2, c[1] + n[1] * i * 1.2), u, 2.6, .62)
    return np.asarray(im.resize((W, H), Image.BOX))


def state_route(paths, stops=(AIRPORT, STATUE, PRESIDENCY)):
    """Le seul tronçon entretenu : de l'aéroport à la présidence, par la statue et tout le rond-point qui l'entoure."""
    key = lambda q: (round(q[0] / 3), round(q[1] / 3))
    graph = {}
    for i, p in enumerate(paths):
        cost = sum(math.dist(a, b) for a, b in zip(p, p[1:]))
        graph.setdefault(key(p[0]), []).append((key(p[-1]), i, cost)); graph.setdefault(key(p[-1]), []).append((key(p[0]), i, cost))
    point = {key(q): q for p in paths for q in (p[0], p[-1])}
    near = lambda target: min(graph, key=lambda n: math.dist(point[n], target))
    route = set()
    for start, end in zip(stops, stops[1:]):
        source, goal = near(start), near(end)
        best, previous, todo = {source: 0.0}, {}, [(0.0, source)]
        while todo:
            d, node = heapq.heappop(todo)
            if node == goal: break
            if d > best[node]: continue
            for other, index, cost in graph[node]:
                if d + cost < best.get(other, 1e12):
                    best[other] = d + cost; previous[other] = (node, index); heapq.heappush(todo, (d + cost, other))
        node = goal
        while node != source:
            node, index = previous[node]; route.add(index)
    # L'anneau autour de la statue et la route de la colline restent neufs eux aussi.
    for i, p in enumerate(paths):
        if all(math.dist(q, STATUE) < 26 for q in p): route.add(i)
        if all(q[0] < -120 and q[1] < -40 for q in (p[0], p[-1])): route.add(i)
    return route, point[near(stops[0])], point[near(stops[-1])]


def wear(paths, keep, rng, scale=2):
    """Routes abîmées : portions sans bitume, nids-de-poule de toutes tailles. Renvoie trois masques : terre, trou, bord cassé."""
    bare = Image.new('L', (W * scale, H * scale), 0); holes = Image.new('L', (W * scale, H * scale), 0); centres = Image.new('L', (W * scale, H * scale), 0)
    bd, hd, cd = ImageDraw.Draw(bare), ImageDraw.Draw(holes), ImageDraw.Draw(centres)
    k = PX * scale
    def blob(draw, c, radius, stretch=1.0, angle=0.0):
        n = rng.integers(7, 13); pts = []
        for i in range(n):
            a = math.tau * i / n; r = radius * rng.uniform(.62, 1.25)
            x, y = math.cos(a) * r * stretch, math.sin(a) * r
            pts.append(pixel(c[0] + x * math.cos(angle) - y * math.sin(angle), c[1] + x * math.sin(angle) + y * math.cos(angle), scale))
        draw.polygon(pts, fill=255)
    for path in paths:
        length, at = along(path)
        # Portions où le bitume a disparu : d'un petit bout à toute une section, parfois sur toute la largeur.
        s = rng.uniform(0, 26)
        while s < length:
            span = float(rng.choice((8, 14, 22, 34, 55), p=(.3, .28, .22, .14, .06))); width = rng.uniform(.3, 1.2) * ROAD; side = rng.uniform(-1, 1) * (ROAD - min(width, ROAD)) / 2
            t = s
            while t < min(length, s + span):
                c, u = at(t); n = (-u[1], u[0]); w = width * rng.uniform(.65, 1.12)
                blob(bd, (c[0] + n[0] * side, c[1] + n[1] * side), w / 2, rng.uniform(1, 1.5), math.atan2(u[1], u[0]))
                t += rng.uniform(1.2, 3.2)
            s += span + rng.uniform(10, 62)
        # Nids-de-poule : beaucoup de petits, quelques très gros, souvent en grappes.
        s = rng.uniform(0, 3)
        while s < length:
            c, u = at(s); n = (-u[1], u[0]); radius = float(rng.choice((.28, .45, .7, 1.05, 1.6, 2.4), p=(.32, .3, .2, .1, .06, .02))) * rng.uniform(.8, 1.2)
            for _ in range(int(rng.integers(1, 5)) if rng.random() < .35 else 1):
                off = rng.uniform(-ROAD / 2 + .3, ROAD / 2 - .3); shift = rng.uniform(-1.8, 1.8); q = (c[0] + n[0] * off + u[0] * shift, c[1] + n[1] * off + u[1] * shift)
                r = radius * rng.uniform(.6, 1.1); ang = rng.uniform(0, math.pi); st = rng.uniform(1, 1.7)
                blob(hd, q, r, st, ang)
                if r > .45: blob(cd, q, r * .58, st, ang)
            s += rng.exponential(2.3) + .5
    # Les bords se déchirent : le masque de terre passe par un bruit fin.
    tear = noise(rng, 1500, 0, 1) * .6 + noise(rng, 500, 0, 1) * .4
    b = np.asarray(bare.resize((W, H), Image.BOX).filter(ImageFilter.GaussianBlur(9))).astype(np.float32) / 255
    b = np.clip((b + (tear - .5) * 1.5 - .5) * 8, 0, 1)
    h = np.asarray(holes.resize((W, H), Image.BOX)).astype(np.float32) / 255
    c = np.asarray(centres.resize((W, H), Image.BOX)).astype(np.float32) / 255
    rim = np.asarray(holes.resize((W, H), Image.BOX).filter(ImageFilter.MaxFilter(max(3, int(.34 * PX)) | 1))).astype(np.float32) / 255
    return b * keep, h * keep, c * keep, rim * keep


def main():
    rng = np.random.default_rng(7)
    original = Image.open(ROOT / 'scripts/data/large-map-original.jpg').convert('RGB')
    old = np.asarray(original.resize((W, H), Image.LANCZOS)).astype(np.float32)
    network = json.loads((ROOT / 'src/data/road-network.json').read_text(encoding='utf8'))
    degree = {}
    for p in network['paths']:
        for q in (p[0], p[-1]):
            key = (round(q[0]), round(q[1])); degree[key] = degree.get(key, 0) + 1
    # Bout de route isolé, sans carrefour : il ne se dessine pas.
    connected = [p for p in network['paths'] if max(degree[(round(q[0]), round(q[1]))] for q in (p[0], p[-1])) >= 2 or math.dist(p[0], p[-1]) > 30]
    route, start, end = state_route(connected)
    print('Tronçon entretenu', start, end, len(route), 'routes,', round(sum(math.dist(a, b) for i in route for a, b in zip(connected[i], connected[i][1:]))), 'unités')
    paths = [relax(p) for p in connected]
    good, damaged = [paths[i] for i in route], [p for i, p in enumerate(paths) if i not in route]
    image = surfaces(original, rng)
    def over(base, mask, color):
        m = (mask.astype(np.float32) / 255)[..., None]; return base * (1 - m) + np.array(color, np.float32) * m
    image = over(image, stroke(paths, WALK), PALETTE['walk'])
    image = over(image, stroke(paths, WALK + .55), PALETTE['ink'])
    image = over(image, stroke(paths, WALK), PALETTE['walk'])
    image = over(image, stroke(paths, ROAD + .55), PALETTE['ink'])
    asphalt = stroke(paths, ROAD)
    grain = noise(rng, 2200, .975, 1.025)[..., None]
    a = (asphalt.astype(np.float32) / 255)[..., None]
    image = image * (1 - a) + np.array(PALETTE['road'], np.float32) * grain * a
    # Le tronçon de la présidence reste neuf ; ailleurs le marquage n'existe plus que par endroits.
    good_mask = stroke(good, WALK + 1).astype(np.float32) / 255
    keep = 1 - good_mask
    faded = np.ones((H, W), np.float32) if CLEAN else (noise(rng, 170, 0, 1) > .62).astype(np.float32)
    line = markings(paths, degree).astype(np.float32) * asphalt.astype(np.float32) / 255 * (good_mask + keep * faded)
    image = over(image, np.clip(line, 0, 255).astype(np.uint8), PALETTE['line'])
    bare, hole, centre, rim = wear(damaged, keep, rng)
    if CLEAN: bare, hole, centre, rim = (np.zeros((H, W), np.float32),) * 4
    road = asphalt.astype(np.float32) / 255
    # Trottoirs cassés sur les routes abîmées.
    pavement = np.zeros((H, W), np.float32) if CLEAN else (stroke(damaged, WALK).astype(np.float32) / 255) * (1 - road) * keep * (noise(rng, 420, 0, 1) > .57)
    def paint(mask, color, texture=None):
        nonlocal image
        m = mask[..., None]; ink = np.array(color, np.float32) * (texture if texture is not None else 1)
        image = image * (1 - m) + ink * m
    dirt = noise(rng, 2600, .9, 1.1)[..., None] * noise(rng, 300, .94, 1.06)[..., None]
    paint(pavement, PALETTE['track'], dirt)
    paint(bare * np.clip(stroke(damaged, ROAD + 1.2).astype(np.float32) / 255, 0, 1), PALETTE['bare'], dirt)
    solid = road * (1 - bare)
    paint(rim * solid * .8, PALETTE['crumble'], dirt)
    paint(hole * solid, PALETTE['hole'])
    paint(centre * solid * .75, PALETTE['mud'], dirt)
    # Zone repeinte : le centre-ville, sans la mer ni les quartiers dessinés.
    zone = polygon_mask([(-225, -205), (100, -205), (100, -40), (118, 60), (130, 175), (-125, 175), (-125, 104), (-235, 104), (-235, 40), (-205, -30)], 5)
    # Bord de mer : plage et rivage restent peints.
    shore = polygon_mask([(-90, -230), (120, -230), (120, -125), (60, -135), (15, -150), (-40, -178), (-70, -205)], 6)
    t = (zone * (1 - shore))[..., None]
    result = np.clip(old * (1 - t) + image * t, 0, 255).astype(np.uint8)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(result).save(OUT, quality=86, subsampling=0)
    print(OUT.stat().st_size, len(paths))


main()
