import { isGuidedOutingActive } from './guided-outing-state.ts'
/*
 * Considération persistante et suivi des demandes de Bae.
 * Accepter une demande ne paie rien : le financement exige une confirmation séparée.
 */

import dialogues from './data/bae-dialogues.json' with { type: 'json' }
import { getMoneyBalance, spendMoney } from './currency.ts'
import { npcTemplates } from './npcs.ts'

type Relationship = { consideration: number; accepted: string[]; completed: string[] }
const key = 'mboa-npc-relationships-v1'
const listeners = new Set<() => void>()
// Une sauvegarde séparée conserve la compatibilité avec les anciennes demandes et la considération de Bae.
const otherKey = 'mboa-npc-consideration-v1'
const otherConsideration: Record<string, number> = {}
try {
  const saved = JSON.parse(localStorage.getItem(otherKey) ?? '{}')
  for (const npc of npcTemplates) {
    const value = saved?.[npc.id]
    if (npc.id !== 'bae' && typeof value === 'number' && Number.isFinite(value)) otherConsideration[npc.id] = Math.max(0, Math.min(100, Math.round(value)))
  }
} catch { /* Use neutral consideration until relationship events are connected. */ }
const requestIds = new Set(dialogues.requests.map(request => request.id))
let bae: Relationship = { consideration: dialogues.initialConsideration, accepted: [], completed: [] }
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
  if (saved && typeof saved.consideration === 'number' && Number.isFinite(saved.consideration)) {
    const validIds = (ids: unknown) => Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && requestIds.has(id)))] : []
    bae = { consideration: Math.max(0, Math.min(100, Math.round(saved.consideration))), accepted: validIds(saved.accepted), completed: validIds(saved.completed) }
  }
} catch { /* Start with the configured relationship if the save is unavailable. */ }
export function getConsideration(id: string) { return id === 'bae' ? bae.consideration : npcTemplates.some(npc => npc.id === id) ? otherConsideration[id] ?? 50 : 0 }
// Les demandes actuellement intégrées sont celles de Bae ; les autres PNJ ont pour l’instant leurs dialogues.
export function getNPCRequests(id: string) { return id === 'bae' ? dialogues.requests.filter(request => !bae.completed.includes(request.id)) : [] }
export function npcNeedsService(id: string) { return getNPCRequests(id).length > 0 }
export function getCompletedNPCRequests(id: string) { return id === 'bae' ? dialogues.requests.filter(request => bae.completed.includes(request.id)) : [] }
// Revérifie acceptation, prix et solde au paiement ; une demande déjà terminée ne peut pas être débitée deux fois.
export function purchaseNPCImprovement(id: string) {
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
  const request = getNPCRequests('bae').find(request => request.id === id)
  if (!request || !isRequestAccepted(id)) return { ok: false, reason: 'Cette demande doit être acceptée avant le paiement.' }
  if (getMoneyBalance() < request.money || !spendMoney(request.money)) return { ok: false, reason: 'Nkap insuffisants.' }
  completeNPCRequest(id)
  return { ok: true, reason: `${request.title} : amélioration payée (${request.money.toLocaleString('fr-FR')} Nkap).` }
}
export function isRequestAccepted(id: string) { return bae.accepted.includes(id) }
function save() {
  try { localStorage.setItem(key, JSON.stringify(bae)) } catch { /* The session still works without storage. */ }
  listeners.forEach(listener => listener())
}
// Enregistre l’engagement du joueur sans déduire de Nkap et sans considérer les travaux comme réalisés.
export function acceptNPCRequest(id: string) {
  if (!requestIds.has(id) || bae.completed.includes(id) || bae.accepted.includes(id)) return false
  bae.accepted.push(id); save(); return true
}
// Quest events call these only after their own conditions and costs have been validated.
// À appeler uniquement après validation de la réalisation par le système concerné, comme le paiement ci-dessus.
export function completeNPCRequest(id: string) {
  if (!bae.accepted.includes(id) || bae.completed.includes(id)) return false
  bae.completed.push(id); save(); return true
}
// Chaque PNJ garde sa propre valeur bornée à [0, 100] ; un identifiant inconnu est ignoré.
export function changeConsideration(id: string, delta: number) {
  if (!Number.isFinite(delta) || !npcTemplates.some(npc => npc.id === id)) return
  if (id !== 'bae') {
    otherConsideration[id] = Math.max(0, Math.min(100, Math.round(getConsideration(id) + delta)))
    try { localStorage.setItem(otherKey, JSON.stringify(otherConsideration)) } catch { /* Preserve the relationship in this session. */ }
    listeners.forEach(listener => listener()); return
  }
  bae.consideration = Math.max(0, Math.min(100, Math.round(bae.consideration + delta))); save()
}
export function onNPCRelationshipChange(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) }
