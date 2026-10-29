# Extrait le réseau routier de la chaussée peinte sur le sol 3D (texture « large map extended » du modèle).
# Masque de couleur -> nettoyage -> squelette -> graphe -> élagage -> coordonnées du monde.
# Usage : python -I scripts/extract-road-network.py [dossier-de-contrôle]
# Écrit src/data/road-network.json, lu par la circulation.

import io, json, math, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DEBUG = Path(sys.argv[1]) if len(sys.argv) > 1 else None
WIDTH = 1400  # résolution de travail : environ 0,45 unité de monde par pixel


def ground():
    """Texture du sol et correspondance exacte monde -> UV, calculée sur les sommets du maillage."""
    data = (ROOT / 'public/models/mboa-wsp.glb').read_bytes()
    length = struct.unpack('<I', data[12:16])[0]
    gltf = json.loads(data[20:20 + length]); offset = 20 + length + 8

    def accessor(i):
        a = gltf['accessors'][i]; view = gltf['bufferViews'][a['bufferView']]
        n = {'VEC2': 2, 'VEC3': 3}[a['type']]
        start = offset + view.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.frombuffer(data, dtype=np.float32, count=a['count'] * n, offset=start).reshape(-1, n)

    node = next(n for n in gltf['nodes'] if n.get('name') == 'WSP Sol et voirie origine')
    primitive = next(p for p in gltf['meshes'][node['mesh']]['primitives'] if gltf['materials'][p['material']]['name'] == 'bg.002')
    position, uv = accessor(primitive['attributes']['POSITION']), accessor(primitive['attributes']['TEXCOORD_0'])
    design = np.column_stack([position[:, 0], position[:, 2], np.ones(len(position))])
    cu = np.linalg.lstsq(design, uv[:, 0], rcond=None)[0]; cv = np.linalg.lstsq(design, uv[:, 1], rcond=None)[0]
    image = next(i for i in gltf['images'] if i.get('name') == 'large map extended')
    view = gltf['bufferViews'][image['bufferView']]
    start = offset + view.get('byteOffset', 0)
    texture = Image.open(io.BytesIO(data[start:start + view['byteLength']])).convert('RGB')
    return texture, cu, cv


GROUND = ('bg.002', 'WSP Prairie de la colline', 'WSP Eau turquoise', 'WSP Terre des abords', 'WSP Mer vivante',
          'WSP Route de la presidence', 'WSP Bordures de la presidence', 'WSP Tablier du pont', 'WSP Garde corps')
PROPS = ('Arbre', 'Passant', 'banc', 'Banc', 'Bac', 'Arbuste', 'Lampadaire', 'lampadaire', 'Traffic', 'Voiture', 'Moto', 'Bus',
         'Avion', 'panneau', 'Panneau', 'Pont', 'Rive', 'Horizon', 'Socle', 'Surface')


def footprint(shape, cu, cv, margin_px=3):
    """Emprise exacte des bâtiments 3D : projection au sol de chacun de leurs triangles."""
    data = (ROOT / 'public/models/mboa-wsp.glb').read_bytes()
    length = struct.unpack('<I', data[12:16])[0]; gltf = json.loads(data[20:20 + length]); offset = 20 + length + 8
    def accessor(i):
        a = gltf['accessors'][i]; view = gltf['bufferViews'][a['bufferView']]
        n = {'SCALAR': 1, 'VEC3': 3}[a['type']]; dtype = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[a['componentType']]
        start = offset + view.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.frombuffer(data, dtype=dtype, count=a['count'] * n, offset=start).reshape(-1, n) if n > 1 else np.frombuffer(data, dtype=dtype, count=a['count'], offset=start)
    h, w = shape; image = Image.new('L', (w, h), 0); draw = ImageDraw.Draw(image)
    for node in gltf['nodes']:
        name = node.get('name', '')
        if node.get('mesh') is None or any(k in name for k in PROPS): continue
        t = np.array(node.get('translation', [0, 0, 0]), np.float32)
        for primitive in gltf['meshes'][node['mesh']]['primitives']:
            if gltf['materials'][primitive['material']]['name'] in GROUND or 'indices' not in primitive: continue
            position = accessor(primitive['attributes']['POSITION']) + t
            if position[:, 1].max() - position[:, 1].min() < 1.5: continue
            u = (position[:, 0] * cu[0] + position[:, 2] * cu[1] + cu[2]) * w
            v = (position[:, 0] * cv[0] + position[:, 2] * cv[1] + cv[2]) * h
            for a, b, c in accessor(primitive['indices']).reshape(-1, 3):
                draw.polygon([(u[a], v[a]), (u[b], v[b]), (u[c], v[c])], fill=255, outline=255)
    return np.asarray(image.filter(ImageFilter.MaxFilter(2 * margin_px + 1))) > 0


