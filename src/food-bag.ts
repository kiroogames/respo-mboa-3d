/* Un emplacement, une confirmation : les aliments vieillissent uniquement avec le calendrier du jeu. */
import { recordMeal } from './hunger.ts'
import {getGameTime,advanceGameTime} from './game-clock.ts'
import {getMoneyBalance,spendMoney} from './currency.ts'
import {projectEnergy,getPlayerResources,getMoodDetails,previewMoodChange,restoreEnergy,changeMood} from './player-resources.ts'
import {isGuidedOutingActive} from './guided-outing-state.ts'

export const bagFoods=[
 {id:'meal',name:'Repas à emporter',zone:'market',money:250,life:360,minutes:25,energy:12,mood:4},
 {id:'snack',name:'Collation à emporter',zone:'supermarket',money:150,life:720,minutes:10,energy:8,mood:2},
] as const
type FoodId=typeof bagFoods[number]['id']
type Item={id:FoodId;bought:number;expires:number}
export type BagContext={zone:string;travelling:boolean;allowed:boolean}
export type BagAction='buy'|'eat'|'discard'
const key='mboa-food-bag-v1'
let item:Item|null=null,sequence=0,committing=false
try{
 const saved=JSON.parse(localStorage.getItem(key)??'null'),v=saved?.item,f=bagFoods.find(f=>f.id===v?.id)
 if(saved?.version===1&&f&&Number.isSafeInteger(v.bought)&&v.bought>=0&&v.bought<=getGameTime().totalMinutes&&v.expires===v.bought+f.life&&Number.isSafeInteger(v.expires))item={id:f.id,bought:v.bought,expires:v.expires}
}catch{/* Une ancienne partie commence avec le sac vide. */}
const listeners=new Set<()=>void>()
export function onFoodBagChange(fn:()=>void){listeners.add(fn);return ()=>listeners.delete(fn)}
function save(){try{localStorage.setItem(key,JSON.stringify({version:1,item}))}catch{/* Conserver la session en mémoire. */}}
export function getFoodBag(){const food=bagFoods.find(f=>f.id===item?.id);return {capacity:1,item:item&&food?{...item,name:food.name,expired:getGameTime().totalMinutes>=item.expires}:null}}
export function previewFoodBag(action:BagAction,id:string,context:BagContext){
 const food=bagFoods.find(f=>f.id===(action==='buy'?id:item?.id)),now=getGameTime().totalMinutes,r=getPlayerResources(),mood=previewMoodChange(action==='eat'&&food?food.mood:0)
 const minutes=action==='buy'?5:action==='eat'&&food?food.minutes:0,end=now+minutes,expires=action==='buy'&&food?end+food.life:item?.expires??null
 const projection=projectEnergy(action==='eat'&&food?food.energy:0,end)
 const energyGain=action==='eat'?projection.energyGain:0,moodGain=action==='eat'?mood.delta:0,money=action==='buy'&&food?food.money:0
 const reason=isGuidedOutingActive()?'Terminez votre sortie accompagnée.':context.travelling||!context.allowed?'Terminez votre déplacement ou votre activité.':!food?'Aucun aliment disponible.':!Number.isSafeInteger(end)||expires!==null&&!Number.isSafeInteger(expires)?'Limite du calendrier atteinte.':action==='buy'?(context.zone!==food.zone?'Achetez cet aliment sur place.':item?'Votre sac est plein.':getMoneyBalance()<money?'Nkap insuffisants.':''):!item?'Votre sac est vide.':action==='eat'?(now>=item.expires?'Cet aliment est périmé.':end>item.expires?'Le repas finirait après la péremption.':energyGain===0&&moodGain===0?'Énergie et humeur déjà au maximum utile.':''):''
 return {action,food:food?{...food}:null,now,end,expires,minutes,money,energyGain,moodGain,energyBefore:r.energy,energyAfter:projection.energyAfter,maxEnergy:r.maxEnergy,maxEnergyAfter:projection.maxEnergyAfter,energyLoss:projection.energyLoss,moodBefore:mood.moodBefore,moodAfter:mood.moodAfter,moodBase:getMoodDetails().base,moodBonus:mood.bonus,balance:getMoneyBalance(),item:item?{...item}:null,zone:context.zone,reason}
}
let pending:(ReturnType<typeof previewFoodBag>&{token:number})|null=null
export function prepareFoodBag(action:BagAction,id:string,context:BagContext){pending={...previewFoodBag(action,id,context),token:++sequence};return structuredClone(pending)}
export function cancelFoodBag(token:number){if(pending?.token===token)pending=null}
export function confirmFoodBag(token:number,context:BagContext){
 if(committing||!pending||pending.token!==token)return {ok:false as const,reason:'Cette action a déjà été confirmée ou remplacée.'}
 const quote=pending;pending=null
 const p=previewFoodBag(quote.action,quote.food?.id??'',context)
 if(p.reason)return {ok:false as const,reason:p.reason}
 if(JSON.stringify(p)!==JSON.stringify({...quote,token:undefined}))return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
 committing=true
 try{
  // Libérer/remplir le sac avant les notifications empêche de consommer deux fois le même objet.
  item=p.action==='buy'?{id:p.food!.id,bought:p.end,expires:p.expires!}:null;save()
  if(p.action==='buy')spendMoney(p.money)
  if(p.action==='eat'){if(p.food!.id==='meal')recordMeal();restoreEnergy(p.food!.energy);changeMood(p.food!.mood)}
  if(p.minutes)advanceGameTime(p.minutes)
  listeners.forEach(fn=>fn())
  return {ok:true as const,...p}
 }finally{committing=false}
}
