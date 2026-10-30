import {getHouseBudget} from './house-budget'
/* Paiement manuel de la plus ancienne facture ; aucune déduction à l’ouverture du menu. */
import {houseBillItems,getHouseBilling,getHouseBill,prepareHouseBillPayment,cancelHouseBillPayment,confirmHouseBillPayment,onHouseBillChange} from './house-bills'
import {onGameTimeChange,getGameTime} from './game-clock'
import {onMoneyBalanceChange} from './currency'
import './house-bills.css'
export function mountHouseBills(options:{button:HTMLButtonElement;canOpen:()=>boolean}){
 const dialog=document.createElement('dialog');dialog.className='travel-dialog bills-dialog';dialog.setAttribute('aria-labelledby','bills-heading')
 dialog.innerHTML=`<button class="travel-close" data-bill-close aria-label="Fermer">×</button><span class="travel-eyebrow">LE BUDGET DE LA MAISON</span><h2 id="bills-heading">Factures de la maison</h2><div class="bills-summary"><div><span>Solde disponible</span><strong data-bill-balance></strong></div><div><span>Total à régler</span><strong data-bill-total></strong></div></div><section class="house-budget-panel" data-house-budget aria-labelledby="house-budget-heading"><h3 id="house-budget-heading">Prévoir le budget</h3><strong data-budget-label></strong><p data-budget-reference></p><p data-budget-gap></p><p data-budget-date></p><small>Estimation uniquement : aucun argent n’est bloqué ou prélevé.</small></section><p data-bill-next></p><p class="bills-policy">Émission le vendredi à 12h pour la semaine suivante. Paiement recommandé avant 18h ; règlement tardif possible, sans frais ni pénalité.</p><div class="bills-history" aria-label="Historique des factures"></div><div class="bills-pages"><button data-bill-prev type="button">Précédent</button><span data-bill-page></span><button data-bill-next-page type="button">Suivant</button></div><details class="bill-preview"><summary>Répartition de la facture</summary><h3 data-bill-title></h3><ul>${houseBillItems.map(item=>`<li><span>${item.name}</span><b>${item.money} Nkap</b></li>`).join('')}</ul><p data-bill-price></p><p data-bill-after></p><small>Aucun temps écoulé, aucun changement d’énergie, d’humeur, de influence ou de points Respo.</small></details><p class="bill-error" data-bill-error role="alert" hidden></p><div class="bill-result" data-bill-result role="status" hidden></div><div class="bill-actions"><button data-bill-back type="button">Retour</button><button data-bill-another type="button" hidden>Préparer la facture suivante</button><button data-bill-confirm type="button">Confirmer le paiement</button></div>`
 const badge=document.createElement('span');badge.id='house-budget-indicator';badge.className='house-budget-indicator'
 options.button.closest('.game-wallet-details')?.append(badge)
 document.body.append(dialog)
 // Les factures et leur paiement passent avant les conseils de prévision du budget.
 dialog.querySelector('.bills-summary')!.after(dialog.querySelector('.bills-history')!,dialog.querySelector('.bills-pages')!)
 const confirm=dialog.querySelector<HTMLButtonElement>('[data-bill-confirm]')!,error=dialog.querySelector<HTMLElement>('[data-bill-error]')!,result=dialog.querySelector<HTMLElement>('[data-bill-result]')!,prev=dialog.querySelector<HTMLButtonElement>('[data-bill-prev]')!,next=dialog.querySelector<HTMLButtonElement>('[data-bill-next-page]')!
 let page=0,committing=false,paidReceipt=false,pending:ReturnType<typeof prepareHouseBillPayment>=null
 const format=(n:number)=>n.toLocaleString('fr-FR')+' Nkap'
 const date=(v:{day:string;time:string;week:number})=>`${v.day} ${v.time} · semaine ${v.week}`
 const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
 const allowed=()=>options.canOpen()&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)
 function updateBudget(){const b=getHouseBudget();badge.dataset.budget=b.status;badge.textContent=b.label;badge.title=`${b.label} · ${format(b.reference)} à prévoir · ${b.missing?format(b.missing)+' manquants':format(b.available)+' disponibles après provision théorique'}`;options.button.dataset.budget=b.status;options.button.setAttribute('aria-label',`Ouvrir les factures · ${b.label}`)}
 function availability(){updateBudget();const state=getHouseBilling();options.button.disabled=dialog.open||!allowed();options.button.dataset.due=String(state.unpaid>0);options.button.title=state.unpaid?`Factures : ${format(state.totalDue)} à régler`:'Factures de la maison'
  // Le lien rappelle directement la somme : dette en cours, sinon la prochaine facture et son jour.
  options.button.textContent=state.unpaid?`À payer : ${format(state.totalDue)}`:state.nextIssue?`${format(state.amount)} à payer ${state.nextIssue.day.toLowerCase()}`:`${format(state.amount)} par semaine`}
 function render(){
  if(pending)cancelHouseBillPayment(pending.token)
  pending=prepareHouseBillPayment()
  const s=getHouseBilling(),pages=Math.max(1,Math.ceil(s.issued/6));page=Math.max(0,Math.min(page,pages-1))
  const budget=getHouseBudget()
  dialog.querySelector<HTMLElement>('[data-house-budget]')!.dataset.budget=budget.status
  text('[data-budget-label]',budget.label)
  text('[data-budget-reference]',`${budget.source==='unpaid'?`${budget.unpaid} facture(s) impayée(s)`:'Prochaine facture à préparer'} : ${format(budget.reference)}`)
  text('[data-budget-gap]',budget.missing?`Il manque ${format(budget.missing)} pour couvrir ce montant.`:`Disponible après provision théorique : ${format(budget.available)}.`)
  text('[data-budget-date]',budget.date?`${budget.source==='unpaid'?'Échéance recommandée de la plus ancienne':'Prochaine émission'} : ${date(budget.date)}`:'Limite du calendrier atteinte.')
  text('[data-bill-balance]',format(s.balance));text('[data-bill-total]',format(s.totalDue))
  const remaining=s.nextIssue?s.nextIssue.totalMinutes-getGameTime().totalMinutes:0
  text('[data-bill-next]',s.nextIssue?`Prochaine facture : ${date(s.nextIssue)} · dans ${Math.floor(remaining/60)} h ${remaining%60} min.`:'Limite du calendrier atteinte.')
  const rows=[]
  for(let index=page*6;index<Math.min(s.issued,(page+1)*6);index++){const bill=getHouseBill(index)!;rows.push(`<div class="bill-row" data-bill-index="${index}" data-paid="${bill.paid}"><div><b>Semaine ${bill.forWeek}</b><small>Émise ${date(bill.issue)}</small></div><span>${format(bill.amount)}<small>${bill.paid?'Payée':bill.overdue?'En retard':'À régler'}</small></span>${!bill.paid?(index===s.oldest?.index?'<div data-bill-pay-slot></div>':'<button type="button" class="bill-pay-waiting" disabled title="Réglez d’abord la facture la plus ancienne">Payer</button>'):''}</div>`)}
  dialog.querySelector('.bills-history')!.innerHTML=rows.join('')||'<p>Aucune facture émise. La première échéance figure ci-dessus.</p>'
  // Réutilise le même bouton et la transaction existante, au plus près du montant concerné.
  const paySlot=dialog.querySelector('[data-bill-pay-slot]')
  ;(paySlot??dialog.querySelector('.bill-actions')!).append(confirm)
  confirm.textContent='Payer'
  confirm.setAttribute('aria-label',s.oldest?`Payer ${format(s.amount)}, facture semaine ${s.oldest.forWeek}`:'Payer la facture')
  dialog.querySelector<HTMLElement>('.bills-pages')!.hidden=pages<=1
  text('[data-bill-page]',`Page ${page+1} / ${pages}`);prev.disabled=page===0;next.disabled=page>=pages-1
  text('[data-bill-title]',s.oldest?`À régler en premier : semaine ${s.oldest.forWeek}`:'Détail de la facture hebdomadaire')
  text('[data-bill-price]',`Total : ${format(s.amount)}`)
  text('[data-bill-after]',s.oldest?`Solde après paiement : ${s.balance>=s.amount?format(s.balance-s.amount):'solde insuffisant'}`:'Aucun paiement demandé pour le moment.')
  error.hidden=!s.oldest||s.balance>=s.amount;error.textContent='Argent insuffisant pour régler cette facture.'
  confirm.hidden=paidReceipt||!s.oldest||!paySlot
  dialog.querySelector<HTMLButtonElement>('[data-bill-another]')!.hidden=!paidReceipt||!s.oldest
  confirm.disabled=committing||!pending||s.balance<s.amount||!allowed()
 }
 function close(){if(committing)return;dialog.close();availability()}
 options.button.onclick=()=>{if(!allowed()||dialog.open)return;page=Math.floor(getHouseBilling().paid/6);paidReceipt=false;result.hidden=true;render();dialog.showModal();availability()}
 for(const selector of ['[data-bill-close]','[data-bill-back]'])dialog.querySelector(selector)!.addEventListener('click',close)
 dialog.addEventListener('cancel',e=>{e.preventDefault();close()})
 dialog.addEventListener('close',()=>{if(dialog.open)return;if(pending)cancelHouseBillPayment(pending.token);pending=null;availability()})
 prev.onclick=()=>{page--;render()};next.onclick=()=>{page++;render()}
 dialog.querySelector<HTMLButtonElement>('[data-bill-another]')!.onclick=()=>{paidReceipt=false;result.hidden=true;render()}
 confirm.onclick=()=>{
  if(committing||confirm.hidden||confirm.disabled||!pending||!dialog.open||!allowed())return
  committing=true;confirm.disabled=true
  try{
   const outcome=confirmHouseBillPayment(pending.token,allowed());pending=null;committing=false;render()
   if(!outcome.ok){error.hidden=false;error.textContent=outcome.reason;return}
   paidReceipt=true;render();result.hidden=false;result.innerHTML=`<b>Facture de la semaine ${outcome.bill.forWeek} payée</b><strong>−${format(outcome.amount)}</strong><span>Nouveau solde : ${format(outcome.balance)}</span>`;result.scrollIntoView({block:'nearest'})
  }finally{committing=false;availability()}
 }
 function refresh(){availability();if(dialog.open&&!committing)render()}
 onGameTimeChange(refresh);onMoneyBalanceChange(refresh);onHouseBillChange(refresh)
 const observer=new MutationObserver(availability);observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['open','data-ready']})
 for(const overlay of document.querySelectorAll('#dialogue,#reference'))observer.observe(overlay,{attributes:true,attributeFilter:['hidden']})
 // Le dialogue d’attente se ferme avant la fin du fondu : réactiver l’accès quand le masque disparaît.
 queueMicrotask(()=>{for(const mask of document.querySelectorAll('.wait-transition'))observer.observe(mask,{attributes:true,attributeFilter:['hidden']})})
 availability()
 return {snapshot:()=>({mode:dialog.open?'menu':'closed',...getHouseBilling(),budget:getHouseBudget()})}
}
