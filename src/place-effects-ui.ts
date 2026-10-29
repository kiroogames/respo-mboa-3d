/* Badges des lieux sur la carte : « + logos » pour ce qu'on peut y gagner, « − logos » pour ce qu'on peut y perdre, à l'heure actuelle. */
import { getPlaceEffects } from './place-activities'
import type { EffectUnit } from './place-activities'
import { onGameTimeChange } from './game-clock'
import { onPlayerResourcesChange } from './player-resources'
import { onMissionChange } from './pro-missions'
import './place-effects.css'

const names: Record<EffectUnit, string> = { nkap: 'Nkap', energy: 'énergie', mood: 'humeur', influence: 'influence' }

export function mountPlaceEffects(base: string) {
  const logo = (unit: EffectUnit) => unit === 'mood'
    ? `<span class="currency-icon currency-icon-mood" aria-hidden="true" style="background-image:url('${base}ui/mood-sprites.png')"></span>`
    : `<img class="currency-icon" src="${base}ui/${unit === 'nkap' ? 'currency-nkap' : unit === 'energy' ? 'currency-energy' : 'currency-respo'}.png" alt=""/>`
  function refresh() {
    for (const label of document.querySelectorAll<HTMLElement>('#landmarks .landmark[data-view]')) {
      const { gains, losses } = getPlaceEffects(label.dataset.view!)
      const key = `${gains.join(',')}|${losses.join(',')}`
      if (label.dataset.effects === key) continue
      // La clé sert aussi à remesurer l'étiquette (sa hauteur change) pour placer les têtes des PNJ au-dessus.
      label.dataset.effects = key
      let badges = label.querySelector<HTMLElement>(':scope > .landmark-effects')
      if (!gains.length && !losses.length) { badges?.remove(); label.classList.remove('has-effects'); continue }
      if (!badges) { badges = document.createElement('span'); badges.className = 'landmark-effects'; label.prepend(badges) }
      label.classList.add('has-effects')
      badges.innerHTML = (gains.length ? `<span class="effect-group is-gain">+${gains.map(logo).join('')}</span>` : '') + (losses.length ? `<span class="effect-group is-loss">−${losses.map(logo).join('')}</span>` : '')
      badges.title = [gains.length ? `À gagner ici : ${gains.map(u => names[u]).join(', ')}` : '', losses.length ? `À dépenser ici : ${losses.map(u => names[u]).join(', ')}` : ''].filter(Boolean).join(' · ')
      const place = label.querySelector('span:not(.landmark-effects):not(.effect-group)')?.textContent ?? ''
      label.setAttribute('aria-label', `${place}. ${badges.title}`)
    }
  }
  onGameTimeChange(() => queueMicrotask(refresh)); onPlayerResourcesChange(refresh); onMissionChange(refresh)
  const root = document.querySelector('#landmarks')
  if (root) new MutationObserver(refresh).observe(root, { childList: true })
  refresh()
}
