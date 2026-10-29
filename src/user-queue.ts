import {createDossierPuzzle,scoreDossierPairs,dossierPayout} from './dossier-puzzle.ts'
import { isGuidedOutingActive } from './guided-outing-state.ts'
/* Accueil au ministère : file indépendante des piles de dossiers, une seule récompense par demande. */
import rules from './data/user-queue.json' with {type:'json'}
import {getGameTime,getGameTimeAt,advanceGameTime} from './game-clock.ts'
import {projectEnergy,getPlayerResources,spendEnergy,changeRespoPoints} from './player-resources.ts'
import {getMoneyBalance,addMoney} from './currency.ts'
export const userQueueRules=rules
const key='mboa-user-queue-v1'
let ledger:{start:number;done:number[]}={start:-1,done:[]},sequence=0,committing=false
try{
  const saved=JSON.parse(localStorage.getItem(key)??'null')
  if(saved&&Number.isSafeInteger(saved.start)&&saved.start>=0&&Math.floor(saved.start/1440)%7<5&&rules.windows.some(([start])=>saved.start%1440===start)&&Array.isArray(saved.done)&&saved.done.every((i:unknown)=>Number.isInteger(i)&&Number(i)>=0&&Number(i)<rules.titles.length)&&new Set(saved.done).size===saved.done.length)ledger=saved
}catch{/* Un registre absent/corrompu n’empêche pas l’accueil. */}
export function getUserQueue(total=getGameTime().totalMinutes){
  const day=Math.floor(total/1440),minute=total%1440
  const window=day%7<5?rules.windows.find(([start,end])=>minute>=start!&&minute<end!):undefined
  const start=window?day*1440+window[0]!:-1,end=window?day*1440+window[1]!:-1
  const done=start>=0&&ledger.start===start?[...ledger.done]:[]
  let next=-1
  for(let d=day;d<=day+7&&next<0;d++)if(d%7<5)for(const [opening] of rules.windows)if(d*1440+opening!>total){next=d*1440+opening!;break}
  return {open:!!window,start,end,done,remaining:window?rules.titles.length-done.length:0,next:getGameTimeAt(next),reason:!window?'L’accueil est fermé.':done.length===rules.titles.length?'Toutes les demandes de cette file sont traitées.':''}
}
export function previewUserRequest(index:number){
  if(!Number.isInteger(index)||index<0||index>=rules.titles.length)throw new RangeError('Demande inconnue.')
  const queue=getUserQueue(),from=getGameTime(),to=getGameTimeAt(from.totalMinutes+rules.minutes),energyBefore=getPlayerResources().energy
  const reason=queue.reason||(queue.done.includes(index)?'Cette demande est déjà traitée.':'')||(to.totalMinutes>queue.end?'Le traitement se terminerait après la fermeture.':'')||(energyBefore<rules.energyCost?'Énergie insuffisante.':'')||(getMoneyBalance()>Number.MAX_SAFE_INTEGER-rules.moneyGain||getPlayerResources().ptRespo>Number.MAX_SAFE_INTEGER-rules.respoGain?'Le total des gains dépasse la limite autorisée.':'')
  return {index,title:rules.titles[index]!,queue,from,to,energyBefore,energyAfter:projectEnergy(0,to.totalMinutes,from.totalMinutes,energyBefore,rules.energyCost,'awake',getPlayerResources().ptRespo+rules.respoGain).energyAfter,reason}
}
export type UserRequestPreview=ReturnType<typeof previewUserRequest>
let pending:(UserRequestPreview&{id:number})|null=null
export function prepareUserRequest(index:number){pending={...previewUserRequest(index),id:++sequence};return structuredClone(pending)}
export function cancelUserRequest(id:number){if(pending?.id===id)pending=null}
export function confirmUserRequest(id:number,context:{zone:string;travelling:boolean;allowed:boolean},path:readonly number[]=[]){
 if(isGuidedOutingActive())return {ok:false as const,reason:'Terminez votre sortie accompagnée.'}
  if(committing||!pending||pending.id!==id)return {ok:false as const,reason:'Cette demande a déjà été confirmée ou remplacée.'}
  const quote=pending;pending=null
  if(context.zone!=='ministry'||context.travelling||!context.allowed)return {ok:false as const,reason:'Vous devez être au ministère, hors trajet et autre activité.'}
  const current=previewUserRequest(quote.index)
  if(current.reason)return {ok:false as const,reason:current.reason}
  if(current.from.totalMinutes!==quote.from.totalMinutes||current.queue.start!==quote.queue.start||current.energyBefore!==quote.energyBefore)return {ok:false as const,reason:'La situation a changé. Vérifiez le nouvel aperçu.'}
  const board=createDossierPuzzle(`queue:${current.queue.start}/${current.index}`,current.index),pairs=scoreDossierPairs(board,path)
  if(!pairs)return {ok:false as const,reason:'Reliez au moins une paire d’icônes identiques.'}
  const money=dossierPayout(board,path,rules.moneyGain)
  committing=true
  try{
    ledger={start:current.queue.start,done:[...current.queue.done,current.index]}
    // Verrouiller avant les notifications d’énergie/argent empêche les appels réentrants.
    try{localStorage.setItem(key,JSON.stringify(ledger))}catch{/* File conservée pendant la session. */}
    spendEnergy(rules.energyCost);addMoney(money);changeRespoPoints(rules.respoGain);advanceGameTime(rules.minutes)
    return {ok:true as const,...current,money,respo:rules.respoGain,energy:rules.energyCost,minutes:rules.minutes,satisfaction:pairs*25}
  }finally{committing=false}
}

// Le puzzle réutilise uniquement le registre de la file ; aucun lien avec les piles de dossiers.
export function getQueuePuzzleBatch(){
 const q=getUserQueue(),canFinish=q.open&&getGameTime().totalMinutes+rules.minutes<=q.end
 return {id:`queue:${q.start}`,open:q.open,canFinish,nextRefill:q.end>=0?q.end:q.next.totalMinutes,remaining:q.remaining,reason:q.reason||(!canFinish?'Il faut 45 minutes avant la fermeture.':''),dossiers:rules.titles.map((title,index)=>({title,index,done:q.done.includes(index)}))}
}
export function queuePuzzleReason(zone:string,batch?:string,index?:number){
 if(zone!=='ministry')return 'Rejoignez le ministère.'
 if(batch!==undefined&&batch!==getQueuePuzzleBatch().id)return 'Cette file a été renouvelée.'
 return index===undefined?getQueuePuzzleBatch().reason:previewUserRequest(index).reason
}
