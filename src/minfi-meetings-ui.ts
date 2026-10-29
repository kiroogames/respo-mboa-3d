/* Menu de réunion sur la carte actuelle : aperçu libre, engagement confirmé une seule fois. */
import {meetingRules as rules,getMeetingSchedule,prepareMeeting,cancelMeeting,confirmMeeting,onMeetingChange} from './minfi-meetings'
import {onGameTimeChange} from './game-clock'
import {onPlayerResourcesChange} from './player-resources'
import './minfi-meetings.css'
export function mountMinfiMeetings(options:{currentZone:()=>string;travelling:()=>boolean;back:()=>void}){
 const dialog=document.createElement('dialog');dialog.className='travel-dialog meeting-dialog';dialog.setAttribute('aria-labelledby','meeting-title')
 dialog.innerHTML=`<button class="travel-close" data-meeting-close aria-label="Fermer">×</button><span class="travel-eyebrow">LA VIE AU MINISTÈRE</span><h2 id="meeting-title">Réunion MINFI</h2><p>Lundi–vendredi · 08h–16h · une réunion par jour</p><p class="meeting-status" data-meeting-status></p><h3 data-meeting-topic></h3><div class="meeting-options" role="group" aria-label="Participation à la réunion">${rules.options.map(o=>`<button data-meeting-option="${o.id}" type="button" aria-pressed="false"><b>${o.name}</b><span>${o.minutes} min · −${o.energy} énergie · +${o.respo} Respo</span></button>`).join('')}</div><section class="meeting-preview" data-meeting-preview><h3 data-meeting-choice></h3><p data-meeting-energy></p><strong data-meeting-respo></strong><p data-meeting-progress></p><p data-meeting-end></p><small>Nkap, humeur, Karma et considération inchangés.</small></section><p class="meeting-error" data-meeting-error role="alert" hidden></p><section class="meeting-result" data-meeting-result role="status" hidden></section><div class="meeting-actions"><button data-meeting-back type="button">Retour au lieu</button><button data-meeting-confirm type="button">Confirmer la réunion</button></div>`
 document.body.append(dialog)
 const confirm=dialog.querySelector<HTMLButtonElement>('[data-meeting-confirm]')!,error=dialog.querySelector<HTMLElement>('[data-meeting-error]')!,result=dialog.querySelector<HTMLElement>('[data-meeting-result]')!
 let selected=rules.options[0]!.id,pending:ReturnType<typeof prepareMeeting>|null=null,committing=false,receipt=false
 const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
 const date=(v:{day:string;time:string;week:number})=>`${v.day} ${v.time} · semaine ${v.week}`
 const allowed=()=>document.documentElement.dataset.ready==='true'&&options.currentZone()===rules.zone&&!options.travelling()&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden&&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)
 function render(){
  if(pending)cancelMeeting(pending.token);pending=prepareMeeting(selected)
  const p=pending,s=p.schedule
  text('[data-meeting-status]',`${s.reason||'Réunion disponible.'}${s.next?' Prochaine ouverture : '+date(s.next)+'.':''}`)
  text('[data-meeting-topic]',s.topic?'Ordre du jour : '+s.topic:'Pas de réunion le week-end.')
  for(const button of dialog.querySelectorAll<HTMLButtonElement>('[data-meeting-option]')){button.setAttribute('aria-pressed',String(button.dataset.meetingOption===selected));button.disabled=committing||s.consumed}
  text('[data-meeting-choice]',p.option.name);text('[data-meeting-energy]',`Énergie : ${p.energyBefore} → ${p.energyAfter} (−${p.option.energy})`)
  text('[data-meeting-respo]',`+${p.option.respo} points Respo`)
  text('[data-meeting-progress]',`Points : ${p.progressBefore.points} → ${p.progressAfter.points} · niveau ${p.progressBefore.level} → ${p.progressAfter.level}${p.progressAfter.remaining?' · encore '+p.progressAfter.remaining+' points avant le suivant':''}`)
  text('[data-meeting-end]',`Fin : ${date(p.to)} · ${p.option.minutes} min`)
  dialog.querySelector<HTMLElement>('[data-meeting-preview]')!.hidden=receipt||s.consumed
  error.hidden=!p.reason||receipt;error.textContent=p.reason
  confirm.hidden=receipt||s.consumed;confirm.disabled=committing||!!p.reason||!allowed()
 }
 function close(){if(committing)return;dialog.close();options.back()}
 for(const selector of ['[data-meeting-close]','[data-meeting-back]'])dialog.querySelector(selector)!.addEventListener('click',close)
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
 dialog.addEventListener('close',()=>{if(dialog.open)return;if(pending)cancelMeeting(pending.token);pending=null})
 dialog.querySelector('.meeting-options')!.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-meeting-option]');if(!b||b.disabled||committing)return;selected=b.dataset.meetingOption!;receipt=false;result.hidden=true;render()})
 confirm.onclick=()=>{
  if(committing||confirm.hidden||confirm.disabled||!pending||!dialog.open||!allowed())return
  committing=true;confirm.disabled=true
  try{
   const outcome=confirmMeeting(pending.token,{zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()});pending=null
   if(!outcome.ok){committing=false;render();error.hidden=false;error.textContent=outcome.reason;return}
   receipt=true;render();result.hidden=false
   result.innerHTML=`<b>Réunion accomplie</b><strong>+${outcome.option.respo} points Respo</strong><p>−${outcome.option.energy} énergie · ${outcome.option.minutes} min</p><p>${outcome.schedule.topic}</p><small>${date(outcome.to)} · niveau ${outcome.progressAfter.level}</small>`
   result.scrollIntoView({block:'nearest'})
  }finally{committing=false}
 }
 function refresh(){if(dialog.open&&!committing)render()}
 onGameTimeChange(refresh);onPlayerResourcesChange(refresh);onMeetingChange(refresh)
 return {open(){if(!allowed()||dialog.open)return;selected=rules.options[0]!.id;receipt=false;result.hidden=true;render();dialog.showModal()},snapshot:()=>({mode:dialog.open?'menu':'closed',schedule:getMeetingSchedule(),preview:dialog.open?pending:null})}
}
