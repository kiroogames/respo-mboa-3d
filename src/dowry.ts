/*
 * Quête principale (décision utilisateur du 12 novembre 2026) : réunir la dot, 250 000 Nkap.
 * L'argent est déposé dans une caisse à part, à la maison : une fois déposé, il ne se dépense plus
 * et la progression ne recule jamais.
 */
import { loc } from './i18n.ts'
import { getMoneyBalance, spendMoney } from './currency.ts'
import { isGuidedOutingActive } from './guided-outing-state.ts'

export const dowryRules = { target: 250000, minimum: 100, step: 100, presets: [1000, 5000, 10000, 25000] }
export type DowryContext = { zone: string; travelling: boolean; allowed: boolean }
const key = 'mboa-dowry-v1'
let saved = 0
try {
  const value = JSON.parse(localStorage.getItem(key) ?? 'null')
  if (value && Number.isSafeInteger(value.saved) && value.saved >= 0 && value.saved <= dowryRules.target) saved = value.saved
} catch { /* Sans sauvegarde, la caisse commence vide. */ }

const listeners = new Set<() => void>()
export function onDowryChange(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) }
export function getDowryState() {
  return { target: dowryRules.target, saved, remaining: dowryRules.target - saved, complete: saved >= dowryRules.target, share: saved / dowryRules.target }
}
export function dowryPresenceReason(context: DowryContext) {
  if (isGuidedOutingActive()) return loc('Terminez votre sortie accompagnée.')
  return context.travelling ? loc('Terminez votre trajet.') : !context.allowed ? loc('Terminez votre autre activité.') : context.zone !== 'home' ? loc('La caisse de la dot est à la maison.') : ''
}
export function previewDowry(amount: number, context: DowryContext) {
  const state = getDowryState(), balance = getMoneyBalance()
  const valid = Number.isSafeInteger(amount) && amount >= dowryRules.minimum && amount % dowryRules.step === 0
  const reason = dowryPresenceReason(context) || (state.complete ? loc('La dot est déjà réunie.') : '')
    || (!valid ? loc('Choisissez un montant d’au moins {0} Nkap, par pas de {1}.', dowryRules.minimum, dowryRules.step) : '')
    || (amount > state.remaining ? loc('Le montant dépasse ce qu’il reste à réunir.') : '')
    || (amount > balance ? loc('Argent insuffisant.') : '')
  return { ...state, amount, balance, reason, afterSaved: valid && amount <= state.remaining ? saved + amount : null, afterBalance: valid && amount <= balance ? balance - amount : null }
}
export function depositDowry(amount: number, context: DowryContext) {
  const quote = previewDowry(amount, context)
  if (quote.reason) return { ok: false as const, reason: quote.reason }
  saved += amount
  // Le cumul est enregistré avant le débit : un double clic ne peut pas déposer deux fois le même argent.
  try { localStorage.setItem(key, JSON.stringify({ saved })) } catch { /* Cumul conservé pendant la session. */ }
  spendMoney(amount); listeners.forEach(listener => listener())
  return { ok: true as const, amount, balance: getMoneyBalance(), ...getDowryState() }
}
