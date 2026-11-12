/*
 * Trois repas par jour : matin, midi et soir. L'énergie ne baisse jamais toute seule :
 * un repas sauté rend seulement chaque activité plus coûteuse en énergie (+25 % par repas manqué, max +50 %)
 * et retire 5 d'humeur une fois. Le prochain repas efface le surcoût.
 */
import { loc } from './i18n.ts'
import { getGameTime, onGameTimeChange } from './game-clock.ts'

export const mealSlots = [
  { id: 'morning', label: loc('Matin'), icon: '☀️', start: 360, end: 600 },
  { id: 'noon', label: loc('Midi'), icon: '🍲', start: 660, end: 840 },
  { id: 'evening', label: loc('Soir'), icon: '🌙', start: 1080, end: 1320 },
] as const
// Décision utilisateur du 12 novembre 2026 : un repas sauté ne punit plus (ni énergie, ni humeur).
export const hungerRules = { surchargePerMissed: 0, maxMissed: 2, moodPerMissed: 0 }
const key = 'mboa-hunger-v1'
// lastMeal : heure du dernier repas (ou du début du suivi) ; checked : dernière heure où les repas manqués ont été comptés.
let state = { lastMeal: getGameTime().totalMinutes, checked: getGameTime().totalMinutes, eaten: [] as string[], meals: [] as string[] }
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
  if (saved && Number.isSafeInteger(saved.lastMeal) && Number.isSafeInteger(saved.checked) && Array.isArray(saved.eaten)) state = { lastMeal: saved.lastMeal, checked: saved.checked, eaten: saved.eaten.filter((id: unknown) => typeof id === 'string').slice(-9), meals: Array.isArray(saved.meals) ? saved.meals.filter((id: unknown) => typeof id === 'string').slice(-9) : [] }
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
    label: missed ? loc('Repas sauté') : loc('Bien nourri'),
    today: mealSlots.map(slot => ({ ...slot, eaten: state.eaten.includes(`${day}:${slot.id}`), passed: total % 1440 >= slot.end, current: total % 1440 >= slot.start && total % 1440 < slot.end })),
  }
}

/** Énergie réellement dépensée pour une activité de coût `base` (arrondi au supérieur). */
export function hungerEnergyCost(base: number, total = getGameTime().totalMinutes) {
  if (!Number.isSafeInteger(base) || base <= 0) return base
  return Math.ceil(base * (1 + getHunger(total).surcharge))
}

// Période de repas : du début d'un créneau jusqu'au début du suivant (la nuit appartient au soir de la veille).
const periodKey = (total: number) => { const day = Math.floor(total / 1440), minute = total % 1440; return minute < mealSlots[0].start ? `${day - 1}:evening` : minute < mealSlots[1].start ? `${day}:morning` : minute < mealSlots[2].start ? `${day}:noon` : `${day}:evening` }
/** Motif de refus d'un deuxième vrai repas dans la même période ; les collations ne sont pas concernées. */
export function mealLimitReason(total = getGameTime().totalMinutes) {
  return !disabled() && state.meals.includes(periodKey(total)) ? loc('Vous avez déjà pris un vrai repas : le prochain sera au créneau suivant.') : ''
}
/** À appeler au début d'un vrai repas, avant d'avancer l'heure. */
export function recordMeal(total = getGameTime().totalMinutes) {
  state.lastMeal = total; state.checked = Math.max(state.checked, total)
  const slot = slotKey(total), period = periodKey(total)
  if (!state.meals.includes(period)) state.meals = [...state.meals, period].slice(-9)
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
  if (newlyMissed) { if (hungerRules.moodPerMissed) moodHandler?.(-hungerRules.moodPerMissed * newlyMissed); listeners.forEach(listener => listener(newlyMissed)) }
  else listeners.forEach(listener => listener(0))
}
onGameTimeChange(check)
