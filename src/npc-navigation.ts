/*
 * Projection des routines sur les rues de la ville.
 * La progression dépend des minutes de jeu, jamais du temps réel passé devant l’écran.
 */

import { getNPCState } from './npcs.ts'
import { createTravelRoute } from './travel.ts'
import type { TravelPoint } from './travel.ts'

// Un trajet est mis en cache par couple de lieux ; le graphe routier n’est pas recalculé à chaque image.
const routes = new Map<string, { points: TravelPoint[]; lengths: number[]; total: number }>()
// Le callback fournit les coordonnées définitives des lieux après chargement du modèle et de sa disposition.
export function getNPCMapPosition(id: string, locate: (zone: string) => TravelPoint, totalMinutes?: number): TravelPoint | null {
  const state = getNPCState(id, totalMinutes)
  if (!state) return null
  if (!state.travelling) return state.zone ? locate(state.zone) : null
  if (!state.origin || !state.destination) return null
  const key = `${state.origin}>${state.destination}`
  let route = routes.get(key)
  if (!route) {
    const points = createTravelRoute(locate(state.origin), locate(state.destination))
    const lengths = points.slice(1).map((point, i) => Math.hypot(point[0] - points[i]![0], point[2] - points[i]![2]))
    route = { points, lengths, total: lengths.reduce((sum, length) => sum + length, 0) }; routes.set(key, route)
  }
  // Répartit la progression sur la longueur des segments, pour ne pas accélérer sur les grands segments.
  let remaining = route.total * state.progress
  for (let i = 0; i < route.lengths.length; i++) {
    const length = route.lengths[i]!
    if (remaining <= length) {
      const a = route.points[i]!, b = route.points[i + 1]!, t = length ? remaining / length : 0
      return [a[0] + (b[0] - a[0]) * t, Math.max(18, a[1] + (b[1] - a[1]) * t), a[2] + (b[2] - a[2]) * t]
    }
    remaining -= length
  }
  return locate(state.destination)
}
