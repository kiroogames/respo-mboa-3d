/*
 * Aperçu de ce qu’on peut faire dans un lieu, consulté avant d’y aller.
 * Lecture seule : reprend les mêmes services et horaires que le menu du lieu, sans rien réserver.
 */

import { loc, gameLocale } from './i18n.ts'
import { getVenueServices, venueServiceReason } from './venue-services'
import { getNPCsAtZone, getNPCState } from './npcs'
import { npcNeedsService } from './npc-relationships'
import { bagFoods } from './food-bag'
import { cityOutings, getOutingSchedule } from './city-outings'
import { missionRules, getMissionState } from './pro-missions'
import { dossierRules, getDossierBatch } from './dossier-work'
import { getUserQueue, userQueueRules } from './user-queue'
import { getMeetingSchedule } from './minfi-meetings'
import { getCanteenService } from './canteen'
import { advancedRules } from './advanced-dossiers'
import { getRespoProgress } from './respo-level'
import { getPlayerResources } from './player-resources'
import { getGameTime } from './game-clock'
import { getHomeMealService } from './home-meals'

export type PlaceActivity = { icon: string; title: string; detail: string; status?: string; closed?: boolean }
export type PlacePerson = { name: string; portrait: string; activity: string; request: boolean; stay: string }

const nkap = (value: number) => value ? loc('{0} Nkap',value.toLocaleString(gameLocale)) : loc('Gratuit')

export function getPlaceActivities(zone: string): PlaceActivity[] {
  const items: PlaceActivity[] = []
  if (zone === dossierRules.zone) {
    const batch = getDossierBatch()
    items.push({ icon: '📂', title: loc('Traiter les dossiers'), detail: loc('Jusqu’à {0} Nkap · +{1} Respo · {2} min',dossierRules.moneyGain,dossierRules.respoGain,dossierRules.minutes), closed: !!batch.reason, status: batch.reason || loc('{0} dossiers dans la pile',batch.remaining) })
  }
  if (zone === 'ministry') {
    const queue = getUserQueue(), meeting = getMeetingSchedule(), canteen = getCanteenService()
    items.push({ icon: '🙋', title: loc('Accueillir les usagers'), detail: loc('Lun–ven · 10h–13h et 16h–18h · jusqu’à ~{0} Nkap selon votre parcours',userQueueRules.moneyGain), closed: !!queue.reason, status: queue.reason || loc('{0} demandes dans la file',queue.remaining) })
    items.push({ icon: '🗂️', title: loc('Réunion MINFI'), detail: loc('Lun–ven · 08h–16h · {0}',meeting.topic ?? loc('pas de réunion le week-end')), closed: !!meeting.reason, status: meeting.reason || loc('Disponible') })
    items.push({ icon: '🍛', title: loc('Cantine du ministère'), detail: loc('Lun–ven · 11h–14h · repas dès 200 Nkap'), closed: !!canteen.reason, status: canteen.reason || loc('{0} plat(s) disponible(s)',canteen.menu.length - canteen.done.length) })
    items.push({ icon: '🌙', title: loc('Taf extra d’Anneke'), detail: loc('Lun–ven · 18h–23h · commande à récupérer en journée · +900 Nkap') })
    if (getRespoProgress(getPlayerResources().ptRespo).level >= advancedRules.visibleLevel) items.push({ icon: '📁', title: loc('Dossiers avancés'), detail: loc('900 à 1500 Nkap · 10 à 16 Respo') })
    if (missionRules.missions.length) items.push({ icon: '🎯', title: loc('Missions professionnelles'), detail: loc('Accepter une mission ou rendre compte auprès de son donneur') })
  }
  if (zone === 'home') {
    items.push({ icon: '🍲', title: loc('Manger à la maison'), detail: loc('Dès 150 Nkap · un repas par service') })
    items.push({ icon: '🛋️', title: loc('Confort et équipements'), detail: loc('Acheter et installer des équipements') })
  }
  for (const service of getVenueServices(zone)) {
    const closed = venueServiceReason(service)
    const gains = [service.moneyGain ? loc('+{0} Nkap',service.moneyGain.toLocaleString(gameLocale)) : '', service.fullEnergy ? loc('recharge complète') : service.energyGain ? loc('+{0} énergie',service.energyGain) : '', service.moodGain > 0 ? loc('+{0} humeur',service.moodGain) : '', service.respoGain ? loc('+{0} Respo',service.respoGain) : ''].filter(Boolean).join(' · ')
    items.push({ icon: service.id === 'home-sleep' ? '🛏️' : '✨', title: service.name, detail: service.id === 'home-sleep' ? loc('Gratuit · durée au choix') : loc('{0} · {1} min{2}',nkap(service.money),service.minutes,gains ? ` · ${gains}` : ''), ...(closed ? { closed: true, status: closed } : {}) })
  }
  for (const outing of cityOutings.filter(item => item.zone === zone)) {
    const schedule = getOutingSchedule(outing.id)
    items.push({ icon: '🎉', title: loc('Sorties · {0}',outing.name), detail: outing.hours, closed: !!schedule.reason, status: schedule.reason || loc('Ouvert') })
  }
  for (const food of bagFoods.filter(item => item.zone === zone)) items.push({ icon: '🥡', title: /emporter|takeaway/i.test(food.name) ? food.name : loc('{0} à emporter',food.name), detail: loc('{0} · +{1} énergie plus tard',nkap(food.money),food.energy) })
  for (const mission of missionRules.missions.filter(item => item.zone === zone && getMissionState(item.id)?.stage === 'active')) items.push({ icon: '🎯', title: loc('Mission : {0}',mission.title), detail: loc('Vérification à effectuer ici'), status: loc('À faire') })
  return items
}

