import { loc, locData } from './i18n.ts'
import { recordMeal, mealLimitReason } from './hunger.ts'
import { foodStockReason, consumeFoodStock } from './food-stock.ts'
import { isGuidedOutingActive } from './guided-outing-state.ts'
/*
 * Règles des services : sélection par lieu, validation des coûts et application des effets.
 * Ce module renvoie les gains réels après plafonnement, pas seulement les gains annoncés.
 * Il porte aussi la vie de quartier : petits jobs, plats de rue, loisirs, tontine du dimanche et cérémonies du samedi.
 */

import definitionsSource from './data/venue-services.json' with { type: 'json' }
import { getMoneyBalance, spendMoney, addMoney } from './currency.ts'
import { getEnergyMaximumAt,projectEnergy,getPlayerResources, spendEnergy, restoreEnergy, changeMood, changeRespoPoints, workGain } from './player-resources.ts'
import { getGameTime,advanceGameTime } from './game-clock.ts'
import { npcTemplates } from './npcs.ts'
import { changeConsideration } from './npc-relationships.ts'

type Limit = { per: 'day' | 'week'; count: number; group?: string }
export type VenueService = {
  id: string; zones: string[]; name: string; description: string
  /** Chute comique affichée une fois la mission de terrain terminée. */ completion?: string
  money: number; energyCost: number; minutes: number; energyGain: number; moodGain: number; respoGain: number; fullEnergy?: boolean
  /** Paie d'un job ou cagnotte reçue. */ moneyGain?: number
  /** Job : la paie et le Respo suivent l'humeur au travail. */ job?: boolean
  /** Vrai repas : compte dans la limite d'un repas par période. */ meal?: boolean
  /** Horaires en minutes depuis minuit ; closing ≤ opening = service de nuit. */ opening?: number; closing?: number
  /** Jours ouverts, 0 = lundi. */ days?: number[]
  limit?: Limit
  /** Illustration public/ui/menu-<art>.jpg. */ art?: string
  special?: 'tontine' | 'ceremony'
}
const definitions = locData(definitionsSource) as unknown as VenueService[]

// Registre de la vie de quartier : nombre d'usages par jour ou par semaine, et suivi de la tontine.
const lifeKey = 'mboa-local-life-v1'
let life: { uses: Record<string, [number, number]>; tontine: { joined: number | null; paid: number } } = { uses: {}, tontine: { joined: null, paid: -1 } }
try {
  const saved = JSON.parse(localStorage.getItem(lifeKey) ?? 'null')
  if (saved && typeof saved.uses === 'object' && saved.uses && saved.tontine && Number.isSafeInteger(saved.tontine.paid)) {
    const uses: Record<string, [number, number]> = {}
    for (const [name, value] of Object.entries(saved.uses)) if (Array.isArray(value) && Number.isSafeInteger(value[0]) && Number.isSafeInteger(value[1])) uses[name] = [value[0], value[1]]
    life = { uses, tontine: { joined: Number.isSafeInteger(saved.tontine.joined) ? saved.tontine.joined : null, paid: saved.tontine.paid } }
  }
} catch { /* Sans sauvegarde exploitable, le registre repart de zéro. */ }
function saveLife() { try { localStorage.setItem(lifeKey, JSON.stringify(life)) } catch { /* Registre conservé pendant la session. */ } }
const periodOf = (limit: Limit, total: number) => Math.floor(total / (limit.per === 'week' ? 10080 : 1440))
const usedCount = (service: VenueService, total: number) => { const use = service.limit ? life.uses[service.limit.group ?? service.id] : undefined; return use && use[0] === periodOf(service.limit!, total) ? use[1] : 0 }

// Tontine : huit membres, 2 000 Nkap chacun le dimanche, la cagnotte tourne ; le Respo « bouffe » la quatrième semaine de chaque cycle.
export const tontineRules = { members: 8, turn: 3, contribution: 2000, fine: 500, maxLate: 3 }
export function getTontine(total = getGameTime().totalMinutes) {
  const week = Math.floor(total / 10080), joined = life.tontine.joined !== null
  const missed = joined ? Math.min(tontineRules.maxLate, Math.max(0, week - life.tontine.paid - 1)) : 0
  return { week, joined, missed, paid: joined && life.tontine.paid >= week, money: tontineRules.contribution * (missed + 1) + tontineRules.fine * missed, payout: week % tontineRules.members === tontineRules.turn ? tontineRules.contribution * tontineRules.members : 0, weeksToTurn: (tontineRules.turn - week % tontineRules.members + tontineRules.members) % tontineRules.members }
}
// Les services spéciaux prennent leur prix et leur texte selon la semaine en cours.
function resolve(service: VenueService, total: number): VenueService {
  if (service.special === 'tontine') {
    const quote = getTontine(total)
    const late = quote.missed ? loc(' · {0} semaine(s) de retard, amende comprise',quote.missed) : ''
    return { ...service, money: quote.money, moneyGain: quote.payout, description: quote.payout ? loc('Dimanche · 14h–18h · c’est votre tour : la cagnotte de {0} Nkap est pour vous{1}',quote.payout,late) : loc('Dimanche · 14h–18h · votre tour dans {0} semaine(s){1}',quote.weeksToTurn,late) }
  }
  if (service.special === 'ceremony') {
    const wedding = Math.floor(total / 10080) % 2 === 0
    return wedding ? { ...service, name: loc('Mariage au village'), money: 3000, moodGain: 18, respoGain: 4, art: 'mariage', description: loc('Samedi · 12h–20h · votre enveloppe compte : +2 de considération auprès de tous') }
      : { ...service, name: loc('Deuil au quartier'), money: 2000, moodGain: 2, respoGain: 6, art: 'deuil', description: loc('Samedi · 12h–20h · votre soutien compte : +2 de considération auprès de tous') }
  }
  return service
}