def height_grid(step=4.0):
    """Hauteur du sol (chaussée, colline, pont) sur une grille régulière : lue sans calcul au démarrage du jeu."""
    data = (ROOT / 'public/models/mboa-wsp.glb').read_bytes()
    length = struct.unpack('<I', data[12:16])[0]; gltf = json.loads(data[20:20 + length]); offset = 20 + length + 8
    points = []
    for node in gltf['nodes']:
        if node.get('mesh') is None: continue
        for primitive in gltf['meshes'][node['mesh']]['primitives']:
            if gltf['materials'][primitive['material']]['name'] not in ('bg.002', 'WSP Prairie de la colline', 'WSP Route de la presidence', 'WSP Tablier du pont'): continue
            a = gltf['accessors'][primitive['attributes']['POSITION']]; view = gltf['bufferViews'][a['bufferView']]
            start = offset + view.get('byteOffset', 0) + a.get('byteOffset', 0)
            points.append(np.frombuffer(data, dtype=np.float32, count=a['count'] * 3, offset=start).reshape(-1, 3) + np.array(node.get('translation', [0, 0, 0]), np.float32))
    p = np.concatenate(points)
    x0, z0 = float(np.floor(p[:, 0].min())), float(np.floor(p[:, 2].min()))
    cols, rows = int((p[:, 0].max() - x0) / step) + 2, int((p[:, 2].max() - z0) / step) + 2
    grid = np.full((rows, cols), -1e9, np.float32)
    i = np.clip(((p[:, 2] - z0) / step).round().astype(int), 0, rows - 1); j = np.clip(((p[:, 0] - x0) / step).round().astype(int), 0, cols - 1)
    np.maximum.at(grid, (i, j), p[:, 1])
    # Cases sans sommet : moyenne des voisines connues, jusqu'à tout remplir.
    for _ in range(40):
        empty = grid < -1e8
        if not empty.any(): break
        padded = np.pad(np.where(empty, np.nan, grid), 1, constant_values=np.nan)
        neighbours = np.stack([padded[1 + a:rows + 1 + a, 1 + b:cols + 1 + b] for a in (-1, 0, 1) for b in (-1, 0, 1)])
        mean = np.nanmean(np.where(np.isnan(neighbours), np.nan, neighbours), axis=0) if np.isfinite(neighbours).any() else None
        grid = np.where(empty & np.isfinite(mean), mean, grid)
    grid = np.where(grid < -1e8, 0, grid)
    return {'x0': x0, 'z0': z0, 'step': step, 'cols': cols, 'rows': rows, 'values': [round(float(v), 2) for v in grid.ravel()]}


