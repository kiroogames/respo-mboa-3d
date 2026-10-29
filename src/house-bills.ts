import { isGuidedOutingActive } from './guided-outing-state.ts'
/* Factures fixes : l’heure de jeu crée les échéances, seul le joueur débite le portefeuille. */
import rules from './data/house-bills.json' with {type:'json'}
import {getGameTime,getGameTimeAt} from './game-clock.ts'
import {getMoneyBalance,spendMoney} from './currency.ts'
export const houseBillItems=rules.items
export const houseBillAmount=rules.items.reduce((sum,item)=>sum+item.money,0)
const key='mboa-house-bills-v1',weekMinutes=10080,issueOffset=rules.issueDay*1440+rules.issueMinute
function nextFridayAfter(total:number){const current=Math.floor(total/weekMinutes)*weekMinutes+issueOffset,candidate=current>total?current:current+weekMinutes;return Number.isSafeInteger(candidate)?candidate:null}
const now=getGameTime().totalMinutes
let firstIssue:number|null=nextFridayAfter(now),paid=0
function issuedAt(total:number){return firstIssue===null||total<firstIssue?0:Math.floor((total-firstIssue)/weekMinutes)+1}
function save(){try{localStorage.setItem(key,JSON.stringify({firstIssue,paid}))}catch{/* La session reste utilisable en mode privé. */}}
try{
 const saved=JSON.parse(localStorage.getItem(key)??'null')
 if(saved&&Number.isSafeInteger(saved.firstIssue)&&saved.firstIssue>=0&&saved.firstIssue%weekMinutes===issueOffset&&Number.isSafeInteger(saved.paid)&&saved.paid>=0){
  const issued=now<saved.firstIssue?0:Math.floor((now-saved.firstIssue)/weekMinutes)+1
  if(saved.paid<=issued){firstIssue=saved.firstIssue;paid=saved.paid}
 }
}catch{/* Pas de dette rétroactive en cas de sauvegarde absente ou invalide. */}
// Enregistrer dès l’activation, même si le joueur n’ouvre pas le menu avant vendredi.
save()
export function getHouseBill(index:number){
 const total=getGameTime().totalMinutes,issued=issuedAt(total)
 if(!Number.isSafeInteger(index)||index<0||index>=issued||firstIssue===null)return null
 const issue=firstIssue+index*weekMinutes,deadline=issue+rules.recommendedDeadlineMinute-rules.issueMinute
 return {index,amount:houseBillAmount,issue:getGameTimeAt(issue),deadline:Number.isSafeInteger(deadline)?getGameTimeAt(deadline):null,forWeek:getGameTimeAt(issue).week+1,paid:index<paid,overdue:index>=paid&&total>=deadline}
}
export function getHouseBilling(){
 const total=getGameTime().totalMinutes,issued=issuedAt(total),unpaid=issued-paid,next=firstIssue===null?null:firstIssue+issued*weekMinutes
 return {amount:houseBillAmount,issued,paid,unpaid,totalDue:unpaid*houseBillAmount,balance:getMoneyBalance(),oldest:unpaid?getHouseBill(paid):null,nextIssue:next!==null&&Number.isSafeInteger(next)?getGameTimeAt(next):null}
}
const listeners=new Set<()=>void>()
export function onHouseBillChange(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener)}
let sequence=0,committing=false,pending:{token:number;index:number;time:number;balance:number}|null=null
export function prepareHouseBillPayment(){
 const state=getHouseBilling()
 pending=state.oldest?{token:++sequence,index:state.oldest.index,time:getGameTime().totalMinutes,balance:state.balance}:null
 return pending?{...pending,amount:houseBillAmount,bill:structuredClone(state.oldest)}:null
}
export function cancelHouseBillPayment(token:number){if(pending?.token===token)pending=null}
export function confirmHouseBillPayment(token:number,allowed=false){
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
 if(committing||!pending||pending.token!==token)return {ok:false as const,reason:'Ce paiement a déjà été confirmé ou remplacé.'}
 const quote=pending;pending=null
 if(!allowed)return {ok:false as const,reason:'Terminez votre autre activité avant de payer.'}
 const state=getHouseBilling()
 if(!state.oldest||state.oldest.index!==quote.index||getGameTime().totalMinutes!==quote.time||state.balance!==quote.balance)return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
 if(state.balance<houseBillAmount)return {ok:false as const,reason:'Argent insuffisant pour régler cette facture.'}
 committing=true
 try{
  paid++;save() // Verrouiller avant les notifications du portefeuille.
  spendMoney(houseBillAmount);listeners.forEach(listener=>listener())
  return {ok:true as const,bill:state.oldest,amount:houseBillAmount,balance:getMoneyBalance()}
 }finally{committing=false}
}
