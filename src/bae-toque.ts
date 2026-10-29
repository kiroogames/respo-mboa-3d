import { isGuidedOutingActive } from './guided-outing-state.ts'
/* Cotisation définitive au Toqué, indépendante des travaux et de la considération de Bae. */
import rules from './data/bae-toque.json' with {type:'json'}
import {getGameTime} from './game-clock.ts'
import {getMoneyBalance,spendMoney} from './currency.ts'
import {getNPCZone,isNPCAvailable} from './npcs.ts'
export const toqueRules=rules
export type ToqueContext={zone:string;travelling:boolean;allowed:boolean}
const key='mboa-bae-toque-v1'
let contributed=0,sequence=0,committing=false
try{const saved=JSON.parse(localStorage.getItem(key)??'null');if(saved&&Number.isSafeInteger(saved.contributed)&&saved.contributed>=0&&saved.contributed<=rules.target&&saved.contributed%rules.step===0)contributed=saved.contributed}catch{/* Une nouvelle cotisation commence à zéro, sans toucher au portefeuille. */}
export function getToqueState(){return {target:rules.target,contributed,remaining:rules.target-contributed,complete:contributed===rules.target}}
export function toquePresenceReason(context:ToqueContext){return context.travelling?'Terminez votre trajet.':!context.allowed?'Terminez votre autre activité.':context.zone!=='home'||getNPCZone('bae')!=='home'||!isNPCAvailable('bae')?'Bae doit être présente et disponible à la maison.':''}
export function previewToque(amount:number,context:ToqueContext){
 const state=getToqueState(),balance=getMoneyBalance(),time=getGameTime().totalMinutes
 const valid=Number.isSafeInteger(amount)&&amount>=rules.minimum&&amount%rules.step===0
 const reason=toquePresenceReason(context)||(state.complete?'Objectif de cotisation déjà atteint.':'')||(!valid?`Choisissez un montant d’au moins ${rules.minimum} Nkap, par pas de ${rules.step}.`:'')||(amount>state.remaining?'Le montant dépasse le reste à financer.':'')||(amount>balance?'Nkap insuffisants.':'')
 return {...state,amount,balance,time,reason,afterContribution:valid&&amount<=state.remaining?state.contributed+amount:null,afterBalance:valid&&amount<=balance?balance-amount:null}
}
type Quote=ReturnType<typeof previewToque>&{token:number}
let pending:Quote|null=null
export function prepareToque(amount:number,context:ToqueContext){pending={...previewToque(amount,context),token:++sequence};return {...pending}}
export function cancelToque(token:number){if(pending?.token===token)pending=null}
const listeners=new Set<()=>void>()
export function onToqueChange(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener)}
export function confirmToque(token:number,context:ToqueContext){
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
 if(committing||!pending||pending.token!==token)return {ok:false as const,reason:'Ce versement a déjà été confirmé ou remplacé.'}
 const quote=pending;pending=null
 const current=previewToque(quote.amount,context)
 if(current.reason)return {ok:false as const,reason:current.reason}
 if(current.time!==quote.time||current.balance!==quote.balance||current.contributed!==quote.contributed)return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
 committing=true
 try{
  contributed+=current.amount
  // Verrouiller le cumul avant les notifications du portefeuille pour empêcher un débit répété.
  try{localStorage.setItem(key,JSON.stringify({contributed}))}catch{/* Cumul conservé pendant la session. */}
  spendMoney(current.amount);listeners.forEach(listener=>listener())
  return {ok:true as const,amount:current.amount,balance:getMoneyBalance(),...getToqueState()}
 }finally{committing=false}
}
