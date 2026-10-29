import {getMoodDetails,onPlayerResourcesChange} from './player-resources'
import { getComfortMoodEffect } from './comfort-mood'
/* Catalogue de données sur la carte actuelle : acheter et équiper sont deux confirmations distinctes. */
import {getHomeComfort,comfortContextReason,prepareHomeEquipment,cancelHomeEquipment,confirmHomeEquipment,onComfortChange} from './home-comfort'
import {onGameTimeChange} from './game-clock'
import {onMoneyBalanceChange} from './currency'
import './home-comfort.css'
export function mountHomeComfort(options:{currentZone:()=>string;travelling:()=>boolean;back:()=>void}){
 const dialog=document.createElement('dialog');dialog.className='travel-dialog comfort-dialog';dialog.setAttribute('aria-labelledby','comfort-heading')
 const initial=getHomeComfort()
 dialog.innerHTML=`<button class="travel-close" data-comfort-close aria-label="Fermer">×</button><span class="travel-eyebrow">CHEZ LE RESPO</span><h2 id="comfort-heading">Confort et équipements</h2><section class="comfort-score"><span data-comfort-status></span><strong data-comfort-total></strong><progress max="${initial.target}" value="0" aria-label="Confort de la maison"></progress><div class="comfort-rooms"></div></section><p data-comfort-wallet></p><label class="comfort-label" for="comfort-room">Pièce de la maison</label><select id="comfort-room">${initial.rooms.map(room=>`<option value="${room.id}">${room.name}</option>`).join('')}</select><div class="comfort-catalogue"></div><div class="comfort-works"></div><section class="comfort-preview"><h3 data-comfort-title></h3><p data-comfort-price></p><p data-comfort-after></p><p data-comfort-mood></p><p data-comfort-sleep></p><small>Acheter donne la propriété. Équiper applique les points de confort, sans frais.</small></section><p class="comfort-policy">Revente des meubles payants à 50 % du prix du catalogue. Aucun temps écoulé ni gain d’énergie ou de Respo. Le confort influence l’humeur via un effet unique, consultable dans « Effets ». Les factures et le Toqué restent séparés.</p><p class="comfort-error" data-comfort-error role="alert" hidden></p><div class="comfort-result" data-comfort-result role="status" hidden></div><div class="comfort-actions"><button data-comfort-back type="button">Retour</button><button data-comfort-continue type="button" hidden>Continuer</button><button data-comfort-sell type="button" hidden>Préparer la revente</button><button data-comfort-confirm type="button"></button></div>`
 document.body.append(dialog)
 const room=dialog.querySelector<HTMLSelectElement>('#comfort-room')!,list=dialog.querySelector<HTMLElement>('.comfort-catalogue')!,confirm=dialog.querySelector<HTMLButtonElement>('[data-comfort-confirm]')!,next=dialog.querySelector<HTMLButtonElement>('[data-comfort-continue]')!,error=dialog.querySelector<HTMLElement>('[data-comfort-error]')!,result=dialog.querySelector<HTMLElement>('[data-comfort-result]')!
 const sell=dialog.querySelector<HTMLButtonElement>('[data-comfort-sell]')!
 let selling=false
 let selected='bed-comfort',pending:ReturnType<typeof prepareHomeEquipment>|null=null,committing=false,receipt=false
 const format=(n:number)=>n.toLocaleString('fr-FR')+' Nkap'
 const allowed=()=>document.documentElement.dataset.ready==='true'&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden&&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)
 const context=()=>({zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()})
 const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
 function render(){
  if(pending)cancelHomeEquipment(pending.token);pending=null
  const state=getHomeComfort()
  text('[data-comfort-total]',`${state.total} / ${state.target}`);text('[data-comfort-status]',state.complete?'Objectif de confort atteint':'Confort de la maison')
  dialog.querySelector<HTMLProgressElement>('progress')!.value=state.total
  dialog.querySelector('.comfort-rooms')!.innerHTML=state.rooms.map(r=>`<span>${r.name}<b>${r.comfort} pts</b></span>`).join('')
  const items=state.equipment.filter(item=>item.room===room.value)
  if(!items.some(item=>item.id===selected)){selected=(items.find(item=>!item.owned)??items[0])?.id??'';selling=false}
  list.innerHTML=items.map(item=>`<button type="button" data-comfort-item="${item.id}" aria-pressed="${selected===item.id}"><b>${item.name}</b><span>${item.comfort} points · ${item.money?format(item.money):'Gratuit'}</span><small>${item.equipped?'Équipé':item.owned?'Possédé':'À acheter'}</small></button>`).join('')
  dialog.querySelector('.comfort-works')!.innerHTML=state.improvements.filter(item=>item.room===room.value).map(item=>`<div class="comfort-work"><b>${item.name}</b><span>+${item.comfort} points · ${item.paid?'Travaux payés, points comptabilisés':`${format(item.money)} · à financer auprès de Bae`}</span></div>`).join('')
  dialog.querySelector<HTMLElement>('.comfort-preview')!.hidden=!selected||receipt
  confirm.hidden=!selected||receipt;next.hidden=!receipt
  sell.hidden=receipt||!selected
  if(!selected){text('[data-comfort-wallet]','Ces travaux restent gérés dans les offres de Bae.');error.hidden=true;return}
  const item=state.equipment.find(item=>item.id===selected)!
  sell.hidden=receipt||!item.owned||item.money===0
  sell.textContent=selling?'Annuler la revente':'Préparer la revente'
  pending=prepareHomeEquipment(selected,selling?'sell':item.owned?'equip':'buy',context())
  const p=pending
  text('[data-comfort-wallet]',`Votre solde : ${format(p.balance)}`);text('[data-comfort-title]',p.item.name)
  text('[data-comfort-price]',p.action==='sell'?`Revente : +${format(p.refund)} · solde après vente : ${format(p.balance+p.refund)}${p.replacement?' · remplacement par le meuble de base':''}`:p.action==='buy'?`Achat : ${format(p.price)} · solde après achat : ${p.balance>=p.price?format(p.balance-p.price):'insuffisant'}`:'Équiper : gratuit et immédiat')
  text('[data-comfort-after]',`Confort : ${p.total} → ${p.afterComfort} / ${state.target}${p.action==='buy'?' (achat sans équipement)':''} · Bonus d’humeur : +${getComfortMoodEffect(p.total).bonus} → +${getComfortMoodEffect(p.afterComfort).bonus}`)
  const mood=getMoodDetails(),beforeEffect=getComfortMoodEffect(p.total),afterEffect=getComfortMoodEffect(p.afterComfort)
  text('[data-comfort-sleep]',p.item.slot==='bed'?(p.item.id==='bed-comfort'?'Une fois équipé : +1 énergie nominale par 30 min de sommeil, sur les 8 premières heures. Recharge plafonnée à la capacité au réveil ; aucun gain immédiat en équipant.':'Lit de base : recharge habituelle du sommeil, sans supplément.'):'')
  text('[data-comfort-mood]',`Palier : ${beforeEffect.name} → ${afterEffect.name} · humeur affichée : ${mood.displayed} → ${Math.min(140,mood.base+afterEffect.bonus)} / 140 · humeur de fond inchangée`)
  error.hidden=!p.reason||receipt;error.textContent=p.reason
  confirm.textContent=p.action==='sell'?'Confirmer la revente':p.action==='buy'?'Confirmer l’achat':'Équiper cet objet'
  confirm.disabled=committing||!!p.reason||!allowed()
  next.textContent=p.item.owned&&!p.item.equipped?'Préparer l’équipement':'Voir le catalogue';next.disabled=!!comfortContextReason(context())
 }
 function close(){if(committing)return;dialog.close();options.back()}
 for(const selector of ['[data-comfort-close]','[data-comfort-back]'])dialog.querySelector(selector)!.addEventListener('click',close)
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
 dialog.addEventListener('close',()=>{if(dialog.open)return;if(pending)cancelHomeEquipment(pending.token);pending=null})
 room.onchange=()=>{selling=false;receipt=false;result.hidden=true;render()}
 list.onclick=event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-comfort-item]');if(!button||committing)return;selected=button.dataset.comfortItem!;selling=false;receipt=false;result.hidden=true;render();list.querySelector<HTMLButtonElement>(`[data-comfort-item="${selected}"]`)?.focus({preventScroll:true})}
 sell.onclick=()=>{if(committing)return;selling=!selling;receipt=false;result.hidden=true;render()}
 next.onclick=()=>{selling=false;receipt=false;result.hidden=true;render()}
 confirm.onclick=()=>{
  if(committing||confirm.hidden||confirm.disabled||!pending||!dialog.open||!allowed())return
  committing=true;confirm.disabled=true
  try{
   const outcome=confirmHomeEquipment(pending.token,context());pending=null;committing=false
   if(!outcome.ok){render();error.hidden=false;error.textContent=outcome.reason;return}
   selling=false;receipt=true;render();result.hidden=false
   result.innerHTML=`<b>${outcome.item.name} ${outcome.action==='sell'?'revendu':outcome.action==='buy'?'acheté':'équipé'}</b><strong>${outcome.action==='sell'?`+${format(outcome.refund)}`:outcome.action==='buy'?`−${format(outcome.price)}`:`Confort : ${outcome.total} / ${outcome.target}`}</strong><span>${outcome.action==='sell'?`Objet retiré · confort ${outcome.total} / ${outcome.target}. Vous pourrez le racheter au prix plein.`:outcome.action==='buy'?'Objet possédé. Équipez-le pour obtenir ses points.':'Équipement gratuit ; les autres versions restent possédées.'}</span>`;result.scrollIntoView({block:'nearest'})
  }finally{committing=false}
 }
 function refresh(){if(dialog.open&&!committing)render()}
 onPlayerResourcesChange(refresh);onComfortChange(refresh);onGameTimeChange(refresh);onMoneyBalanceChange(refresh)
 return {open(){if(!allowed()||comfortContextReason(context())||dialog.open)return;selling=false;receipt=false;result.hidden=true;room.value='bedroom';selected='bed-comfort';render();dialog.showModal()},snapshot:()=>({mode:dialog.open?'menu':'closed',...getHomeComfort(),preview:dialog.open?pending:null})}
}

