/*
 * Réseau routier et devis : les trajets suivent la chaussée peinte du sol 3D (road-network.json).
 * Un point de trajet est [X, Y, Z] ; les distances tarifées utilisent le plan horizontal X/Z.
 */

import { loc } from './i18n.ts'
import { roadPaths } from './road-network.ts'
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
// Rues = chaussée réellement peinte sur le sol (road-network.json), la même que suit la circulation :
// le Respo, son taxi ou sa moto et les habitants roulent sur les vraies routes, plus sur l'ancien tracé.
export const streetPaths: [number, number][][] = roadPaths.map(path => path.map(([x, z]) => [x, z] as [number, number]))
for (const path of roadPaths) addPath(path.map(([x, z]) => [x, 8, z] as TravelPoint))
// Les tronçons se touchent exactement aux carrefours : un raccord court (2,5 unités) évite les raccourcis
// à travers les pâtés de maisons qu'un seuil large créait entre deux rues parallèles.
const roadNodes = nodes.length
for (let i = 0; i < roadNodes; i++) for (let j = i + 1; j < roadNodes; j++) {
  if (distance(nodes[i]!, nodes[j]!) < 2.5) connect(i, j)
}
// Route de la présidence (absente de la chaussée peinte) : tracé manuel raccordé au point de route le plus proche.
const presidencyRoad = [[-88, 8, -28], [-109, 8, -51], [-122, 12, -43], [-133, 18, -22], [-155, 28, -26], [-173, 36, -37], [-177.98, 42, -64.55]]
  .map(([x, y, z]) => [x! * scale, y!, z! * scale] as TravelPoint)
streetPaths.push(presidencyRoad.map(p => [p[0], p[2]]))
addPath(presidencyRoad)
let joint = 0
for (let i = 1; i < roadNodes; i++) if (distance(nodes[i]!, nodes[roadNodes]!) < distance(nodes[joint]!, nodes[roadNodes]!)) joint = i
connect(joint, roadNodes)
// Réseau principal : les bouts de route isolés (bords de carte) ne servent jamais de point d'accroche,
// sinon un lieu voisin se retrouverait « non relié ».
const main = new Set<number>([roadNodes])
for (const stack = [roadNodes]; stack.length;) for (const edge of edges[stack.pop()!]!) if (!main.has(edge.to)) { main.add(edge.to); stack.push(edge.to) }

// Dijkstra relie les points routiers les plus proches ; les extrémités exactes raccordent le joueur et le lieu.
export function createTravelRoute(from: TravelPoint, to: TravelPoint) {
  const nearest = (p: TravelPoint) => nodes.reduce((best, node, i) => main.has(i) && distance(node, p) < distance(nodes[best]!, p) ? i : best, roadNodes)
  const start = nearest(from), goal = nearest(to)
  const costs = nodes.map(() => Infinity), parent = nodes.map(() => -1), visited = new Set<number>()
  costs[start] = 0
  while (visited.size < nodes.length) {
    let current = -1
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && Number.isFinite(costs[i]) && (current < 0 || costs[i]! < costs[current]!)) current = i
    if (current < 0) throw new Error(loc('Cette zone n’est pas encore reliée au réseau de déplacement.'))
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
  // Marche : gratuite mais lente, fatigante et pénible pour l'humeur.
  { id: 'walk', label: loc('À pied'), description: loc('Gratuit, mais long et éprouvant'), symbol: '🚶', fare: 0, moneyPerKm: 0, energyPerKm: 4, moodPerKm: 3, metersPerMinute: 75, departureMinutes: 0, stopsMinutesPerKm: 0 },
  // Taxi commun : le moins cher des véhicules, lent (attente, arrêts) et inconfortable.
  { id: 'taxi', label: loc('Taxi commun'), description: loc('Pas cher · lent, serré, arrêts fréquents'), symbol: '🚕', fare: 150, moneyPerKm: 60, energyPerKm: 0, moodPerKm: 1.5, metersPerMinute: 300, departureMinutes: 5, stopsMinutesPerKm: 1.5 },
  // Yonga : cher et rapide, mais coincé dans les embouteillages ; le confort remonte l’humeur (coût d’humeur négatif = gain).
  { id: 'yonga', label: loc('Yonga — taxi privé'), description: loc('Cher et confortable · remonte l’humeur · ralenti par les bouchons'), symbol: '🚘', fare: 600, moneyPerKm: 180, energyPerKm: 0, moodPerKm: -1.5, metersPerMinute: 600, departureMinutes: 5, stopsMinutesPerKm: 0 },
  // Moto : plus chère que le taxi commun, un peu plus rapide que Yonga, légèrement éprouvante ; se faufile mais subit aussi les bouchons.
  { id: 'moto', label: 'Moto', description: loc('Pratique et rapide · un peu secouant'), symbol: '🏍️', fare: 250, moneyPerKm: 110, energyPerKm: .3, moodPerKm: .5, metersPerMinute: 650, departureMinutes: 3, stopsMinutesPerKm: 0 },
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
    mood: Math.ceil(distanceMeters / 1000 * config.moodPerKm),
    minutes: Math.max(5, Math.ceil(rawMinutes / 5) * 5),
    clearMinutes: Math.max(5, Math.ceil((fixedMinutes + distanceMeters / config.metersPerMinute) / 5) * 5),
  }
}
