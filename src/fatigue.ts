/* Dette d’éveil : les minutes de jeu comptent, seules les minutes de sommeil la réduisent. */
import {getGameTime,onGameTimeChange} from './game-clock.ts'
import type {TimeKind} from './game-clock.ts'
const key='mboa-fatigue-v1'
let anchor=getGameTime().totalMinutes,awake=0
try{const v=JSON.parse(localStorage.getItem(key)??'null');if(v?.version===1&&Number.isSafeInteger(v.anchor)&&v.anchor>=0&&v.anchor<=anchor&&Number.isSafeInteger(v.awake)&&v.awake>=0){awake=Math.min(Number.MAX_SAFE_INTEGER,v.awake+anchor-v.anchor)}}catch{/* Activation sans fatigue rétroactive. */}
function save(){try{localStorage.setItem(key,JSON.stringify({version:1,anchor,awake}))}catch{/* Compteur en mémoire. */}}
export function getFatigueAt(total=getGameTime().totalMinutes,kind:TimeKind='awake'){
 const delta=Math.max(0,total-anchor),minutes=kind==='sleep'?Math.max(0,awake-2*delta):Math.min(Number.MAX_SAFE_INTEGER,awake+delta),penalty=minutes>=1800?30:minutes>=1440?20:minutes>=1080?10:0
 return {minutes,penalty,label:penalty===30?'Grande fatigue':penalty===20?'Très fatigué':penalty===10?'Fatigué':'Reposé',sleepNeeded:Math.max(0,Math.ceil((minutes-1079)/2))}
}
const listeners=new Set<(changed:boolean)=>void>()
export function onFatigueChange(fn:(changed:boolean)=>void){listeners.add(fn);return ()=>listeners.delete(fn)}
save()
onGameTimeChange(event=>{const before=getFatigueAt(anchor).penalty;awake=getFatigueAt(event.to,event.kind).minutes;anchor=event.to;save();const changed=getFatigueAt().penalty!==before;listeners.forEach(fn=>fn(changed))})

// Pénalité explicite : une minute de sommeil supplémentaire vaut deux minutes au compteur.
export function addSleepDebt(sleepMinutes:number){
 if(!Number.isSafeInteger(sleepMinutes)||sleepMinutes<0||!Number.isSafeInteger(sleepMinutes*2))throw new RangeError('Dette de sommeil invalide.')
 const before=getFatigueAt().penalty;awake=Math.min(Number.MAX_SAFE_INTEGER,getFatigueAt().minutes+sleepMinutes*2);anchor=getGameTime().totalMinutes;save();listeners.forEach(fn=>fn(getFatigueAt().penalty!==before))
}
