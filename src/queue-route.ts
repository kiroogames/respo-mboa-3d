/*
 * File d'attente façon Pragmata : un seul chemin du dossier (départ) à la signature (arrivée),
 * sans repasser sur ses pas. Les cases portent des gains (+) ou des pertes (−) de monnaies du jeu.
 * Une graine stable redonne la même grille après fermeture ou rechargement.
 */

export type RouteUnit = 'nkap' | 'energy' | 'mood' | 'influence'
export type RouteTile = { unit: RouteUnit; amount: number }
export type QueueRoute = { size: number; start: number; goal: number; blocked: number[]; tiles: Record<number, RouteTile>; level: number }
export type RouteTotals = Record<RouteUnit, number>

const size = 5
function generator(seed: string) {
  let state = 2166136261
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619)
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296 }
}
export function routeNeighbours(cell: number) {
  const x = cell % size, y = Math.floor(cell / size)
  return [x > 0 ? cell - 1 : -1, x < size - 1 ? cell + 1 : -1, y > 0 ? cell - size : -1, y < size - 1 ? cell + size : -1].filter(c => c >= 0)
}

/** Niveau 0 à 4 : chemin conseillé plus long, plus d'obstacles et de pertes, influence aux niveaux élevés. */
export function createQueueRoute(seed: string, difficulty = 0): QueueRoute {
  const level = Math.max(0, Math.min(4, Math.floor(Number.isFinite(difficulty) ? difficulty : 0)))
  const random = generator(`queue-route-v1/${seed}`), pick = <T,>(values: T[]) => values[Math.floor(random() * values.length)]!
  const shuffle = <T,>(values: T[]) => { for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [values[i], values[j]] = [values[j]!, values[i]!] } return values }
  // Départ au milieu du bas, signature au milieu du haut : la colonne centrale est le raccourci, les côtés sont des détours.
  const start = 22, goal = 2, minimum = 9 + level, maximum = 13 + level
  // Chemin « payant » : long détour réservé d'avance, il garantit une solution à la grille.
  const route = [start], visited = new Set(route)
  let attempts = 0
  function carve(cell: number): boolean {
    if (++attempts > 40000) return false
    if (cell === goal) return route.length >= minimum
    const remaining = Math.abs(cell % size - goal % size) + Math.abs(Math.floor(cell / size) - Math.floor(goal / size))
    if (route.length + remaining > maximum) return false
    for (const next of shuffle(routeNeighbours(cell))) {
      if (visited.has(next)) continue
      visited.add(next); route.push(next)
      if (carve(next)) return true
      visited.delete(next); route.pop()
    }
    return false
  }
  if (!carve(start)) route.splice(0, route.length, 22, 21, 20, 15, 10, 5, 0, 1, 2)
  const onRoute = new Set(route), free = Array.from({ length: size * size }, (_, c) => c).filter(c => !onRoute.has(c))
  // Guichets fermés : hors du chemin réservé, donc la grille reste toujours faisable.
  const blocked = new Set(shuffle([...free]).slice(0, 1 + Math.ceil(level / 2)))
  const tiles: Record<number, RouteTile> = {}
  const interior = route.slice(1, -1)
  // Détour d'une case : 0 si elle est sur un plus court chemin, plus grand si elle oblige à s'écarter.
  const manhattan = (a: number, b: number) => Math.abs(a % size - b % size) + Math.abs(Math.floor(a / size) - Math.floor(b / size))
  const detour = (cell: number) => manhattan(start, cell) + manhattan(cell, goal) - manhattan(start, goal)
  // Gains sur les cases du détour les plus écartées : environ 800 Nkap pour qui fait le grand tour.
  const gainCells = shuffle([...interior]).sort((a, b) => detour(b) - detour(a)).slice(0, 4).filter(c => detour(c) > 0)
  let budget = 800
  gainCells.forEach((cell, i) => {
    const left = gainCells.length - i, amount = i === gainCells.length - 1 ? budget : Math.max(100, Math.min(budget - (left - 1) * 100, Math.round(budget / left / 50 + (random() - .5) * 2) * 50))
    tiles[cell] = { unit: 'nkap', amount }; budget -= amount
  })
  const plainOnRoute = () => interior.filter(c => !tiles[c])
  if (level >= 1 && plainOnRoute().length) tiles[pick(plainOnRoute())] = { unit: 'mood', amount: 2 + level }
  // L'influence reste rare : seulement sur la demande la plus difficile (elle sert surtout aux quêtes des PNJ).
  if (level >= 4 && plainOnRoute().length) tiles[pick(plainOnRoute())] = { unit: 'influence', amount: 1 }
  // Le chemin payant coûte aussi un peu : il faut accepter une perte pour aller chercher le gros gain.
  if (level >= 2 && plainOnRoute().length) tiles[pick(plainOnRoute())] = { unit: 'energy', amount: -(2 + level) }
  // Pertes sur les raccourcis (cases sans détour) : aller droit à la signature rapporte peu et use.
  const direct = shuffle(free.filter(c => !blocked.has(c) && detour(c) === 0))
  const others = shuffle(free.filter(c => !blocked.has(c) && detour(c) > 0))
  const lossKinds: RouteTile[] = [{ unit: 'mood', amount: -(3 + level) }, { unit: 'energy', amount: -(4 + level) }]
  if (level >= 2) lossKinds.push({ unit: 'nkap', amount: -(50 + level * 25) })
  direct.slice(0, 3 + level).forEach((cell, i) => { tiles[cell] = lossKinds[i % lossKinds.length]! })
  // Petite tentation hors du chemin : un bonus au bout d'une impasse.
  const lure = others.find(c => !tiles[c])
  if (level >= 1 && lure !== undefined) tiles[lure] = { unit: 'nkap', amount: 100 }
  // Rotations et symétries : même logique, positions variées.
  const rotations = Math.floor(random() * 4), mirror = random() < .5
  const transform = (cell: number) => {
    let x = cell % size, y = Math.floor(cell / size)
    if (mirror) x = size - 1 - x
    for (let i = 0; i < rotations; i++) [x, y] = [size - 1 - y, x]
    return y * size + x
  }
  return {
    size, level, start: transform(start), goal: transform(goal), blocked: [...blocked].map(transform),
    tiles: Object.fromEntries(Object.entries(tiles).map(([cell, tile]) => [transform(Number(cell)), tile])),
  }
}

