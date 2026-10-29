/*
 * Circulation sur le réseau des rues, sans dépendance au moteur 3D.
 * Les rues deviennent un graphe de carrefours ; chaque rue porte deux voies (conduite à droite).
 * Une voiture choisit sa sortie à chaque carrefour, tourne en courbe, garde ses distances,
 * n'entre dans un carrefour que s'il est libre et que sa sortie l'est aussi, puis quitte la ville
 * par un bord pendant qu'une autre y entre.
 */

type P2 = [number, number]
type P3 = [number, number, number]
export type TrafficOptions = { radius: number; laneOffset?: number; height?: (x: number, z: number) => number; seed?: number }
type Path = { pts: P3[]; cum: number[]; length: number }
type Lane = Path & { from: number; to: number; reverse: number; exits: number[] }
type Connector = Path & { node: number; from: number; to: number }
type Car = { active: boolean; lane: number; connector: number; s: number; speed: number; next: number; position: P3; yaw: number; holding: number; holdingTurn: number; waited: number; atLine: number }

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[a.length - 1]! - b[b.length - 1]!)

function makePath(points: P3[]): Path {
  const cum = [0]
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1]! + dist(points[i - 1]!, points[i]!))
  return { pts: points, cum, length: cum.at(-1) ?? 0 }
}
function at(path: Path, s: number): { p: P3; dir: P2 } {
  s = Math.max(0, Math.min(path.length, s))
  let lo = 1, hi = path.pts.length - 1
  while (lo < hi) { const mid = (lo + hi) >> 1; if (path.cum[mid]! < s) lo = mid + 1; else hi = mid }
  const a = path.pts[Math.max(0, lo - 1)]!, b = path.pts[Math.min(lo, path.pts.length - 1)]!
  const span = path.cum[lo]! - path.cum[lo - 1]!, t = span > 0 ? (s - path.cum[lo - 1]!) / span : 0
  const dx = b[0] - a[0], dz = b[2] - a[2], n = Math.hypot(dx, dz) || 1
  return { p: [a[0] + dx * t, a[1] + (b[1] - a[1]) * t, a[2] + dz * t], dir: [dx / n, dz / n] }
}
function resample(points: P2[], step: number): P2[] {
  const out: P2[] = [points[0]!]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, n = Math.max(1, Math.ceil(dist(a, b) / step))
    for (let j = 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n])
  }
  return out
}

