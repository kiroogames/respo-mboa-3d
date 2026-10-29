/* Préparation libre, puis séquence guidée réservée. La caméra reste libre pendant les trois étapes. */
import {accompaniedRules as rules,prepareAccompanied,cancelAccompanied,confirmAccompanied,getAccompaniedState,finishAccompaniedPhase,onAccompaniedChange} from './accompanied-outings'
import type {GuidedPhase,LocatePlace} from './accompanied-outings'
import {cityOutings} from './city-outings'
import {travelModes} from './travel'
import type {TravelMode,TravelPoint} from './travel'
import {onGameTimeChange} from './game-clock'
import {onPlayerResourcesChange} from './player-resources'
import {onMoneyBalanceChange} from './currency'
import {onNPCRelationshipChange} from './npc-relationships'
import {isGuidedOutingActive} from './guided-outing-state'
import './accompanied-outings.css'
export function mountAccompaniedOutings(options:{currentZone:()=>string;travelling:()=>boolean;locate:LocatePlace;label:(id:string)=>string;depart:(key:string,route:TravelPoint[],mode:TravelMode,done:()=>void)=>void;positionAt:(zone:string)=>void;back:(npcId:string)=>void}){
 const dialog=document.createElement('dialog');dialog.className='travel-dialog accompanied-dialog';dialog.setAttribute('aria-labelledby','accompanied-heading')
 dialog.innerHTML=`<button class="travel-close" data-accompanied-close aria-label="Fermer">×</button><span class="travel-eyebrow">UN MOMENT À DEUX</span><h2 id="accompanied-heading">Préparer une sortie</h2><div class="accompanied-form"><p data-accompanied-person></p><label for="accompanied-activity">Sortie</label><select id="accompanied-activity">${cityOutings.filter(a=>rules.activities.includes(a.id)).map(a=>`<option value="${a.id}">${a.name}</option>`).join('')}</select><label for="accompanied-option">Option pour deux</label><select id="accompanied-option"></select><label for="accompanied-mode">Transport aller et retour</label><select id="accompanied-mode">${travelModes.map(mode=>`<option value="${mode.id}">${mode.label}${mode.id==='taxi'?' · deux places':mode.id==='moto'?' · deux motos':mode.id==='yonga'?' · un véhicule partagé':''}</option>`).join('')}</select><section class="accompanied-quote"><strong data-accompanied-money></strong><p data-accompanied-energy></p><p data-accompanied-route></p><p data-accompanied-dates></p><p data-accompanied-gains></p><p data-accompanied-balance></p><small>Prix et durées réservés selon le trafic affiché. Après confirmation, le parcours se termine par le retour au lieu du rendez-vous.</small></section><p class="accompanied-error" data-accompanied-error role="alert" hidden></p></div><div class="accompanied-result" data-accompanied-result role="status" hidden></div><div class="accompanied-actions"><button data-accompanied-back type="button">Retour</button><button data-accompanied-confirm type="button">Confirmer le parcours</button></div>`
 const panel=document.createElement('div');panel.className='accompanied-progress';panel.hidden=true;panel.setAttribute('role','status')
 document.body.append(dialog,panel)
 const activity=dialog.querySelector<HTMLSelectElement>('#accompanied-activity')!,option=dialog.querySelector<HTMLSelectElement>('#accompanied-option')!,mode=dialog.querySelector<HTMLSelectElement>('#accompanied-mode')!,confirm=dialog.querySelector<HTMLButtonElement>('[data-accompanied-confirm]')!,error=dialog.querySelector<HTMLElement>('[data-accompanied-error]')!,result=dialog.querySelector<HTMLElement>('[data-accompanied-result]')!
 let npcId='bae',pending:ReturnType<typeof prepareAccompanied>|null=null,committing=false,driving:GuidedPhase|null=null,timer:ReturnType<typeof setTimeout>|null=null,finished=false,visualPaused=false
 const name=(id:string)=>id==='bae'?'Bae':'Crystal',format=(n:number)=>n.toLocaleString('fr-FR')+' Nkap'
 const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
 const allowed=()=>document.documentElement.dataset.ready==='true'&&!options.travelling()&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden
 const context=()=>({zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()})
 function fillOptions(){option.innerHTML=cityOutings.find(a=>a.id===activity.value)!.options.map(o=>`<option value="${o.id}">${o.name}</option>`).join('')}
 function render(){
  if(pending)cancelAccompanied(pending.token);pending=null
  if(finished)return
  try{
   const p=prepareAccompanied(npcId,activity.value,option.value,mode.value as TravelMode,context(),options.locate);pending=p
   text('[data-accompanied-person]',`Avec ${name(npcId)} · aller, activité pour deux et retour inclus.`)
   text('[data-accompanied-money]',`Total : ${format(p.money)}`)
   text('[data-accompanied-energy]',`Énergie : −${p.energy} · ${p.energyBefore} → ${Math.max(0,p.energyBefore-p.energy)} · retour ${p.energyAfter} / ${p.maxEnergyAfter??p.maxEnergy}${p.activityId.startsWith('restaurant')?` au départ ; +${p.energyGain} au repas (${p.energyAtMeal??p.energyAfter}) ; retour ${p.energyAfter} / ${p.maxEnergyAfter??p.maxEnergy}`:""}`)
   text('[data-accompanied-route]',`${options.label(p.origin)} → ${options.label(p.destination)} → ${options.label(p.origin)} · ${p.traffic.label}`)
   text('[data-accompanied-dates]',`Arrivée ${p.arrival.day} ${p.arrival.time} · fin d’activité ${p.activityEnd.day} ${p.activityEnd.time} · retour ${p.returned.day} ${p.returned.time} (semaine ${p.returned.week})`)
   text('[data-accompanied-gains]',`Gain réel : +${p.moodGain} humeur · +${p.considerationGain} considération pour ${name(npcId)}`)
   text('[data-accompanied-balance]',`Solde : ${format(p.balance)} · après paiement : ${p.balance>=p.money?format(p.balance-p.money):'insuffisant'}`)
   error.hidden=!p.reason;error.textContent=p.reason;confirm.disabled=!!p.reason||committing
  }catch(failure){confirm.disabled=true;error.hidden=false;error.textContent=failure instanceof Error?failure.message:'Ce parcours est indisponible.'}
 }
 function close(){if(isGuidedOutingActive()||committing)return;dialog.close();options.back(npcId)}
 for(const selector of ['[data-accompanied-close]','[data-accompanied-back]'])dialog.querySelector(selector)!.addEventListener('click',close)
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
 dialog.addEventListener('close',()=>{if(dialog.open)return;if(pending)cancelAccompanied(pending.token);pending=null})
 activity.onchange=()=>{fillOptions();render()};option.onchange=render;mode.onchange=render
 confirm.onclick=()=>{
  if(committing||confirm.disabled||!pending||!dialog.open||!allowed())return
  committing=true
  try{const outcome=confirmAccompanied(pending.token,context(),options.locate);pending=null;if(!outcome.ok){committing=false;render();error.hidden=false;error.textContent=outcome.reason}}
  finally{committing=false}
 }
 function showReceipt(){
  const state=getAccompaniedState();if(!state||state.phase!=='done')return
  finished=true;npcId=state.plan.npcId;dialog.querySelector<HTMLElement>('.accompanied-form')!.hidden=true;confirm.hidden=true
  text('#accompanied-heading',`De retour avec ${name(npcId)}`)
  result.hidden=false;result.innerHTML=`<b>Sortie à deux terminée</b><strong>+${state.moodGain} humeur</strong>${state.plan.activityId.startsWith('restaurant')?`<strong>+${state.energyGain??0} énergie au repas</strong>`:""}<span>+${state.considerationGain} considération pour ${name(npcId)}</span><small>${format(state.plan.money)} payés · retour ${state.plan.returned.day} ${state.plan.returned.time}</small>`
  if(!dialog.open)dialog.showModal()
 }
 function drive(){
  if(document.documentElement.dataset.ready!=='true')return
  const state=getAccompaniedState();if(!state||state.phase===driving)return
  if(timer){clearTimeout(timer);timer=null}
  const phase=state.phase,p=state.plan;driving=phase
  if(phase==='done'){panel.hidden=true;options.positionAt(p.origin);showReceipt();return}
  if(dialog.open)dialog.close();panel.hidden=false
  panel.innerHTML=`<strong>Avec ${name(p.npcId)} · ${phase==='outbound'?'Aller':phase==='activity'?'Activité':'Retour'}</strong><span>${format(p.money)} réservés · retour ${p.returned.day} ${p.returned.time}</span>`
  const finish=()=>{if(finishAccompaniedPhase(phase))return;panel.innerHTML='<strong>La sortie ne peut pas reprendre dans cet état.</strong>'}
  if(phase==='activity'){
   options.positionAt(p.destination)
   if(!visualPaused)timer=setTimeout(finish,matchMedia('(prefers-reduced-motion: reduce)').matches?0:1100)
  }else options.depart(phase==='outbound'?p.destination:p.origin,phase==='outbound'?p.outwardRoute:p.returnRoute,p.mode,finish)
 }
 onAccompaniedChange(drive)
 function refresh(){if(dialog.open&&!committing&&!finished&&!isGuidedOutingActive())render()}
 onGameTimeChange(refresh);onPlayerResourcesChange(refresh);onMoneyBalanceChange(refresh);onNPCRelationshipChange(refresh)
 return {
  open(id:string){if(!rules.companions.includes(id)||!allowed()||dialog.open||isGuidedOutingActive())return;npcId=id;finished=false;result.hidden=true;dialog.querySelector<HTMLElement>('.accompanied-form')!.hidden=false;confirm.hidden=false;text('#accompanied-heading','Préparer une sortie');activity.value='cinema';mode.value='yonga';fillOptions();render();dialog.showModal()},
  resume(){const state=getAccompaniedState();if(state&&state.phase!=='done'){driving=null;drive()}},
  setVisualPaused(value:boolean){visualPaused=value;if(timer){clearTimeout(timer);timer=null}if(!value&&getAccompaniedState()?.phase==='activity'){driving=null;drive()}},
  advanceVisual(){const state=getAccompaniedState();if(state?.phase==='activity'){if(timer)clearTimeout(timer);timer=null;finishAccompaniedPhase('activity')}},
  snapshot:()=>({mode:isGuidedOutingActive()?'guided':dialog.open?(finished?'receipt':'planning'):'closed',state:getAccompaniedState(),preview:dialog.open&&!finished?pending:null}),
 }
}