/** Vérifie le tracé (départ → arrivée, pas orthogonaux, sans retour ni obstacle) et additionne les cases. */
export function scoreQueueRoute(board: QueueRoute, path: readonly number[], requireGoal = true): RouteTotals | null {
  if (!Array.isArray(path) || !path.length || path.length > size * size || path[0] !== board.start) return null
  const seen = new Set<number>(), totals: RouteTotals = { nkap: 0, energy: 0, mood: 0, influence: 0 }
  for (let i = 0; i < path.length; i++) {
    const cell = path[i]!
    if (!Number.isInteger(cell) || cell < 0 || cell >= size * size || seen.has(cell) || board.blocked.includes(cell)) return null
    if (i > 0 && !routeNeighbours(path[i - 1]!).includes(cell)) return null
    if (cell === board.goal && i !== path.length - 1) return null
    seen.add(cell)
    const tile = board.tiles[cell]
    if (tile) totals[tile.unit] += tile.amount
  }
  if (requireGoal && path.at(-1) !== board.goal) return null
  return totals
}

/** Le gain en Nkap d'une demande ne descend jamais sous zéro ; énergie et humeur peuvent être négatives. */
export function routePayout(totals: RouteTotals) {
  return { money: Math.max(0, totals.nkap), energyLoss: Math.max(0, -totals.energy), energyGain: Math.max(0, totals.energy), mood: totals.mood, influence: totals.influence }
}
