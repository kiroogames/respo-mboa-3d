/* Bilan dérivé : rien n’est prélevé, réservé ni sauvegardé par cet indicateur. */
import { loc } from './i18n.ts'
import {getHouseBilling} from './house-bills.ts'
export function classifyHouseBudget(balance:number,reference:number){
 if(!Number.isInteger(balance)||balance<0||!Number.isInteger(reference)||reference<0)throw new RangeError(loc('Montants de budget invalides.'))
 const status=balance>=reference?'covered':BigInt(balance)*4n>=BigInt(reference)*3n?'tight':'insufficient'
 return {status,label:status==='covered'?loc('Budget couvert'):status==='tight'?loc('Budget serré'):loc('Budget insuffisant'),missing:Math.max(0,reference-balance),available:Math.max(0,balance-reference)}
}
export function getHouseBudget(){
 const s=getHouseBilling(),reference=s.unpaid?s.totalDue:s.amount
 return {...classifyHouseBudget(s.balance,reference),balance:s.balance,reference,source:s.unpaid?'unpaid':'upcoming',unpaid:s.unpaid,date:s.oldest?.deadline??s.nextIssue}
}
