import { recordMeal } from './hunger.ts'
import {grantSportEffect} from './sport-energy.ts'
import { isGuidedOutingActive } from './guided-outing-state.ts'
/* Sorties solo : une occurrence par activité/session, même en changeant d’option ou après minuit. */
import definitions from './data/city-outings.json' with {type:'json'}
import {getGameTime,getGameTimeAt,advanceGameTime} from './game-clock.ts'
import {getMoneyBalance,spendMoney} from './currency.ts'
import {projectEnergy,getPlayerResources,spendEnergy,restoreEnergy,changeMood,previewMoodChange} from './player-resources.ts'
export const cityOutings=definitions
const key='mboa-city-outings-v1',completed:Record<string,number>={}
const weekday=(day:number)=>(day%7+7)%7
try{
 const saved=JSON.parse(localStorage.getItem(key)??'null'),today=Math.floor(getGameTime().totalMinutes/1440)
 for(const activity of definitions){const session=saved?.[activity.id];if(Number.isSafeInteger(session)&&session>=(activity.closing<activity.opening?-1:0)&&session<=today&&activity.days.includes(weekday(session)))completed[activity.id]=session}
}catch{/* Les sorties restent jouables si le registre est absent ou corrompu. */}
export function getOutingSchedule(id:string,total=getGameTime().totalMinutes){
 if(!Number.isSafeInteger(total)||total<0)throw new RangeError('Date de sortie invalide.')
 const activity=definitions.find(a=>a.id===id)
 if(!activity)throw new RangeError('Sortie inconnue.')
 const day=Math.floor(total/1440),minute=total%1440,night=activity.closing<activity.opening
 // Après minuit, le snack reste rattaché au jour d’ouverture ; −1 désigne la toute première nuit.
 const session=night?(minute>=activity.opening?day:minute<activity.closing?day-1:null):minute>=activity.opening&&minute<activity.closing?day:null
 const open=session!==null&&activity.days.includes(weekday(session))
 const start=open?session*1440+activity.opening:null,end=open?session*1440+(night?1440:0)+activity.closing:null
 const consumed=!activity.repeatable&&open&&completed[id]===session
 let next:number|null=null
 for(let d=day;d<=day+7&&next===null;d++){
  const candidate=d*1440+activity.opening
  if(activity.days.includes(weekday(d))&&candidate>total&&Number.isSafeInteger(candidate))next=candidate
 }
 return {open,session:open?session:null,start,end,consumed,next:next===null?null:getGameTimeAt(next),reason:!open?'Cette sortie est fermée à cette heure.':consumed?night?'Sortie déjà effectuée pour cette soirée.':'Sortie déjà effectuée pour cette journée.':''}
}
export function previewCityOuting(id:string,optionId:string){
 const activity=definitions.find(a=>a.id===id),option=activity?.options.find(o=>o.id===optionId)
 if(!activity||!option)throw new RangeError('Sortie ou option inconnue.')
 const from=getGameTime(),schedule=getOutingSchedule(id),resources=getPlayerResources(),mood=previewMoodChange(option.mood),balance=getMoneyBalance()
 const safe=Number.isSafeInteger(from.totalMinutes+option.minutes),to=safe?getGameTimeAt(from.totalMinutes+option.minutes):from
 const projection=projectEnergy(option.energyGain,to.totalMinutes,from.totalMinutes,resources.energy,option.energy),energyGain=projection.energyGain
 const reason=schedule.reason||(!safe?'Limite du calendrier atteinte.':'')||(to.totalMinutes>schedule.end!?'La sortie se terminerait après la fermeture.':'')||(balance<option.money?'Nkap insuffisants.':'')||(resources.energy<option.energy?'Énergie insuffisante.':'')||(activity.repeatable&&energyGain===0&&mood.delta===0?'Énergie et humeur déjà au maximum utile.':'')
 return {activity:structuredClone(activity),option:{...option},from,to,schedule,balance,energyBefore:resources.energy,energyGain,maxEnergy:resources.maxEnergy,energyAfter:projection.energyAfter,maxEnergyAfter:projection.maxEnergyAfter,energyLoss:projection.energyLoss,moodBaseBefore:mood.baseBefore,moodBonus:mood.bonus,moodBefore:mood.moodBefore,moodAfter:mood.moodAfter,moodGain:mood.delta,reason}
}
const listeners=new Set<()=>void>()
export function onCityOutingChange(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener)}
// Réservation commune au solo et aux invitations, sans nouveau compteur parallèle.
export function claimCityOutingSession(id:string,session:number){
 const schedule=getOutingSchedule(id)
 if(!schedule.open||schedule.consumed||schedule.session!==session)return false
 if(!definitions.find(a=>a.id===id)!.repeatable)completed[id]=session
 try{localStorage.setItem(key,JSON.stringify(completed))}catch{/* Session conservée en mémoire. */}
 listeners.forEach(listener=>listener());return true
}
let sequence=0,committing=false,pending:(ReturnType<typeof previewCityOuting>&{token:number})|null=null
export function prepareCityOuting(id:string,optionId:string){pending={...previewCityOuting(id,optionId),token:++sequence};return structuredClone(pending)}
export function cancelCityOuting(token:number){if(pending?.token===token)pending=null}
export function confirmCityOuting(token:number,context:{zone:string;travelling:boolean;allowed:boolean}){
 if(committing||!pending||pending.token!==token)return {ok:false as const,reason:'Cette sortie a déjà été confirmée ou remplacée.'}
 const quote=pending;pending=null
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
 if(context.zone!==quote.activity.zone||context.travelling||!context.allowed)return {ok:false as const,reason:'Vous devez être arrivé sur le lieu, hors trajet et autre activité.'}
 const current=previewCityOuting(quote.activity.id,quote.option.id)
 if(current.reason)return {ok:false as const,reason:current.reason}
 if(current.from.totalMinutes!==quote.from.totalMinutes||current.schedule.session!==quote.schedule.session||current.balance!==quote.balance||current.energyBefore!==quote.energyBefore||current.maxEnergy!==quote.maxEnergy||current.moodBaseBefore!==quote.moodBaseBefore||current.moodBonus!==quote.moodBonus)return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
 committing=true
 try{
  if(!current.activity.repeatable)completed[current.activity.id]=current.schedule.session!
  // Verrouiller l’occurrence avant les notifications de portefeuille, ressources et calendrier.
  try{localStorage.setItem(key,JSON.stringify(completed))}catch{/* Limite conservée pendant la session. */}
  // Restaurant ou plat au snack : un vrai repas.
  if(current.activity.id.startsWith('restaurant')||current.option.id==='meal')recordMeal()
  spendMoney(current.option.money);spendEnergy(current.option.energy);restoreEnergy(current.option.energyGain);changeMood(current.option.mood);advanceGameTime(current.option.minutes)
  if(current.activity.id==='football')grantSportEffect()
  listeners.forEach(listener=>listener())
  return {ok:true as const,...current}
 }finally{committing=false}
}
