/*
 * Trois repas par jour : matin, midi et soir. L'énergie ne baisse jamais toute seule :
 * un repas sauté rend seulement chaque activité plus coûteuse en énergie (+25 % par repas manqué, max +50 %)
 * et retire 5 d'humeur une fois. Le prochain repas efface le surcoût.
 */
import { getGameTime, onGameTimeChange } from './game-clock.ts'

export const mealSlots = [
  { id: 'morning', label: 'Matin', icon: '☀️', start: 360, end: 600 },
  { id: 'noon', label: 'Midi', icon: '🍲', start: 660, end: 840 },
  { id: 'evening', label: 'Soir', icon: '🌙', start: 1080, end: 1320 },
] as const
export const hungerRules = { surchargePerMissed: .25, maxMissed: 2, moodPerMissed: 5 }
const key = 'mboa-hunger-v1'
// lastMeal : heure du dernier repas (ou du début du suivi) ; checked : dernière heure où les repas manqués ont été comptés.
let state = { lastMeal: getGameTime().totalMinutes, checked: getGameTime().totalMinutes, eaten: [] as string[] }
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
  if (saved && Number.isSafeInteger(saved.lastMeal) && Number.isSafeInteger(saved.checked) && Array.isArray(saved.eaten)) state = { lastMeal: saved.lastMeal, checked: saved.checked, eaten: saved.eaten.filter((id: unknown) => typeof id === 'string').slice(-9) }
} catch { /* Sans sauvegarde, le suivi commence maintenant, sans faim rétroactive. */ }
function save() { try { localStorage.setItem(key, JSON.stringify(state)) } catch { /* Suivi conservé pendant la session. */ } }
save()

const listeners = new Set<(missedNow: number) => void>()
export function onHungerChange(listener: (missedNow: number) => void) { listeners.add(listener); return () => listeners.delete(listener) }

/** Fins de créneaux sans repas, strictement après `from` et jusqu'à `to` inclus (un repas pris dans le créneau le valide). */
function slotEndsBetween(from: number, to: number) {
  const ends: number[] = []
  for (let day = Math.floor(from / 1440); day <= Math.floor(to / 1440); day++)
    for (const slot of mealSlots) { const end = day * 1440 + slot.end; if (end > from && end <= to && !state.eaten.includes(`${day}:${slot.id}`)) ends.push(end) }
  return ends
}
const slotKey = (total: number) => { const day = Math.floor(total / 1440), minute = total % 1440, slot = mealSlots.find(s => minute >= s.start && minute < s.end); return slot ? `${day}:${slot.id}` : null }

/** Repas sautés depuis le dernier repas (0 à 2 comptent pour le surcoût). */
// Les tests d'autres fonctionnalités peuvent désactiver la faim pour garder leurs bilans d'origine.
const disabled = () => (globalThis as { __MBOA_NO_HUNGER__?: boolean }).__MBOA_NO_HUNGER__ === true
export function getHunger(total = getGameTime().totalMinutes) {
  const missed = disabled() ? 0 : slotEndsBetween(state.lastMeal, total).length, counted = Math.min(hungerRules.maxMissed, missed)
  const day = Math.floor(total / 1440)
  return {
    missed, surcharge: counted * hungerRules.surchargePerMissed,
    label: missed ? `Repas sauté${missed > 1 ? 's' : ''} : activités +${Math.round(counted * hungerRules.surchargePerMissed * 100)} % d’énergie` : 'Bien nourri',
    today: mealSlots.map(slot => ({ ...slot, eaten: state.eaten.includes(`${day}:${slot.id}`), passed: total % 1440 >= slot.end, current: total % 1440 >= slot.start && total % 1440 < slot.end })),
  }
}

/** Énergie réellement dépensée pour une activité de coût `base` (arrondi au supérieur). */
export function hungerEnergyCost(base: number, total = getGameTime().totalMinutes) {
  if (!Number.isSafeInteger(base) || base <= 0) return base
  return Math.ceil(base * (1 + getHunger(total).surcharge))
}

/** À appeler au début d'un vrai repas, avant d'avancer l'heure. */
export function recordMeal(total = getGameTime().totalMinutes) {
  state.lastMeal = total; state.checked = Math.max(state.checked, total)
  const slot = slotKey(total)
  if (slot && !state.eaten.includes(slot)) state.eaten = [...state.eaten, slot].slice(-9)
  save(); listeners.forEach(listener => listener(0))
}

// Chaque créneau qui se termine sans repas retire de l'humeur une seule fois.
let moodHandler: ((delta: number) => void) | null = null
export function setHungerMoodHandler(handler: (delta: number) => void) { moodHandler = handler }
function check() {
  const now = getGameTime().totalMinutes
  if (now <= state.checked) return
  const newlyMissed = disabled() ? 0 : slotEndsBetween(Math.max(state.checked, state.lastMeal), now).length
  state.checked = now; save()
  if (newlyMissed) { moodHandler?.(-hungerRules.moodPerMissed * newlyMissed); listeners.forEach(listener => listener(newlyMissed)) }
  else listeners.forEach(listener => listener(0))
}
onGameTimeChange(check)
