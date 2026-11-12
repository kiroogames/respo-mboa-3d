/* Repas du jour dans le HUD (matin, midi, soir) et bandeau d'alerte dans les fenêtres quand un repas a été sauté. */
import { loc } from './i18n.ts'
import { getHunger, onHungerChange } from './hunger'
import { onGameTimeChange } from './game-clock'
import './hunger.css'

export function mountHungerUI() {
  const energyTile = document.querySelector<HTMLElement>('#energy-counter')
  const tracker = document.createElement('div')
  tracker.className = 'meal-tracker'; tracker.setAttribute('role', 'group'); tracker.setAttribute('aria-label', loc('Repas du jour'))
  energyTile?.querySelector('.game-wallet-details')?.append(tracker)
  const toast = document.createElement('div')
  toast.className = 'hunger-toast'; toast.setAttribute('role', 'status'); toast.hidden = true
  document.body.append(toast)


  function render() {
    const hunger = getHunger()
    tracker.innerHTML = hunger.today.map(slot => {
      const state = slot.eaten ? 'eaten' : slot.current ? 'now' : slot.passed ? 'missed' : 'later'
      const title = `${slot.label} : ${slot.eaten ? loc('repas pris') : slot.current ? loc('c’est l’heure de manger') : slot.passed ? loc('repas sauté') : loc('plus tard')}`
      return `<span class="meal-slot" data-state="${state}" title="${title}" aria-label="${title}">${slot.icon}</span>`
    }).join('') + ''
    energyTile?.setAttribute('data-hungry', String(hunger.missed > 0))
    // Plus de bandeau « repas sauté » : sauter un repas ne punit plus (décision du 12 novembre 2026).
    for (const banner of document.querySelectorAll('dialog.travel-dialog .hunger-banner')) banner.remove()
  }
  function warn(missedNow: number) {
    render()
    // Plus d’avertissement : sauter un repas ne coûte rien.
    void missedNow
  }
  onHungerChange(warn); onGameTimeChange(() => queueMicrotask(render))
  new MutationObserver(render).observe(document.body, { childList: true })
  document.addEventListener('toggle', render, true)
  render()
}
