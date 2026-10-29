/* Effet daté indépendant des ressources : aucun temps réel et aucun cumul de capacité. */
import {getGameTime,onGameTimeChange} from './game-clock.ts'
const key='mboa-rested-energy-v1'
export const restedRules={bonus:10,minutes:360,minimumSleep:600}
let effect:{start:number;end:number}|null=null
try{const v=JSON.parse(localStorage.getItem(key)??'null');if(v?.version===1&&Number.isSafeInteger(v.start)&&v.start>=0&&v.start<=getGameTime().totalMinutes&&v.end===v.start+restedRules.minutes&&Number.isSafeInteger(v.end))effect={start:v.start,end:v.end}}catch{/* Pas d’effet rétroactif. */}
const listeners=new Set<(kind:'grant'|'expire')=>void>()
export function onRestedEffectChange(fn:(kind:'grant'|'expire')=>void){listeners.add(fn);return ()=>listeners.delete(fn)}
export function getRestedEffect(total=getGameTime().totalMinutes){return effect&&total>=effect.start&&total<effect.end?{...effect,bonus:restedRules.bonus,name:'Bien reposé'}:null}
function save(){try{localStorage.setItem(key,JSON.stringify({version:1,...effect}))}catch{/* Effet en mémoire. */}}
export function grantRestedEffect(){const start=getGameTime().totalMinutes;if(!Number.isSafeInteger(start+restedRules.minutes))return;effect={start,end:start+restedRules.minutes};save();listeners.forEach(fn=>fn('grant'))}
onGameTimeChange(()=>{if(effect&&getGameTime().totalMinutes>=effect.end){effect=null;save();listeners.forEach(fn=>fn('expire'))}})
