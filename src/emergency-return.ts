/* Retour de dernier recours : aucune recharge ni avance d’argent ; la dette est sauvegardée par fatigue. */
import {createTravelRoute,quoteTravel,travelModes} from './travel.ts'
import type {TravelPoint} from './travel.ts'
import {getTrafficConditions} from './traffic-conditions.ts'
import type {TrafficConditions} from './traffic-conditions.ts'
import {getPlayerResources} from './player-resources.ts'
import {getMoneyBalance} from './currency.ts'
import {getGameTime,advanceGameTime} from './game-clock.ts'
import {getFatigueAt,addSleepDebt} from './fatigue.ts'
import {isGuidedOutingActive} from './guided-outing-state.ts'
export const emergencySleepMinutes=120
export function previewEmergencyReturn(origin:string,from:TravelPoint,home:TravelPoint,traffic:TrafficConditions=getTrafficConditions()){
 const route=createTravelRoute(from,home),r=getPlayerResources(),balance=getMoneyBalance(),now=getGameTime().totalMinutes
 const paidAvailable=travelModes.some(mode=>{const q=quoteTravel(route,mode.id,traffic);return mode.id!=='walk'&&q.energy<=r.energy&&q.money<=balance})
 const reason=origin==='home'?'Vous êtes déjà à la maison.':r.energy!==0?'Le retour de secours est réservé à une énergie épuisée.':paidAvailable?'Un transport payant vers la maison reste accessible.':''
 const quote=quoteTravel(route,'yonga',traffic)
 return {origin,route,minutes:quote.minutes,now,balance,energy:r.energy,reason,sleepMinutes:emergencySleepMinutes,awakeAfter:Math.min(Number.MAX_SAFE_INTEGER,getFatigueAt().minutes+quote.minutes+emergencySleepMinutes*2)}
}
let sequence=0,pending:ReturnType<typeof previewEmergencyReturn>&{token:number}|null=null,committing=false
export function prepareEmergencyReturn(origin:string,from:TravelPoint,home:TravelPoint,traffic?:TrafficConditions){pending={...previewEmergencyReturn(origin,from,home,traffic),token:++sequence};return structuredClone(pending)}
export function confirmEmergencyReturn(token:number,context:{origin:string;allowed:boolean}){
 if(committing||!pending||pending.token!==token)return {ok:false as const,reason:'Ce retour a déjà été confirmé ou remplacé.'}
 const q=pending;pending=null
 if(!context.allowed||isGuidedOutingActive()||context.origin!==q.origin)return {ok:false as const,reason:'Terminez votre autre activité.'}
 if(q.reason||getGameTime().totalMinutes!==q.now||getMoneyBalance()!==q.balance||getPlayerResources().energy!==0)return {ok:false as const,reason:q.reason||'La situation a changé. Vérifiez le nouveau devis.'}
 committing=true
 try{advanceGameTime(q.minutes);addSleepDebt(q.sleepMinutes);return {ok:true as const,...q}}finally{committing=false}
}
