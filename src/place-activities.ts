/*
 * Aperçu de ce qu’on peut faire dans un lieu, consulté avant d’y aller.
 * Lecture seule : reprend les mêmes services et horaires que le menu du lieu, sans rien réserver.
 */

import { getVenueServices } from './venue-services'
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

export type PlaceActivity = { icon: string; title: string; detail: string; status?: string; closed?: boolean }
export type PlacePerson = { name: string; portrait: string; activity: string; request: boolean }

const nkap = (value: number) => value ? `${value.toLocaleString('fr-FR')} Nkap` : 'Gratuit'

export function getPlaceActivities(zone: string): PlaceActivity[] {
  const items: PlaceActivity[] = []
  if (zone === dossierRules.zone) {
    const batch = getDossierBatch()
    items.push({ icon: '📂', title: 'Traiter les dossiers', detail: `Jusqu’à ${dossierRules.moneyGain} Nkap · +${dossierRules.respoGain} Respo · ${dossierRules.minutes} min`, closed: !!batch.reason, status: batch.reason || `${batch.remaining} dossiers dans la pile` })
  }
  if (zone === 'ministry') {
    const queue = getUserQueue(), meeting = getMeetingSchedule(), canteen = getCanteenService()
    items.push({ icon: '🙋', title: 'Accueillir les usagers', detail: `Lun–ven · 10h–13h et 16h–18h · +${userQueueRules.moneyGain} Nkap`, closed: !!queue.reason, status: queue.reason || `${queue.remaining} demandes dans la file` })
    items.push({ icon: '🗂️', title: 'Réunion MINFI', detail: `Lun–ven · 08h–16h · ${meeting.topic ?? 'pas de réunion le week-end'}`, closed: !!meeting.reason, status: meeting.reason || 'Disponible' })
    items.push({ icon: '🍛', title: 'Cantine du ministère', detail: 'Lun–ven · 11h–14h · repas dès 200 Nkap', closed: !!canteen.reason, status: canteen.reason || `${canteen.menu.length - canteen.done.length} plat(s) disponible(s)` })
    items.push({ icon: '🌙', title: 'Taf extra d’Anneke', detail: 'Lun–ven · 18h–23h · commande à récupérer en journée · +900 Nkap' })
    if (getRespoProgress(getPlayerResources().ptRespo).level >= advancedRules.visibleLevel) items.push({ icon: '📁', title: 'Dossiers avancés', detail: '900 à 1500 Nkap · 10 à 16 Respo' })
    if (missionRules.missions.length) items.push({ icon: '🎯', title: 'Missions professionnelles', detail: 'Accepter une mission ou rendre compte auprès de son donneur' })
  }
  if (zone === 'home') {
    items.push({ icon: '🍲', title: 'Manger à la maison', detail: 'Dès 150 Nkap · un repas par service' })
    items.push({ icon: '🛋️', title: 'Confort et équipements', detail: 'Acheter et installer des équipements' })
  }
  for (const service of getVenueServices(zone)) {
    const gains = [service.fullEnergy ? 'recharge complète' : service.energyGain ? `+${service.energyGain} énergie` : '', service.moodGain > 0 ? `+${service.moodGain} humeur` : '', service.respoGain ? `+${service.respoGain} Respo` : ''].filter(Boolean).join(' · ')
    items.push({ icon: service.id === 'home-sleep' ? '🛏️' : '✨', title: service.name, detail: service.id === 'home-sleep' ? 'Gratuit · durée au choix' : `${nkap(service.money)} · ${service.minutes} min${gains ? ` · ${gains}` : ''}` })
  }
  for (const outing of cityOutings.filter(item => item.zone === zone)) {
    const schedule = getOutingSchedule(outing.id)
    items.push({ icon: '🎉', title: `Sorties · ${outing.name}`, detail: outing.hours, closed: !!schedule.reason, status: schedule.reason || 'Ouvert' })
  }
  for (const food of bagFoods.filter(item => item.zone === zone)) items.push({ icon: '🥡', title: `${food.name} à emporter`, detail: `${nkap(food.money)} · +${food.energy} énergie plus tard` })
  for (const mission of missionRules.missions.filter(item => item.zone === zone && getMissionState(item.id)?.stage === 'active')) items.push({ icon: '🎯', title: `Mission : ${mission.title}`, detail: 'Vérification à effectuer ici', status: 'À faire' })
  return items
}

/** Personnes présentes à l’heure actuelle ; elles peuvent être parties à l’arrivée. */
export function getPlacePeople(zone: string): PlacePerson[] {
  return getNPCsAtZone(zone).map(npc => {
    const state = getNPCState(npc.id)
    return { name: npc.name, portrait: npc.portrait, activity: state ? `${state.activity}` : npc.relationship, request: npcNeedsService(npc.id) }
  })
}
