/*
 * Stock journalier des plats hors de la maison (décision utilisateur du 13 novembre 2026).
 * Chaque jour, chaque plat de chaque lieu reçoit une quantité aléatoire entre 2 et 8, la même pour
 * tous les rechargements de la journée (tirage fixé par le jour et le plat). Chaque repas servi en
 * consomme une ; à zéro, le plat est épuisé jusqu'au lendemain. La maison n'est pas concernée.
 */
import { loc } from './i18n.ts'
import { getGameTime } from './game-clock.ts'

export const stockRules = { min: 2, max: 8 }
const key = 'mboa-food-stock-v1'
let served: { day: number; used: Record<string, number> } = { day: -1, used: {} }
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
  if (saved && Number.isSafeInteger(saved.day) && saved.used && typeof saved.used === 'object') served = { day: saved.day, used: Object.fromEntries(Object.entries(saved.used).filter(([, v]) => Number.isSafeInteger(v) && (v as number) >= 0)) as Record<string, number> }
} catch { /* Sans sauvegarde, tous les stocks sont pleins. */ }
const save = () => { try { localStorage.setItem(key, JSON.stringify(served)) } catch { /* Stock gardé pendant la session. */ } }
const listeners = new Set<() => void>()
export function onFoodStockChange(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) }

// Tirage déterministe : même jour + même plat = même quantité.
function hash(text: string) { let h = 2166136261; for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const today = (total = getGameTime().totalMinutes) => Math.floor(total / 1440)
function used(day: number) { if (served.day !== day) { served = { day, used: {} }; save() } return served.used }

export function getFoodStock(item: string, total = getGameTime().totalMinutes) {
  const day = today(total), initial = stockRules.min + hash(`${day}|${item}`) % (stockRules.max - stockRules.min + 1)
  const remaining = Math.max(0, initial - (used(day)[item] ?? 0))
  return { initial, remaining, soldOut: remaining === 0 }
}
export function foodStockReason(item: string, total = getGameTime().totalMinutes) {
  return getFoodStock(item, total).soldOut ? loc('Épuisé pour aujourd’hui · retour demain.') : ''
}
export function consumeFoodStock(item: string, total = getGameTime().totalMinutes) {
  const list = used(today(total)); list[item] = (list[item] ?? 0) + 1; save(); listeners.forEach(listener => listener())
}