def road_mask(texture):
    small = texture.resize((WIDTH, round(texture.height * WIDTH / texture.width)), Image.BILINEAR)
    a = np.asarray(small).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # Chaussée claire du centre et routes de terre rosées : jamais l'orange vif du sol (bleu faible),
    # ni le gris neutre des parcelles et du tarmac (rouge ≈ bleu), ni l'herbe (vert > rouge).
    mask = (r >= 172) & (r <= 248) & (b >= 98) & (r - b >= 16) & (r - b <= 105) & (g - b >= 2) & (g - b <= 55) & (r - g >= 4) & (r - g <= 75)
    img = Image.fromarray((mask * 255).astype(np.uint8))
    img = img.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))   # comble les trous
    img = img.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))   # retire le bruit fin
    return small, np.asarray(img) > 127


def keep_large(mask, minimum):
    """Ne garde que les grandes zones connexes : les taches isolées ne sont pas des rues."""
    h, w = mask.shape; label = np.zeros((h, w), np.int32); sizes = [0]
    for y, x in zip(*np.nonzero(mask)):
        if label[y, x]: continue
        current = len(sizes); stack = [(y, x)]; label[y, x] = current; count = 0
        while stack:
            j, i = stack.pop(); count += 1
            for dj in (-1, 0, 1):
                for di in (-1, 0, 1):
                    b, a = j + dj, i + di
                    if 0 <= b < h and 0 <= a < w and mask[b, a] and not label[b, a]:
                        label[b, a] = current; stack.append((b, a))
        sizes.append(count)
    sizes = np.array(sizes)
    return (sizes[label] >= minimum) & mask


