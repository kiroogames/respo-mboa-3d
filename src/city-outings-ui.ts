import { loc, gameLocale } from './i18n.ts'
import { getFoodStock, onFoodStockChange } from './food-stock'
import {getSportEffect,sportRules} from './sport-energy'
/* Options de sorties : choisir ne produit aucun effet ; une seule confirmation engage les coûts. */
import {cityOutings,getOutingSchedule,prepareCityOuting,cancelCityOuting,confirmCityOuting,onCityOutingChange} from './city-outings'
import {getGameTimeAt,onGameTimeChange} from './game-clock'
import {onPlayerResourcesChange} from './player-resources'
import {onMoneyBalanceChange} from './currency'
import './city-outings.css'
export function mountCityOutings(options:{currentZone:()=>string;travelling:()=>boolean;back:()=>void}){
 const dialog=document.createElement('dialog');dialog.className='travel-dialog outings-dialog';dialog.setAttribute('aria-labelledby','outings-heading')
 dialog.innerHTML=`<button class="travel-close" data-outing-close aria-label="${loc('Fermer')}">×</button><span class="travel-eyebrow">${loc('PRENDRE DU TEMPS POUR SOI')}</span><h2 id="outings-heading"></h2><p data-outing-hours></p><p class="outing-schedule" data-outing-schedule></p><div class="outing-options" role="group" aria-label="${loc('Options de sortie')}"></div><section class="outing-preview"><h3 data-outing-title></h3><div class="outing-gain"><span>${loc('Gain réel d’humeur')}</span><strong data-outing-gain></strong></div><p data-outing-mood></p><p data-outing-energy></p><p class="outing-cost" data-outing-cost></p><p data-outing-wallet></p><p data-outing-end></p></section><p class="outing-policy">${loc('Sortie en solo. Une utilisation par jour, ou par soirée de 18h à 04h pour le snack. Aucun gain de Respo, influence ou considération.')}</p><p class="outing-error" data-outing-error role="alert" hidden></p><div class="outing-result" data-outing-result role="status" hidden></div><div class="outing-actions"><button data-outing-back type="button">${loc('Retour au lieu')}</button><button data-outing-confirm type="button">${loc('Confirmer la sortie')}</button></div>`
 document.body.append(dialog)
 const list=dialog.querySelector<HTMLElement>('.outing-options')!,confirm=dialog.querySelector<HTMLButtonElement>('[data-outing-confirm]')!,error=dialog.querySelector<HTMLElement>('[data-outing-error]')!,result=dialog.querySelector<HTMLElement>('[data-outing-result]')!
 let activityId=cityOutings[0]!.id,optionId=cityOutings[0]!.options[0]!.id,pending:ReturnType<typeof prepareCityOuting>|null=null,committing=false,receipt=false
 const format=(n:number)=>n.toLocaleString(gameLocale)+' Nkap'
 const date=(v:{day:string;time:string;week:number})=>loc('{0} {1} · semaine {2}',v.day,v.time,v.week)
 const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
 const allowed=()=>document.documentElement.dataset.ready==='true'&&!options.travelling()&&options.currentZone()===cityOutings.find(a=>a.id===activityId)!.zone&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden&&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)
 function render(){
  if(pending)cancelCityOuting(pending.token)
  pending=prepareCityOuting(activityId,optionId)
  const p=pending,a=p.activity,s=p.schedule
  const meal=a.id.startsWith('restaurant')
  confirm.textContent=meal?loc('Commander'):loc('Confirmer la sortie')
  dialog.querySelector('.travel-eyebrow')!.textContent=meal?loc('À LA CARTE'):loc('PRENDRE DU TEMPS POUR SOI')
  text('#outings-heading',a.name);text('[data-outing-hours]',a.hours)
  text('[data-outing-schedule]',`${s.reason||(s.end!==null?loc('Ouvert jusqu’à {0}.',date(getGameTimeAt(s.end))):'')} ${s.next?loc('Prochaine ouverture : {0}.',date(s.next)):''}`)
  // Les horaires sont déjà au-dessus : évite un second pavé avant la carte des plats.
  dialog.querySelector<HTMLElement>('[data-outing-schedule]')!.hidden=meal&&s.open&&!s.consumed
  const stockOf=(option:string)=>a.id.startsWith('restaurant')||option==='meal'?getFoodStock(`outing:${a.id}:${option}`):null
  list.innerHTML=a.options.map(o=>`<button type="button" data-outing-option="${o.id}" data-menu-art="${a.id==='restaurant'?({classic:'ndole',complete:'chicken','rice-beans':'ricebeans','grilled-chicken':'chicken',mafe:'rice'} as Record<string,string>)[o.id]??'food':''}" aria-pressed="${o.id===optionId}" ${s.consumed||stockOf(o.id)?.soldOut?'disabled':''}><b>${o.name}</b><span>${loc('{0} · {1} min · {2}',o.money?format(o.money):loc('Gratuit'),o.minutes,o.energy?loc('−{0} énergie',o.energy):loc('Sans coût d’énergie'))}</span>${stockOf(o.id)?`<small class="stock-badge${stockOf(o.id)!.soldOut?' is-out':''}">${stockOf(o.id)!.soldOut?loc('Épuisé'):loc('Reste {0}',stockOf(o.id)!.remaining)}</small>`:''}</button>`).join('')
  text('.outing-policy',a.repeatable?loc('Repas en solo. Disponible à nouveau tant que vous pouvez en bénéficier. Aucun gain de Respo, influence ou considération.'):loc('Sortie en solo. Une utilisation par jour, ou par soirée pour le snack. Aucun gain de Respo, influence ou considération.'))
  text('[data-outing-title]',p.option.name)
  text('[data-outing-gain]',`+${p.moodGain}`);text('[data-outing-mood]',`${p.moodBefore} → ${p.moodAfter} / 140`)
  text('[data-outing-energy]',loc('{0}Énergie : {1} → {2} / {3}{4}{5}',a.id==='football'?loc('Après le match : +{0} max pendant 6h, sans recharge offerte ; excédent plafonné à expiration. ',sportRules.bonus):'',p.energyBefore,p.energyAfter,p.maxEnergyAfter,p.energyLoss?loc(' · −{0} au changement de capacité',p.energyLoss):"",p.option.energyGain?loc(' · +{0} énergie réelle',p.energyGain):""))
  text('[data-outing-cost]',loc('{0} · {1} min',p.option.money?format(p.option.money):loc('Gratuit'),p.option.minutes))
  text('[data-outing-wallet]',loc('Solde : {0} · après sortie : {1}',format(p.balance),p.balance>=p.option.money?format(p.balance-p.option.money):loc('insuffisant')))
  text('[data-outing-end]',loc('Fin : {0}',date(p.to)))
  dialog.querySelector<HTMLElement>('.outing-preview')!.hidden=s.consumed||receipt
  error.hidden=!p.reason||s.consumed;error.textContent=p.reason
  confirm.hidden=s.consumed||receipt;confirm.disabled=committing||!!p.reason||!allowed()
 }
 function close(){if(committing)return;dialog.close();options.back()}
 for(const selector of ['[data-outing-close]','[data-outing-back]'])dialog.querySelector(selector)!.addEventListener('click',close)
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
 dialog.addEventListener('close',()=>{if(dialog.open)return;if(pending)cancelCityOuting(pending.token);pending=null})
 list.onclick=event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-outing-option]');if(!b||b.disabled||committing)return;optionId=b.dataset.outingOption!;receipt=false;result.hidden=true;render();list.querySelector<HTMLButtonElement>(`[data-outing-option="${optionId}"]`)?.focus({preventScroll:true})}
 confirm.onclick=()=>{
  if(committing||confirm.hidden||confirm.disabled||!pending||!dialog.open||!allowed())return
  committing=true;confirm.disabled=true
  try{
   const outcome=confirmCityOuting(pending.token,{zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()});pending=null;committing=false
   if(!outcome.ok){render();error.hidden=false;error.textContent=outcome.reason;return}
   receipt=true;render();result.hidden=false
   result.innerHTML=`<b>${loc('{0} · sortie terminée',outcome.option.name)}</b><strong>${outcome.moodGain?loc('+{0} humeur',outcome.moodGain):loc('Humeur affichée inchangée')}</strong><span>${loc('{0} · {1} énergie · {2} min',outcome.option.money?`−${format(outcome.option.money)}`:loc('Gratuit'),outcome.option.energyGain?`+${outcome.energyGain}`:`−${outcome.option.energy}`,outcome.option.minutes)}</span><small>${date(outcome.to)}</small>`;if(outcome.activity.id==='football'){const effect=getSportEffect();if(effect){const info=document.createElement('p');info.textContent=loc('Forme sportive : +10 énergie max jusqu’à {0}. Aucune recharge offerte.',date(getGameTimeAt(effect.end)));result.append(info)}};result.scrollIntoView({block:'nearest'})
  }finally{committing=false}
 }
 function refresh(){if(dialog.open&&!committing)render()}
 onGameTimeChange(()=>{if(dialog.open&&!committing){receipt=false;result.hidden=true;render()}});onPlayerResourcesChange(refresh);onMoneyBalanceChange(refresh);onFoodStockChange(refresh);onCityOutingChange(refresh)
 return {open(id:string){const a=cityOutings.find(a=>a.id===id);if(!a||options.currentZone()!==a.zone||options.travelling()||dialog.open)return;activityId=id;optionId=a.options[0]!.id;if(!allowed())return;receipt=false;result.hidden=true;render();dialog.showModal()},snapshot:()=>({mode:dialog.open?'menu':'closed',preview:dialog.open?pending:null,schedules:cityOutings.map(a=>({id:a.id,...getOutingSchedule(a.id)}))})}
}
