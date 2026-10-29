import { isGuidedOutingActive } from './guided-outing-state.ts'
/* Missions simultanées : chaque parcours possède son état et sa limite hebdomadaire. */
import rules from './data/pro-missions.json' with {type:'json'}
import {getGameTime,getGameTimeAt,advanceGameTime} from './game-clock.ts'
import {getPlayerResources,spendEnergy,changeRespoPoints} from './player-resources.ts'
import {getMoneyBalance,addMoney} from './currency.ts'
import {getNPCZone,isNPCAvailable} from './npcs.ts'
export const missionRules=rules
type Stage='active'|'ready'|'paid'
type RecordState={week:number;stage:Stage}
export type MissionContext={zone:string;travelling:boolean;allowed:boolean}
const key='mboa-pro-missions-v1',ledger:Record<string,RecordState>={}
try{
 const saved=JSON.parse(localStorage.getItem(key)??'null')
 for(const mission of rules.missions){const v=saved?.[mission.id];if(v&&Number.isSafeInteger(v.week)&&v.week>0&&v.week<=getGameTime().week&&['active','ready','paid'].includes(v.stage))ledger[mission.id]={week:v.week,stage:v.stage}}
}catch{/* Le journal fonctionne sans sauvegarde disponible. */}
const listeners=new Set<()=>void>()
export function onMissionChange(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener)}
function save(){try{localStorage.setItem(key,JSON.stringify(ledger))}catch{/* État conservé pendant la session. */}}
export function getMissionState(id:string){return ledger[id]?{...ledger[id]}:null}
export function getMissionView(id:string,context:MissionContext){
 const mission=rules.missions.find(m=>m.id===id)
 if(!mission)throw new RangeError('Mission inconnue.')
 const record=getMissionState(id),from=getGameTime(),energy=getPlayerResources().energy
 const stage=record?.stage==='paid'&&record.week<from.week?'offer':record?.stage??'offer'
 const action=stage==='offer'?'accept':stage==='active'?'work':stage==='ready'?'report':null
 let reason=context.travelling?'Terminez votre trajet.':!context.allowed?'Fermez l’autre activité.':''
 const giverPresent=context.zone==='ministry'&&getNPCZone(mission.giver)==='ministry'&&isNPCAvailable(mission.giver)
 if(!reason){
  if(action==='accept')reason=!giverPresent?`Retrouvez ${mission.giverName} au ministère.`:!mission.days.includes(Math.floor(from.totalMinutes/1440)%7)?'Cette mission n’est pas proposée aujourd’hui.':''
  else if(action==='work')reason=context.zone!==mission.zone?'Rendez-vous sur le lieu de la mission.':energy<rules.energyCost?'Énergie insuffisante.':''
  else if(action==='report')reason=!giverPresent?`Retrouvez ${mission.giverName} au ministère pour rendre compte.`:getMoneyBalance()>Number.MAX_SAFE_INTEGER-rules.moneyGain||getPlayerResources().ptRespo>Number.MAX_SAFE_INTEGER-rules.respoGain?'Le total des gains dépasse la limite autorisée.':''
  else reason='Mission déjà terminée cette semaine.'
 }
 return {mission:structuredClone(mission),record,stage,action,reason,from,to:getGameTimeAt(from.totalMinutes+(action==='work'?rules.minutes:0)),energy}
}
export type MissionView=ReturnType<typeof getMissionView>
let pending:(MissionView&{token:number})|null=null,sequence=0,committing=false
export function prepareMission(id:string,context:MissionContext){pending={...getMissionView(id,context),token:++sequence};return structuredClone(pending)}
export function cancelMission(token:number){if(pending?.token===token)pending=null}
export function confirmMission(token:number,context:MissionContext){
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
 if(committing||!pending||pending.token!==token)return {ok:false as const,reason:'Cette action a déjà été confirmée ou remplacée.'}
 const quote=pending;pending=null
 const current=getMissionView(quote.mission.id,context)
 if(current.reason)return {ok:false as const,reason:current.reason}
 if(current.from.totalMinutes!==quote.from.totalMinutes||current.stage!==quote.stage||current.record?.week!==quote.record?.week||current.action==='work'&&current.energy!==quote.energy)return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
 committing=true
 try{
  const action=current.action!,id=current.mission.id
  if(action==='accept')ledger[id]={week:current.from.week,stage:'active'}
  else if(action==='work')ledger[id]={week:current.record!.week,stage:'ready'}
  else ledger[id]={week:current.record!.week,stage:'paid'}
  // Verrouillage sauvegardé avant toute notification de ressources ou du calendrier.
  save()
  if(action==='work'){spendEnergy(rules.energyCost);advanceGameTime(rules.minutes)}
  if(action==='report'){addMoney(rules.moneyGain);changeRespoPoints(rules.respoGain)}
  listeners.forEach(listener=>listener())
  return {ok:true as const,...current}
 }finally{committing=false}
}
