/* Menu du jour partagé par le lieu et Mami Makala ; les effets attendent la confirmation. */
import {canteenRules as rules,getCanteenService,prepareCanteenMeal,cancelCanteenMeal,confirmCanteenMeal,onCanteenChange} from './canteen'
import {onGameTimeChange} from './game-clock'
import {onPlayerResourcesChange} from './player-resources'
import {onMoneyBalanceChange} from './currency'
import './canteen.css'
export function mountCanteen(options:{base:string;currentZone:()=>string;travelling:()=>boolean;back:(tab:'place'|'people')=>void}){
 const dialog=document.createElement('dialog');dialog.className='travel-dialog canteen-dialog';dialog.setAttribute('aria-labelledby','canteen-title')
 dialog.innerHTML=`<button class="travel-close" data-canteen-close aria-label="Fermer">×</button><span class="travel-eyebrow">LA PAUSE DÉJEUNER AU MBOA</span><h2 id="canteen-title">Cantine du ministère</h2><p>Lundi–vendredi · 11h–14h · chaque plat une fois par service</p><p class="canteen-status" data-canteen-status></p><div class="canteen-choices" role="group" aria-label="Plats du jour"></div><section class="canteen-preview" data-canteen-preview><h3 data-canteen-dish></h3><p class="canteen-energy"><img src="${options.base}ui/currency-energy.png" alt=""/><strong data-canteen-energy></strong></p><p data-canteen-energy-range></p><p data-canteen-mood></p><p data-canteen-money></p><p data-canteen-end></p><small>Aucun gain de Influence, Respo ou considération.</small></section><p class="canteen-error" data-canteen-error role="alert" hidden></p><section class="canteen-result" data-canteen-result role="status" hidden></section><div class="canteen-actions"><button data-canteen-back>Retour au lieu</button><button data-canteen-confirm>Confirmer le repas</button></div>`
 document.body.append(dialog)
 const choices=dialog.querySelector<HTMLElement>('.canteen-choices')!,confirm=dialog.querySelector<HTMLButtonElement>('[data-canteen-confirm]')!,error=dialog.querySelector<HTMLElement>('[data-canteen-error]')!,result=dialog.querySelector<HTMLElement>('[data-canteen-result]')!
 let selected=rules.dishes[0]!.id,pending:ReturnType<typeof prepareCanteenMeal>|null=null,committing=false,receipt=false,tab:'place'|'people'='place'
 const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
 const date=(t:{day:string;time:string;week:number})=>`${t.day} ${t.time} · semaine ${t.week}`
 const allowed=()=>document.documentElement.dataset.ready==='true'&&options.currentZone()===rules.zone&&!options.travelling()&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden&&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)
 function render(){
  if(pending)cancelCanteenMeal(pending.token);pending=prepareCanteenMeal(selected)
  const p=pending,s=p.service
  text('[data-canteen-status]',`${s.reason||'Service du jour ouvert.'}${s.next?' Prochain service : '+date(s.next)+'.':''}`)
  choices.innerHTML=s.menu.map(id=>{const d=rules.dishes.find(d=>d.id===id)!;return `<button data-canteen-dish-id="${id}" aria-pressed="${id===selected}" ${s.done.includes(id)?'disabled':''}><b>${d.name}</b><span>${s.done.includes(id)?'✓ Déjà consommé':`${d.money} Nkap · ${d.minutes} min · +${d.energy} énergie`}</span></button>`}).join('')
  text('[data-canteen-dish]',p.dish.name);text('[data-canteen-energy]',`+${p.energyGain} énergie réelle`)
  text('[data-canteen-energy-range]',`${p.energyBefore} → ${p.energyAfter} / ${p.maxEnergyAfter}${p.energyLoss?` · −${p.energyLoss} au changement de capacité`:""}`)
  text('[data-canteen-mood]',`+${p.moodGain} humeur · ${p.moodBefore} → ${p.moodAfter} / 140`)
  text('[data-canteen-money]',`${p.dish.money} Nkap · solde ${p.balance} → ${p.balance>=p.dish.money?p.balance-p.dish.money:'insuffisant'}`)
  text('[data-canteen-end]',`${p.dish.minutes} min · fin ${date(p.to)}`)
  const consumed=s.done.includes(selected)
  dialog.querySelector<HTMLElement>('[data-canteen-preview]')!.hidden=receipt||consumed||!s.menu.length
  error.hidden=!p.reason||receipt;error.textContent=p.reason
  confirm.hidden=receipt||consumed||!s.menu.length;confirm.disabled=!!p.reason||committing||!allowed()
 }
 function close(){if(committing)return;dialog.close();options.back(tab)}
 for(const selector of ['[data-canteen-close]','[data-canteen-back]'])dialog.querySelector(selector)!.addEventListener('click',close)
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
 dialog.addEventListener('close',()=>{if(dialog.open)return;if(pending)cancelCanteenMeal(pending.token);pending=null})
 choices.onclick=event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-canteen-dish-id]');if(!b||b.disabled||committing)return;selected=b.dataset.canteenDishId!;receipt=false;result.hidden=true;render();choices.querySelector<HTMLButtonElement>(`[data-canteen-dish-id="${selected}"]`)?.focus({preventScroll:true})}
 confirm.onclick=()=>{
  if(committing||!dialog.open||confirm.hidden||confirm.disabled||!pending||!allowed())return
  committing=true;confirm.disabled=true
  try{
   const outcome=confirmCanteenMeal(pending.token,{zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()});pending=null;committing=false
   if(!outcome.ok){render();error.hidden=false;error.textContent=outcome.reason;return}
   receipt=true;render();result.hidden=false
   result.innerHTML=`<b>Bon appétit !</b><strong>+${outcome.energyGain} énergie</strong><p>+${outcome.moodGain} humeur · −${outcome.dish.money} Nkap</p><small>${outcome.dish.name} · ${outcome.dish.minutes} min<br>${date(outcome.to)}</small>`;result.scrollIntoView({block:'nearest'})
  }finally{committing=false}
 }
 function refresh(){if(dialog.open&&!committing){const s=getCanteenService();if(s.menu.length&&!s.menu.includes(selected)){selected=s.menu[0]!;receipt=false;result.hidden=true}render()}}
 onGameTimeChange(refresh);onPlayerResourcesChange(refresh);onMoneyBalanceChange(refresh);onCanteenChange(refresh)
 return {open(from:'place'|'people'='place'){if(!allowed()||dialog.open)return;tab=from;const s=getCanteenService();selected=s.menu.find(id=>!s.done.includes(id))??s.menu[0]??rules.dishes[0]!.id;receipt=false;result.hidden=true;render();dialog.showModal()},snapshot:()=>({mode:dialog.open?'menu':'closed',service:getCanteenService(),preview:dialog.open?pending:null})}
}
