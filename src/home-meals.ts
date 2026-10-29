import { recordMeal } from './hunger.ts'
import {mealEnergyRules,grantMealEnergyEffect} from './meal-energy.ts'
import {getNPCState} from './npcs.ts'
import {getCompletedNPCRequests,getConsideration} from './npc-relationships.ts'
import { isGuidedOutingActive } from './guided-outing-state.ts'
/* Un seul repas par service à domicile ; le registre est enregistré avant toute notification. */
import meals from './data/home-meals.json' with {type:'json'}
import {getGameTime,getGameTimeAt,advanceGameTime} from './game-clock.ts'
import {getEnergyDetails,getPlayerResources,restoreEnergy,changeMood,previewMoodChange} from './player-resources.ts'
import {getMoneyBalance,spendMoney} from './currency.ts'
export const homeMeals=meals
const key='mboa-home-meals-v1'
// L’heure est monotone : seul le dernier service consommé est nécessaire.
let lastConsumed=-1,lastBaeDay=-1,sequence=0,committing=false
try{const value=JSON.parse(localStorage.getItem(key)??'null');if(value&&Number.isSafeInteger(value.lastConsumed)&&value.lastConsumed>=0&&[360,720,1080].includes(value.lastConsumed%1440))lastConsumed=value.lastConsumed;if(Number.isSafeInteger(value?.lastBaeDay)&&value.lastBaeDay>=0&&value.lastBaeDay<=Math.floor(getGameTime().totalMinutes/1440))lastBaeDay=value.lastBaeDay}catch{/* Sauvegarde absente/corrompue. */}
function windows(day:number){return day%7>=5?[[360,600],[720,900],[1080,1410]]:[[360,600],[1080,1410]]}
export function getHomeMealService(total=getGameTime().totalMinutes){
  const day=Math.floor(total/1440),minute=total%1440
  const current=windows(day).find(([start,end])=>minute>=start!&&minute<end!)
  const start=current?day*1440+current[0]!:-1,end=current?day*1440+current[1]!:-1
  const consumed=current&&lastConsumed===start
  let next=-1
  for(let d=day;d<=day+1&&next<0;d++)for(const [opening] of windows(d))if(d*1440+opening!>total){next=d*1440+opening!;break}
  return {open:!!current&&!consumed,start,end,consumed:!!consumed,next:getGameTimeAt(next),reason:consumed?'Vous avez déjà mangé pendant ce service.':!current?'Les repas ne sont pas servis à cette heure.':''}
}
export type MealVariant='regular'|'bae'
// Vérifier chaque minute garantit la présence durant tout le repas, départ exact à la fin autorisé.
export function getBaeMealStatus(duration=0,total=getGameTime().totalMinutes){
 if(!Number.isSafeInteger(duration)||duration<0||duration>960||!Number.isSafeInteger(total)||total<0)throw new RangeError('Durée ou date de repas invalide.')
 const kitchen=getCompletedNPCRequests('bae').some(r=>r.id==='kitchen'),consideration=getConsideration('bae'),consumed=lastBaeDay===Math.floor(total/1440)
 const present=(time:number)=>{const p=getNPCState('bae',time);return !!p?.available&&!p.travelling&&p.zone==='home'}
 let available=present(total)
 for(let minute=1;minute<duration&&available;minute++)available=present(total+minute)
 const reason=!kitchen?'Financez d’abord la cuisine demandée par Bae.':consideration<60?`Bae doit avoir au moins 60 % de considération (${consideration} % actuellement).`:consumed?'Vous avez déjà pris un repas préparé par Bae aujourd’hui.':!present(total)?'Bae est absente ou indisponible à la maison.':!available?'Bae part avant la fin de ce repas.':''
 return {kitchen,consideration,consumed,available,reason}
}
export function previewHomeMeal(id:string,variant:MealVariant='regular'){
  const meal=meals.find(m=>m.id===id)
  if(variant!=='regular'&&variant!=='bae')throw new RangeError('Variante inconnue.')
  if(!meal)throw new RangeError('Plat inconnu.')
  const from=getGameTime(),to=getGameTimeAt(from.totalMinutes+meal.minutes),service=getHomeMealService(),state=getPlayerResources()
  const bae=getBaeMealStatus(meal.minutes),moodDelta=meal.mood+(variant==='bae'?5:0),balance=getMoneyBalance()
  const reason=service.reason||(variant==='bae'?bae.reason:'')||(to.totalMinutes>service.end?'Ce repas se terminerait après la fermeture.':'')||(getMoneyBalance()<meal.money?'Argent insuffisant.':'')
  const details=getEnergyDetails(to.totalMinutes),maxEnergyAfter=Math.min(Number.MAX_SAFE_INTEGER,details.total-details.mealBonus+mealEnergyRules.bonus),energyAfter=Math.min(maxEnergyAfter,state.energy+meal.energy)
  const projection={maxEnergyAfter,energyAfter,energyGain:Math.max(0,energyAfter-Math.min(state.energy,maxEnergyAfter)),energyLoss:Math.max(0,state.energy-maxEnergyAfter)},energyGain=projection.energyGain,mood=previewMoodChange(moodDelta),moodGain=mood.delta
  const mealEffectEnd=getGameTimeAt(to.totalMinutes+mealEnergyRules.minutes)
  return {mealEffectEnd,variant,bae,moodDelta,balance,meal:{...meal},from,to,service,reason,energyBefore:state.energy,maxEnergy:state.maxEnergy,energyGain,energyAfter:projection.energyAfter,maxEnergyAfter:projection.maxEnergyAfter,energyLoss:projection.energyLoss,moodBefore:state.mood,moodGain,moodAfter:mood.moodAfter,moodBaseBefore:mood.baseBefore,moodBonus:mood.bonus}
}
export type MealPreview=ReturnType<typeof previewHomeMeal>
let pending:(MealPreview&{id:number})|null=null
export function prepareHomeMeal(id:string,variant:MealVariant='regular'){pending={...previewHomeMeal(id,variant),id:++sequence};return structuredClone(pending)}
export function cancelHomeMeal(id:number){if(pending?.id===id)pending=null}
export function confirmHomeMeal(id:number,context:{zone:string;travelling:boolean;allowed:boolean}){
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
  if(committing||!pending||pending.id!==id)return {ok:false as const,reason:'Ce repas a déjà été confirmé ou remplacé.'}
  const quote=pending;pending=null
  if(context.zone!=='home'||context.travelling||!context.allowed)return {ok:false as const,reason:'Vous devez être à la maison, hors autre activité.'}
  const current=previewHomeMeal(quote.meal.id,quote.variant)
  if(current.reason)return {ok:false as const,reason:current.reason}
  if(current.from.totalMinutes!==quote.from.totalMinutes||current.balance!==quote.balance||current.variant==='bae'&&current.bae.consideration!==quote.bae.consideration||current.energyBefore!==quote.energyBefore||current.maxEnergy!==quote.maxEnergy||current.moodBaseBefore!==quote.moodBaseBefore||current.moodBonus!==quote.moodBonus)return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
  committing=true
  try{
    lastConsumed=current.service.start
    if(current.variant==='bae')lastBaeDay=Math.floor(current.from.totalMinutes/1440)
    try{localStorage.setItem(key,JSON.stringify({lastConsumed,lastBaeDay}))}catch{/* Le verrou reste actif pendant la session. */}
    spendMoney(current.meal.money);recordMeal();advanceGameTime(current.meal.minutes);grantMealEnergyEffect();restoreEnergy(Math.max(0,current.energyAfter-getPlayerResources().energy));changeMood(current.moodDelta)
    return {ok:true as const,...current}
  }finally{committing=false}
}
