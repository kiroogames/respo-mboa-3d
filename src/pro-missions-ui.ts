import {projectEnergy} from './player-resources'
/* Journal commun : plusieurs missions restent actives, chaque action exige son vrai lieu. */
import {missionRules as rules,getMissionState,getMissionView,prepareMission,cancelMission,confirmMission,onMissionChange} from './pro-missions'
import type {MissionView} from './pro-missions'
import {onGameTimeChange} from './game-clock'
import './pro-missions.css'
export function mountProMissions(options:{label:(zone:string)=>string;currentZone:()=>string;travelling:()=>boolean}){
 const launcher=document.createElement('button');launcher.id='missions-open';launcher.type='button';launcher.textContent='Missions';launcher.title='Journal des missions';document.querySelector('.tools')!.prepend(launcher)
 const dialog=document.createElement('dialog');dialog.className='travel-dialog missions-dialog';dialog.setAttribute('aria-labelledby','missions-heading')
 dialog.innerHTML=`<button class="travel-close" data-mission-close aria-label="Fermer">×</button><span class="travel-eyebrow">LE TRAVAIL SUR LE TERRAIN</span><h2 id="missions-heading">Missions professionnelles</h2><p class="missions-summary" data-mission-summary></p><div class="missions-list" role="group" aria-label="Missions disponibles et en cours"></div><section class="mission-detail"><h3 data-mission-title></h3><p data-mission-objective></p><ol data-mission-steps></ol><p class="mission-cost">Activité : −${rules.energyCost} énergie · ${rules.minutes} min.<br/>Transports selon votre trajet.</p><strong class="mission-reward">Au compte rendu : +${rules.moneyGain} Nkap · +${rules.respoGain} Respo</strong><p data-mission-preview></p></section><p class="mission-reason" data-mission-reason></p><div class="mission-result" data-mission-result role="status" hidden></div><div class="mission-actions"><button data-mission-back type="button">Retour</button><button data-mission-confirm type="button"></button></div>`
 document.body.append(dialog)
 const list=dialog.querySelector<HTMLElement>('.missions-list')!,confirm=dialog.querySelector<HTMLButtonElement>('[data-mission-confirm]')!,result=dialog.querySelector<HTMLElement>('[data-mission-result]')!
 let selected=rules.missions[0]!.id,pending:(MissionView&{token:number})|null=null,committing=false,back:(()=>void)|undefined
 const allowed=()=>document.documentElement.dataset.ready==='true'&&!options.travelling()&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)&&!!document.querySelector<HTMLElement>('#dialogue')?.hidden&&!!document.querySelector<HTMLElement>('#reference')?.hidden&&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)
 const context=()=>({zone:options.currentZone(),travelling:options.travelling(),allowed:allowed()})
 const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
 const stageLabel=(stage:string)=>({offer:'À accepter',active:'Activité à réaliser',ready:'Compte rendu à faire',paid:'Terminée cette semaine'}[stage]??stage)
 function render(){
  if(pending)cancelMission(pending.token)
  pending=prepareMission(selected,context())
  const p=pending,m=p.mission
  const active=rules.missions.filter(m=>['active','ready'].includes(getMissionState(m.id)?.stage??'')).length
  text('[data-mission-summary]',`${active} mission${active>1?'s':''} en cours · chaque mission une fois par semaine. Plusieurs missions peuvent être acceptées ensemble.`)
  list.innerHTML=rules.missions.map(m=>{const v=getMissionView(m.id,context());return `<button type="button" data-mission-id="${m.id}" aria-pressed="${selected===m.id}"><b>${m.title}</b><small>${m.giverName} · ${stageLabel(v.stage)}</small></button>`}).join('')
  text('[data-mission-title]',m.title);text('[data-mission-objective]',`${m.giverName} — ${m.objective}`)
  const accepted=p.stage!=='offer',worked=p.stage==='ready'||p.stage==='paid',paid=p.stage==='paid'
  dialog.querySelector('[data-mission-steps]')!.innerHTML=`<li>${accepted?'✓':'1.'} Accepter auprès de ${m.giverName} au ministère (${m.giver==='anneke'?'lun/mer/ven':'mar/jeu'}).</li><li>${worked?'✓':'2.'} Effectuer la vérification : ${options.label(m.zone)}.</li><li>${paid?'✓':'3.'} Revenir auprès du donneur au ministère et rendre compte.</li>`
  text('[data-mission-preview]',p.action==='work'?`Énergie : ${p.energy} → ${projectEnergy(0,p.to.totalMinutes,p.from.totalMinutes,p.energy,rules.energyCost).energyAfter} · fin ${p.to.day} ${p.to.time}, semaine ${p.to.week}`:p.action==='report'?'Compte rendu gratuit et immédiat. Récompense attribuée après confirmation.':'Accepter est gratuit. Aucun gain avant le compte rendu ; la mission reste active sans date limite.')
  text('[data-mission-reason]',p.reason)
  confirm.textContent=p.action==='accept'?'Accepter la mission':p.action==='work'?'Confirmer la vérification':p.action==='report'?'Rendre compte et récupérer':'Mission terminée'
  confirm.disabled=committing||!!p.reason||!allowed()||!p.action
 }
 function availability(){launcher.disabled=dialog.open||!allowed()}
 function close(){if(committing)return;dialog.close();const returnTo=back;back=undefined;returnTo?.();availability()}
 function open(id?:string,onBack?:()=>void){if(!allowed()||dialog.open)return;selected=id??rules.missions.find(m=>['active','ready'].includes(getMissionState(m.id)?.stage??''))?.id??rules.missions[0]!.id;back=onBack;result.hidden=true;render();dialog.showModal();availability()}
 launcher.onclick=()=>open()
 list.onclick=event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-mission-id]');if(!button||committing)return;selected=button.dataset.missionId!;result.hidden=true;render();list.querySelector<HTMLButtonElement>(`[data-mission-id="${selected}"]`)?.focus({preventScroll:true})}
 for(const selector of ['[data-mission-close]','[data-mission-back]'])dialog.querySelector(selector)!.addEventListener('click',close)
 dialog.addEventListener('cancel',e=>{e.preventDefault();close()})
 dialog.addEventListener('close',()=>{if(dialog.open)return;if(pending)cancelMission(pending.token);pending=null;availability()})
 confirm.onclick=()=>{
  if(committing||confirm.disabled||!pending||!dialog.open||!allowed())return
  committing=true;confirm.disabled=true
  try{
   const outcome=confirmMission(pending.token,context());pending=null;committing=false;render()
   if(!outcome.ok){text('[data-mission-reason]',outcome.reason);return}
   result.hidden=false
   result.innerHTML=outcome.action==='accept'?'<b>Mission acceptée</b><span>Retrouvez toutes vos étapes dans ce journal.</span>':outcome.action==='work'?'<b>Vérification effectuée</b><span>Rendez compte au donneur lorsqu’il est au ministère.</span>':`<b>Compte rendu validé</b><strong>+${rules.moneyGain} Nkap</strong><span>+${rules.respoGain} points Respo</span>`
   result.scrollIntoView({block:'nearest'})
  }finally{committing=false;availability()}
 }
 function refresh(){availability();if(dialog.open&&!committing)render()}
 onGameTimeChange(refresh);onMissionChange(refresh)
 const observer=new MutationObserver(availability);observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['open','data-ready']})
 for(const overlay of document.querySelectorAll('#dialogue,#reference'))observer.observe(overlay,{attributes:true,attributeFilter:['hidden']})
 // Les masques sont tous créés à la fin du montage synchrone de l’interface.
 queueMicrotask(()=>{for(const mask of document.querySelectorAll('.wait-transition'))observer.observe(mask,{attributes:true,attributeFilter:['hidden']})})
 availability()
 return {open,snapshot:()=>({mode:dialog.open?'journal':'closed',missions:rules.missions.map(m=>({id:m.id,...getMissionState(m.id)})),preview:dialog.open?pending:null})}
}
