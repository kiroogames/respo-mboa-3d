/* Les demandes de la file sont les seules activités utilisant le puzzle de liaison. */
import {mountCitizenQueuePuzzle} from './citizen-queue-puzzle-ui'
import {dossierRules} from './dossier-work'
import {userQueueRules as rules,getUserQueue,getQueuePuzzleBatch,queuePuzzleReason,prepareUserRequest,confirmUserRequest} from './user-queue'
export function mountUserQueue(options:{base:string;currentZone:()=>string;travelling:()=>boolean;back:()=>void}){
 const allowed=()=>options.currentZone()==='ministry'&&!options.travelling()&&![...document.querySelectorAll('dialog[open]')].some(d=>!d.classList.contains('queue-puzzle-dialog'))&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden
 const ui=mountCitizenQueuePuzzle({...options,work:{rules:{...dossierRules,...rules,batchSize:rules.titles.length},getBatch:getQueuePuzzleBatch,reason:queuePuzzleReason,draftKey:'mboa-user-queue-draft-v1',presentation:{id:'queue-puzzle-heading',eyebrow:'MINISTÈRE · FILE D’ATTENTE',intro:'Écoutez la demande et tracez son parcours jusqu’à la signature.',listTitle:'Les usagers attendent'},complete:(batch,index,path,zone)=>{
  const why=queuePuzzleReason(zone,batch,index);if(why)return {ok:false as const,reason:why}
  const q=prepareUserRequest(index),result=confirmUserRequest(q.id,{zone,travelling:options.travelling(),allowed:allowed()},path);return result.ok?{ok:true as const,money:result.money,respo:result.respo,energy:result.energy,minutes:result.minutes,title:result.title,mood:result.mood,influence:result.influence}:result
 }}})
 return {open(){if(allowed())ui.open()},snapshot:()=>({...ui.snapshot(),queue:getUserQueue()})}
}
