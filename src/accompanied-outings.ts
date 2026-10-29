/* Parcours réservé pour deux : payer une fois, avancer trois étapes, reprendre sans rejouer leurs effets. */
import rules from './data/accompanied-outings.json' with {type:'json'}
import {getGameTime,getGameTimeAt,advanceGameTime} from './game-clock.ts'
import {getRoutineNPCState} from './npcs.ts'
import {getMoneyBalance,spendMoney} from './currency.ts'
import {projectEnergy,getEnergyMaximumAt,getPlayerResources,getMoodDetails,previewMoodChange,spendEnergy,restoreEnergy,changeMood} from './player-resources.ts'
import {getConsideration,changeConsideration} from './npc-relationships.ts'
import {cityOutings,getOutingSchedule,claimCityOutingSession} from './city-outings.ts'
import {createTravelRoute,quoteTravel,travelModes} from './travel.ts'
import type {TravelMode,TravelPoint} from './travel.ts'
import {getTrafficConditions,trafficLevels} from './traffic-conditions.ts'
import type {TrafficConditions} from './traffic-conditions.ts'
import {isGuidedOutingActive,setGuidedPresentation} from './guided-outing-state.ts'
export const accompaniedRules=rules
export type GuidedPhase='outbound'|'activity'|'return'|'done'
export type GuidedContext={zone:string;travelling:boolean;allowed:boolean}
export type LocatePlace=(zone:string)=>TravelPoint
function freeAt(id:string,time:number){const p=getRoutineNPCState(id,time);return !!p?.available&&!p.travelling&&p.zone===(id==='bae'?'home':'palms')&&(id==='bae'||p.activity.toLowerCase().includes('temps libre'))}
export function companionAvailableUntil(id:string,time=getGameTime().totalMinutes){
 if(!rules.companions.includes(id)||!freeAt(id,time))return time
 let end=time+1
 // Fusionne la présence de Bae à domicile de part et d’autre de minuit, jusqu’à son départ à 08h.
 while(end<time+2880&&Number.isSafeInteger(end)&&freeAt(id,end))end++
 return end
}
export function previewAccompanied(npcId:string,activityId:string,optionId:string,mode:TravelMode,context:GuidedContext,locate:LocatePlace,traffic:TrafficConditions=getTrafficConditions()){
 const activity=cityOutings.find(a=>a.id===activityId),option=activity?.options.find(o=>o.id===optionId)
 if(!rules.companions.includes(npcId)||!rules.activities.includes(activityId)||!activity||!option||!travelModes.some(m=>m.id===mode))throw new RangeError('Invitation ou option inconnue.')
 const origin=npcId==='bae'?'home':'palms',destination=activity.zone,from=getGameTime(),availableUntil=companionAvailableUntil(npcId,from.totalMinutes)
 const outwardRoute=createTravelRoute(locate(origin),locate(destination)),returnRoute=createTravelRoute(locate(destination),locate(origin))
 const outward=quoteTravel(outwardRoute,mode,traffic),back=quoteTravel(returnRoute,mode,traffic),seats=rules.transportSeats[mode]
 const arrival=from.totalMinutes+outward.minutes,activityEnd=arrival+option.minutes,returned=activityEnd+back.minutes
 const schedule=getOutingSchedule(activityId,arrival),resources=getPlayerResources(),mood=previewMoodChange(option.mood+rules.moodBonus),balance=getMoneyBalance()
 const money=option.money*2+(outward.money+back.money)*seats,energy=option.energy+outward.energy+back.energy
 const mealProjection=projectEnergy(option.energyGain,activityEnd,arrival,Math.max(0,resources.energy-energy)),energyGain=mealProjection.energyGain,energyAfter=Math.min(mealProjection.energyAfter,getEnergyMaximumAt(returned))
 const considerationBefore=getConsideration(npcId),considerationGain=Math.min(rules.considerationGain,100-considerationBefore)
 const reason=isGuidedOutingActive()?'Terminez votre sortie accompagnée.':context.travelling||!context.allowed?'Terminez votre autre activité.':context.zone!==origin||availableUntil===from.totalMinutes?'Retrouvez cette personne sur place pendant son temps libre.':schedule.reason||(!schedule.end||activityEnd>schedule.end?'L’activité ne tiendrait pas dans les horaires d’ouverture.':'')||(returned>=availableUntil?'Le retour serait trop tard pour la disponibilité de votre accompagnante.':'')||(balance<money?'Nkap insuffisants pour le parcours complet.':'')||(resources.energy<energy?'Énergie insuffisante pour le parcours complet.':'')||(activity.repeatable&&energyGain===0&&mood.delta===0?'Énergie et humeur déjà au maximum utile.':'')
 return {npcId,activityId,optionId,mode,origin,destination,from,arrival:getGameTimeAt(arrival),activityEnd:getGameTimeAt(activityEnd),returned:getGameTimeAt(returned),availableUntil,outwardRoute,returnRoute,outward,back,traffic:{...traffic},money,energy,activityMoney:option.money*2,activityMinutes:option.minutes,moodDelta:option.mood+rules.moodBonus,moodGain:mood.delta,moodBefore:mood.moodBefore,moodAfter:mood.moodAfter,moodBaseBefore:mood.baseBefore,moodBonus:mood.bonus,considerationBefore,considerationGain,balance,energyBefore:resources.energy,maxEnergy:resources.maxEnergy,energyGain,energyAfter,energyAtMeal:mealProjection.energyAfter,maxEnergyAfter:getEnergyMaximumAt(returned),session:schedule.session,reason}
}
export type AccompaniedPlan=ReturnType<typeof previewAccompanied>
type GuidedRecord={version:1;phase:GuidedPhase;plan:AccompaniedPlan;moodGain:number;considerationGain:number;energyGain?:number}
const key='mboa-accompanied-outings-v1'
let record:GuidedRecord|null=null,sequence=0,committing=false,pending:(AccompaniedPlan&{token:number})|null=null
const listeners=new Set<()=>void>()
export function onAccompaniedChange(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener)}
function publish(){
 if(!record||record.phase==='done'){setGuidedPresentation(null);return}
 const {phase,plan:p}=record,returning=phase==='return'
 setGuidedPresentation({npcId:p.npcId,mode:p.mode,phase,origin:returning?p.destination:p.origin,destination:returning?p.origin:p.destination,zone:phase==='activity'?p.destination:null,travelling:phase!=='activity',progress:0})
}
function save(){try{localStorage.setItem(key,JSON.stringify(record))}catch{/* Reprise en mémoire pendant cette session. */}}
function notify(){listeners.forEach(listener=>listener())}
// Les données de trajet sont réservées, mais une sauvegarde mal formée ne doit pas bloquer le jeu.
function validSaved(v:any):v is GuidedRecord{
 try{
  const p=v?.plan,activity=cityOutings.find(a=>a.id===p?.activityId),option=activity?.options.find(o=>o.id===p?.optionId),traffic=trafficLevels[p?.traffic?.id as keyof typeof trafficLevels]
  if(v?.version!==1||!['outbound','activity','return','done'].includes(v.phase)||!p||!option||!rules.activities.includes(p.activityId)||!rules.companions.includes(p.npcId)||!traffic||!travelModes.some(m=>m.id===p.mode)||p.origin!==(p.npcId==='bae'?'home':'palms')||p.destination!==activity!.zone)return false
  for(const route of [p.outwardRoute,p.returnRoute])if(!Array.isArray(route)||route.length<2||route.length>2000||route.some((point:any)=>!Array.isArray(point)||point.length!==3||point.some((n:any)=>!Number.isFinite(n)||Math.abs(n)>100000)))return false
  const out=quoteTravel(p.outwardRoute,p.mode,traffic),back=quoteTravel(p.returnRoute,p.mode,traffic),seats=rules.transportSeats[p.mode as TravelMode]
  if(p.outward?.minutes!==out.minutes||p.back?.minutes!==back.minutes||p.activityMinutes!==option.minutes||p.outward?.money!==out.money||p.back?.money!==back.money||p.outward?.energy!==out.energy||p.back?.energy!==back.energy)return false
  if(!Number.isSafeInteger(p.from?.totalMinutes)||p.from.totalMinutes<0||p.arrival?.totalMinutes!==p.from.totalMinutes+out.minutes||p.activityEnd?.totalMinutes!==p.arrival.totalMinutes+option.minutes||p.returned?.totalMinutes!==p.activityEnd.totalMinutes+back.minutes||!Number.isSafeInteger(p.returned.totalMinutes)||p.money!==option.money*2+(out.money+back.money)*seats||p.energy!==option.energy+out.energy+back.energy||p.moodDelta!==option.mood+rules.moodBonus)return false
  if(option.energyGain&&(!Number.isFinite(v.energyGain)||v.energyGain<0||v.energyGain>option.energyGain))return false
  if(p.returned.totalMinutes>=companionAvailableUntil(p.npcId,p.from.totalMinutes)||p.session!==getOutingSchedule(p.activityId,p.arrival.totalMinutes).session)return false
  const current=getGameTime().totalMinutes,expected=v.phase==='outbound'?p.arrival.totalMinutes:v.phase==='activity'?p.activityEnd.totalMinutes:p.returned.totalMinutes
  return Number.isFinite(v.moodGain)&&v.moodGain>=0&&v.moodGain<=option.mood+rules.moodBonus&&Number.isFinite(v.considerationGain)&&v.considerationGain>=0&&v.considerationGain<=rules.considerationGain&&(v.phase==='done'?current>=expected:current===expected)
 }catch{return false}
}
try{const saved=JSON.parse(localStorage.getItem(key)??'null');if(validSaved(saved))record=saved}catch{/* Ancienne partie ou registre absent. */}
publish()
export function getAccompaniedState(){return record?structuredClone(record):null}
export function prepareAccompanied(npcId:string,activityId:string,optionId:string,mode:TravelMode,context:GuidedContext,locate:LocatePlace){pending={...previewAccompanied(npcId,activityId,optionId,mode,context,locate),token:++sequence};return structuredClone(pending)}
export function cancelAccompanied(token:number){if(pending?.token===token)pending=null}
export function confirmAccompanied(token:number,context:GuidedContext,locate:LocatePlace){
 if(committing||!pending||pending.token!==token)return {ok:false as const,reason:'Ce parcours a déjà été confirmé ou remplacé.'}
 const quote=pending;pending=null
 const p=previewAccompanied(quote.npcId,quote.activityId,quote.optionId,quote.mode,context,locate,quote.traffic)
 if(p.reason)return {ok:false as const,reason:p.reason}
 if(p.from.totalMinutes!==quote.from.totalMinutes||p.balance!==quote.balance||p.energyBefore!==quote.energyBefore||p.maxEnergy!==quote.maxEnergy||p.moodBaseBefore!==quote.moodBaseBefore||p.moodBonus!==quote.moodBonus||p.considerationBefore!==quote.considerationBefore)return {ok:false as const,reason:'La situation a changé. Vérifiez le nouveau devis.'}
 committing=true
 try{
  record={version:1,phase:'outbound',plan:p,moodGain:0,considerationGain:0,energyGain:0};publish();save()
  spendMoney(p.money);spendEnergy(p.energy);advanceGameTime(p.outward.minutes);save();notify()
  return {ok:true as const,plan:structuredClone(p)}
 }finally{committing=false}
}
export function finishAccompaniedPhase(expected:GuidedPhase){
 if(committing||!record||record.phase!==expected||expected==='done')return false
 committing=true
 try{
  const p=record.plan
  if(expected==='outbound'){
   if(!claimCityOutingSession(p.activityId,p.session!))return false
   const before=getMoodDetails().displayed,energyBefore=getPlayerResources().energy,consideration=getConsideration(p.npcId)
   record.phase='activity';publish();save()
   restoreEnergy(cityOutings.find(a=>a.id===p.activityId)!.options.find(o=>o.id===p.optionId)!.energyGain)
   changeMood(p.moodDelta);changeConsideration(p.npcId,rules.considerationGain)
   record.moodGain=getMoodDetails().displayed-before;record.considerationGain=getConsideration(p.npcId)-consideration
   advanceGameTime(p.activityMinutes)
   record.energyGain=Math.max(0,getPlayerResources().energy-Math.min(energyBefore,getEnergyMaximumAt()))
  }else if(expected==='activity'){record.phase='return';publish();save();advanceGameTime(p.back.minutes)}
  else{record.phase='done';publish()}
  save();notify();return true
 }finally{committing=false}
}
