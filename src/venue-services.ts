import { isGuidedOutingActive } from './guided-outing-state.ts'
/*
 * Règles des services : sélection par lieu, validation des coûts et application des effets.
 * Ce module renvoie les gains réels après plafonnement, pas seulement les gains annoncés.
 */

import definitions from './data/venue-services.json' with { type: 'json' }
import { getMoneyBalance, spendMoney } from './currency.ts'
import { getEnergyMaximumAt,projectEnergy,getPlayerResources, spendEnergy, restoreEnergy, changeMood, changeRespoPoints } from './player-resources.ts'
import { getGameTime,advanceGameTime } from './game-clock.ts'

// Services du lieu ; les services génériques servent seulement de repli.
export function getVenueServices(zone: string) {
  const specific = definitions.filter(service => service.zones.includes(zone)&&!(zone==='pilton'&&service.id==='hotel-meal'))
  // Le club propose maintenant ses sorties horaires ; ne pas y ajouter un repli générique.
  const local = specific.length ? specific : zone === 'club' ? [] : definitions.filter(service => service.zones.includes('*'))
  return local
}

export function projectVenueEnergy(service:ReturnType<typeof getVenueServices>[number]){
 const before=getPlayerResources(),end=getGameTime().totalMinutes+service.minutes,kind=service.id==='hotel-night'?'sleep':'awake'
 return projectEnergy(service.fullEnergy?getEnergyMaximumAt(end,kind):service.energyGain,end,undefined,before.energy,service.energyCost,kind,before.ptRespo+service.respoGain)
}
export function useVenueService(id: string, zone: string) {
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
  if(id==='home-sleep')return {ok:false as const,reason:'Choisissez la durée dans le menu de sommeil.'}
  const service = getVenueServices(zone).find(item => item.id === id)
  if (!service) return { ok: false as const, reason: 'Ce service n’est pas proposé ici.' }
  const before = getPlayerResources()
  if (getMoneyBalance() < service.money) return { ok: false as const, reason: 'Argent insuffisant.' }
  if (before.energy < service.energyCost) return { ok: false as const, reason: 'Énergie insuffisante.' }
  // Toutes les validations précèdent les mutations pour éviter une facturation partielle en cas de refus.
  spendMoney(service.money)
  spendEnergy(service.energyCost)
  const sleeping=service.id==='hotel-night'
  if(sleeping)advanceGameTime(service.minutes,'sleep')
  restoreEnergy(service.fullEnergy ? getPlayerResources().maxEnergy : service.energyGain)
  changeMood(service.moodGain)
  changeRespoPoints(service.respoGain)
  // Le temps du service est un événement de jeu ; il peut modifier la présence des PNJ immédiatement.
  if(!sleeping)advanceGameTime(service.minutes)
  const after = getPlayerResources()
  return { ok: true as const, service, energy: after.energy - before.energy, mood: after.mood - before.mood, respo: after.ptRespo - before.ptRespo }
}
