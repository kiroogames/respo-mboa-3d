/*
 * Conditions de circulation communes aux devis et à la simulation des voitures.
 * Un tirage est conservé par tranche de minutes de jeu, y compris après rechargement.
 */

import rules from '../travel-rules.json' with { type: 'json' }
import { getGameTime } from './game-clock.ts'

export const trafficLevels = {
  clear: { id: 'clear', label: 'Circulation fluide', taxiFactor: 1, motoFactor: 1 },
  busy: { id: 'busy', label: 'Circulation chargée', taxiFactor: 1.6, motoFactor: 1.25 },
  jammed: { id: 'jammed', label: 'Embouteillages', taxiFactor: 2.8, motoFactor: 1.6 },
} as const
export type TrafficConditions = typeof trafficLevels[keyof typeof trafficLevels]
const storageKey = 'mboa-traffic-v1'
let cached: { period: number; level: keyof typeof trafficLevels } | null = null

// Sépare le tirage de sa persistance pour tester les seuils avec une valeur déterministe.
export function sampleTraffic(random: number): TrafficConditions {
  return random < rules.clearTrafficProbability ? trafficLevels.clear
    : random < rules.clearTrafficProbability + rules.busyTrafficProbability ? trafficLevels.busy : trafficLevels.jammed
}

// Ne retire pas de conditions tant que la période n’a pas changé : rouvrir un devis ne relance rien.
export function getTrafficConditions(): TrafficConditions {
  const period = Math.floor(getGameTime().totalMinutes / rules.trafficPeriodMinutes)
  if (!cached) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if (saved && Number.isSafeInteger(saved.period) && Object.hasOwn(trafficLevels, saved.level)) cached = saved
    } catch { /* Draw fresh conditions when no saved traffic is available. */ }
  }
  if (!cached || cached.period !== period) {
    cached = { period, level: sampleTraffic(Math.random()).id }
    try { localStorage.setItem(storageKey, JSON.stringify(cached)) } catch { /* Retain conditions for this session. */ }
  }
  return trafficLevels[cached.level]
}
