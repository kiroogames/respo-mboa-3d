/* Une commande reçue en présence d’Anneke, un traitement classique et un seul règlement le soir. */
import rules from './data/anneke-extra.json' with {type:'json'}
import {getGameTime,advanceGameTime} from './game-clock.ts'
import {getPlayerResources,spendEnergy,changeRespoPoints} from './player-resources.ts'
import {getMoneyBalance,addMoney} from './currency.ts'
import {getNPCState} from './npcs.ts'
import {isGuidedOutingActive} from './guided-outing-state.ts'
export const extraRules=rules
export const extraDraftKey='mboa-anneke-extra-draft-v1'
export type ExtraContext={zone:string;travelling:boolean;allowed:boolean}
const key='mboa-anneke-extra-v1'
type Order={version:1;day:number;index:number;started:boolean;done:boolean}
let order:Order|null=null,committing=false,sequence=0
try{
 const v=JSON.parse(localStorage.getItem(key)??'null')
 if(v?.version===1&&Number.isSafeInteger(v.day)&&v.day>=0&&v.day%7<5&&v.day<=Math.floor(getGameTime().totalMinutes/1440)&&Number.isInteger(v.index)&&v.index>=0&&v.index<rules.titles.length&&typeof v.started==='boolean'&&typeof v.done==='boolean'&&(!v.done||v.started))order={version:1,day:v.day,index:v.index,started:v.started,done:v.done}
}catch{/* Ancienne partie : aucune commande ni récompense. */}
const listeners=new Set<()=>void>()
export function onExtraChange(fn:()=>void){listeners.add(fn);return ()=>listeners.delete(fn)}
function save(){try{localStorage.setItem(key,JSON.stringify(order))}catch{/* Garder la réservation dans la session. */}}
export function getExtraState(){
 const time=getGameTime().totalMinutes,day=Math.floor(time/1440),minute=time%1440,person=getNPCState(rules.giver)
 const expired=!!order&&!order.done&&(order.day!==day||minute>=rules.closing)
 return {order:order?{...order}:null,expired,day,open:day%7<5&&minute>=rules.opening&&minute<rules.closing,deadline:(order?.day??day)*1440+rules.closing,giverAvailable:!!person?.available&&!person.travelling&&person.zone===rules.zone,title:order?rules.titles[order.index]!:null}
}
function contextReason(context:ExtraContext){return isGuidedOutingActive()?'Terminez votre sortie accompagnée.':context.zone!==rules.zone||context.travelling||!context.allowed?'Vous devez être au ministère, hors trajet et autre activité.':''}
export function extraWorkReason(zone:string,batch?:string,index?:number){
 const s=getExtraState(),o=s.order,now=getGameTime().totalMinutes
 if(zone!==rules.zone)return 'Rejoignez le ministère.'
 if(!o)return 'Récupérez une commande auprès d’Anneke en journée.'
 if(o.done&&o.day===s.day)return 'Cette commande a déjà été rémunérée aujourd’hui.'
 if(s.expired||o.day!==s.day)return 'La commande a expiré à 23h. Retrouvez Anneke un autre jour ouvré.'
 if(!s.open)return 'Le taf extra se réalise du lundi au vendredi, de 18h à 23h.'
 if(!Number.isSafeInteger(now+rules.minutes)||now+rules.minutes>s.deadline)return 'Il faut une heure complète avant 23h.'
 if(batch!==undefined&&batch!==`extra:${o.day}`||index!==undefined&&index!==o.index)return 'Cette commande ne correspond pas à votre commande acceptée.'
 if(getPlayerResources().energy<rules.energyCost)return 'Énergie insuffisante : il faut 25 énergie.'
 if(!Number.isSafeInteger(getMoneyBalance()+rules.moneyGain)||!Number.isSafeInteger(getPlayerResources().ptRespo+rules.respoGain))return 'Les compteurs ne permettent pas de recevoir cette récompense.'
 return ''
}
export function getExtraBatch(){
 const s=getExtraState(),o=s.order,reason=extraWorkReason(rules.zone),valid=!!o&&o.day===s.day&&!s.expired
 return {id:valid?`extra:${o!.day}`:`extra:${s.day}:expired`,open:s.open,canFinish:!reason,nextRefill:s.deadline,remaining:valid&&!o!.done?1:0,reason,dossiers:valid?[{index:o!.index,title:rules.titles[o!.index]!,done:o!.done}]:[]}
}
export function previewExtra(action:'accept'|'start',index:number,context:ExtraContext){
 if(!Number.isInteger(index)||index<0||index>=rules.titles.length)throw new RangeError('Commande inconnue.')
 const s=getExtraState(),now=getGameTime().totalMinutes
 const reason=contextReason(context)||(action==='accept'?(s.day%7>=5||!s.giverAvailable?'Retrouvez Anneke au ministère lorsqu’elle est disponible.':s.order?.day===s.day?'Une seule commande extra peut être choisie par jour.':''):extraWorkReason(context.zone,undefined,index))
 return {action,index,title:rules.titles[index]!,now,day:s.day,deadline:s.day*1440+rules.closing,energyBefore:getPlayerResources().energy,balance:getMoneyBalance(),points:getPlayerResources().ptRespo,order:s.order,reason}
}
let pending:(ReturnType<typeof previewExtra>&{token:number})|null=null
export function prepareExtra(action:'accept'|'start',index:number,context:ExtraContext){pending={...previewExtra(action,index,context),token:++sequence};return structuredClone(pending)}
export function cancelExtra(token:number){if(pending?.token===token)pending=null}
export function confirmExtra(token:number,context:ExtraContext){
 if(committing||!pending||pending.token!==token)return {ok:false as const,reason:'Cette commande a déjà été confirmée ou remplacée.'}
 const q=pending;pending=null;const p=previewExtra(q.action,q.index,context)
 if(p.reason)return {ok:false as const,reason:p.reason}
 if(p.now!==q.now||p.energyBefore!==q.energyBefore||p.balance!==q.balance||p.points!==q.points||JSON.stringify(p.order)!==JSON.stringify(q.order))return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
 committing=true
 try{if(p.action==='accept')order={version:1,day:p.day,index:p.index,started:false,done:false};else order!.started=true;save();listeners.forEach(fn=>fn());return {ok:true as const,...p}}finally{committing=false}
}
export function completeExtra(batch:string,index:number,_path:readonly number[],context:ExtraContext){
 if(committing)return {ok:false as const,reason:'Le règlement est déjà en cours.'}
 const reason=contextReason(context)||extraWorkReason(context.zone,batch,index)
 if(reason)return {ok:false as const,reason}
 if(!order?.started)return {ok:false as const,reason:'Confirmez le démarrage de votre commande.'}
 const money=rules.moneyGain
 committing=true
 try{
  order.done=true;save() // Verrouiller avant les notifications empêche un paiement réentrant.
  spendEnergy(rules.energyCost);addMoney(money);changeRespoPoints(rules.respoGain);advanceGameTime(rules.minutes)
  listeners.forEach(fn=>fn())
  return {ok:true as const,money,respo:rules.respoGain,energy:rules.energyCost,minutes:rules.minutes,title:rules.titles[index]!}
 }finally{committing=false}
}
