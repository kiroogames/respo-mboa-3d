/* Réunion quotidienne : un seul engagement pour les deux options et aucun versement rétroactif. */
import rules from './data/minfi-meetings.json' with {type:'json'}
import {getGameTime,getGameTimeAt,advanceGameTime} from './game-clock.ts'
import {projectEnergy,getPlayerResources,spendEnergy,changeRespoPoints} from './player-resources.ts'
import {getRespoProgress} from './respo-level.ts'
import {isGuidedOutingActive} from './guided-outing-state.ts'
export const meetingRules=rules
const key='mboa-minfi-meetings-v1'
let completedDay=-1,sequence=0,committing=false
try{
 const saved=JSON.parse(localStorage.getItem(key)??'null'),day=saved?.day
 if(saved?.version===1&&Number.isSafeInteger(day)&&day>=0&&day%7<5&&day<=Math.floor(getGameTime().totalMinutes/1440))completedDay=day
}catch{/* Les anciennes parties commencent sans réunion accomplie. */}
const listeners=new Set<()=>void>()
export function onMeetingChange(fn:()=>void){listeners.add(fn);return ()=>listeners.delete(fn)}
export function getMeetingSchedule(total=getGameTime().totalMinutes){
 if(!Number.isSafeInteger(total)||total<0)throw new RangeError('Date de réunion invalide.')
 const day=Math.floor(total/1440),minute=total%1440,weekday=day%7,open=weekday<5&&minute>=rules.opening&&minute<rules.closing,consumed=completedDay===day
 let next:number|null=null
 for(let d=day;d<=day+7&&next===null;d++){const start=d*1440+rules.opening;if(d%7<5&&start>total&&Number.isSafeInteger(start))next=start}
 return {day,open,consumed,topic:weekday<5?rules.topics[weekday]!:null,end:day*1440+rules.closing,next:next===null?null:getGameTimeAt(next),reason:!open?'Les réunions sont fermées à cette heure.':consumed?'Réunion déjà accomplie aujourd’hui.':''}
}
export function previewMeeting(id:string){
 const option=rules.options.find(o=>o.id===id)
 if(!option)throw new RangeError('Option de réunion inconnue.')
 const from=getGameTime(),schedule=getMeetingSchedule(),resources=getPlayerResources(),safe=Number.isSafeInteger(from.totalMinutes+option.minutes),to=safe?getGameTimeAt(from.totalMinutes+option.minutes):from
 const gainsSafe=Number.isSafeInteger(resources.ptRespo+option.respo),progressBefore=getRespoProgress(resources.ptRespo),progressAfter=getRespoProgress(gainsSafe?resources.ptRespo+option.respo:resources.ptRespo)
 const reason=schedule.reason||(!safe?'Limite du calendrier atteinte.':'')||(to.totalMinutes>schedule.end?'La réunion se terminerait après 16h.':'')||(resources.energy<option.energy?'Énergie insuffisante.':'')||(!gainsSafe?'Le total des points Respo dépasse la limite autorisée.':'')
 return {option:{...option},from,to,schedule,energyBefore:resources.energy,energyAfter:projectEnergy(0,to.totalMinutes,from.totalMinutes,resources.energy,option.energy,'awake',resources.ptRespo+option.respo).energyAfter,progressBefore,progressAfter,reason}
}
let pending:(ReturnType<typeof previewMeeting>&{token:number})|null=null
export function prepareMeeting(id:string){pending={...previewMeeting(id),token:++sequence};return structuredClone(pending)}
export function cancelMeeting(token:number){if(pending?.token===token)pending=null}
export function confirmMeeting(token:number,context:{zone:string;travelling:boolean;allowed:boolean}){
 if(committing||!pending||pending.token!==token)return {ok:false as const,reason:'Cette réunion a déjà été confirmée ou remplacée.'}
 const quote=pending;pending=null
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
 if(context.zone!==rules.zone||context.travelling||!context.allowed)return {ok:false as const,reason:'Vous devez être au ministère, hors trajet et autre activité.'}
 const p=previewMeeting(quote.option.id)
 if(p.reason)return {ok:false as const,reason:p.reason}
 if(p.from.totalMinutes!==quote.from.totalMinutes||p.energyBefore!==quote.energyBefore||p.progressBefore.points!==quote.progressBefore.points)return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
 committing=true
 try{
  // Réserver la journée avant les notifications des ressources empêche toute seconde récompense.
  completedDay=p.schedule.day
  try{localStorage.setItem(key,JSON.stringify({version:1,day:completedDay}))}catch{/* Journée conservée en mémoire. */}
  spendEnergy(p.option.energy);changeRespoPoints(p.option.respo);advanceGameTime(p.option.minutes)
  listeners.forEach(fn=>fn())
  return {ok:true as const,...p}
 }finally{committing=false}
}
