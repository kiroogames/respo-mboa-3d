import {onComfortChange} from './home-comfort'
import { onPlayerResourcesChange } from './player-resources'
/* Le lit reste un menu de la carte ; zéro minute ne peut jamais être confirmé. */
import { prepareSleeping, confirmSleeping, cancelSleeping } from './sleeping'
import type { SleepingPreview } from './sleeping'
import { getDayPeriod } from './daylight'
import { getGameTimeAt,onGameTimeChange } from './game-clock'
import './sleeping.css'

export function mountSleeping(options:{base:string;currentZone:()=>string;travelling:()=>boolean;back:()=>void}){
  const dialog=document.createElement('dialog');dialog.className='travel-dialog sleep-dialog';dialog.setAttribute('aria-labelledby','sleep-heading')
  dialog.innerHTML=`<button class="travel-close" data-sleep-close aria-label="Fermer">×</button><span class="travel-eyebrow">LE REPOS À LA MAISON</span><h2 id="sleep-heading">Une bonne nuit</h2><p class="wait-intro">Choisissez votre durée de sommeil.</p><div class="wait-dates"><div><span>Au coucher</span><strong data-sleep-from></strong><small data-sleep-from-day></small></div><span class="wait-arrow">→</span><div><span>Au réveil</span><strong data-sleep-to></strong><small data-sleep-to-day></small></div></div><label class="wait-duration" for="sleep-duration">Durée du sommeil <output data-sleep-duration></output></label><input id="sleep-duration" type="range" min="0" max="960" step="30" value="480"/><div class="wait-limits"><span>0 h</span><span>16 h</span></div><div class="wait-presets">${[60,240,480,600].map(n=>`<button data-sleep-minutes="${n}" type="button">${n/60} h</button>`).join('')}</div><div class="sleep-energy"><img src="${options.base}ui/currency-energy.png" alt=""/><div><span>Énergie récupérée</span><strong data-sleep-energy></strong><small data-sleep-energy-preview></small></div></div><p data-sleep-bed></p><p data-sleep-fatigue></p><p data-sleep-rested></p><p class="sleep-mood" data-sleep-mood></p><p class="wait-neutral">Gratuit · aucun gain de influence ou de points Respo.</p><p class="wait-rules">8 h suffisent pour une récupération complète. À partir de 10 h, sans fatigue restante au réveil : Bien reposé, +10 de capacité pendant 6 h.</p><p class="wait-error" data-sleep-error hidden role="alert"></p><div class="wait-actions"><button data-sleep-cancel type="button">Retour</button><button data-sleep-confirm type="button">Dormir</button></div>`
  const mask=document.createElement('div');mask.className='wait-transition sleep-transition';mask.hidden=true;mask.setAttribute('aria-hidden','true')
  const toast=document.createElement('div');toast.className='wait-result sleep-result';toast.hidden=true;toast.setAttribute('role','status')
  document.body.append(dialog,mask,toast)
  const slider=dialog.querySelector<HTMLInputElement>('#sleep-duration')!,confirm=dialog.querySelector<HTMLButtonElement>('[data-sleep-confirm]')!,error=dialog.querySelector<HTMLElement>('[data-sleep-error]')!
  let pending:(SleepingPreview&{id:number})|null=null,transitioning=false,timer:ReturnType<typeof setTimeout>|undefined
  const allowed=()=>options.currentZone()==='home'&&!options.travelling()&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)
  const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
  const durationText=(n:number)=>`${Math.floor(n/60)} h${n%60?' 30 min':''}`
  function render(){
    if(pending)cancelSleeping(pending.id);pending=null;error.hidden=true
    const duration=Number(slider.value)
    text('[data-sleep-duration]',durationText(duration));slider.setAttribute('aria-valuetext',durationText(duration))
    // À zéro, projeter seulement la situation actuelle ; aucune proposition confirmable.
    const preview=prepareSleeping(duration||30)
    if(duration)pending=preview;else cancelSleeping(preview.id)
    text('[data-sleep-from]',preview.from.time);text('[data-sleep-from-day]',`${preview.from.day} · semaine ${preview.from.week}`)
    const target=duration?preview.to:preview.from
    text('[data-sleep-to]',target.time);text('[data-sleep-to-day]',`${target.day} · semaine ${target.week} · ${getDayPeriod(target.minuteOfDay)}`)
    text('[data-sleep-energy]',`+${duration?preview.energyGain:0} énergie`)
    text('[data-sleep-energy-preview]',`${preview.energyBefore} → ${duration?preview.energyAfter:preview.energyBefore} / ${duration?preview.maxEnergyAfter:preview.maxEnergy}${duration&&preview.energyLoss?` · −${preview.energyLoss} au changement de capacité`:""}`)
    text('[data-sleep-bed]',`${preview.bed.name} : ${preview.bed.bonusPer30?`+1 énergie nominale par 30 min sur les 8 premières heures (supplément prévu : +${duration?preview.bedBonus:0}). Le gain total affiché respecte le plafond au réveil.`:'recharge habituelle. Équipez le lit confortable pour améliorer les siestes.'}`)
    text('[data-sleep-fatigue]',`Fatigue : ${preview.fatigueBefore.label} → ${duration?preview.fatigueAfter.label:preview.fatigueBefore.label} · éveil accumulé ${preview.fatigueBefore.minutes} → ${duration?preview.fatigueAfter.minutes:preview.fatigueBefore.minutes} min`)
    text('[data-sleep-rested]',duration&&preview.restedEligible?`Bien reposé : +10 de capacité, remplie au réveil, pendant 6 h (jusqu’à ${getGameTimeAt(preview.restedAfter!.end).day} ${getGameTimeAt(preview.restedAfter!.end).time}, semaine ${getGameTimeAt(preview.restedAfter!.end).week}).`:duration&&preview.restedAfter?'Bien reposé restera actif au réveil, sans renouvellement.':'Pas de nouveau bonus Bien reposé : choisissez au moins 10 h et ramenez la fatigue à zéro au réveil.')
    text('[data-sleep-mood]',`Humeur : +${duration?preview.moodGain:0} · ${preview.moodBefore} → ${duration?preview.moodAfter:preview.moodBefore} / 140`)
    for(const preset of dialog.querySelectorAll<HTMLButtonElement>('[data-sleep-minutes]'))preset.setAttribute('aria-pressed',String(Number(preset.dataset.sleepMinutes)===duration))
    confirm.disabled=!duration||!allowed()||transitioning
  }
  function close(){if(transitioning)return;dialog.close();options.back()}
  slider.oninput=render
  dialog.querySelector('.wait-presets')!.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-sleep-minutes]');if(b&&!transitioning){slider.value=b.dataset.sleepMinutes!;render()}})
  for(const selector of ['[data-sleep-close]','[data-sleep-cancel]'])dialog.querySelector(selector)!.addEventListener('click',close)
  dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
  dialog.addEventListener('close',()=>{if(dialog.open)return;if(pending)cancelSleeping(pending.id);pending=null})
  confirm.onclick=async()=>{
    if(transitioning||confirm.disabled||!pending||!dialog.open||!allowed())return
    transitioning=true;const id=pending.id
    for(const node of dialog.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button,input'))node.disabled=true
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,pause=(ms:number)=>new Promise(r=>setTimeout(r,ms))
    try{
      if(!reduced){mask.hidden=false;mask.classList.add('wait-visible');dialog.classList.add('wait-leaving');await pause(140)}
      const outcome=confirmSleeping(id,{zone:options.currentZone(),travelling:options.travelling(),allowed:dialog.open&&allowed()})
      if(!outcome.ok){transitioning=false;render();error.hidden=false;error.textContent=outcome.reason;return}
      pending=null;dialog.close()
      if(!reduced){mask.classList.remove('wait-visible');await pause(140)}
      toast.textContent=`Réveil ${outcome.to.day} à ${outcome.to.time} · semaine ${outcome.to.week} · +${outcome.energyGain} énergie · +${outcome.moodGain} humeur · ${outcome.bed.name}${outcome.restedEligible?' · Bien reposé : +10 max pendant 6 h':''}`
      toast.hidden=false;clearTimeout(timer);timer=setTimeout(()=>{toast.hidden=true},6500)
    }finally{
      transitioning=false;mask.hidden=true;mask.classList.remove('wait-visible');dialog.classList.remove('wait-leaving')
      for(const node of dialog.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button,input'))node.disabled=false
      confirm.disabled=!pending||!allowed()
    }
  }
  onPlayerResourcesChange(()=>{if(dialog.open&&!transitioning)render()})
  onComfortChange(()=>{if(dialog.open&&!transitioning)render()})
  onGameTimeChange(()=>{if(dialog.open&&!transitioning)render()})
  return {open(){if(!allowed()||transitioning||dialog.open)return;toast.hidden=true;slider.value='480';render();dialog.showModal();slider.focus()},snapshot:()=>({mode:transitioning?'transition':dialog.open?'preview':'closed',preview:dialog.open?pending:null})}
}