/* ---------- Graphe des rues ---------- */
export function buildRoadGraph(streets: P2[][], mergeDistance = 9) {
  const polys = streets.map(points => { const cum = [0]; for (let i = 1; i < points.length; i++) cum.push(cum[i - 1]! + dist(points[i - 1]!, points[i]!)); return { points, cum } })
  const marks: { poly: number; s: number; p: P2 }[] = []
  const mark = (poly: number, s: number, p: P2) => marks.push({ poly, s, p })
  polys.forEach((poly, k) => { mark(k, 0, poly.points[0]!); mark(k, poly.cum.at(-1)!, poly.points.at(-1)!) })
  // Croisements entre segments.
  for (let k1 = 0; k1 < polys.length; k1++) for (let k2 = k1; k2 < polys.length; k2++) {
    const A = polys[k1]!, B = polys[k2]!
    for (let i = 0; i < A.points.length - 1; i++) for (let j = k1 === k2 ? i + 2 : 0; j < B.points.length - 1; j++) {
      const p = A.points[i]!, r: P2 = [A.points[i + 1]![0] - p[0], A.points[i + 1]![1] - p[1]]
      const q = B.points[j]!, u: P2 = [B.points[j + 1]![0] - q[0], B.points[j + 1]![1] - q[1]]
      const den = r[0] * u[1] - r[1] * u[0]
      if (Math.abs(den) < 1e-9) continue
      const t = ((q[0] - p[0]) * u[1] - (q[1] - p[1]) * u[0]) / den, w = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den
      if (t < 0 || t > 1 || w < 0 || w > 1) continue
      const x: P2 = [p[0] + r[0] * t, p[1] + r[1] * t]
      mark(k1, A.cum[i]! + t * dist(A.points[i]!, A.points[i + 1]!), x)
      mark(k2, B.cum[j]! + w * dist(B.points[j]!, B.points[j + 1]!), x)
    }
  }
  // Rues qui s'arrêtent contre une autre : raccord en T.
  polys.forEach((poly, k) => {
    for (const end of [0, poly.points.length - 1]) {
      const e = poly.points[end]!
      polys.forEach((other, k2) => {
        for (let j = 0; j < other.points.length - 1; j++) {
          const a = other.points[j]!, b = other.points[j + 1]!, len = dist(a, b)
          if (!len) continue
          const t = Math.max(0, Math.min(1, ((e[0] - a[0]) * (b[0] - a[0]) + (e[1] - a[1]) * (b[1] - a[1])) / (len * len)))
          const x: P2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], s = other.cum[j]! + t * len
          if (dist(x, e) > 7 || (k2 === k && Math.abs(s - poly.cum[end]!) < 20)) continue
          mark(k2, s, x); mark(k, poly.cum[end]!, x)
        }
      })
    }
  })
  // Regroupe les marques proches en carrefours.
  const parent = marks.map((_, i) => i)
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]!))
  for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) if (dist(marks[i]!.p, marks[j]!.p) < mergeDistance) parent[find(i)] = find(j)
  const roots = new Map<number, number>(), nodes: P2[] = [], sums: number[][] = []
  marks.forEach((m, i) => {
    const r = find(i)
    if (!roots.has(r)) { roots.set(r, nodes.length); nodes.push([0, 0]); sums.push([0, 0, 0]) }
    const id = roots.get(r)!, sum = sums[id]!; sum[0]! += m.p[0]; sum[1]! += m.p[1]; sum[2]! += 1
  })
  sums.forEach((s, i) => { nodes[i] = [s[0]! / s[2]!, s[1]! / s[2]!] })
  const nodeOf = marks.map((_, i) => roots.get(find(i))!)
  // Découpe chaque rue entre carrefours successifs.
  const edges: { a: number; b: number; points: P2[] }[] = []
  polys.forEach((poly, k) => {
    const list = marks.map((m, i) => ({ ...m, node: nodeOf[i]! })).filter(m => m.poly === k).sort((x, y) => x.s - y.s)
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i]!, b = list[i + 1]!
      if (a.node === b.node) continue
      const inner = poly.points.filter((_, j) => poly.cum[j]! > a.s + 1 && poly.cum[j]! < b.s - 1)
      const points: P2[] = [nodes[a.node]!, ...inner, nodes[b.node]!]
      if (edges.some(e => (e.a === a.node && e.b === b.node || e.a === b.node && e.b === a.node) && Math.abs(e.points.length - points.length) < 2)) continue
      edges.push({ a: a.node, b: b.node, points })
    }
  })
  // Un tronçon très court entre deux carrefours n'est pas une rue : les deux carrefours n'en font qu'un.
  // Une impasse aussi courte est un débord de parcelle : on la retire.
  const polyLength = (points: P2[]) => points.slice(1).reduce((sum, p, i) => sum + dist(points[i]!, p), 0)
  for (let changed = true; changed;) {
    changed = false
    const degree = nodes.map(() => 0)
    for (const e of edges) { degree[e.a]!++; degree[e.b]!++ }
    const index = edges.findIndex(e => e.a !== e.b && polyLength(e.points) < 16)
    if (index < 0) break
    const e = edges[index]!
    edges.splice(index, 1); changed = true
    if (degree[e.a] === 1 || degree[e.b] === 1) continue
    const merged: P2 = [(nodes[e.a]![0] + nodes[e.b]![0]) / 2, (nodes[e.a]![1] + nodes[e.b]![1]) / 2]
    nodes[e.a] = merged
    for (const other of edges) {
      if (other.a === e.b) other.a = e.a
      if (other.b === e.b) other.b = e.a
      if (other.a === e.a) other.points[0] = merged
      if (other.b === e.a) other.points[other.points.length - 1] = merged
    }
  }
  for (let i = edges.length - 1; i >= 0; i--) if (edges[i]!.a === edges[i]!.b && polyLength(edges[i]!.points) < 40) edges.splice(i, 1)
  return { nodes, edges }
}