// Services du lieu ; les services génériques servent seulement de repli.
export function getVenueServices(zone: string, total = getGameTime().totalMinutes) {
  const specific = definitions.filter(service => service.zones.includes(zone)&&!(zone==='pilton'&&service.id==='hotel-meal'))
  // Le club propose ses sorties horaires ; ne pas y ajouter un repli générique.
  const local = specific.length ? specific : zone === 'club' ? [] : definitions.filter(service => service.zones.includes('*'))
  return local.map(service => resolve(service, total))
}
const isMeal = (service: VenueService) => !!service.meal || service.id === 'market-meal' || service.id === 'hotel-meal'

/** Motif de fermeture ou de refus, hors argent et énergie ; chaîne vide si le service est possible maintenant. */
export function venueServiceReason(service: VenueService, total = getGameTime().totalMinutes) {
  const day = Math.floor(total / 1440), minute = total % 1440
  if (service.opening !== undefined && service.closing !== undefined) {
    const night = service.closing <= service.opening
    const session = night ? (minute >= service.opening ? day : minute < service.closing ? day - 1 : null) : minute >= service.opening && minute < service.closing ? day : null
    if (session === null || service.days && !service.days.includes(((session % 7) + 7) % 7)) return loc('Fermé à cette heure.')
    if (total + service.minutes > session * 1440 + (night ? 1440 : 0) + service.closing) return loc('Trop tard pour finir avant la fermeture.')
  } else if (service.days && !service.days.includes(day % 7)) return loc('Fermé à cette heure.')
  if (service.special === 'tontine' && getTontine(total).paid) return loc('Cotisation déjà versée cette semaine.')
  if (service.limit && usedCount(service, total) >= service.limit.count) return service.limit.per === 'week' ? loc('Déjà fait cette semaine.') : loc('Déjà fait aujourd’hui.')
  if (isMeal(service)) return mealLimitReason(total) || foodStockReason(`venue:${service.id}@${service.zones[0]}`, total)
  return ''
}

export function projectVenueEnergy(service:VenueService){
 const before=getPlayerResources(),end=getGameTime().totalMinutes+service.minutes,kind=service.id==='hotel-night'?'sleep':'awake'
 return projectEnergy(service.fullEnergy?getEnergyMaximumAt(end,kind):service.energyGain,end,undefined,before.energy,service.energyCost,kind,before.ptRespo+service.respoGain)
}
export function useVenueService(id: string, zone: string) {
 if(isGuidedOutingActive())return {ok:false as const,reason:loc('Terminez votre sortie accompagnée.')}
  if(id==='home-sleep')return {ok:false as const,reason:loc('Choisissez la durée dans le menu de sommeil.')}
  const service = getVenueServices(zone).find(item => item.id === id)
  if (!service) return { ok: false as const, reason: loc('Ce service n’est pas proposé ici.') }
  const before = getPlayerResources(), start = getGameTime().totalMinutes
  const closed = venueServiceReason(service, start)
  if (closed) return { ok: false as const, reason: closed }
  if (getMoneyBalance() < service.money) return { ok: false as const, reason: loc('Argent insuffisant.') }
  if (before.energy < service.energyCost) return { ok: false as const, reason: loc('Énergie insuffisante.') }
  // La paie suit l'humeur du moment, calculée avant que la tâche ne l'use.
  const money = service.moneyGain ? service.job ? workGain(service.moneyGain) : service.moneyGain : 0
  const respo = service.job ? workGain(service.respoGain) : service.respoGain
  if (!Number.isSafeInteger(getMoneyBalance() - service.money + money)) return { ok: false as const, reason: loc('Le total des gains dépasse la limite autorisée.') }
  // Toutes les validations précèdent les mutations pour éviter une facturation partielle en cas de refus.
  if (service.limit) { life.uses[service.limit.group ?? service.id] = [periodOf(service.limit, start), usedCount(service, start) + 1] }
  if (service.special === 'tontine') { const week = Math.floor(start / 10080); life.tontine = { joined: life.tontine.joined ?? week, paid: week } }
  if (service.limit || service.special) saveLife()
  spendMoney(service.money)
  // Un vrai repas compte dans la limite d'un repas par période.
  if (isMeal(service)) { recordMeal(); consumeFoodStock(`venue:${service.id}@${service.zones[0]}`) }
  spendEnergy(service.energyCost)
  const sleeping=service.id==='hotel-night'
  if(sleeping)advanceGameTime(service.minutes,'sleep')
  restoreEnergy(service.fullEnergy ? getPlayerResources().maxEnergy : service.energyGain)
  if (money) addMoney(money)
  changeMood(service.moodGain)
  changeRespoPoints(respo)
  if (service.special === 'ceremony') for (const npc of npcTemplates) { try { changeConsideration(npc.id, 2) } catch { /* Une relation plafonnée ou absente n'empêche pas la cérémonie. */ } }
  // Le temps du service est un événement de jeu ; il peut modifier la présence des PNJ immédiatement.
  if(!sleeping)advanceGameTime(service.minutes)
  const after = getPlayerResources()
  return { ok: true as const, service, money, energy: after.energy - before.energy, mood: after.mood - before.mood, respo: after.ptRespo - before.ptRespo }
}
