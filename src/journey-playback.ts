/* Déroulement visuel uniquement : aucune dépense et aucune avance du calendrier.
 * Les minutes du devis modulent légèrement une animation plafonnée, jamais une attente réelle.
 */
import type {TravelMode,TravelPoint} from './travel.ts'

export type JourneyPhase='exit'|'board'|'travel'|'alight'|'enter'|'done'
export function journeyTiming(mode:TravelMode,minutes:number,reducedMotion=false){
 const riding={walk:3.2,taxi:2.5,yonga:2.1,moto:1.8}[mode]
 const travel=riding+Math.min(1.4,Math.log1p(Math.max(0,minutes)/30)*.65)
 const factor=reducedMotion?.12:1
 const steps:{phase:JourneyPhase;seconds:number}[]=[
  {phase:'exit',seconds:.65},{phase:'board',seconds:mode==='walk'?0:.4},
  {phase:'travel',seconds:travel},{phase:'alight',seconds:mode==='walk'?0:.3},
  {phase:'enter',seconds:.65},
 ]
 for(const step of steps)step.seconds*=factor
 return {steps,duration:steps.reduce((sum,step)=>sum+step.seconds,0)}
}

export function journeyFrame(timing:ReturnType<typeof journeyTiming>,elapsed:number){
 let start=0
 for(const step of timing.steps){
  if(step.seconds>0&&elapsed<start+step.seconds)return {phase:step.phase,progress:Math.max(0,(elapsed-start)/step.seconds),total:Math.max(0,Math.min(1,elapsed/timing.duration))}
  start+=step.seconds
 }
 return {phase:'done' as JourneyPhase,progress:1,total:1}
}

// Échantillonnage en distance : la vitesse ne dépend pas de la densité des nœuds routiers.
export function sampleJourneyPath(points:readonly TravelPoint[],progress:number){
 if(!points.length)throw new Error('Trajet visuel vide.')
 const lengths=points.map((p,i)=>i?Math.hypot(p[0]-points[i-1]![0],p[2]-points[i-1]![2]):0)
 let remaining=lengths.reduce((sum,n)=>sum+n,0)*Math.max(0,Math.min(1,progress))
 for(let i=1;i<points.length;i++){
  const length=lengths[i]!
  if(remaining<=length&&length>0){const a=points[i-1]!,b=points[i]!,t=remaining/length;return {point:a.map((n,j)=>n+(b[j]!-n)*t) as TravelPoint,yaw:Math.atan2(b[0]-a[0],b[2]-a[2])}}
  remaining-=length
 }
 const end=points.at(-1)!,before=points.at(-2)??end
 return {point:[...end] as TravelPoint,yaw:Math.atan2(end[0]-before[0],end[2]-before[2])}
}
