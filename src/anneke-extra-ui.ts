/* La fiche du contrat confirme l’engagement, puis ouvre le traitement classique de la commande. */
import {extraRules as rules,extraDraftKey,getExtraState,getExtraBatch,extraWorkReason,prepareExtra,cancelExtra,confirmExtra,completeExtra,onExtraChange} from './anneke-extra'
import {mountDossierWork} from './dossier-work-ui'
import {dossierRules} from './dossier-work'
import {getGameTimeAt,onGameTimeChange} from './game-clock'
import {projectEnergy,getPlayerResources,onPlayerResourcesChange} from './player-resources'
import './anneke-extra.css'
export function mountAnnekeExtra(options:{base:string;currentZone:()=>string;travelling:()=>boolean;back:(tab:'people'|'place')=>void}){
 const dialog=document.createElement('dialog');dialog.className='travel-dialog extra-dialog';dialog.setAttribute('aria-labelledby','extra-heading')
 dialog.innerHTML=`<button class="travel-close" data-extra-close aria-label="Fermer">×</button><span class="travel-eyebrow">LES COMMANDES D’ANNEKE</span><h2 id="extra-heading">Taf extra du soir</h2><p>Récupérez une commande en journée. Réalisez-la au ministère de 18h à 23h, du lundi au vendredi.</p><div class="extra-choices" role="group" aria-label="Commandes du jour">${rules.titles.map((title,index)=>`<button data-extra-choice="${index}" aria-pressed="false"><b>${title}</b></button>`).join('')}</div><section class="extra-preview"><h3 data-extra-title></h3><p>Coût à la réussite : <b>25 énergie · 60 min</b></p><strong>+900 Nkap · +8 Respo</strong><p data-extra-deadline></p><p data-extra-energy></p><small>Choix et abandon sans frais. Commande disponible jusqu’à l’échéance. Aucun effet sur Karma, humeur ou considération.</small></section><p data-extra-error role="alert" hidden></p><p data-extra-result role="status" hidden></p><div class="extra-actions"><button data-extra-back>Retour</button><button data-extra-confirm>Confirmer la commande</button></div>`
 document.body.append(dialog)
 let mode:'accept'|'start'='accept',selected=0,pending:ReturnType<typeof prepareExtra>|null=null,committing=false
 const allowed=()=>document.documentElement.dataset.ready==='true'&&options.currentZone()===rules.zone&&!options.travelling()&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog&&!d.classList.contains('extra-puzzle-dialog'))&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden&&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)
 const context=()=>({zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()})
 const work=mountDossierWork({base:options.base,currentZone:options.currentZone,travelling:options.travelling,back:()=>options.back('place'),work:{rules:{...dossierRules,...rules,batchSize:rules.titles.length},getBatch:getExtraBatch,reason:extraWorkReason,complete:(batch,index,path)=>completeExtra(batch,index,path,context()),draftKey:extraDraftKey}})
 const confirm=dialog.querySelector<HTMLButtonElement>('[data-extra-confirm]')!,error=dialog.querySelector<HTMLElement>('[data-extra-error]')!,result=dialog.querySelector<HTMLElement>('[data-extra-result]')!
 const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
 function render(){
  if(pending)cancelExtra(pending.token);pending=null
  const state=getExtraState();if(mode==='start'&&state.order)selected=state.order.index
  dialog.querySelector<HTMLElement>('.extra-choices')!.hidden=mode==='start'
  for(const b of dialog.querySelectorAll<HTMLButtonElement>('[data-extra-choice]')){b.setAttribute('aria-pressed',String(Number(b.dataset.extraChoice)===selected));b.disabled=mode==='accept'&&state.order?.day===state.day}
  const p=prepareExtra(mode,selected,context());pending=p
  text('[data-extra-title]',p.title);const deadline=getGameTimeAt(p.deadline)
  text('[data-extra-deadline]',`Échéance : ${deadline.day} ${deadline.time} · semaine ${deadline.week}. Fin du travail au plus tard à 23h.`)
  text('[data-extra-energy]',mode==='accept'?'La réception est gratuite, sans temps écoulé.':`Énergie à la réussite : ${p.energyBefore} → ${projectEnergy(0,p.now+rules.minutes,p.now,p.energyBefore,rules.energyCost,'awake',getPlayerResources().ptRespo+rules.respoGain).energyAfter}`)
  error.hidden=!p.reason;error.textContent=p.reason;confirm.disabled=!!p.reason||!allowed()||committing
  confirm.textContent=mode==='accept'?'Accepter cette commande':state.order?.started?'Reprendre le traitement':'Préparer le traitement'
 }
 function close(){if(committing)return;dialog.close();options.back(mode==='accept'?'people':'place')}
 for(const selector of ['[data-extra-close]','[data-extra-back]'])dialog.querySelector(selector)!.addEventListener('click',close)
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
 dialog.addEventListener('close',()=>{if(dialog.open)return;if(pending)cancelExtra(pending.token);pending=null})
 dialog.querySelector('.extra-choices')!.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-extra-choice]');if(!b||b.disabled)return;selected=Number(b.dataset.extraChoice);result.hidden=true;render()})
 confirm.onclick=()=>{
  if(committing||!dialog.open||confirm.disabled||!pending||!allowed())return
  committing=true;confirm.disabled=true
  try{
   const outcome=confirmExtra(pending.token,context());pending=null;committing=false
   if(!outcome.ok){render();error.hidden=false;error.textContent=outcome.reason;return}
   if(mode==='start'){dialog.close();work.open();return}
   render();result.hidden=false;result.textContent='Commande reçue. Revenez dans les services du ministère entre 18h et 22h pour avoir le temps de terminer avant 23h.'
  }finally{committing=false}
 }
 function refresh(){if(dialog.open&&!committing)render()}
 onGameTimeChange(refresh);onPlayerResourcesChange(refresh);onExtraChange(refresh)
 return {open(action:'accept'|'start'){if(!allowed()||dialog.open)return;mode=action;selected=getExtraState().order?.index??0;result.hidden=true;render();dialog.showModal()},snapshot:()=>({mode:dialog.open?mode:'closed',state:getExtraState(),preview:dialog.open?pending:null,puzzle:work.snapshot()})}
}
