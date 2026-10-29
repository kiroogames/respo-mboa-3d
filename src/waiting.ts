import { isGuidedOutingActive } from './guided-outing-state.ts'
/*
 * Attente validée : seul le calendrier avance ; ni énergie, ni argent, ni points Respo ne sont accordés.
 * L’ennui porte sur l’attente continue, y compris entre plusieurs confirmations et rechargements.
 */
import rules from './data/waiting.json' with { type: 'json' }
import { getGameTime, getGameTimeAt, advanceGameTime } from './game-clock.ts'
import { projectEnergy,getPlayerResources, changeMood, getMoodDetails, previewMoodChange } from './player-resources.ts'

export const waitingRules = rules
const storageKey = 'mboa-waiting-v1'
let ledger = { lastEnd: -1, continuousMinutes: 0 }
let sequence = 0, committing = false
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
  if (saved && Number.isSafeInteger(saved.lastEnd) && saved.lastEnd >= 0 && Number.isSafeInteger(saved.continuousMinutes) && saved.continuousMinutes >= 0 && saved.continuousMinutes % rules.stepMinutes === 0 && saved.continuousMinutes <= saved.lastEnd) ledger = saved
} catch { /* Une sauvegarde absente ou corrompue ne bloque pas le calendrier. */ }

export function getContinuousWaiting() {
  // Une autre activité faisant avancer l’heure rompt la suite ; ouvrir un menu ne la rompt pas.
  return ledger.lastEnd === getGameTime().totalMinutes ? ledger.continuousMinutes : 0
}
const boredomPeriods = (minutes: number) => Math.ceil(Math.max(0, minutes - rules.boredomAfterMinutes) / rules.boredomPeriodMinutes)
export function previewWaiting(duration: number) {
  if (!Number.isSafeInteger(duration) || duration < rules.minimumMinutes || duration > rules.maximumMinutes || duration % rules.stepMinutes !== 0) throw new RangeError('Choisissez une attente de 10 minutes à 6 heures, par pas de 10 minutes.')
  const from = getGameTime(), to = getGameTimeAt(from.totalMinutes + duration), continuousBefore = getContinuousWaiting()
  const continuousAfter = continuousBefore + duration, moodBefore = getPlayerResources().mood
  const penalty = (boredomPeriods(continuousAfter) - boredomPeriods(continuousBefore)) * rules.moodLossPerPeriod
  const mood=previewMoodChange(-penalty),moodLoss=Math.max(0,-mood.delta)
  return {energyProjection:projectEnergy(0,to.totalMinutes),energyBefore:getPlayerResources().energy, duration, from, to, continuousBefore, continuousAfter, penalty, moodBefore, moodAfter:mood.moodAfter, moodLoss,moodBaseBefore:mood.baseBefore,moodBonus:mood.bonus }
}
export type WaitingPreview = ReturnType<typeof previewWaiting>
let pending: (WaitingPreview & { id: number }) | null = null

/** Un seul devis courant : une ancienne confirmation ne peut pas être rejouée. */
export function prepareWaiting(duration: number) {
  pending = { ...previewWaiting(duration), id: ++sequence }
  return { ...pending, from: { ...pending.from }, to: { ...pending.to } }
}
export function cancelWaiting(id: number) { if (pending?.id === id) pending = null }
export function confirmWaiting(id: number, allowed = false) {
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
  if (committing || !pending || pending.id !== id) return { ok: false as const, reason: 'Cette attente a déjà été confirmée ou remplacée.' }
  const quote = pending
  pending = null
  if (!allowed) return { ok: false as const, reason: 'L’attente est disponible uniquement en exploration libre.' }
  if (getGameTime().totalMinutes !== quote.from.totalMinutes || getContinuousWaiting() !== quote.continuousBefore || getMoodDetails().base !== quote.moodBaseBefore || getMoodDetails().bonus !== quote.moodBonus) return { ok: false as const, reason: 'La situation a changé. Vérifiez le nouvel aperçu avant de confirmer.' }
  committing = true
  try {
    ledger = { lastEnd: quote.to.totalMinutes, continuousMinutes: quote.continuousAfter }
    // Sauvegarder le cumul avant les notifications empêche de contourner l’ennui par rechargement.
    try { localStorage.setItem(storageKey, JSON.stringify(ledger)) } catch { /* Le cumul reste conservé pendant la session. */ }
    if (quote.penalty > 0) changeMood(-quote.penalty)
    advanceGameTime(quote.duration)
    return { ok: true as const, ...quote }
  } finally { committing = false }
}