def thin(mask):
    """Squelette Zhang-Suen : la ligne centrale de la chaussée, épaisse d'un pixel."""
    s = np.pad(mask.astype(np.uint8), 1)
    changed = True
    while changed:
        changed = False
        for phase in (0, 1):
            p2, p3, p4, p5 = s[:-2, 1:-1], s[:-2, 2:], s[1:-1, 2:], s[2:, 2:]
            p6, p7, p8, p9 = s[2:, 1:-1], s[2:, :-2], s[1:-1, :-2], s[:-2, :-2]
            ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            neighbours = sum(ring[:8])
            transitions = sum(((ring[k] == 0) & (ring[k + 1] == 1)).astype(np.uint8) for k in range(8))
            centre = s[1:-1, 1:-1] == 1
            if phase == 0: cond = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)
            else: cond = (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            remove = centre & (neighbours >= 2) & (neighbours <= 6) & (transitions == 1) & cond
            if remove.any():
                s[1:-1, 1:-1][remove] = 0; changed = True
    return s[1:-1, 1:-1].astype(bool)


FOUR = [(-1, 0), (1, 0), (0, -1), (0, 1)]
DIAG = [(-1, -1), (-1, 1), (1, -1), (1, 1)]


def graph(skeleton):
    """Découpe le squelette en tronçons entre carrefours et extrémités.
    Voisinage sans doublon : une diagonale ne compte pas si elle est déjà rejointe par un voisin direct,
    sinon chaque marche d'escalier ressemble à un carrefour."""
    pixels = set(zip(*np.nonzero(skeleton)))
    def neighbours(p):
        direct = [(p[0] + a, p[1] + b) for a, b in FOUR if (p[0] + a, p[1] + b) in pixels]
        diagonal = [(p[0] + a, p[1] + b) for a, b in DIAG if (p[0] + a, p[1] + b) in pixels
                    and (p[0] + a, p[1]) not in pixels and (p[0], p[1] + b) not in pixels]
        return direct + diagonal
    degree = {p: len(neighbours(p)) for p in pixels}
    junction = {p for p, d in degree.items() if d >= 3}
    # Regroupe les pixels de carrefour contigus : un carrefour = un nœud.
    cluster, nodes = {}, []
    for p in junction:
        if p in cluster: continue
        stack, members = [p], []
        cluster[p] = len(nodes)
        while stack:
            q = stack.pop(); members.append(q)
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    r = (q[0] + a, q[1] + b)
                    if r in junction and r not in cluster: cluster[r] = len(nodes); stack.append(r)
        nodes.append(tuple(np.mean(members, axis=0)))
    ends = {p for p, d in degree.items() if d <= 1}
    for p in ends: cluster[p] = len(nodes); nodes.append(p)
    edges, used = [], set()
    for start in list(cluster):
        for first in neighbours(start):
            if first in cluster or (start, first) in used: continue
            path, previous, current = [start, first], start, first
            while current not in cluster:
                nxt = [n for n in neighbours(current) if n != previous and n not in path[-4:]]
                if not nxt: break
                previous, current = current, nxt[0]; path.append(current)
            used.add((start, first)); used.add((path[-1], path[-2]))
            if current not in cluster: continue
            a, b = cluster[start], cluster[current]
            if a == b and len(path) < 60: continue
            edges.append([nodes[a]] + path[1:-1] + [nodes[b]])
    # Carrefours adjacents reliés directement (pixels de carrefour voisins de deux grappes).
    return edges


def length(path): return sum(math.dist(a, b) for a, b in zip(path, path[1:]))


def prune(edges, spur):
    """Retire les branches mortes courtes (débords de parcelles), plusieurs passes."""
    for _ in range(6):
        ends = {}
        for e in edges:
            for p in (e[0], e[-1]): ends[p] = ends.get(p, 0) + 1
        kept = [e for e in edges if not ((ends[e[0]] == 1 or ends[e[-1]] == 1) and length(e) < spur)]
        if len(kept) == len(edges): break
        edges = merge(kept)
    return edges


def merge(edges):
    """Recolle les tronçons reliés par un nœud de degré 2 apparu après élagage."""
    edges = [list(e) for e in edges if len(e) > 1]
    changed = True
    while changed:
        changed = False
        ends = {}
        for i, e in enumerate(edges):
            for p in (e[0], e[-1]): ends.setdefault(p, []).append(i)
        for p, ids in ends.items():
            if len(ids) == 2 and ids[0] != ids[1]:
                a, b = edges[ids[0]], edges[ids[1]]
                if a[-1] != p: a.reverse()
                if b[0] != p: b.reverse()
                edges[ids[0]] = a + b[1:]; edges.pop(ids[1]); changed = True; break
    return edges


def islands(mask):
    """Îlots circulaires entourés de chaussée : ce sont les ronds-points."""
    h, w = mask.shape; seen = np.zeros((h, w), bool); found = []
    for y, x in zip(*np.nonzero(~mask)):
        if seen[y, x]: continue
        stack, members, border = [(y, x)], [], False; seen[y, x] = True
        while stack:
            j, i = stack.pop(); members.append((j, i))
            if j in (0, h - 1) or i in (0, w - 1): border = True
            if len(members) > 15000: border = True
            for b, a in ((j + 1, i), (j - 1, i), (j, i + 1), (j, i - 1)):
                if 0 <= b < h and 0 <= a < w and not mask[b, a] and not seen[b, a]:
                    seen[b, a] = True; stack.append((b, a))
        if border or not 700 <= len(members) <= 12000: continue
        pts = np.array(members, float); cy, cx = pts.mean(axis=0); radius = math.sqrt(len(members) / math.pi)
        spread = np.hypot(pts[:, 0] - cy, pts[:, 1] - cx).max()
        if spread < radius * 1.25: found.append((cy, cx, radius))
    return found


def roundabouts(edges, circles, width=9):
    """Remplace le squelette déformé autour d'un îlot par un anneau propre, raccordé aux rues."""
    for cy, cx, radius in circles:
        clip, ring = radius + width * 3, radius + width
        kept, attach = [], []
        def ring_point(p):
            angle = math.atan2(p[0] - cy, p[1] - cx)
            for a, q in attach:
                if abs(math.remainder(a - angle, math.tau)) < math.radians(10): return q
            q = (cy + ring * math.sin(angle), cx + ring * math.cos(angle)); attach.append((angle, q)); return q
        for e in edges:
            inside = [math.dist(p, (cy, cx)) < clip for p in e]
            if not any(inside): kept.append(e); continue
            piece, clipped_start = [], inside[0]
            for p, isin in zip(e, inside):
                if isin:
                    if len(piece) > 2: kept.append(([ring_point(piece[0])] if clipped_start else []) + piece + [ring_point(piece[-1])])
                    piece, clipped_start = [], True
                else: piece.append(p)
            if len(piece) > 2: kept.append(([ring_point(piece[0])] if clipped_start else []) + piece)
        attach.sort()
        if not attach:
            continue
        for k, (a, q) in enumerate(attach):
            b, r = attach[(k + 1) % len(attach)]
            span = (b - a) % math.tau or math.tau
            steps = max(2, int(span / math.radians(6)))
            arc = [q] + [(cy + ring * math.sin(a + span * t / steps), cx + ring * math.cos(a + span * t / steps)) for t in range(1, steps)] + [r]
            kept.append(arc)
        edges = kept
    return edges


def bridge(edges, support, reach=70, cone=42, gap=30):
    """Prolonge une impasse jusqu'à la route qui la continue (peinture interrompue par un arbre, une ombre)."""
    count = {}
    for e in edges:
        for p in (e[0], e[-1]): count[p] = count.get(p, 0) + 1
    for i in range(len(edges)):
        for end in (0, -1):
            e = edges[i]; p = e[end]
            if count.get(p, 0) != 1 or len(e) < 6: continue
            back = e[5] if end == 0 else e[-6]
            d = (p[0] - back[0], p[1] - back[1]); n = math.hypot(*d) or 1; d = (d[0] / n, d[1] / n)
            best = None
            for k, other in enumerate(edges):
                if k == i: continue
                for m, q in enumerate(other):
                    v = (q[0] - p[0], q[1] - p[1]); dist = math.hypot(*v)
                    if dist < 2 or dist > reach: continue
                    angle = math.degrees(math.acos(max(-1, min(1, (v[0] * d[0] + v[1] * d[1]) / dist))))
                    score = dist + angle * .8
                    if angle >= cone or (best is not None and score >= best[0]): continue
                    # Le raccord doit rester sur la chaussée : au plus « gap » pixels sans peinture d'affilée.
                    run = worst = 0
                    for t in range(int(dist) + 1):
                        y, x = round(p[0] + v[0] * t / dist), round(p[1] + v[1] * t / dist)
                        on = 0 <= y < support.shape[0] and 0 <= x < support.shape[1] and support[y, x]
                        run = 0 if on else run + 1; worst = max(worst, run)
                    if worst <= gap: best = (score, k, m)
            if not best: continue
            _, k, m = best; other = edges[k]; q = other[m]
            if 0 < m < len(other) - 1:
                edges[k] = other[:m + 1]; edges.append(other[m:])
            link = [q, p] if end == 0 else [p, q]
            edges.append(link); count[p] = 2; count[q] = count.get(q, 0) + 2
    return edges


def components(edges, shape, minimum=180):
    """Garde le réseau principal et les routes qui entrent par un bord ; retire les morceaux isolés."""
    h, w = shape; owner = {}
    for i, e in enumerate(edges):
        for p in (e[0], e[-1]): owner.setdefault(p, []).append(i)
    group = [-1] * len(edges); groups = []
    for i in range(len(edges)):
        if group[i] >= 0: continue
        stack, members = [i], []; group[i] = len(groups)
        while stack:
            k = stack.pop(); members.append(k)
            for p in (edges[k][0], edges[k][-1]):
                for j in owner[p]:
                    if group[j] < 0: group[j] = len(groups); stack.append(j)
        groups.append(members)
    keep = []
    biggest = max(groups, key=lambda g: sum(length(edges[k]) for k in g))
    for g in groups:
        total = sum(length(edges[k]) for k in g)
        border = any(p[0] < 30 or p[1] < 30 or p[0] > h - 31 or p[1] > w - 31 for k in g for p in edges[k])
        # Un tronçon isolé (route qui s'arrête dans le sol, parking) piégerait les voitures : réseau principal seulement.
        if g is biggest: keep += [edges[k] for k in g]
    return keep


def smooth(path, rounds=2):
    """Chaikin : adoucit les angles du tracé en gardant ses extrémités."""
    for _ in range(rounds):
        if len(path) < 3: return path
        out = [path[0]]
        for a, b in zip(path, path[1:]):
            out.append((a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25)); out.append((a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75))
        out[-1] = path[-1]; path = out
    return path


def simplify(path, tolerance):
    """Ramer-Douglas-Peucker."""
    if len(path) < 3: return path
    a, b = np.array(path[0], float), np.array(path[-1], float); d = b - a; n = np.hypot(*d) or 1
    distances = [abs(d[0] * (p[1] - a[1]) - d[1] * (p[0] - a[0])) / n for p in path]
    i = int(np.argmax(distances))
    if distances[i] <= tolerance: return [path[0], path[-1]]
    return simplify(path[:i + 1], tolerance)[:-1] + simplify(path[i:], tolerance)


def main():
    texture, cu, cv = ground()
    small, mask = road_mask(texture)
    # Une rue peinte sous un bâtiment 3D n'est pas praticable : on retire l'emprise exacte des bâtiments (marge ≈ 1,3 unité).
    mask = mask & ~footprint(mask.shape, cu, cv)
    mask = keep_large(mask, 1500)
    skeleton = thin(mask)
    circles = islands(mask)
    edges = roundabouts(graph(skeleton), circles)
    edges = prune(merge(edges), spur=45)
    support = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 127
    edges = merge(bridge(edges, support))
    edges = merge(bridge(edges, support))
    edges = components(edges, mask.shape)
    edges = prune(merge(edges), spur=45)
    edges = [e for e in edges if length(e) >= 6]
    h, w = mask.shape
    # Pixel (ligne, colonne) -> UV -> monde (X, Z) par inversion de la correspondance affine du sol.
    inverse = np.linalg.inv(np.array([[cu[0], cu[1]], [cv[0], cv[1]]]))
    def world(p):
        u, v = (p[1] + .5) / w, (p[0] + .5) / h
        x, z = inverse @ np.array([u - cu[2], v - cv[2]])
        return [round(float(x), 2), round(float(z), 2)]
    paths = [[world(p) for p in smooth(simplify(e, 1.6))] for e in edges]
    total = sum(sum(math.dist(a, b) for a, b in zip(p, p[1:])) for p in paths)
    out = ROOT / 'src/data/road-network.json'
    out.write_text(json.dumps({'source': 'Chaussée peinte du sol 3D (large map extended), squelette automatique', 'paths': paths, 'heights': height_grid()}, separators=(',', ':')), encoding='utf8')
    print(json.dumps({'roundabouts': len(circles), 'paths': len(paths), 'length': round(total), 'mask_pixels': int(mask.sum()), 'skeleton_pixels': int(skeleton.sum())}))
    if DEBUG:
        DEBUG.mkdir(parents=True, exist_ok=True)
        view = Image.fromarray((np.asarray(small) * .55).astype(np.uint8)); draw = ImageDraw.Draw(view)
        view.paste((255, 255, 255), mask=Image.fromarray((mask * 90).astype(np.uint8)))
        for e in edges:
            draw.line([(p[1], p[0]) for p in smooth(simplify(e, 1.6))], fill=(0, 160, 255), width=3)
            for p in (e[0], e[-1]): draw.ellipse([p[1] - 4, p[0] - 4, p[1] + 4, p[0] + 4], fill=(255, 60, 60))
        view.save(DEBUG / 'road-network.png')


if __name__ == '__main__':
    main()