/* ---------- Simulation ---------- */
export function createRoadTraffic(streets: P2[][], count: number, options: TrafficOptions) {
  const { radius } = options, laneOffset = options.laneOffset ?? 2.1, height = options.height ?? (() => 0)
  let seed = options.seed ?? 1
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const { nodes, edges } = buildRoadGraph(streets)
  const degree: number[] = []
  const computeDegree = () => { degree.length = 0; nodes.forEach(() => degree.push(0)); for (const e of edges) { degree[e.a]!++; degree[e.b]!++ } }
  computeDegree()
  const lift = (p: P2): P3 => [p[0], height(p[0], p[1]), p[1]]
  // Une voie : la rue rééchantillonnée, décalée à droite et raccourcie à l'approche des carrefours.
  const lanes: Lane[] = []
  // Ligne d'arrêt selon l'angle entre les rues : plus l'angle est fermé, plus on s'arrête tôt,
  // pour qu'une voiture qui attend ne déborde jamais sur la voie de sortie d'une rue voisine.
  const armDirection = (points: P2[]) => {
    let walked = 0, i = 1
    while (i < points.length - 1 && walked + dist(points[i - 1]!, points[i]!) < 8) { walked += dist(points[i - 1]!, points[i]!); i++ }
    const dx = points[i]![0] - points[0]![0], dz = points[i]![1] - points[0]![1], n = Math.hypot(dx, dz) || 1
    return [dx / n, dz / n] as P2
  }
  const trims: number[][] = []
  const computeTrims = () => { trims.length = 0; trims.push(...edges.map(e => [degree[e.a]! > 1 ? 5 : 0, degree[e.b]! > 1 ? 5 : 0])); nodes.forEach((_, node) => {
    const arms: { k: number; end: number; d: P2 }[] = []
    edges.forEach((e, k) => {
      if (e.a === node) arms.push({ k, end: 0, d: armDirection(e.points) })
      if (e.b === node) arms.push({ k, end: 1, d: armDirection([...e.points].reverse()) })
    })
    if (arms.length < 2) return
    for (const a of arms) for (const b of arms) {
      if (a === b) continue
      const half = Math.acos(Math.max(-1, Math.min(1, a.d[0] * b.d[0] + a.d[1] * b.d[1]))) / 2
      trims[a.k]![a.end] = Math.max(trims[a.k]![a.end]!, Math.min(24, (laneOffset * 2 + 3.8) / (2 * Math.max(.16, Math.sin(half)))))
    }
  }) }
  const laneEdge: [number, number][] = []
  function laneFrom(points: P2[], from: number, to: number, trimStart: number, trimEnd: number, edge: [number, number]) {
    const dense = resample(points, 1.5)
    const shifted = dense.map((p, i) => {
      const a = dense[Math.max(0, i - 1)]!, b = dense[Math.min(dense.length - 1, i + 1)]!
      const dx = b[0] - a[0], dz = b[1] - a[1], n = Math.hypot(dx, dz) || 1
      return [p[0] - dz / n * laneOffset, p[1] + dx / n * laneOffset] as P2
    })
    const raw = makePath(shifted.map(lift))
    let kept = shifted.filter((_, i) => raw.cum[i]! >= trimStart && raw.cum[i]! <= raw.length - trimEnd)
    // Rue plus courte que ses deux lignes d'arrêt : on garde son milieu, jamais ses extrémités dans les carrefours.
    if (kept.length < 2) { const mid = Math.max(1, Math.floor(shifted.length / 2)); kept = [shifted[mid - 1]!, shifted[Math.min(mid, shifted.length - 1)]!] }
    const path = makePath(kept.map(lift))
    lanes.push({ ...path, from, to, reverse: -1, exits: [] }); laneEdge.push(edge)
    return lanes.length - 1
  }
  const connectors: Connector[] = []
  const xs = nodes.map(n => n[0]), zs = nodes.map(n => n[1])
  const bounds = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
  const onBorder = (node: number) => { const [x, z] = nodes[node]!; return x - bounds[0]! < 25 || bounds[1]! - x < 25 || z - bounds[2]! < 25 || bounds[3]! - z < 25 }
  function buildTurns() {
    lanes.forEach((lane, i) => {
      if (degree[lane.to]! < 2) {
        // Impasse à l'intérieur de la ville : demi-tour au bout de la rue.
        if (onBorder(lane.to)) return
        const a = lane.pts.at(-1)!, b = lanes[lane.reverse]!.pts[0]!, dir = at(lane, lane.length).dir
        const c1: P2 = [a[0] + dir[0] * 5, a[2] + dir[1] * 5], c2: P2 = [b[0] + dir[0] * 5, b[2] + dir[1] * 5]
        const pts: P3[] = []
        for (let k = 0; k <= 12; k++) {
          const t = k / 12, m = 1 - t
          const x = m ** 3 * a[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t ** 3 * b[0]
          const z = m ** 3 * a[2] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t ** 3 * b[2]
          pts.push([x, height(x, z), z])
        }
        lane.exits.push(connectors.length)
        connectors.push({ ...makePath(pts), node: lane.to, from: i, to: lane.reverse })
        return
      }
      for (const [j, out] of lanes.entries()) {
        if (out.from !== lane.to || j === lane.reverse) continue
        const a = lane.pts.at(-1)!, b = out.pts[0]!, c = lift(nodes[lane.to]!)
        const din = at(lane, lane.length).dir, dout = at(out, 0).dir
        if (din[0] * dout[0] + din[1] * dout[1] < -.85) continue
        const control: P2 = [(a[0] + b[0]) / 2 * .5 + c[0] * .5, (a[2] + b[2]) / 2 * .5 + c[2] * .5]
        const pts: P3[] = []
        for (let k = 0; k <= 10; k++) {
          const t = k / 10, x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * control[0] + t * t * b[0], z = (1 - t) ** 2 * a[2] + 2 * (1 - t) * t * control[1] + t * t * b[2]
          pts.push([x, height(x, z), z])
        }
        lane.exits.push(connectors.length)
        connectors.push({ ...makePath(pts), node: lane.to, from: i, to: j })
      }
    })
  }
  // Fusionne les deux carrefours d'un tronçon : un mini-carrefour en grappe devient un seul carrefour.
  function collapse(index: number) {
    const e = edges[index]!; edges.splice(index, 1)
    const merged: P2 = [(nodes[e.a]![0] + nodes[e.b]![0]) / 2, (nodes[e.a]![1] + nodes[e.b]![1]) / 2]
    nodes[e.a] = merged
    for (const other of edges) {
      if (other.a === e.b) other.a = e.a
      if (other.b === e.b) other.b = e.a
      if (other.a === e.a) other.points[0] = merged
      if (other.b === e.a) other.points[other.points.length - 1] = merged
    }
    for (let i = edges.length - 1; i >= 0; i--) if (edges[i]!.a === edges[i]!.b) edges.splice(i, 1)
  }
  for (let round = 0; round < 12; round++) {
  computeDegree(); computeTrims()
  // Construit voies et virages, puis recule toute ligne d'arrêt qu'un virage frôle :
  // une voiture arrêtée au feu ne doit jamais gêner celle qui tourne.
  for (let pass = 0; pass < 10; pass++) {
    lanes.length = 0; laneEdge.length = 0; connectors.length = 0
    for (const [k, e] of edges.entries()) {
      const f = laneFrom(e.points, e.a, e.b, trims[k]![0]!, trims[k]![1]!, [k, 1]), b = laneFrom([...e.points].reverse(), e.b, e.a, trims[k]![1]!, trims[k]![0]!, [k, 0])
      lanes[f]!.reverse = b; lanes[b]!.reverse = f
    }
    buildTurns()
    let changed = false
    lanes.forEach((lane, i) => {
      if (degree[lane.to]! < 3) return
      const stop = lane.pts.at(-1)!, [k, end] = laneEdge[i]!
      if (trims[k]![end]! >= 30) return
      const nearTurn = connectors.some(c => c.node === lane.to && c.from !== i && c.pts.some(p => dist(p, stop) < 3.6))
      const nearExit = lanes.some((out, j) => out.from === lane.to && j !== lane.reverse && out.pts.some((p, n) => out.cum[n]! < 8 && dist(p, stop) < 3.6))
      if (nearTurn || nearExit) { trims[k]![end]! += 2; changed = true }
    })
    if (!changed) break
  }
  // Une rue plus courte que ses deux lignes d'arrêt n'en est pas une : on fusionne ses carrefours et on reconstruit.
  const squeezed = edges.findIndex((e, k) => degree[e.a]! > 1 && degree[e.b]! > 1 && lanes.some((l, i) => laneEdge[i]![0] === k && l.length < 4))
  if (squeezed < 0) break
  collapse(squeezed)
  }
  const entries = lanes.map((_, i) => i).filter(i => degree[lanes[i]!.from] === 1 && onBorder(lanes[i]!.from))
  const totalLength = lanes.reduce((sum, l) => sum + l.length, 0)
  const separation = radius * 2 + .8
  // Deux virages d'un même carrefour sont compatibles s'ils ne se croisent pas et ne visent pas la même sortie.
  const conflicts = connectors.map((a, i) => connectors.map((b, j) => {
    if (i === j || a.node !== b.node) return i === j
    if (a.to === b.to || a.from === b.from) return true
    return a.pts.some(p => b.pts.some(q => dist(p, q) < 3.6))
  }))
  // Feux à deux phases : les arrivées à peu près perpendiculaires alternent au vert.
  const phaseOf = lanes.map(lane => { const d = at(lane, lane.length).dir; return Math.round((Math.atan2(d[1], d[0]) + Math.PI) / (Math.PI / 2)) % 2 })

  const cars: Car[] = Array.from({ length: count }, () => ({ active: false, lane: 0, connector: -1, s: 0, speed: 0, next: -1, position: [0, 0, 0], yaw: 0, holding: -1, holdingTurn: -1, waited: 0, atLine: 0 }))
  const reserved = new Map<number, Set<number>>()
  const pathOf = (car: Car): Path => car.connector >= 0 ? connectors[car.connector]! : lanes[car.lane]!
  const chooseExit = (lane: number) => { const exits = lanes[lane]!.exits; return exits.length ? exits[Math.floor(random() * exits.length)]! : -1 }
  function place(car: Car) { const { p, dir } = at(pathOf(car), car.s); car.position = p; car.yaw = Math.atan2(-dir[0], -dir[1]) }
  const free = (p: readonly number[], except: Car) => cars.every(o => o === except || !o.active || dist(o.position, p) > separation * 2)
  // Fait apparaître une voiture : par une entrée de la ville si possible, sinon n'importe où sur une voie libre.
  function spawn(car: Car, atEntry: boolean) {
    for (let attempt = 0; attempt < 30; attempt++) {
      let lane: number, s: number
      if (atEntry && entries.length && attempt < 15) { lane = entries[Math.floor(random() * entries.length)]!; s = 0 }
      else {
        let pick = random() * totalLength; lane = 0
        while (lane < lanes.length - 1 && pick > lanes[lane]!.length) { pick -= lanes[lane]!.length; lane++ }
        s = Math.min(pick, lanes[lane]!.length)
      }
      if (!free(at(lanes[lane]!, s).p, car)) continue
      Object.assign(car, { active: true, lane, connector: -1, s, speed: 1.5, next: chooseExit(lane), holding: -1, holdingTurn: -1, waited: 0, atLine: 0 })
      place(car); return true
    }
    return false
  }

  let desired = count, speedMultiplier = 1, congestion = 0, elapsed = 0, borderExits = 0, stuckRemovals = 0
  function configure(activeCars: number, multiplier: number, jam: number) {
    desired = Math.max(0, Math.min(count, Math.floor(activeCars)))
    speedMultiplier = Math.max(.1, Math.min(1, multiplier)); congestion = Math.max(0, Math.min(2, jam))
  }
  function populate(initial: boolean) {
    let active = cars.filter(c => c.active).length
    for (const car of cars) {
      if (active > desired && car.active && car.connector < 0 && car.holding < 0) { car.active = false; active-- }
      else if (active < desired && !car.active && spawn(car, !initial)) active++
    }
  }
  // Points que la voiture va parcourir : sa voie, le virage choisi, puis le début de la voie suivante.
  function lookahead(car: Car, range: number) {
    const out: { p: P3; d: number }[] = []
    let path = pathOf(car), s = car.s, d = 0, next = car.connector >= 0 ? -2 : car.next
    while (d < range) {
      const step = Math.min(1.2, path.length - s)
      if (step <= .01) {
        if (car.connector >= 0 && next === -2) { path = lanes[connectors[car.connector]!.to]!; s = 0; next = -3; continue }
        if (next >= 0) { path = connectors[next]!; s = 0; next = -2; continue }
        break
      }
      s += step; d += step; out.push({ p: at(path, s).p, d })
    }
    return out
  }
  function release(car: Car) {
    const holders = reserved.get(car.holding)
    if (holders) { holders.delete(cars.indexOf(car)); if (!holders.size) reserved.delete(car.holding) }
    car.holding = -1; car.holdingTurn = -1
  }
  // Feu rouge pour cette arrivée : le cycle dure 24 s, les deux phases alternent, plus longtemps quand ça bouchonne.
  const red = (lane: number, node: number) => {
    if (congestion === 0 || degree[node]! < 3) return false
    const cycle = (elapsed + node * 3.7) % 24, green = congestion === 2 ? 10 : 11
    return phaseOf[lane] === 0 ? !(cycle < green) : !(cycle >= 12 && cycle < 12 + green)
  }

  function step(seconds: number) {
    let remaining = Math.min(seconds, .1)
    while (remaining > 1e-8) {
      const dt = Math.min(remaining, .02); remaining -= dt; elapsed += dt
      populate(false)
      for (const car of cars) {
        if (!car.active) continue
        const path = pathOf(car), { dir } = at(path, car.s)
        // Vitesse de croisière réduite dans les virages.
        const ahead = at(path, car.s + 4).dir
        const turn = Math.acos(Math.max(-1, Math.min(1, dir[0] * ahead[0] + dir[1] * ahead[1])))
        let target = Math.min(5.5, 1.6 + 3.9 * (1 - Math.min(1, turn / .9))) * speedMultiplier
        // Une fois engagée, la voiture dégage franchement le carrefour, même dans les bouchons.
        if (car.connector >= 0) target = 3.2
        // Garde ses distances avec tout véhicule présent sur sa trajectoire.
        for (const { p, d } of lookahead(car, 14)) {
          if (cars.some(o => o !== car && o.active && dist(o.position, p) < 3.2)) { target = Math.min(target, Math.max(0, (d - separation) / 1.4)); break }
        }
        // Avant un carrefour : le carrefour doit être libre, la sortie dégagée et le feu au vert.
        if (car.connector < 0 && car.next >= 0) {
          const lane = lanes[car.lane]!, gap = lane.length - car.s, node = connectors[car.next]!.node
          if (gap < 7) {
            // En abordant un nouveau carrefour, on rend le précédent : sinon deux voitures sur une rue courte s'attendent mutuellement.
            if (car.holding >= 0 && car.holding !== node) release(car)
            const index = cars.indexOf(car), holders = reserved.get(node) ?? new Set<number>()
            const mine = car.holding === node && car.holdingTurn === car.next
            const exitClear = cars.every(o => o === car || !o.active || o.connector >= 0 || o.lane !== connectors[car.next]!.to || o.s > separation * 1.6)
            const compatible = [...holders].every(h => h === index || !conflicts[car.next]![cars[h]!.holdingTurn]!)
            // Seule la voiture en tête de file peut demander le passage.
            const first = !cars.some(o => o !== car && o.active && o.connector < 0 && o.lane === car.lane && o.s > car.s)
            // Équité : celle qui attend au stop depuis le plus longtemps passe avant les mouvements qui la coupent.
            const priority = !cars.some(o => o !== car && o.active && o.connector < 0 && o.next >= 0 && connectors[o.next]!.node === node && o.atLine > 4 && o.atLine > car.atLine + 1 && conflicts[car.next]![o.next]!)
            if (mine || (first && compatible && exitClear && priority && !red(car.lane, node))) {
              if (!mine) { release(car); holders.add(index); reserved.set(node, holders); car.holding = node; car.holdingTurn = car.next; car.atLine = 0 }
            }
            else { target = Math.min(target, Math.max(0, (gap - .5) / 1.2)); if (gap < 1.5) car.atLine += dt }
          }
        }
        if (car.connector < 0 && car.next < 0 && lanes[car.lane]!.length - car.s < .3) { release(car); car.active = false; borderExits++; continue }
        // Une voiture immobilisée trop longtemps quitte la circulation ; une autre entrera par un bord.
        car.waited = car.speed < .05 && target < .1 ? car.waited + dt : 0
        if (car.waited > 60 && car.connector < 0) { release(car); car.active = false; stuckRemovals++; continue }
        const previous = car.speed
        car.speed += Math.max(-4 * dt, Math.min(1.6 * dt, target - car.speed))
        car.s += (previous + car.speed) * .5 * dt
        // Changement de tronçon en fin de parcours.
        while (car.s >= pathOf(car).length) {
          const over = car.s - pathOf(car).length
          if (car.connector >= 0) { car.lane = connectors[car.connector]!.to; car.connector = -1; car.next = chooseExit(car.lane) }
          else if (car.next >= 0 && car.holding === connectors[car.next]!.node) { car.connector = car.next; car.next = -1 }
          else { car.s = pathOf(car).length; car.speed = 0; break }
          car.s = over
        }
        // Libère le carrefour une fois engagé sur la voie de sortie.
        if (car.holding >= 0 && car.connector < 0 && car.s > radius + .6 && (car.next < 0 || connectors[car.next]!.node !== car.holding)) release(car)
        place(car)
      }
      for (const [node, holders] of reserved) { for (const h of holders) if (!cars[h]!.active || cars[h]!.holding !== node) holders.delete(h); if (!holders.size) reserved.delete(node) }
    }
  }
  populate(true)
  return {
    states: cars,
    step, configure, separation,
    get stats() { return { borderExits, stuckRemovals } },
    lanePaths: () => lanes.map(l => l.pts.filter((_, i) => i % 3 === 0 || i === l.pts.length - 1)),
    get network() { return { nodes: nodes.length, streets: edges.length, lanes: lanes.length, turns: connectors.length, entries: entries.length, length: totalLength } },
  }
}
