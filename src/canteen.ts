/* Les deux accès à la cantine utilisent le même service quotidien et le même verrou par plat. */
import rules from './data/canteen.json' with {type:'json'}
import {getGameTime,getGameTimeAt,advanceGameTime} from './game-clock.ts'
import {projectEnergy,getPlayerResources,previewMoodChange,restoreEnergy,changeMood} from './player-resources.ts'
import {getMoneyBalance,spendMoney} from './currency.ts'
import {isGuidedOutingActive} from './guided-outing-state.ts'
export const canteenRules=rules
const key='mboa-canteen-v1'
let ledger:{day:number;done:string[]}={day:-1,done:[]},sequence=0,committing=false
try{
 const v=JSON.parse(localStorage.getItem(key)??'null')
 if(v?.version===1&&Number.isSafeInteger(v.day)&&v.day>=0&&v.day%7<5&&v.day<=Math.floor(getGameTime().totalMinutes/1440)&&Array.isArray(v.done)&&v.done.every((id:unknown)=>typeof id==='string'&&rules.menus[v.day%7]!.includes(id))&&new Set(v.done).size===v.done.length)ledger={day:v.day,done:[...v.done]}
}catch{/* Ancienne partie : aucun plat consommé rétroactivement. */}
const listeners=new Set<()=>void>()
export function onCanteenChange(fn:()=>void){listeners.add(fn);return ()=>listeners.delete(fn)}
export function getCanteenService(total=getGameTime().totalMinutes){
 if(!Number.isSafeInteger(total)||total<0)throw new RangeError('Date de cantine invalide.')
 const day=Math.floor(total/1440),minute=total%1440,menu=rules.menus[day%7]??[],done=ledger.day===day?[...ledger.done]:[],open=day%7<5&&minute>=rules.opening&&minute<rules.closing
 let next:number|null=null
 for(let d=day;d<=day+7&&next===null;d++){const start=d*1440+rules.opening;if(d%7<5&&start>total&&Number.isSafeInteger(start))next=start}
 return {day,open,menu:[...menu],done,end:day*1440+rules.closing,next:next===null?null:getGameTimeAt(next),reason:!open?'La cantine ouvre du lundi au vendredi, de 11h à 14h.':menu.every(id=>done.includes(id))?'Tous les plats du service ont été consommés.':''}
}
export function previewCanteenMeal(id:string){
 const dish=rules.dishes.find(d=>d.id===id)
 if(!dish)throw new RangeError('Plat inconnu.')
 const service=getCanteenService(),from=getGameTime(),resources=getPlayerResources(),balance=getMoneyBalance(),mood=previewMoodChange(dish.mood),safe=Number.isSafeInteger(from.totalMinutes+dish.minutes),to=safe?getGameTimeAt(from.totalMinutes+dish.minutes):from
 const projection=projectEnergy(dish.energy,to.totalMinutes),energyGain=projection.energyGain
 const reason=service.reason||(!service.menu.includes(id)?'Ce plat n’est pas au menu aujourd’hui.':'')||(service.done.includes(id)?'Ce plat a déjà été consommé pendant ce service.':'')||(!safe?'Limite du calendrier atteinte.':'')||(to.totalMinutes>service.end?'Ce repas se terminerait après 14h.':'')||(balance<dish.money?'Nkap insuffisants.':'')||(energyGain===0&&mood.delta===0?'Énergie et humeur déjà au maximum utile.':'')
 return {dish:{...dish},service,from,to,balance,energyBefore:resources.energy,maxEnergy:resources.maxEnergy,energyGain,energyAfter:projection.energyAfter,maxEnergyAfter:projection.maxEnergyAfter,energyLoss:projection.energyLoss,moodBaseBefore:mood.baseBefore,moodBonus:mood.bonus,moodBefore:mood.moodBefore,moodAfter:mood.moodAfter,moodGain:mood.delta,reason}
}
let pending:(ReturnType<typeof previewCanteenMeal>&{token:number})|null=null
export function prepareCanteenMeal(id:string){pending={...previewCanteenMeal(id),token:++sequence};return structuredClone(pending)}
export function cancelCanteenMeal(token:number){if(pending?.token===token)pending=null}
export function confirmCanteenMeal(token:number,context:{zone:string;travelling:boolean;allowed:boolean}){
 if(committing||!pending||pending.token!==token)return {ok:false as const,reason:'Ce repas a déjà été confirmé ou remplacé.'}
 const q=pending;pending=null
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
 if(context.zone!==rules.zone||context.travelling||!context.allowed)return {ok:false as const,reason:'Vous devez être au ministère, hors trajet et autre activité.'}
 const p=previewCanteenMeal(q.dish.id)
 if(p.reason)return {ok:false as const,reason:p.reason}
 if(p.from.totalMinutes!==q.from.totalMinutes||p.balance!==q.balance||p.energyBefore!==q.energyBefore||p.maxEnergy!==q.maxEnergy||p.moodBaseBefore!==q.moodBaseBefore||p.moodBonus!==q.moodBonus)return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
 committing=true
 try{
  // Réserver le plat avant toute notification protège les deux entrées et les appels réentrants.
  ledger={day:p.service.day,done:[...p.service.done,p.dish.id]}
  try{localStorage.setItem(key,JSON.stringify({version:1,...ledger}))}catch{/* Service conservé en mémoire. */}
  spendMoney(p.dish.money);restoreEnergy(p.energyGain);changeMood(p.dish.mood);advanceGameTime(p.dish.minutes)
  listeners.forEach(fn=>fn())
  return {ok:true as const,...p}
 }finally{committing=false}
}
