/* Piles avancées indépendantes : coût et accès propres à chaque dossier, règlement unique. */
import rules from './data/advanced-dossiers.json' with {type:'json'}
import {getGameTime,advanceGameTime} from './game-clock.ts'
import {getPlayerResources,spendEnergy,changeRespoPoints} from './player-resources.ts'
import {getMoneyBalance,addMoney} from './currency.ts'
import {getRespoProgress} from './respo-level.ts'
import {isGuidedOutingActive} from './guided-outing-state.ts'
export const advancedRules=rules,advancedDraftKey='mboa-advanced-draft-v1'
const key='mboa-advanced-dossiers-v1'
let ledger:{batch:string;done:number[]}={batch:'',done:[]},committing=false
try{
 const v=JSON.parse(localStorage.getItem(key)??'null'),match=typeof v?.batch==='string'?/^advanced:(\d+):(\d+)$/.exec(v.batch):null
 if(v?.version===1&&match&&Number.isSafeInteger(+match[1]!)&&+match[1]!%7<5&&rules.refills.includes(+match[2]!)&&+match[1]!*1440+(+match[2]!)<=getGameTime().totalMinutes&&Array.isArray(v.done)&&v.done.every((i:unknown)=>Number.isInteger(i)&&Number(i)>=0&&Number(i)<rules.dossiers.length)&&new Set(v.done).size===v.done.length)ledger={batch:v.batch,done:[...v.done]}
}catch{/* Anciennes parties et registres corrompus : aucun gain ni dossier réglé rétroactivement. */}
const listeners=new Set<()=>void>()
export function onAdvancedChange(fn:()=>void){listeners.add(fn);return ()=>listeners.delete(fn)}
export function getAdvancedBatch(){
 const now=getGameTime().totalMinutes,day=Math.floor(now/1440),minute=now%1440,open=day%7<5&&minute>=rules.opening&&minute<rules.closing,start=rules.refills.findLast(t=>minute>=t)??rules.opening,id=`advanced:${day}:${start}`,done=ledger.batch===id?[...ledger.done]:[]
 let next=-1
 for(let d=day;d<=day+7&&next<0;d++)if(d%7<5)for(const t of rules.refills)if(d*1440+t>now){next=d*1440+t;break}
 const level=getRespoProgress(getPlayerResources().ptRespo).level,reason=level<rules.visibleLevel?'Dossiers avancés visibles à partir du niveau 2.':!open?'Le service avancé ouvre du lundi au vendredi, de 7h à 23h.':''
 return {id,open,canFinish:!reason&&rules.dossiers.some((d,i)=>!done.includes(i)&&level>=d.level&&minute+d.minutes<=rules.closing),nextRefill:next,remaining:open?rules.dossiers.filter((d,i)=>!done.includes(i)&&level>=d.level).length:0,reason,dossiers:rules.dossiers.map((d,index)=>({index,title:d.title,done:done.includes(index)}))}
}
export function advancedWorkReason(zone:string,batchId?:string,index?:number){
 if(zone!==rules.zone)return 'Rejoignez le ministère.'
 const batch=getAdvancedBatch();if(batch.reason)return batch.reason
 if(batchId!==undefined&&batchId!==batch.id)return 'Cette pile a été renouvelée. Choisissez un dossier de la nouvelle pile.'
 if(index===undefined)return ''
 const d=rules.dossiers[index];if(!d||!Number.isInteger(index))return 'Dossier introuvable.'
 if(getRespoProgress(getPlayerResources().ptRespo).level<d.level)return `Niveau ${d.level} requis.`
 if(batch.dossiers[index]!.done)return 'Ce dossier a déjà été rémunéré dans cette pile.'
 const end=getGameTime().totalMinutes+d.minutes
 if(!Number.isSafeInteger(end)||end%1440>rules.closing||Math.floor(end/1440)!==Math.floor(getGameTime().totalMinutes/1440))return 'Ce dossier se terminerait après 23h.'
 if(getPlayerResources().energy<d.energyCost)return `Énergie insuffisante : ${d.energyCost} nécessaires.`
 if(!Number.isSafeInteger(getMoneyBalance()+d.moneyGain)||!Number.isSafeInteger(getPlayerResources().ptRespo+d.respoGain))return 'Les compteurs ne permettent pas de recevoir cette récompense.'
 return ''
}
export function completeAdvancedDossier(batchId:string,index:number,_path:readonly number[],context:{zone:string;travelling:boolean;allowed:boolean}){
 if(committing)return {ok:false as const,reason:'Le traitement est déjà en cours.'}
 if(isGuidedOutingActive()||context.travelling||!context.allowed)return {ok:false as const,reason:'Terminez votre trajet ou votre autre activité.'}
 const reason=advancedWorkReason(context.zone,batchId,index);if(reason)return {ok:false as const,reason}
 const d=rules.dossiers[index]!
 const money=d.moneyGain
 committing=true
 try{
  ledger={batch:batchId,done:[...getAdvancedBatch().dossiers.filter(d=>d.done).map(d=>d.index),index]}
  try{localStorage.setItem(key,JSON.stringify({version:1,...ledger}))}catch{/* Verrou conservé dans la session. */}
  spendEnergy(d.energyCost);addMoney(money);changeRespoPoints(d.respoGain);advanceGameTime(d.minutes)
  listeners.forEach(fn=>fn());return {ok:true as const,title:d.title,money,respo:d.respoGain,energy:d.energyCost,minutes:d.minutes}
 }finally{committing=false}
}
