import {getBedSleepQuality} from './home-comfort.ts'
import {restedRules,getRestedEffect,grantRestedEffect} from './rested-energy.ts'
import {getFatigueAt} from './fatigue.ts'
import { isGuidedOutingActive } from './guided-outing-state.ts'
/* Sommeil à domicile : aperçu pur, gains réels et confirmation unique. */
import { getGameTime, getGameTimeAt, advanceGameTime } from './game-clock.ts'
import { getEnergyDetails,getEnergyMaximumAt,projectEnergy,getPlayerResources, restoreEnergy, changeMood, getMoodDetails, previewMoodChange } from './player-resources.ts'

export function previewSleeping(duration: number) {
  if (!Number.isSafeInteger(duration) || duration < 30 || duration > 960 || duration % 30) throw new RangeError('Choisissez de 30 minutes à 16 heures, par pas de 30 minutes.')
  const from = getGameTime(), to = getGameTimeAt(from.totalMinutes + duration), before = getPlayerResources()
  const bed=getBedSleepQuality(),bedBonus=bed.bonusPer30*Math.floor(Math.min(duration,480)/30)
  const restedEligible=duration>=restedRules.minimumSleep&&getFatigueAt(to.totalMinutes,'sleep').minutes===0
  const details=getEnergyDetails(to.totalMinutes,'sleep'),maxEnergyAfter=restedEligible?Math.min(Number.MAX_SAFE_INTEGER,details.total-details.restedBonus+restedRules.bonus):details.total
  const projection=restedEligible?{maxEnergyAfter,energyAfter:maxEnergyAfter,energyGain:Math.max(0,maxEnergyAfter-Math.min(before.energy,maxEnergyAfter)),energyLoss:Math.max(0,before.energy-maxEnergyAfter)}:projectEnergy(Math.min(Number.MAX_SAFE_INTEGER,Math.floor(maxEnergyAfter * Math.min(duration,480) / 480)+bedBonus),to.totalMinutes,from.totalMinutes,before.energy,0,'sleep'),energyGain=projection.energyGain
  const restedAfter=restedEligible?{start:to.totalMinutes,end:to.totalMinutes+restedRules.minutes,bonus:restedRules.bonus,name:'Bien reposé'}:getRestedEffect(to.totalMinutes)
  const moodDelta=Math.min(10,Math.floor(10*duration/480)),mood=previewMoodChange(moodDelta),moodGain=mood.delta
  return {bed,bedBonus,restedEligible,restedAfter,fatigueBefore:getFatigueAt(),fatigueAfter:getFatigueAt(to.totalMinutes,'sleep'), duration, from, to, energyBefore:before.energy, maxEnergy:before.maxEnergy, energyGain, energyAfter:projection.energyAfter,maxEnergyAfter:projection.maxEnergyAfter,energyLoss:projection.energyLoss, moodBefore:before.mood, moodGain, moodAfter:mood.moodAfter,moodDelta,moodBaseBefore:mood.baseBefore,moodBonus:mood.bonus }
}
export type SleepingPreview = ReturnType<typeof previewSleeping>
let sequence=0, pending:(SleepingPreview & {id:number})|null=null, committing=false
export function prepareSleeping(duration:number){
  pending={...previewSleeping(duration),id:++sequence}
  return {...pending,from:{...pending.from},to:{...pending.to}}
}
export function cancelSleeping(id:number){if(pending?.id===id)pending=null}
export function confirmSleeping(id:number, context:{zone:string;travelling:boolean;allowed:boolean}){
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
  if(committing||!pending||pending.id!==id)return {ok:false as const,reason:'Ce sommeil a déjà été confirmé ou remplacé.'}
  const quote=pending;pending=null
  if(context.zone!=='home'||context.travelling||!context.allowed)return {ok:false as const,reason:'Vous devez être à la maison, hors trajet et autre activité.'}
  const state=getPlayerResources()
  if(getBedSleepQuality().id!==quote.bed.id||getGameTime().totalMinutes!==quote.from.totalMinutes||state.energy!==quote.energyBefore||state.maxEnergy!==quote.maxEnergy||getMoodDetails().base!==quote.moodBaseBefore||getMoodDetails().bonus!==quote.moodBonus)return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
  committing=true
  try{
    advanceGameTime(quote.duration,'sleep');if(quote.restedEligible)grantRestedEffect();restoreEnergy(quote.duration>=480?getEnergyMaximumAt():quote.energyGain);changeMood(quote.moodDelta)
    return {ok:true as const,...quote}
  }finally{committing=false}
}
