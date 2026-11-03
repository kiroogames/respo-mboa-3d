import { loc, gameLocale } from './i18n.ts'
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
 dialog.innerHTML=`<button class="travel-close" data-comfort-close aria-label="${loc('Fermer')}">×</button><span class="travel-eyebrow">${loc('CHEZ LE RESPO')}</span><h2 id="comfort-heading">${loc('Confort et équipements')}</h2><section class="comfort-score"><span data-comfort-status></span><strong data-comfort-total></strong><progress max="${initial.target}" value="0" aria-label="${loc('Confort de la maison')}"></progress><div class="comfort-rooms"></div></section><p data-comfort-wallet></p><label class="comfort-label" for="comfort-room">${loc('Pièce de la maison')}</label><select id="comfort-room">${initial.rooms.map(room=>`<option value="${room.id}">${room.name}</option>`).join('')}</select><div class="comfort-catalogue"></div><div class="comfort-works"></div><section class="comfort-preview"><h3 data-comfort-title></h3><p data-comfort-price></p><p data-comfort-after></p><p data-comfort-mood></p><p data-comfort-sleep></p><small>${loc('Acheter donne la propriété. Équiper applique les points de confort, sans frais.')}</small></section><p class="comfort-policy">${loc('Revente des meubles payants à 50 % du prix du catalogue. Aucun temps écoulé ni gain d’énergie ou de Respo. Le confort influence l’humeur via un effet unique, consultable dans « Effets ». Les factures et le Toqué restent séparés.')}</p><p class="comfort-error" data-comfort-error role="alert" hidden></p><div class="comfort-result" data-comfort-result role="status" hidden></div><div class="comfort-actions"><button data-comfort-back type="button">${loc('Retour')}</button><button data-comfort-continue type="button" hidden>${loc('Continuer')}</button><button data-comfort-sell type="button" hidden>${loc('Préparer la revente')}</button><button data-comfort-confirm type="button"></button></div>`
 document.body.append(dialog)
 const room=dialog.querySelector<HTMLSelectElement>('#comfort-room')!,list=dialog.querySelector<HTMLElement>('.comfort-catalogue')!,confirm=dialog.querySelector<HTMLButtonElement>('[data-comfort-confirm]')!,next=dialog.querySelector<HTMLButtonElement>('[data-comfort-continue]')!,error=dialog.querySelector<HTMLElement>('[data-comfort-error]')!,result=dialog.querySelector<HTMLElement>('[data-comfort-result]')!
 const sell=dialog.querySelector<HTMLButtonElement>('[data-comfort-sell]')!
 let selling=false
 let selected='bed-comfort',pending:ReturnType<typeof prepareHomeEquipment>|null=null,committing=false,receipt=false
 const format=(n:number)=>n.toLocaleString(gameLocale)+' Nkap'
 const allowed=()=>document.documentElement.dataset.ready==='true'&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden&&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)
 const context=()=>({zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()})
 const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
 function render(){
  if(pending)cancelHomeEquipment(pending.token);pending=null
  const state=getHomeComfort()
  text('[data-comfort-total]',`${state.total} / ${state.target}`);text('[data-comfort-status]',state.complete?loc('Objectif de confort atteint'):loc('Confort de la maison'))
  dialog.querySelector<HTMLProgressElement>('progress')!.value=state.total
  dialog.querySelector('.comfort-rooms')!.innerHTML=state.rooms.map(r=>`<span>${r.name}<b>${loc('{0} pts',r.comfort)}</b></span>`).join('')
  const items=state.equipment.filter(item=>item.room===room.value)
  if(!items.some(item=>item.id===selected)){selected=(items.find(item=>!item.owned)??items[0])?.id??'';selling=false}
  list.innerHTML=items.map(item=>`<button type="button" data-comfort-item="${item.id}" aria-pressed="${selected===item.id}"><b>${item.name}</b><span>${loc('{0} points · {1}',item.comfort,item.money?format(item.money):loc('Gratuit'))}</span><small>${item.equipped?loc('Équipé'):item.owned?loc('Possédé'):loc('À acheter')}</small></button>`).join('')
  dialog.querySelector('.comfort-works')!.innerHTML=state.improvements.filter(item=>item.room===room.value).map(item=>`<div class="comfort-work"><b>${item.name}</b><span>${loc('+{0} points · {1}',item.comfort,item.paid?loc('Travaux payés, points comptabilisés'):loc('{0} · à financer auprès de Bae',format(item.money)))}</span></div>`).join('')
  dialog.querySelector<HTMLElement>('.comfort-preview')!.hidden=!selected||receipt
  confirm.hidden=!selected||receipt;next.hidden=!receipt
  sell.hidden=receipt||!selected
  if(!selected){text('[data-comfort-wallet]',loc('Ces travaux restent gérés dans les offres de Bae.'));error.hidden=true;return}
  const item=state.equipment.find(item=>item.id===selected)!
  sell.hidden=receipt||!item.owned||item.money===0
  sell.textContent=selling?loc('Annuler la revente'):loc('Préparer la revente')
  pending=prepareHomeEquipment(selected,selling?'sell':item.owned?'equip':'buy',context())
  const p=pending
  text('[data-comfort-wallet]',loc('Votre solde : {0}',format(p.balance)));text('[data-comfort-title]',p.item.name)
  text('[data-comfort-price]',p.action==='sell'?loc('Revente : +{0} · solde après vente : {1}{2}',format(p.refund),format(p.balance+p.refund),p.replacement?loc(' · remplacement par le meuble de base'):''):p.action==='buy'?loc('Achat : {0} · solde après achat : {1}',format(p.price),p.balance>=p.price?format(p.balance-p.price):loc('insuffisant')):loc('Équiper : gratuit et immédiat'))
  text('[data-comfort-after]',loc('Confort : {0} → {1} / {2}{3} · Bonus d’humeur : +{4} → +{5}',p.total,p.afterComfort,state.target,p.action==='buy'?loc(' (achat sans équipement)'):'',getComfortMoodEffect(p.total).bonus,getComfortMoodEffect(p.afterComfort).bonus))
  const mood=getMoodDetails(),beforeEffect=getComfortMoodEffect(p.total),afterEffect=getComfortMoodEffect(p.afterComfort)
  text('[data-comfort-sleep]',p.item.slot==='bed'?(p.item.id==='bed-comfort'?loc('Une fois équipé : +1 énergie nominale par 30 min de sommeil, sur les 8 premières heures. Recharge plafonnée à la capacité au réveil ; aucun gain immédiat en équipant.'):loc('Lit de base : recharge habituelle du sommeil, sans supplément.')):'')
  text('[data-comfort-mood]',loc('Palier : {0} → {1} · humeur affichée : {2} → {3} / 140 · humeur de fond inchangée',beforeEffect.name,afterEffect.name,mood.displayed,Math.min(140,mood.base+afterEffect.bonus)))
  error.hidden=!p.reason||receipt;error.textContent=p.reason
  confirm.textContent=p.action==='sell'?loc('Confirmer la revente'):p.action==='buy'?loc('Confirmer l’achat'):loc('Équiper cet objet')
  confirm.disabled=committing||!!p.reason||!allowed()
  next.textContent=p.item.owned&&!p.item.equipped?loc('Préparer l’équipement'):loc('Voir le catalogue');next.disabled=!!comfortContextReason(context())
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
   result.innerHTML=`<b>${outcome.item.name} ${outcome.action==='sell'?loc('revendu'):outcome.action==='buy'?loc('acheté'):loc('équipé')}</b><strong>${outcome.action==='sell'?`+${format(outcome.refund)}`:outcome.action==='buy'?`−${format(outcome.price)}`:loc('Confort : {0} / {1}',outcome.total,outcome.target)}</strong><span>${outcome.action==='sell'?loc('Objet retiré · confort {0} / {1}. Vous pourrez le racheter au prix plein.',outcome.total,outcome.target):outcome.action==='buy'?loc('Objet possédé. Équipez-le pour obtenir ses points.'):loc('Équipement gratuit ; les autres versions restent possédées.')}</span>`;result.scrollIntoView({block:'nearest'})
  }finally{committing=false}
 }
 function refresh(){if(dialog.open&&!committing)render()}
 onPlayerResourcesChange(refresh);onComfortChange(refresh);onGameTimeChange(refresh);onMoneyBalanceChange(refresh)
 return {open(){if(!allowed()||comfortContextReason(context())||dialog.open)return;selling=false;receipt=false;result.hidden=true;room.value='bedroom';selected='bed-comfort';render();dialog.showModal()},snapshot:()=>({mode:dialog.open?'menu':'closed',...getHomeComfort(),preview:dialog.open?pending:null})}
}