/** Personnes présentes à l’heure actuelle ; elles peuvent être parties à l’arrivée. */
export function getPlacePeople(zone: string): PlacePerson[] {
  const now = getGameTime().totalMinutes
  return getNPCsAtZone(zone).map(npc => {
    const state = getNPCState(npc.id)
    return { name: npc.name, portrait: npc.portrait, activity: state ? `${state.activity}` : npc.relationship, request: npcNeedsService(npc.id), stay: describeStay(npc.id, zone, now) }
  })
}

// Heure où la personne quitte le lieu (ou cesse d'être disponible), en suivant sa routine par pas de 5 minutes sur 24 h.
function presenceEnd(id: string, zone: string, now: number) {
  for (let t = now - now % 5 + 5; t <= now + 1440; t += 5) {
    const state = getNPCState(id, t)
    if (state?.zone !== zone || !state.available) return t
  }
  return null
}
const clock = (total: number) => { const minute = ((total % 1440) + 1440) % 1440; return `${Math.floor(minute / 60)} h ${String(minute % 60).padStart(2, '0')}` }
const span = (minutes: number) => minutes < 60 ? loc('{0} min',minutes) : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}` : ''}`
function describeStay(id: string, zone: string, now: number) {
  const end = presenceEnd(id, zone, now)
  if (end === null) return loc('Ici toute la journée')
  const nextDay = Math.floor(end / 1440) > Math.floor(now / 1440) && end % 1440 !== 0 ? ' (demain)' : ''
  return loc('Ici jusqu’à {0}{1} · encore {2}',end % 1440 === 0 ? loc('minuit') : clock(end),nextDay,span(end - now))
}

export type PlaceOffer = 'earn' | 'eat' | 'open'
/** Ce qu'un lieu propose à l'heure actuelle, pour le filtre de la carte. */
export function getPlaceOffers(zone: string): PlaceOffer[] {
  const { gains, losses } = getPlaceEffects(zone), offers: PlaceOffer[] = []
  if (gains.includes('nkap')) offers.push('earn')
  const outing = cityOutings.some(item => item.zone === zone && (item.id.startsWith('restaurant') || item.id === 'snack') && !getOutingSchedule(item.id).reason)
  if (outing || getVenueServices(zone).some(service => service.meal && !venueServiceReason(service)) || bagFoods.some(food => food.zone === zone) || (zone === 'ministry' && !getCanteenService().reason) || (zone === 'home' && getHomeMealService().open)) offers.push('eat')
  if (gains.length || losses.length) offers.push('open')
  return offers
}

export type EffectUnit = 'nkap' | 'energy' | 'mood' | 'influence'
/**
 * Ce qu'on peut gagner (+) ou perdre (−) dans un lieu à l'heure actuelle, pour les badges de la carte.
 * Seules les activités ouvertes maintenant comptent ; la pause gratuite proposée partout est ignorée.
 */
export function getPlaceEffects(zone: string) {
  const gains = new Set<EffectUnit>(), losses = new Set<EffectUnit>()
  const add = (gain: EffectUnit[], loss: EffectUnit[] = []) => { gain.forEach(u => gains.add(u)); loss.forEach(u => losses.add(u)) }
  const now = getGameTime().totalMinutes, day = Math.floor(now / 1440), minute = now % 1440, weekday = day % 7 < 5
  if (zone === dossierRules.zone && !getDossierBatch().reason) {
    add(['nkap'], ['energy'])
    if (getRespoProgress(getPlayerResources().ptRespo).level >= advancedRules.visibleLevel + 1) add(['nkap'], ['energy'])
  }
  if (zone === 'ministry') {
    if (!getUserQueue().reason) add(['nkap', 'mood'], ['energy', 'mood'])
    if (!getMeetingSchedule().reason) add([], ['energy'])
    if (!getCanteenService().reason) add(['energy', 'mood'], ['nkap'])
    if (weekday && minute >= 1080 && minute < 1380) add(['nkap'], ['energy'])
    if (missionRules.missions.some(m => getMissionState(m.id)?.stage === 'ready')) add(['nkap'])
  }
  if (zone === 'home') {
    if (getHomeMealService().open) add(['energy', 'mood'], ['nkap'])
    add(['mood'], ['nkap'])
  }
  for (const service of getVenueServices(zone)) {
    if (service.id === 'public-rest' || venueServiceReason(service)) continue
    add([...(service.moneyGain ? ['nkap' as const] : []), ...(service.energyGain || service.fullEnergy ? ['energy' as const] : []), ...(service.moodGain > 0 ? ['mood' as const] : [])],
      [...(service.money > 0 ? ['nkap' as const] : []), ...(service.energyCost > 0 ? ['energy' as const] : []), ...(service.moodGain < 0 ? ['mood' as const] : [])])
  }
  for (const outing of cityOutings.filter(item => item.zone === zone && !getOutingSchedule(item.id).reason))
    for (const option of outing.options) add([...(option.mood > 0 ? ['mood' as const] : []), ...(option.energyGain > 0 ? ['energy' as const] : [])], [...(option.money > 0 ? ['nkap' as const] : []), ...(option.energy > 0 ? ['energy' as const] : [])])
  if (bagFoods.some(food => food.zone === zone)) add([], ['nkap'])
  if (missionRules.missions.some(m => m.zone === zone && getMissionState(m.id)?.stage === 'active')) add([], ['energy'])
  const order: EffectUnit[] = ['nkap', 'energy', 'mood', 'influence']
  return { gains: order.filter(u => gains.has(u)), losses: order.filter(u => losses.has(u)) }
}
