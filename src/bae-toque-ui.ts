/* Offre sur place de Bae : aperçu sans paiement, confirmation unique et reçu. */
import {toqueRules as rules,getToqueState,toquePresenceReason,prepareToque,cancelToque,confirmToque,onToqueChange} from './bae-toque'
import {onGameTimeChange} from './game-clock'
import {onMoneyBalanceChange} from './currency'
import './bae-toque.css'
export function mountBaeToque(options:{currentZone:()=>string;travelling:()=>boolean;back:()=>void}){
 const dialog=document.createElement('dialog');dialog.className='travel-dialog toque-dialog';dialog.setAttribute('aria-labelledby','toque-heading')
 dialog.innerHTML=`<button class="travel-close" data-toque-close aria-label="Fermer">×</button><span class="travel-eyebrow">UN OBJECTIF AVEC BAE</span><h2 id="toque-heading">Cotiser au Toqué</h2><section class="toque-progress"><span data-toque-status></span><strong data-toque-total></strong><progress max="${rules.target}" value="0" aria-label="Cotisation au Toqué"></progress><small data-toque-remaining></small></section><p data-toque-wallet></p><div class="toque-controls"><label for="toque-amount">Montant du versement</label><input id="toque-amount" type="number" inputmode="numeric" min="${rules.minimum}" step="${rules.step}" value="500"/><div class="toque-presets">${rules.presets.map(amount=>`<button type="button" data-toque-amount="${amount}">${amount.toLocaleString('fr-FR')}</button>`).join('')}<button type="button" data-toque-complete>Compléter</button></div><div class="toque-preview"><p data-toque-after-total></p><p data-toque-after-wallet></p></div></div><p class="toque-policy">Versement définitif, sans frais. Aucun temps écoulé ni autre gain. Cette cotisation reste séparée des travaux de la maison.</p><p class="toque-error" data-toque-error role="alert" hidden></p><div class="toque-result" data-toque-result role="status" hidden></div><div class="toque-actions"><button data-toque-back type="button">Retour</button><button data-toque-another type="button" hidden>Nouveau versement</button><button data-toque-confirm type="button">Confirmer le versement</button></div>`
 document.body.append(dialog)
 const input=dialog.querySelector<HTMLInputElement>('#toque-amount')!,confirm=dialog.querySelector<HTMLButtonElement>('[data-toque-confirm]')!,another=dialog.querySelector<HTMLButtonElement>('[data-toque-another]')!,error=dialog.querySelector<HTMLElement>('[data-toque-error]')!,result=dialog.querySelector<HTMLElement>('[data-toque-result]')!
 let pending:ReturnType<typeof prepareToque>|null=null,committing=false,receipt=false
 const format=(n:number)=>n.toLocaleString('fr-FR')+' Nkap'
 const allowed=()=>document.documentElement.dataset.ready==='true'&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden&&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)
 const context=()=>({zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()})
 const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
 function render(){
  if(pending)cancelToque(pending.token)
  pending=prepareToque(input.valueAsNumber,context())
  const p=pending
  text('[data-toque-status]',p.complete?'Objectif atteint':'Cotisation en cours')
  text('[data-toque-total]',`${p.contributed.toLocaleString('fr-FR')} / ${format(p.target)}`)
  dialog.querySelector<HTMLProgressElement>('progress')!.value=p.contributed
  text('[data-toque-remaining]',`Reste à financer : ${format(p.remaining)}`);text('[data-toque-wallet]',`Votre solde : ${format(p.balance)}`)
  input.max=String(p.remaining)
  text('[data-toque-after-total]',`Après versement : ${p.afterContribution===null?'—':format(p.afterContribution)}`)
  text('[data-toque-after-wallet]',`Solde restant : ${p.afterBalance===null?'—':format(p.afterBalance)}`)
  error.hidden=!p.reason||p.complete||receipt;error.textContent=p.reason
  const presence=toquePresenceReason(context())
  input.disabled=committing||receipt||p.complete||!!presence
  for(const button of dialog.querySelectorAll<HTMLButtonElement>('[data-toque-amount]')){button.disabled=input.disabled||Number(button.dataset.toqueAmount)>p.remaining;button.setAttribute('aria-pressed',String(Number(button.dataset.toqueAmount)===input.valueAsNumber))}
  dialog.querySelector<HTMLButtonElement>('[data-toque-complete]')!.disabled=input.disabled
  dialog.querySelector<HTMLElement>('.toque-controls')!.hidden=p.complete||receipt
  confirm.hidden=p.complete||receipt;confirm.disabled=committing||!!p.reason||!allowed()
  another.hidden=!receipt||p.complete;another.disabled=!!presence
 }
 function close(){if(committing)return;dialog.close();options.back()}
 for(const selector of ['[data-toque-close]','[data-toque-back]'])dialog.querySelector(selector)!.addEventListener('click',close)
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
 dialog.addEventListener('close',()=>{if(dialog.open)return;if(pending)cancelToque(pending.token);pending=null})
 input.oninput=()=>{result.hidden=true;render()}
 dialog.querySelector('.toque-presets')!.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b||b.disabled||committing||receipt)return;input.value=String(b.hasAttribute('data-toque-complete')?getToqueState().remaining:Number(b.dataset.toqueAmount));render()})
 another.onclick=()=>{receipt=false;result.hidden=true;input.value=String(Math.min(500,getToqueState().remaining));render();input.focus()}
 confirm.onclick=()=>{
  if(committing||confirm.hidden||confirm.disabled||!pending||!dialog.open||!allowed())return
  committing=true;confirm.disabled=true
  try{
   const outcome=confirmToque(pending.token,context());pending=null;committing=false
   if(!outcome.ok){render();error.hidden=false;error.textContent=outcome.reason;return}
   receipt=true;render();result.hidden=false
   result.innerHTML=`<b>Versement enregistré</b><strong>−${format(outcome.amount)}</strong><span>Total cotisé : ${format(outcome.contributed)}</span><small>Solde : ${format(outcome.balance)}</small>`;result.scrollIntoView({block:'nearest'})
  }finally{committing=false}
 }
 function refresh(){if(dialog.open&&!committing)render()}
 onGameTimeChange(refresh);onMoneyBalanceChange(refresh);onToqueChange(refresh)
 return {open(){if(!allowed()||toquePresenceReason(context())||dialog.open)return;receipt=false;result.hidden=true;input.value=String(Math.min(500,getToqueState().remaining));render();dialog.showModal()},snapshot:()=>({mode:dialog.open?'menu':'closed',...getToqueState()})}
}
