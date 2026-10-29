/* Effet daté indépendant des ressources : aucun temps réel et aucun cumul de capacité. */
import {getGameTime,onGameTimeChange} from './game-clock.ts'
const key='mboa-sport-energy-v1'
export const sportRules={bonus:10,minutes:360}
let effect:{start:number;end:number}|null=null
try{const v=JSON.parse(localStorage.getItem(key)??'null');if(v?.version===1&&Number.isSafeInteger(v.start)&&v.start>=0&&v.start<=getGameTime().totalMinutes&&v.end===v.start+sportRules.minutes&&Number.isSafeInteger(v.end))effect={start:v.start,end:v.end}}catch{/* Pas d’effet rétroactif. */}
const listeners=new Set<(kind:'grant'|'expire')=>void>()
export function onSportEffectChange(fn:(kind:'grant'|'expire')=>void){listeners.add(fn);return ()=>listeners.delete(fn)}
export function getSportEffect(total=getGameTime().totalMinutes){return effect&&total>=effect.start&&total<effect.end?{...effect,bonus:sportRules.bonus,name:'Forme sportive'}:null}
function save(){try{localStorage.setItem(key,JSON.stringify({version:1,...effect}))}catch{/* Effet en mémoire. */}}
export function grantSportEffect(){const start=getGameTime().totalMinutes;if(!Number.isSafeInteger(start+sportRules.minutes))return;effect={start,end:start+sportRules.minutes};save();listeners.forEach(fn=>fn('grant'))}
onGameTimeChange(()=>{if(effect&&getGameTime().totalMinutes>=effect.end){effect=null;save();listeners.forEach(fn=>fn('expire'))}})
