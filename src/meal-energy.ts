/* Effet daté indépendant des ressources : aucun temps réel et aucun cumul de capacité. */
import {getGameTime,onGameTimeChange} from './game-clock.ts'
const key='mboa-meal-energy-v1'
export const mealEnergyRules={bonus:5,minutes:180}
let effect:{start:number;end:number}|null=null
try{const v=JSON.parse(localStorage.getItem(key)??'null');if(v?.version===1&&Number.isSafeInteger(v.start)&&v.start>=0&&v.start<=getGameTime().totalMinutes&&v.end===v.start+mealEnergyRules.minutes&&Number.isSafeInteger(v.end))effect={start:v.start,end:v.end}}catch{/* Pas d’effet rétroactif. */}
const listeners=new Set<(kind:'grant'|'expire')=>void>()
export function onMealEnergyEffectChange(fn:(kind:'grant'|'expire')=>void){listeners.add(fn);return ()=>listeners.delete(fn)}
export function getMealEnergyEffect(total=getGameTime().totalMinutes){return effect&&total>=effect.start&&total<effect.end?{...effect,bonus:mealEnergyRules.bonus,name:'Repas maison'}:null}
function save(){try{localStorage.setItem(key,JSON.stringify({version:1,...effect}))}catch{/* Effet en mémoire. */}}
export function grantMealEnergyEffect(){const start=getGameTime().totalMinutes;if(!Number.isSafeInteger(start+mealEnergyRules.minutes))return;effect={start,end:start+mealEnergyRules.minutes};save();listeners.forEach(fn=>fn('grant'))}
onGameTimeChange(()=>{if(effect&&getGameTime().totalMinutes>=effect.end){effect=null;save();listeners.forEach(fn=>fn('expire'))}})
