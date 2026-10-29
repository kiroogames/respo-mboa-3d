/* Repas du jour dans le HUD (matin, midi, soir) et bandeau d'alerte dans les fenêtres quand un repas a été sauté. */
import { getHunger, onHungerChange } from './hunger'
import { onGameTimeChange } from './game-clock'
import './hunger.css'

export function mountHungerUI() {
  const energyTile = document.querySelector<HTMLElement>('#energy-counter')
  const tracker = document.createElement('div')
  tracker.className = 'meal-tracker'; tracker.setAttribute('role', 'group'); tracker.setAttribute('aria-label', 'Repas du jour')
  energyTile?.querySelector('.game-wallet-details')?.append(tracker)
  const toast = document.createElement('div')
  toast.className = 'hunger-toast'; toast.setAttribute('role', 'status'); toast.hidden = true
  document.body.append(toast)
  let toastTimer = 0

  function render() {
    const hunger = getHunger()
    tracker.innerHTML = hunger.today.map(slot => {
      const state = slot.eaten ? 'eaten' : slot.current ? 'now' : slot.passed ? 'missed' : 'later'
      const title = `${slot.label} : ${slot.eaten ? 'repas pris' : slot.current ? 'c’est l’heure de manger' : slot.passed ? 'repas sauté' : 'plus tard'}`
      return `<span class="meal-slot" data-state="${state}" title="${title}" aria-label="${title}">${slot.icon}</span>`
    }).join('') + (hunger.missed ? `<span class="meal-warning">+${Math.round(hunger.surcharge * 100)} % ⚡</span>` : '')
    energyTile?.setAttribute('data-hungry', String(hunger.missed > 0))
    // Bandeau dans chaque fenêtre ouverte : le coût affiché des activités ne tient pas encore compte de la faim.
    for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog.travel-dialog')) {
      let banner = dialog.querySelector<HTMLElement>(':scope > .popup-head .hunger-banner')
      if (!hunger.missed) { banner?.remove(); continue }
      if (!banner) { banner = document.createElement('p'); banner.className = 'hunger-banner'; dialog.querySelector(':scope > .popup-head')?.append(banner) }
      banner.textContent = `🍽️ ${hunger.label}. Mangez pour retrouver vos forces.`
    }
  }
  function warn(missedNow: number) {
    render()
    if (!missedNow) return
    toast.textContent = `🍽️ Repas sauté : −${5 * missedNow} humeur, et chaque activité coûte plus d’énergie jusqu’au prochain repas.`
    toast.hidden = false; clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { toast.hidden = true }, 6000)
  }
  onHungerChange(warn); onGameTimeChange(() => queueMicrotask(render))
  new MutationObserver(render).observe(document.body, { childList: true })
  document.addEventListener('toggle', render, true)
  render()
}
