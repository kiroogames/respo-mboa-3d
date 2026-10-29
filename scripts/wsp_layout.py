# Recherche des emplacements des maisons sans agrandir leur géométrie.
# Les routes réservées, l’eau, les bâtiments et les écarts minimaux limitent les parcelles acceptées.

"""Spread the WSP layout while preserving the dimensions of every native building."""
import math
import statistics


def is_house(name):
    return name.lower().startswith(('maison', 'rich home', 'house_player'))


def rectangle_gap(a, b):
    return math.hypot(max(a[0] - b[2], b[0] - a[2], 0),
                      max(a[1] - b[3], b[1] - a[3], 0))


# Déplace les centres et conserve les empreintes ; la recherche privilégie les grandes parcelles déjà nommées.
def spread_city(bounds, scale, minimum_gap, painted_color, presidency_offset, streets):
    centers = {name: ((r[0] + r[2]) / 2, (r[1] + r[3]) / 2)
               for name, r in bounds.items()}
    offsets = {}
    for name, (x, y) in centers.items():
        dx, dy = presidency_offset if name == 'presidence' else (0, 0)
        offsets[name] = ((x + dx) * scale - x, (y + dy) * scale - y)

    # Move the roadside billboard clear of the roundabout carriageway.
    ox,oy=offsets["panneau PUB"];offsets["panneau PUB"]=(ox-8,oy+12)

    # These meshes form a single stacked complex and must move together.
    police = ['contenair_police', 'comissariat', 'HotelDePolilce fontaine']
    group = [bounds[name] for name in police]
    x = (min(r[0] for r in group) + max(r[2] for r in group)) / 2
    y = (min(r[1] for r in group) + max(r[3] for r in group)) / 2
    for name in police:
        offsets[name] = ((scale - 1) * x, (scale - 1) * y)

    def shifted(name, offset):
        a, b, c, d = bounds[name]
        return (a + offset[0], b + offset[1], c + offset[0], d + offset[1])

    houses = [name for name in bounds if is_house(name)]
    obstacles = [shifted(name, offset) for name, offset in offsets.items() if name not in houses]
    placed = []
    adjustments = []

    def clear_land(rect):
        a, b, c, d = rect
        if streets.intersects(rect):
            return False
        # Sample the core of the actual plot; corners include the native apron.
        for fx in [.12, .5, .88]:
            for fy in [.12, .5, .88]:
                r, g, blue = painted_color(a + (c - a) * fx, b + (d - b) * fy)
                water = blue > r * 1.22 and g > r * 1.3 and blue > .24
                if water:
                    return False
        return True

    # Large named homes retain their lots; nearby small houses use the new space.
    for name in sorted(houses, key=lambda n: (-((bounds[n][2] - bounds[n][0]) *
                                               (bounds[n][3] - bounds[n][1])), n)):
        desired = offsets[name]
        best = None
        for ring in range(25):
            candidates = [(0, 0)] if ring == 0 else [
                (2 * ring * math.cos(i * math.tau / 32),
                 2 * ring * math.sin(i * math.tau / 32)) for i in range(32)]
            for dx, dy in candidates:
                offset = (desired[0] + dx, desired[1] + dy)
                rect = shifted(name, offset)
                if any(rectangle_gap(rect, other) < minimum_gap - .00001 for _, other in placed):
                    continue
                if any(rectangle_gap(rect, other) < 1.5 for other in obstacles):
                    continue
                if not clear_land(rect):
                    continue
                best = (offset, rect, dx, dy)
                break
            if best is not None:
                break
        if best is None:
            raise RuntimeError('No clear, separated plot found near ' + name)
        offset, rect, dx, dy = best
        offsets[name] = offset
        placed.append((name, rect))
        adjustments.append({'name': name, 'extra_move': [dx, dy], 'footprint': list(rect)})

    gaps = [rectangle_gap(a, b) for i, (_, a) in enumerate(placed) for _, b in placed[i + 1:]]
    nearest = [min(rectangle_gap(a, b) for other, b in placed if name != other)
               for name, a in placed]
    old_nearest = [min(rectangle_gap(bounds[name], bounds[other]) for other in houses if name != other)
                   for name in houses]
    assert min(gaps) >= minimum_gap - .00001, 'House plots still touch'
    return offsets, {
        'horizontal_scale': scale, 'area_multiplier': scale * scale,
        'houses': len(houses), 'minimum_house_gap': min(gaps),
        'median_nearest_gap_before': statistics.median(old_nearest),
        'median_nearest_gap_after': statistics.median(nearest),
        'local_adjustments': sum(math.hypot(*record['extra_move']) > .01 for record in adjustments),
        'maximum_local_adjustment': max(math.hypot(*record['extra_move']) for record in adjustments),
        'plots_checked_clear_of_roads_and_water': len(placed),
        'preserved_dimensions': True, 'house_plots': adjustments,
    }