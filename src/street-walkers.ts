/*
 * Passants sur les trottoirs, sans dépendance au moteur 3D.
 * Chacun va et vient sur un tronçon de trottoir dégagé (extract-road-network.py écarte bâtiments et chaussées).
 */

type P2 = [number, number]
export type Walker = { walk: number; s: number; direction: number; speed: number; x: number; z: number; yaw: number; phase: number }

export function createWalkers(walks: P2[][], count: number, seed = 11) {
  let state = seed
  const random = () => { state = (state * 16807) % 2147483647; return (state - 1) / 2147483646 }
  const paths = walks.map(points => {
    const cum = [0]
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1]! + Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]))
    return { points, cum, length: cum.at(-1) ?? 0 }
  }).filter(path => path.length > 8)
  // Les longs trottoirs reçoivent plus de monde.
  const total = paths.reduce((sum, path) => sum + path.length, 0)
  function pick() {
    let left = random() * total, index = 0
    while (index < paths.length - 1 && left > paths[index]!.length) { left -= paths[index]!.length; index++ }
    return index
  }
  const walkers: Walker[] = paths.length ? Array.from({ length: count }, () => {
    const walk = pick()
    return { walk, s: random() * paths[walk]!.length, direction: random() < .5 ? 1 : -1, speed: .9 + random() * .7, x: 0, z: 0, yaw: 0, phase: random() * 6.28 }
  }) : []
  function place(walker: Walker) {
    const { points, cum } = paths[walker.walk]!
    let i = 1
    while (i < points.length - 1 && cum[i]! < walker.s) i++
    const a = points[i - 1]!, b = points[i]!, span = cum[i]! - cum[i - 1]! || 1, t = Math.max(0, Math.min(1, (walker.s - cum[i - 1]!) / span))
    walker.x = a[0] + (b[0] - a[0]) * t; walker.z = a[1] + (b[1] - a[1]) * t
    const dx = (b[0] - a[0]) * walker.direction, dz = (b[1] - a[1]) * walker.direction
    walker.yaw = Math.atan2(-dx, -dz)
  }
  function step(seconds: number) {
    for (const walker of walkers) {
      walker.s += walker.direction * walker.speed * seconds
      const length = paths[walker.walk]!.length
      // Au bout du trottoir, la personne fait demi-tour.
      if (walker.s < 0) { walker.s = -walker.s; walker.direction = 1 }
      else if (walker.s > length) { walker.s = 2 * length - walker.s; walker.direction = -1 }
      walker.phase += seconds * walker.speed * 7
      place(walker)
    }
  }
  walkers.forEach(place)
  return { walkers, step }
}
