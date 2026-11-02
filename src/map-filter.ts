/* Filtre de la carte : montre d'un coup d'œil où gagner de l'argent, où manger, et ce qui est ouvert à cette heure. */
import { getPlaceOffers } from './place-activities'
import type { PlaceOffer } from './place-activities'
import { onGameTimeChange } from './game-clock'
import { onPlayerResourcesChange } from './player-resources'
import './map-filter.css'

const key = 'mboa-map-filter-v1'
const choices: { id: PlaceOffer | ''; label: string; title: string }[] = [
  { id: '', label: 'Tout', title: 'Montrer tous les lieux' },
  { id: 'earn', label: '💵 Gagner', title: 'Lieux où gagner de l’argent maintenant' },
  { id: 'eat', label: '🍲 Manger', title: 'Lieux où manger maintenant' },
  { id: 'open', label: '🕒 Ouvert', title: 'Lieux où il y a quelque chose à faire maintenant' },
]

export function mountMapFilter() {
  const bar = document.createElement('div')
  bar.className = 'map-filter'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Filtrer les lieux de la carte')
  bar.innerHTML = choices.map(c => `<button type="button" data-filter="${c.id}" title="${c.title}">${c.label}</button>`).join('')
  document.querySelector('#app')!.append(bar)
  let filter: PlaceOffer | '' = ''
  try { const saved = localStorage.getItem(key); if (choices.some(c => c.id === saved)) filter = saved as PlaceOffer | '' } catch { /* Sans préférence, tout est montré. */ }
  function refresh() {
    for (const button of bar.querySelectorAll<HTMLButtonElement>('button')) button.setAttribute('aria-pressed', String(button.dataset.filter === filter))
    const root = document.querySelector<HTMLElement>('#landmarks')
    if (!root) return
    if (filter) root.dataset.filter = filter; else delete root.dataset.filter
    for (const label of root.querySelectorAll<HTMLElement>('.landmark[data-view]')) label.toggleAttribute('data-match', !!filter && getPlaceOffers(label.dataset.view!).includes(filter))
  }
  bar.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!button) return
    filter = button.dataset.filter as PlaceOffer | ''
    try { localStorage.setItem(key, filter) } catch { /* Choix valable pour cette session. */ }
    refresh()
  })
  onGameTimeChange(() => queueMicrotask(refresh)); onPlayerResourcesChange(refresh)
  const root = document.querySelector('#landmarks')
  if (root) new MutationObserver(records => { if (records.some(r => r.addedNodes.length)) refresh() }).observe(root, { childList: true })
  refresh()
}
