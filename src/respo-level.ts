/* Courbe validée : coût du niveau n vers n+1 = 95 × (n+1), points toujours cumulés. */
const threshold=(level:number)=>95n*BigInt(level-1)*BigInt(level+2)/2n
export function getRespoProgress(points:number){
  if(!Number.isSafeInteger(points)||points<0)throw new RangeError('Total Respo invalide.')
  const total=BigInt(points)
  // Recherche logarithmique et arithmétique exacte, même pour un ancien total très élevé.
  let low=1,high=2
  while(threshold(high)<=total)high*=2
  while(low+1<high){const mid=Math.floor((low+high)/2);if(threshold(mid)<=total)low=mid;else high=mid}
  const start=Number(threshold(low)),next=threshold(low+1)
  const nextThreshold=next<=BigInt(Number.MAX_SAFE_INTEGER)?Number(next):null
  return {level:low,points,start,nextThreshold,earned:points-start,needed:nextThreshold===null?0:nextThreshold-start,remaining:nextThreshold===null?0:nextThreshold-points}
}

// Premier palier de capacité validé : +5 aux niveaux2–5, puis bonus permanent plafonné à20.
export function levelEnergyBonus(level:number){
 if(!Number.isSafeInteger(level)||level<1)throw new RangeError('Niveau invalide.')
 return 5*Math.min(4,level-1)
}
