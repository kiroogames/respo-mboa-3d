/* Traitement classique ; chaque profil avancé fournit ses propres coûts et conditions. */
import {mountDossierWork} from './dossier-work-ui'
import {dossierRules} from './dossier-work'
import {advancedRules as rules,advancedDraftKey,getAdvancedBatch,advancedWorkReason,completeAdvancedDossier} from './advanced-dossiers'
import {projectEnergy,getPlayerResources} from './player-resources'
import {getRespoProgress} from './respo-level'
import {getGameTime,getGameTimeAt} from './game-clock'
export function mountAdvancedDossiers(options:{base:string;currentZone:()=>string;travelling:()=>boolean;back:()=>void}){
 const allowed=()=>document.documentElement.dataset.ready==='true'&&!options.travelling()&&![...document.querySelectorAll('dialog[open]')].some(d=>!d.classList.contains('advanced-puzzle-dialog'))&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden&&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)
 const ui=mountDossierWork({...options,work:{rules:{...dossierRules,...rules,...rules.dossiers[0]!,batchSize:rules.dossiers.length,titles:rules.dossiers.map(d=>d.title)},getBatch:getAdvancedBatch,reason:advancedWorkReason,complete:(batch,index,path)=>completeAdvancedDossier(batch,index,path,{zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()}),draftKey:advancedDraftKey,difficulty:index=>rules.dossiers[index]!.difficulty,profile:index=>rules.dossiers[index]!,cardInfo:index=>{const d=rules.dossiers[index]!,r=getPlayerResources(),end=getGameTimeAt(getGameTime().totalMinutes+d.minutes);return `Niv. ${d.level} · ${d.energyCost} énergie (${r.energy} → ${projectEnergy(0,end.totalMinutes,undefined,r.energy,d.energyCost,'awake',r.ptRespo+d.respoGain).energyAfter}) · ${d.minutes} min · fin ${end.day} ${end.time} · +${d.moneyGain} Nkap · +${d.respoGain} Respo`},presentation:{id:'advanced-dossier-heading',eyebrow:'MINISTÈRE · DOSSIERS AVANCÉS',intro:'Votre service au ministère : notes à la direction, rapports des services et dossiers pour signature.',listTitle:'Votre pile avancée'}}})
 return {open(){if(!allowed()||getRespoProgress(getPlayerResources().ptRespo).level<rules.visibleLevel)return;ui.open()},snapshot:()=>({...ui.snapshot(),schedule:getAdvancedBatch()})}
}
