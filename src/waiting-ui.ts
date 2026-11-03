import { loc, gameLocale } from './i18n'
import { onPlayerResourcesChange } from './player-resources'
/* Attente en exploration : aperçu sans effet, confirmation unique et transition visuelle courte. */
import './waiting.css'
import { prepareWaiting, confirmWaiting, cancelWaiting, getContinuousWaiting, waitingRules } from './waiting'
import type { WaitingPreview } from './waiting'
import { onGameTimeChange } from './game-clock'

export function mountWaiting(options: { button: HTMLButtonElement; canWait: () => boolean }) {
  const dialog = document.createElement('dialog'); dialog.className = 'travel-dialog wait-dialog'; dialog.setAttribute('aria-labelledby', 'wait-heading')
  dialog.innerHTML = `<button class="travel-close" data-wait-close aria-label="${loc('Fermer l’attente')}">×</button><span class="travel-eyebrow">${loc('LE TEMPS AU MBOA')}</span><h2 id="wait-heading">${loc('Attendre un moment')}</h2><p class="wait-intro">${loc('Laissez les habitants poursuivre leur journée.')}</p>
    <div class="wait-dates"><div><span>${loc('Maintenant')}</span><strong data-wait-from></strong><small data-wait-from-day></small></div><span class="wait-arrow" aria-hidden="true">→</span><div><span>${loc('Après l’attente')}</span><strong data-wait-to></strong><small data-wait-to-day></small></div></div>
    <label class="wait-duration" for="wait-duration">${loc('Durée choisie')} <output data-wait-duration for="wait-duration">1 h</output></label><input id="wait-duration" type="range" min="${waitingRules.minimumMinutes}" max="${waitingRules.maximumMinutes}" step="${waitingRules.stepMinutes}" value="60"><div class="wait-limits"><span>10 min</span><span>6 h</span></div>
    <div class="wait-presets" aria-label="${loc('Durées d’attente rapides')}">${[10, 30, 60, 180, 360].map(minutes => `<button type="button" data-wait-minutes="${minutes}">${minutes < 60 ? loc('{0} min',minutes) : `${minutes / 60} h`}</button>`).join('')}</div>
    <div class="wait-mood"><div><b data-wait-mood-title>${loc('Humeur inchangée')}</b><strong data-wait-mood-change>0</strong></div><p data-wait-mood-preview></p><small data-wait-continuous></small></div>
    <p class="wait-rules">${loc('Après 3 h d’attente continue : −5 humeur par heure supplémentaire commencée. Plusieurs attentes successives se cumulent.')}</p><p class="wait-neutral">${loc('Attendre ne recharge pas l’énergie et augmente la fatigue. Les excédents peuvent être plafonnés.')}</p><p class="wait-error" data-wait-error role="alert" hidden></p>
    <div class="wait-actions"><button type="button" data-wait-cancel>${loc('Annuler')}</button><button type="button" data-wait-confirm>${loc('Confirmer l’attente')}</button></div>`
  const mask = document.createElement('div'); mask.className = 'wait-transition'; mask.hidden = true; mask.setAttribute('aria-hidden', 'true')
  const toast = document.createElement('div'); toast.className = 'wait-result'; toast.hidden = true; toast.setAttribute('role', 'status')
  document.body.append(dialog, mask, toast)
  const slider = dialog.querySelector<HTMLInputElement>('#wait-duration')!, confirm = dialog.querySelector<HTMLButtonElement>('[data-wait-confirm]')!
  const error = dialog.querySelector<HTMLElement>('[data-wait-error]')!
  let pending: (WaitingPreview & { id: number }) | null = null, transitioning = false
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  const durationText = (minutes: number) => minutes < 60 ? loc('{0} min',minutes) : `${Math.floor(minutes / 60)} h${minutes % 60 ? loc(' {0} min',minutes % 60) : ''}`
  const format = (value: number) => value.toLocaleString(gameLocale, { maximumFractionDigits: 1 })
  const otherDialog = () => [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].some(open => open !== dialog)
  const allowedNow = () => options.canWait() && !otherDialog()
  function updateAvailability() { options.button.disabled = transitioning || dialog.open || !allowedNow() }
  function render() {
    try {
      pending = prepareWaiting(Number(slider.value))
    dialog.querySelector('.wait-neutral')!.textContent=loc('Énergie : {0} → {1} / {2}. Attendre augmente la fatigue, sans recharger l’énergie.',pending.energyBefore,pending.energyProjection.energyAfter,pending.energyProjection.maxEnergyAfter)
      const preview = pending
      dialog.querySelector('[data-wait-from]')!.textContent = preview.from.time; dialog.querySelector('[data-wait-to]')!.textContent = preview.to.time
      dialog.querySelector('[data-wait-from-day]')!.textContent = loc('{0} · semaine {1}',preview.from.day,preview.from.week)
      dialog.querySelector('[data-wait-to-day]')!.textContent = loc('{0} · semaine {1}',preview.to.day,preview.to.week)
      dialog.querySelector('[data-wait-duration]')!.textContent = durationText(preview.duration)
      slider.setAttribute('aria-valuetext', durationText(preview.duration))
      dialog.querySelector('[data-wait-mood-title]')!.textContent = preview.moodLoss ? loc('Ennui pendant l’attente') : preview.penalty ? loc('Humeur affichée inchangée') : loc('Humeur inchangée')
      dialog.querySelector('[data-wait-mood-change]')!.textContent = preview.moodLoss ? `−${format(preview.moodLoss)}` : '0'
      dialog.querySelector<HTMLElement>('.wait-mood')!.dataset.loss = String(preview.moodLoss > 0)
      dialog.querySelector('[data-wait-mood-preview]')!.textContent = `${format(preview.moodBefore)} → ${format(preview.moodAfter)} / 140`
      dialog.querySelector('[data-wait-continuous]')!.textContent = loc('Attente continue après confirmation : {0}',durationText(preview.continuousAfter))
      for (const preset of dialog.querySelectorAll<HTMLButtonElement>('[data-wait-minutes]')) preset.setAttribute('aria-pressed', String(Number(preset.dataset.waitMinutes) === preview.duration))
      confirm.disabled = transitioning || !allowedNow(); error.hidden = true
    } catch (failure) { pending = null; confirm.disabled = true; error.hidden = false; error.textContent = failure instanceof Error ? failure.message : loc('Cette attente n’est pas disponible.') }
  }
  function close() { if (!transitioning) dialog.close() }
  options.button.addEventListener('click', () => {
    if (transitioning || !allowedNow() || dialog.open) return
    toast.hidden = true; render(); dialog.showModal(); updateAvailability(); slider.focus({ preventScroll: true })
  })
  slider.addEventListener('input', render)
  dialog.querySelector('.wait-presets')!.addEventListener('click', event => {
    const preset = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-wait-minutes]')
    if (preset && !transitioning) { slider.value = preset.dataset.waitMinutes!; render() }
  })
  for (const selector of ['[data-wait-close]', '[data-wait-cancel]']) dialog.querySelector(selector)!.addEventListener('click', close)
  dialog.addEventListener('cancel', event => { if (transitioning) event.preventDefault() })
  dialog.addEventListener('close', () => {
    // L’événement natif est différé : une réouverture rapide possède déjà son propre aperçu.
    if (dialog.open) return
    if (pending) cancelWaiting(pending.id)
    pending = null; updateAvailability()
    if (!options.button.disabled && document.activeElement === document.body) options.button.focus({ preventScroll: true })
  })
  confirm.addEventListener('click', async () => {
    if (transitioning || confirm.disabled || !pending || !dialog.open) return
    transitioning = true; const id = pending.id
    for (const control of dialog.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input')) control.disabled = true
    updateAvailability()
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    try {
      if (!reduced) { mask.hidden = false; mask.classList.add('wait-visible'); dialog.classList.add('wait-leaving'); await pause(140) }
      const outcome = confirmWaiting(id, dialog.open && allowedNow())
      if (!outcome.ok) {
        transitioning = false; dialog.classList.remove('wait-leaving'); render(); error.hidden = false; error.textContent = outcome.reason
        return
      }
      pending = null; dialog.close()
      if (!reduced) { mask.classList.remove('wait-visible'); await pause(140) }
      toast.textContent = loc('{0} d’attente · {1} {2} · semaine {3}{4}',durationText(outcome.duration),outcome.to.day,outcome.to.time,outcome.to.week,outcome.moodLoss ? loc(' · −{0} humeur',format(outcome.moodLoss)) : loc(' · humeur inchangée'))
      toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true }, 6500)
    } finally {
      transitioning = false; mask.hidden = true; mask.classList.remove('wait-visible'); dialog.classList.remove('wait-leaving')
      for (const control of dialog.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input')) control.disabled = false
      confirm.disabled = !pending || !allowedNow()
      updateAvailability()
      if (!dialog.open && !options.button.disabled) options.button.focus({ preventScroll: true })
    }
  })
  onPlayerResourcesChange(()=>{if(dialog.open&&!transitioning)render()})
  onGameTimeChange(() => { if (dialog.open && !transitioning) render() })
  // Les fenêtres natives signalent leur ouverture ; on ne surveille pas les GPS animés à chaque image.
  const observer = new MutationObserver(updateAvailability)
  observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['open', 'data-ready'] })
  for (const element of document.querySelectorAll('#dialogue,#reference')) observer.observe(element, { attributes: true, attributeFilter: ['hidden'] })
  updateAvailability()
  return { snapshot: () => ({ mode: transitioning ? 'transition' : dialog.open ? 'preview' : 'closed', continuousMinutes: getContinuousWaiting(), preview: dialog.open ? pending : null, available: !options.button.disabled }) }
}
