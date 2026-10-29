import { isGuidedOutingActive } from './guided-outing-state.ts'
/* Confort dérivé des objets équipés et des travaux payés : aucun compteur cumulable au clic. */
import rules from './data/home-comfort.json' with {type:'json'}
import bae from './data/bae-dialogues.json' with {type:'json'}
import {getCompletedNPCRequests,onNPCRelationshipChange} from './npc-relationships.ts'
import {getMoneyBalance,spendMoney,addMoney} from './currency.ts'
import {getGameTime} from './game-clock.ts'
export const comfortRules=rules
export type ComfortContext={zone:string;travelling:boolean;allowed:boolean}
export type ComfortAction='buy'|'equip'|'sell'
const key='mboa-home-comfort-v1',owned=new Set<string>(),equipped:Record<string,string>={bed:'bed-base',sofa:'sofa-base'}
try{
 const saved=JSON.parse(localStorage.getItem(key)??'null')
 if(Array.isArray(saved?.owned))for(const id of saved.owned)if(rules.equipment.some(item=>item.id===id&&item.money>0))owned.add(id)
 for(const slot of ['bed','sofa']){const item=rules.equipment.find(item=>item.id===saved?.equipped?.[slot]&&item.slot===slot);if(item&&(item.money===0||owned.has(item.id)))equipped[slot]=item.id}
}catch{/* Les équipements de base gratuits restent disponibles. */}
function save(){try{localStorage.setItem(key,JSON.stringify({owned:[...owned],equipped}))}catch{/* L’inventaire fonctionne aussi pendant la session. */}}
export function getHomeComfort(){
 const completed=new Set(getCompletedNPCRequests('bae').map(item=>item.id))
 const equipment=rules.equipment.map(item=>({...item,owned:item.money===0||owned.has(item.id),equipped:equipped[item.slot]===item.id}))
 const improvements=rules.improvements.map(item=>{const request=bae.requests.find(r=>r.id===item.id)!;return {...item,name:request.title,money:request.money,paid:completed.has(item.id)}})
 const rooms=rules.rooms.map(room=>({...room,comfort:equipment.filter(item=>item.room===room.id&&item.equipped).reduce((sum,item)=>sum+item.comfort,0)+improvements.filter(item=>item.room===room.id&&item.paid).reduce((sum,item)=>sum+item.comfort,0)}))
 const total=rooms.reduce((sum,room)=>sum+room.comfort,0)
 return {total,target:rules.target,complete:total>=rules.target,rooms,equipment,improvements}
}
export function comfortContextReason(context:ComfortContext){return context.travelling?'Terminez votre trajet.':!context.allowed?'Terminez votre autre activité.':context.zone!=='home'?'Vous devez être à la maison.':''}
export function previewHomeEquipment(id:string,action:ComfortAction,context:ComfortContext){
 const state=getHomeComfort(),item=state.equipment.find(item=>item.id===id)
 if(!item)throw new RangeError('Équipement inconnu.')
 if(action!=='buy'&&action!=='equip'&&action!=='sell')throw new RangeError('Action inconnue.')
 const previous=state.equipment.find(other=>other.slot===item.slot&&other.equipped)!,balance=getMoneyBalance()
 const refund=action==='sell'?Math.floor(item.money/2):0,base=state.equipment.find(other=>other.slot===item.slot&&other.money===0)!
 const reason=comfortContextReason(context)||(action==='sell'?(!item.owned?'Vous ne possédez pas cet équipement.':item.money===0?'Les meubles de base gratuits ne sont pas revendables.':!Number.isSafeInteger(balance+refund)?'Le portefeuille ne peut pas recevoir ce montant.':''):action==='buy'?(item.owned?'Cet équipement est déjà possédé.':balance<item.money?'Nkap insuffisants.':''):!item.owned?'Achetez cet équipement avant de l’équiper.':item.equipped?'Cet équipement est déjà équipé.':'')
 return {item,action,price:action==='buy'?item.money:0,refund,replacement:action==='sell'&&item.equipped?base.id:null,balance,total:state.total,afterComfort:action==='equip'?state.total-previous.comfort+item.comfort:action==='sell'&&item.equipped?state.total-item.comfort+base.comfort:state.total,time:getGameTime().totalMinutes,reason,
  signature:JSON.stringify({owned:[...owned].sort(),equipped,completed:state.improvements.filter(item=>item.paid).map(item=>item.id)})}
}
const listeners=new Set<()=>void>()
export function onComfortChange(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener)}
onNPCRelationshipChange(()=>listeners.forEach(listener=>listener()))
let sequence=0,committing=false,pending:(ReturnType<typeof previewHomeEquipment>&{token:number})|null=null
export function prepareHomeEquipment(id:string,action:ComfortAction,context:ComfortContext){pending={...previewHomeEquipment(id,action,context),token:++sequence};return structuredClone(pending)}
export function cancelHomeEquipment(token:number){if(pending?.token===token)pending=null}
export function confirmHomeEquipment(token:number,context:ComfortContext){
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
 if(committing||!pending||pending.token!==token)return {ok:false as const,reason:'Cette action a déjà été confirmée ou remplacée.'}
 const quote=pending;pending=null
 const current=previewHomeEquipment(quote.item.id,quote.action,context)
 if(current.reason)return {ok:false as const,reason:current.reason}
 if(current.signature!==quote.signature||current.time!==quote.time||current.balance!==quote.balance)return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
 committing=true
 try{
  if(current.action==='buy')owned.add(current.item.id)
  else if(current.action==='sell'){
   owned.delete(current.item.id)
   if(current.replacement)equipped[current.item.slot]=current.replacement
  }else equipped[current.item.slot]=current.item.id
  save() // Enregistrer la propriété avant les notifications du portefeuille.
  if(current.action==='buy')spendMoney(current.price)
  if(current.action==='sell')addMoney(current.refund)
  listeners.forEach(listener=>listener())
  return {ok:true as const,item:current.item,action:current.action,price:current.price,refund:current.refund,...getHomeComfort()}
 }finally{committing=false}
}

// Seul le lit équipé aide la recharge : acheter sans équiper ne donne aucun bonus.
export function getBedSleepQuality(){
 const bed=getHomeComfort().equipment.find(item=>item.slot==='bed'&&item.equipped)!
 return {id:bed.id,name:bed.name,bonusPer30:bed.id==='bed-comfort'?1:0}
}
