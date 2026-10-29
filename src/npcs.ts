import { getGuidedPresentation } from './guided-outing-state.ts'
/*
 * Résout la présence des PNJ à partir de l’heure absolue sauvegardée.
 * Les identités viennent de npcs.json ; les déplacements viennent de npc-routines.json.
 */

import definitions from './data/npcs.json' with { type: 'json' }
import { getGameTime } from './game-clock.ts'
import routines from './data/npc-routines.json' with { type: 'json' }

export const npcTemplates = definitions

type Period = { from: number; until: number; zone: string | null; origin?: string; destination?: string; activity: string; available: boolean; travelling: boolean }
type Routine = { rank: string; transport: string; weekday: Period[]; weekend: Period[]; friday?: Period[] }
const schedules: Record<string, Routine> = routines.people
// Lundi vaut 0 : le vendredi peut remplacer la semaine, samedi et dimanche utilisent le week-end.
function periodsFor(id: string, totalMinutes: number) {
  const routine = schedules[id]
  if (!routine || !Number.isFinite(totalMinutes) || totalMinutes < 0) return []
  const day = Math.floor(totalMinutes / 1440) % 7
  return day >= 5 ? routine.weekend : day === 4 && routine.friday ? routine.friday : routine.weekday
}
// Copie les périodes pour que le programme affiché ne puisse pas modifier les routines sources.
export function getNPCSchedule(id: string, totalMinutes = getGameTime().totalMinutes) { return periodsFor(id, totalMinutes).map(period => ({ ...period })) }
// Les intervalles sont [début, fin[ : un PNJ appartient à une seule étape, même à l’heure de départ.
export function getRoutineNPCState(id: string, totalMinutes = getGameTime().totalMinutes) {
  const routine = schedules[id]
  if (!routine || !Number.isFinite(totalMinutes) || totalMinutes < 0) return null
  const minute = totalMinutes % 1440
  const periods = periodsFor(id, totalMinutes)
  const period = periods.find(period => minute >= period.from && minute < period.until)
  if (!period) return null
  return { ...period, rank: routine.rank, transport: routine.transport, progress: (minute - period.from) / (period.until - period.from) }
}
// Le planificateur consulte la routine normale ; seul le PNJ effectivement accompagné est temporairement occupé.
export function getNPCState(id:string,totalMinutes=getGameTime().totalMinutes){
 const guided=getGuidedPresentation()
 if(guided?.npcId===id&&totalMinutes===getGameTime().totalMinutes){
  const normal=getRoutineNPCState(id,totalMinutes)
  return {from:0,until:1440,zone:guided.zone,origin:guided.origin,destination:guided.destination,activity:guided.phase==='activity'?'Sortie accompagnée':'Trajet de sortie accompagnée',available:false,travelling:guided.travelling,rank:normal?.rank??'Accompagnante',transport:guided.mode,progress:guided.progress}
 }
 return getRoutineNPCState(id,totalMinutes)
}
// Un trajet ou un repos privé n’est pas une présence dans un lieu accessible : la zone vaut alors null.
export function getNPCZone(id: string, totalMinutes = getGameTime().totalMinutes) {
  return getNPCState(id, totalMinutes)?.zone ?? null
}
export function isNPCAvailable(id: string, totalMinutes = getGameTime().totalMinutes) {
  return getNPCState(id, totalMinutes)?.available ?? false
}

// Filtre la position actuelle et la disponibilité, pas le lieu de rattachement statique du personnage.
export function getNPCsAtZone(zone: string) {
  return npcTemplates.filter(npc => getNPCZone(npc.id) === zone && isNPCAvailable(npc.id))
}
