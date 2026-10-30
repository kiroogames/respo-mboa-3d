import { isGuidedOutingActive } from './guided-outing-state.ts'
/*
 * Travail au ministère : piles datées, confirmation du traitement et récompense unique.
 * Les coûts validés sont centralisés dans les données ; aucune animation ne débite de ressources.
 */
import rules from './data/dossier-work.json' with { type: 'json' }
import { getGameTime, advanceGameTime } from './game-clock.ts'
import { getMoneyBalance, addMoney } from './currency.ts'
import { getPlayerResources, spendEnergy, changeRespoPoints } from './player-resources.ts'

export const dossierRules = rules
const key = 'mboa-dossier-work-v1'
let ledger: { batch: string; done: number[] } = { batch: '', done: [] }
let committing = false
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
  if (saved && typeof saved.batch === 'string' && Array.isArray(saved.done)) ledger = { batch: saved.batch, done: [...new Set<number>(saved.done.filter((index: unknown): index is number => Number.isInteger(index) && Number(index) >= 0 && Number(index) < rules.batchSize))] }
} catch { /* Sans sauvegarde exploitable, la session utilise une nouvelle pile. */ }
function save() { try { localStorage.setItem(key, JSON.stringify(ledger)) } catch { /* Le verrou de session reste actif. */ } }
// Service ouvert en continu, week-end compris : une nouvelle pile arrive toutes les refillHours heures depuis minuit.
export function getDossierBatch(totalMinutes = getGameTime().totalMinutes) {
  const day = Math.floor(totalMinutes / 1440), minute = totalMinutes % 1440
  const open = true, canFinish = true
  const start = Math.floor(minute / (rules.refillHours * 60)) * rules.refillHours * 60
  const id = `${day}:${start}`
  if (ledger.batch !== id) { ledger = { batch: id, done: [] }; save() }
  const nextRefill = day * 1440 + start + rules.refillHours * 60
  const done = [...ledger.done]
  return {
    id, open, canFinish, nextRefill, remaining: rules.batchSize - done.length,
    reason: '',
    dossiers: rules.titles.map((title, index) => ({ index, title, done: done.includes(index) })),
  }
}

export function dossierWorkReason(zone: string, batchId?: string, index?: number) {
  if (zone !== rules.zone) return 'Rejoignez le ministère pour travailler sur un dossier.'
  const batch = getDossierBatch()
  if (!batch.canFinish) return batch.reason
  if (batchId !== undefined && batchId !== batch.id) return 'Cette pile a été renouvelée. Choisissez un dossier de la nouvelle pile.'
  if (index !== undefined && (!Number.isInteger(index) || index < 0 || index >= rules.batchSize)) return 'Dossier introuvable.'
  if (index !== undefined && batch.dossiers[index]!.done) return 'Ce dossier a déjà été rémunéré.'
  if (getPlayerResources().energy < rules.energyCost) return `Énergie insuffisante : il faut ${rules.energyCost} énergie.`
  return ''
}

export function completeDossier(batchId: string, index: number, _path: readonly number[], zone: string) {
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
  if (committing) return { ok: false as const, reason: 'Le traitement est déjà en cours.' }
  const reason = dossierWorkReason(zone, batchId, index)
  if (reason) return { ok: false as const, reason }
  const money=rules.moneyGain
  const before = getPlayerResources()
  if (!Number.isSafeInteger(getMoneyBalance() + money) || !Number.isSafeInteger(before.ptRespo + rules.respoGain)) return { ok: false as const, reason: 'Les compteurs ne permettent pas de recevoir cette récompense.' }
  committing = true
  try {
    // Marquer avant d’émettre les mises à jour empêche un double crédit, même en cas de clic réentrant.
    ledger.done.push(index); save()
    spendEnergy(rules.energyCost); addMoney(money); changeRespoPoints(rules.respoGain)
    advanceGameTime(rules.minutes)
    return { ok: true as const, money, respo: rules.respoGain, energy: rules.energyCost, minutes: rules.minutes, title: rules.titles[index]! }
  } finally { committing = false }
}
