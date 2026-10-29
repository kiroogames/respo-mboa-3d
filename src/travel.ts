/*
 * Réseau routier et devis : les trajets suivent les rues tracées sur la carte WSP.
 * Un point de trajet est [X, Y, Z] ; les distances tarifées utilisent le plan horizontal X/Z.
 */

import streets from '../scripts/wsp-streets.json' with { type: 'json' }
import settings from '../city-layout.json' with { type: 'json' }
import rules from '../travel-rules.json' with { type: 'json' }
import { getTrafficConditions } from './traffic-conditions.ts'
import type { TrafficConditions } from './traffic-conditions.ts'

export type TravelPoint = [number, number, number]
export type TravelMode = 'walk' | 'taxi' | 'yonga' | 'moto'
const scale = settings.horizontalScale
const distance = (a: TravelPoint, b: TravelPoint) => Math.hypot(a[0] - b[0], a[2] - b[2])
const nodes: TravelPoint[] = []
const edges: { to: number; cost: number }[][] = []
// Échantillonne les rues pour relier leurs intersections ; les coûts des arêtes restent des distances horizontales.
function addPath(points: TravelPoint[]) {
  let previous = -1
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!, steps = Math.max(1, Math.ceil(distance(a, b) / 6))
    for (let j = 0; j <= steps; j++) {
      if (i > 0 && j === 0) continue
      const t = j / steps, p: TravelPoint = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
      const id = nodes.length
      nodes.push(p); edges.push([])
      if (previous >= 0) connect(previous, id)
      previous = id
    }
  }
}
function connect(a: number, b: number) {
  const cost = distance(nodes[a]!, nodes[b]!)
  edges[a]!.push({ to: b, cost }); edges[b]!.push({ to: a, cost })
}
// Rues en coordonnées du monde (X, Z) : partagées par les trajets du joueur et la circulation.
export const streetPaths: [number, number][][] = []
for (const path of streets.paths) {
  const points = path.map(([x, y]) => [
    (((x! / 1800 * 6392 - 1276) / 3840) * 235.2227173 - 121.1039047) * scale,
    8,
    -((1 - y! / 1161) * 261.2766 - 126.4015656) * scale,
  ] as TravelPoint)
  streetPaths.push(points.map(p => [p[0], p[2]]))
  addPath(points)
}
const presidencyRoad = [[-88, 8, -28], [-109, 8, -51], [-122, 12, -43], [-133, 18, -22], [-155, 28, -26], [-173, 36, -37], [-177.98, 42, -64.55]]
  .map(([x, y, z]) => [x! * scale, y!, z! * scale] as TravelPoint)
streetPaths.push(presidencyRoad.map(p => [p[0], p[2]]))
addPath(presidencyRoad)
// Join streets at junctions, including crossings between sampled segments.
for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
  if (distance(nodes[i]!, nodes[j]!) < 9) connect(i, j)
}

// Dijkstra relie les points routiers les plus proches ; les extrémités exactes raccordent le joueur et le lieu.
export function createTravelRoute(from: TravelPoint, to: TravelPoint) {
  const nearest = (p: TravelPoint) => nodes.reduce((best, node, i) => distance(node, p) < distance(nodes[best]!, p) ? i : best, 0)
  const start = nearest(from), goal = nearest(to)
  const costs = nodes.map(() => Infinity), parent = nodes.map(() => -1), visited = new Set<number>()
  costs[start] = 0
  while (visited.size < nodes.length) {
    let current = -1
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && Number.isFinite(costs[i]) && (current < 0 || costs[i]! < costs[current]!)) current = i
    if (current < 0) throw new Error('Cette zone n’est pas encore reliée au réseau de déplacement.')
    if (current === goal) break
    visited.add(current)
    for (const edge of edges[current]!) if (costs[current]! + edge.cost < costs[edge.to]!) {
      costs[edge.to] = costs[current]! + edge.cost; parent[edge.to] = current
    }
  }
  const route: TravelPoint[] = [to]
  for (let i = goal; i >= 0; i = parent[i]!) route.unshift(nodes[i]!)
  route.unshift(from)
  return route.filter((p, i) => i === 0 || i === route.length - 1 || distance(p, route[i - 1]!) > .01)
}

// Starting tariffs, centralized here for future gameplay balancing.
export const travelModes = [
  { id: 'walk', label: 'À pied', description: 'Sans frais de transport', symbol: '🚶', fare: 0, moneyPerKm: 0, energyPerKm: 4, metersPerMinute: 75, departureMinutes: 0, stopsMinutesPerKm: 0 },
  { id: 'taxi', label: 'Taxi commun', description: 'Trajet partagé · attente et arrêts possibles', symbol: '🚕', fare: 150, moneyPerKm: 60, energyPerKm: 0, metersPerMinute: 500, departureMinutes: 10, stopsMinutesPerKm: 1.5 },
  { id: 'yonga', label: 'Yonga — taxi privé', description: 'Véhicule réservé · trajet direct', symbol: '🚘', fare: 600, moneyPerKm: 180, energyPerKm: 0, metersPerMinute: 550, departureMinutes: 5, stopsMinutesPerKm: 0 },
  { id: 'moto', label: 'Moto', description: 'Plus agile dans la circulation', symbol: '🏍️', fare: 100, moneyPerKm: 50, energyPerKm: .3, metersPerMinute: 450, departureMinutes: 5, stopsMinutesPerKm: 0 },
] as const

// Convertit la longueur en mètres de ville, applique le mode et le trafic, puis arrondit la durée au multiple de 5 supérieur.
export function quoteTravel(route: TravelPoint[], mode: TravelMode, traffic: TrafficConditions = getTrafficConditions()) {
  const config = travelModes.find(item => item.id === mode)!
  const length = route.slice(1).reduce((sum, point, i) => sum + distance(route[i]!, point), 0)
  const distanceMeters = length * rules.cityMetersPerMapUnit
  const factor = mode === 'taxi' || mode === 'yonga' ? traffic.taxiFactor : mode === 'moto' ? traffic.motoFactor : 1
  const fixedMinutes = config.departureMinutes + distanceMeters / 1000 * config.stopsMinutesPerKm
  const rawMinutes = fixedMinutes + distanceMeters / config.metersPerMinute * factor
  return {
    mode, label: config.label, length, distanceMeters, traffic,
    money: config.fare + Math.ceil(distanceMeters / 1000 * config.moneyPerKm / 10) * 10,
    energy: Math.ceil(distanceMeters / 1000 * config.energyPerKm),
    minutes: Math.max(5, Math.ceil(rawMinutes / 5) * 5),
    clearMinutes: Math.max(5, Math.ceil((fixedMinutes + distanceMeters / config.metersPerMinute) / 5) * 5),
  }
}
