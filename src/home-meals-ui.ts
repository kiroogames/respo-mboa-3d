import { loc } from './i18n'
import {onNPCRelationshipChange} from './npc-relationships'
import { onPlayerResourcesChange } from './player-resources'
/* Le choix d’un plat ne débite rien ; seule la confirmation consomme le service. */
import {homeMeals,getHomeMealService,prepareHomeMeal,cancelHomeMeal,confirmHomeMeal} from './home-meals'
import type {MealPreview,MealVariant} from './home-meals'
import {onGameTimeChange} from './game-clock'
import './home-meals.css'
export function mountHomeMeals(options:{base:string;currentZone:()=>string;travelling:()=>boolean;back:()=>void}){
  const dialog=document.createElement('dialog');dialog.className='travel-dialog meal-dialog';dialog.setAttribute('aria-labelledby','meal-heading')
  dialog.innerHTML=`<button class="travel-close" data-meal-close aria-label="${loc('Fermer')}">×</button><span class="travel-eyebrow">${loc('À TABLE, AU MBOA')}</span><h2 id="meal-heading">${loc('Manger à la maison')}</h2><p class="meal-intro">${loc('Un repas par service. Choisissez votre plat.')}</p><p class="meal-service" data-meal-service></p><label for="meal-variant">${loc('Préparation du repas')}</label><select id="meal-variant"><option value="regular">${loc('Repas habituel')}</option><option value="bae">${loc('Repas préparé par Bae · +5 humeur nominale')}</option></select><p class="meal-bae-status" data-meal-bae-status></p><div class="meal-choices" role="group" aria-label="${loc('Choix du plat')}">${homeMeals.map(m=>`<button type="button" data-meal="${m.id}" aria-pressed="false"><b>${m.name}</b><span>${loc('{0} Nkap · {1} min',m.money,m.minutes)}</span></button>`).join('')}</div><section class="meal-preview" aria-label="${loc('Aperçu du repas')}"><h3 data-meal-title></h3><div class="meal-energy"><img src="${options.base}ui/currency-energy.png" alt=""/><strong data-meal-energy></strong></div><p data-meal-energy-preview></p><p data-meal-mood></p><p data-meal-end></p><p data-meal-effect></p><p class="meal-price" data-meal-price></p></section><p class="meal-error" data-meal-error role="alert" hidden></p><div class="meal-result" data-meal-result role="status" hidden></div><div class="meal-actions"><button data-meal-cancel type="button">${loc('Retour')}</button><button data-meal-confirm type="button">${loc('Confirmer le repas')}</button></div>`
  document.body.append(dialog)
  const confirm=dialog.querySelector<HTMLButtonElement>('[data-meal-confirm]')!,error=dialog.querySelector<HTMLElement>('[data-meal-error]')!,result=dialog.querySelector<HTMLElement>('[data-meal-result]')!
  const variant=dialog.querySelector<HTMLSelectElement>('#meal-variant')!
  let selected=homeMeals[0]!.id,pending:(MealPreview&{id:number})|null=null,committing=false
  const allowed=()=>options.currentZone()==='home'&&!options.travelling()&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden
  const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
  function render(){
    if(pending)cancelHomeMeal(pending.id)
    pending=prepareHomeMeal(selected,variant.value as MealVariant)
    const p=pending,s=p.service
    text('[data-meal-service]',loc('{0} Prochain service : {1} {2} · semaine {3}.',s.open?loc('Service ouvert.'):s.reason,s.next.day,s.next.time,s.next.week))
    text('[data-meal-bae-status]',p.bae.reason?loc('Option Bae : ')+p.bae.reason:loc('Bae peut préparer ce repas. Un seul repas Bae par jour ; il partage la limite du service.'))
    text('[data-meal-title]',p.meal.name+(p.variant==='bae'?loc(' · préparé par Bae'):''))
    text('[data-meal-energy]',loc('+{0} énergie',p.energyGain))
    text('[data-meal-energy-preview]',`${p.energyBefore} → ${p.energyAfter} / ${p.maxEnergyAfter}${p.energyLoss?loc(' · −{0} au changement de capacité',p.energyLoss):""}`)
    text('[data-meal-mood]',loc('Humeur : +{0} · {1} → {2} / 140{3}',p.moodGain,p.moodBefore,p.moodAfter,p.variant==='bae'?loc(' · bonus Bae +5 inclus ({0} nominaux au total)',p.moodDelta):''))
    text('[data-meal-end]',loc('Fin du repas : {0} {1} · semaine {2}',p.to.day,p.to.time,p.to.week))
    text('[data-meal-effect]',loc('Repas maison : +5 de capacité pendant 3 h, jusqu’à {0} {1} · semaine {2}. Le plat garde sa recharge habituelle ; aucun cumul avec lui-même.',p.mealEffectEnd.day,p.mealEffectEnd.time,p.mealEffectEnd.week))
    text('[data-meal-price]',loc('{0} Nkap · {1} min · aucun gain de influence ou Respo',p.meal.money,p.meal.minutes))
    dialog.querySelector<HTMLElement>('.meal-preview')!.hidden=s.consumed
    error.hidden=!p.reason||s.consumed;error.textContent=p.reason
    confirm.disabled=!!p.reason||!allowed()||committing
    for(const b of dialog.querySelectorAll<HTMLButtonElement>('[data-meal]')){b.setAttribute('aria-pressed',String(b.dataset.meal===selected));b.disabled=committing||!s.open}
  }
  variant.onchange=()=>{result.hidden=true;render()}
  function close(){if(committing)return;dialog.close();options.back()}
  dialog.querySelector('.meal-choices')!.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-meal]');if(!b||b.disabled||committing)return;selected=b.dataset.meal!;result.hidden=true;render()})
  for(const selector of ['[data-meal-close]','[data-meal-cancel]'])dialog.querySelector(selector)!.addEventListener('click',close)
  dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
  dialog.addEventListener('close',()=>{if(dialog.open)return;if(pending)cancelHomeMeal(pending.id);pending=null})
  onNPCRelationshipChange(()=>{if(dialog.open&&!committing)render()})
  onPlayerResourcesChange(()=>{if(dialog.open&&!committing)render()})
  onGameTimeChange(()=>{if(dialog.open&&!committing)render()})
  confirm.onclick=()=>{
    if(committing||confirm.disabled||!pending||!dialog.open||!allowed())return
    committing=true;confirm.disabled=true
    try{
      const outcome=confirmHomeMeal(pending.id,{zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()})
      pending=null;committing=false
      if(!outcome.ok){render();error.hidden=false;error.textContent=outcome.reason;return}
      render();result.hidden=false
      result.innerHTML=`<b>${outcome.variant==='bae'?loc('Repas préparé par Bae'):loc('Bon appétit !')}</b><strong>${loc('+{0} énergie',outcome.energyGain)}</strong><span>${loc('+{0} humeur · −{1} Nkap',outcome.moodGain,outcome.meal.money)}</span><span>${loc('Repas maison : +5 max jusqu’à {0} {1} · semaine {2}',outcome.mealEffectEnd.day,outcome.mealEffectEnd.time,outcome.mealEffectEnd.week)}</span><small>${loc('{0} {1} · semaine {2}',outcome.to.day,outcome.to.time,outcome.to.week)}</small>`
      result.scrollIntoView({block:'nearest'})
    }finally{committing=false;confirm.disabled=!pending||!!pending.reason||!allowed()}
  }
  return {open(){if(!allowed()||dialog.open||committing)return;variant.value='regular';result.hidden=true;render();dialog.showModal()},snapshot:()=>({mode:dialog.open?'menu':'closed',service:getHomeMealService(),preview:dialog.open?pending:null})}
}
