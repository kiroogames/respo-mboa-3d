/* Le sac et les vendeurs partagent le même aperçu, sans débit avant confirmation. */
import {bagFoods,getFoodBag,prepareFoodBag,confirmFoodBag,cancelFoodBag,onFoodBagChange} from './food-bag'
import type {BagAction} from './food-bag'
import {getGameTimeAt,onGameTimeChange} from './game-clock'
import {onPlayerResourcesChange} from './player-resources'
import './food-bag.css'

export function mountFoodBag(options:{button:HTMLButtonElement;currentZone:()=>string;travelling:()=>boolean;canOpen:()=>boolean;back:()=>void}){
 const dialog=document.createElement('dialog');dialog.className='travel-dialog food-bag-dialog';dialog.setAttribute('aria-labelledby','bag-title')
 dialog.innerHTML=`<button class="travel-close" data-bag-close aria-label="Fermer le sac">×</button><span class="travel-eyebrow">UNE PAUSE AU MBOA</span><h2 id="bag-title">Mon sac</h2><p>1 emplacement gratuit · un aliment à la fois</p><section data-bag-item></section><div class="bag-actions"><button data-bag-eat>Consommer</button><button data-bag-discard>Jeter</button></div><section class="bag-preview" data-bag-preview hidden></section><p data-bag-error role="alert" hidden></p><p data-bag-result role="status" hidden></p><div class="bag-actions"><button data-bag-cancel>Retour</button><button data-bag-confirm hidden>Confirmer</button></div>`
 document.body.append(dialog)
 const confirm=dialog.querySelector<HTMLButtonElement>('[data-bag-confirm]')!,preview=dialog.querySelector<HTMLElement>('[data-bag-preview]')!,error=dialog.querySelector<HTMLElement>('[data-bag-error]')!,result=dialog.querySelector<HTMLElement>('[data-bag-result]')!
 let pending:ReturnType<typeof prepareFoodBag>|null=null,fromVenue=false,committing=false
 const allowed=()=>options.canOpen()&&!options.travelling()&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)
 const context=()=>({zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()})
 const date=(minutes:number)=>{const t=getGameTimeAt(minutes);return `${t.day} ${t.time} · semaine ${t.week}`}
 function clear(){if(pending)cancelFoodBag(pending.token);pending=null;preview.hidden=true;confirm.hidden=true;error.hidden=true}
 function renderItem(){
  const item=getFoodBag().item
  dialog.querySelector('[data-bag-item]')!.textContent=item?`${item.name} · ${item.expired?'Périmé':'À consommer avant '+date(item.expires)}`:'Votre sac est vide. Achetez à emporter au marché ou au supermarché.'
  dialog.querySelector<HTMLButtonElement>('[data-bag-eat]')!.disabled=!item||item.expired
  dialog.querySelector<HTMLButtonElement>('[data-bag-discard]')!.disabled=!item
  options.button.textContent=`Sac · ${item?'1':'0'}/1${item?.expired?' !':''}`
 }
 function select(action:BagAction,id=''){
  clear();result.hidden=true;pending=prepareFoodBag(action,id,context());const p=pending
  preview.hidden=false;confirm.hidden=false;confirm.textContent=action==='buy'?'Acheter à emporter':action==='eat'?'Confirmer le repas':'Confirmer la suppression'
  preview.innerHTML=action==='buy'?`<h3>${p.food!.name}</h3><p><strong>${p.money} Nkap</strong> · ${p.minutes} min pour acheter</p><p>Aucun gain immédiat. Plus tard : +${p.food!.energy} énergie, +${p.food!.mood} humeur de base en ${p.food!.minutes} min.</p><p>Conservation : ${p.food!.life/60} h · limite ${date(p.expires!)}</p><p>Solde : ${p.balance} → ${p.balance-p.money} Nkap</p>`:action==='eat'?`<h3>${p.food?.name??'Sac vide'}</h3><p class="bag-energy"><strong>+${p.energyGain} énergie</strong> · ${p.energyBefore} → ${p.energyAfter} / ${p.maxEnergyAfter}${p.energyLoss?` · −${p.energyLoss} au changement de capacité`:""}</p><p>+${p.moodGain} humeur · ${p.moodBefore} → ${p.moodAfter} / 140</p><p>${p.minutes} min · fin ${date(p.end)}</p><p>Sans dépense de Nkap.</p>`:`<h3>Jeter cet aliment ?</h3><p>${p.food?.name??'Sac vide'} sera supprimé. Aucun remboursement, aucun temps écoulé.</p>`
  error.hidden=!p.reason;error.textContent=p.reason;confirm.disabled=!!p.reason||!allowed()
 }
 function close(){if(committing)return;clear();dialog.close();if(fromVenue){fromVenue=false;options.back()}}
 for(const selector of ['[data-bag-close]','[data-bag-cancel]'])dialog.querySelector(selector)!.addEventListener('click',close)
 dialog.addEventListener('cancel',e=>{e.preventDefault();close()})
 dialog.addEventListener('close',()=>{if(!dialog.open)clear()})
 dialog.querySelector<HTMLButtonElement>('[data-bag-eat]')!.onclick=()=>select('eat')
 dialog.querySelector<HTMLButtonElement>('[data-bag-discard]')!.onclick=()=>select('discard')
 confirm.onclick=()=>{
  if(committing||!dialog.open||confirm.disabled||!pending)return
  committing=true;confirm.disabled=true
  try{
   const p=confirmFoodBag(pending.token,context());pending=null
   if(!p.ok){clear();error.hidden=false;error.textContent=p.reason;return}
   clear();renderItem();result.hidden=false
   result.textContent=p.action==='buy'?`${p.food!.name} ajouté au sac. −${p.money} Nkap · ${p.minutes} min. À consommer avant ${date(p.expires!)}.`:p.action==='eat'?`Bon appétit ! +${p.energyGain} énergie · +${p.moodGain} humeur · ${p.minutes} min. Votre emplacement est libre.`:'Aliment jeté. Votre emplacement est libre.'
  }finally{committing=false}
 }
 options.button.onclick=()=>{if(!allowed())return;fromVenue=false;clear();result.hidden=true;renderItem();dialog.showModal()}
 function refresh(){renderItem();if(dialog.open&&!committing&&pending)select(pending.action,pending.food?.id)}
 onGameTimeChange(refresh);onFoodBagChange(refresh);onPlayerResourcesChange(refresh)
 // Refléter aussi les déplacements et les autres fenêtres, qui ne changent pas nécessairement l’horloge.
 setInterval(()=>{options.button.disabled=dialog.open||!allowed()},250)
 renderItem()
 return {openPurchase(id:string){if(!allowed()||!bagFoods.some(f=>f.id===id&&f.zone===options.currentZone()))return;fromVenue=true;result.hidden=true;renderItem();dialog.showModal();select('buy',id)},snapshot:()=>({mode:dialog.open?'menu':'closed',...getFoodBag(),preview:dialog.open?pending:null})}
}
