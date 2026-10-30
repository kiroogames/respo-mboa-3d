/*
 * Gains visibles : quand une monnaie augmente, ses logos s'envolent depuis l'endroit de l'action
 * (dernier clic ou élément actif) jusqu'à sa case dans le bandeau du haut, qui rebondit à l'arrivée.
 * Le calque est un popover : il passe au-dessus des fenêtres ouvertes (couche supérieure du navigateur).
 */
import './currency-fly.css'
import { playSound } from './game-feedback'

type Unit = 'money' | 'energy' | 'mood' | 'influence'
const sources: Record<Unit, { amount: string; tile: string }> = {
  money: { amount: '#money-amount', tile: '.game-wallet:has(#money-amount)' },
  influence: { amount: '#influence-amount', tile: '#influence-counter' },
  energy: { amount: '#energy-amount', tile: '#energy-counter' },
  mood: { amount: '#mood-amount', tile: '#mood-counter' },
}
// Premier nombre affiché (« 75 / 100 » → 75, « 1 500 » → 1500).
const read = (text: string | null | undefined) => Number((text ?? '').split('/')[0]!.replace(/[^\d-]/g, '')) || 0

export function mountCurrencyFly(base: string) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const layer = document.createElement('div')
  layer.className = 'currency-fly-layer'; layer.setAttribute('popover', 'manual'); layer.setAttribute('aria-hidden', 'true')
  document.body.append(layer)
  let lastPoint = { x: innerWidth / 2, y: innerHeight / 2, at: 0 }
  document.addEventListener('pointerdown', event => { lastPoint = { x: event.clientX, y: event.clientY, at: performance.now() } }, true)
  // Point de départ : le dernier clic s'il est récent, sinon l'élément actif (clavier), sinon le centre.
  function origin() {
    if (performance.now() - lastPoint.at < 4000) return lastPoint
    const active = document.activeElement as HTMLElement | null
    if (active && active !== document.body) { const r = active.getBoundingClientRect(); if (r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2, at: 0 } }
    return { x: innerWidth / 2, y: innerHeight * .55, at: 0 }
  }
  function icon(unit: Unit) {
    if (unit === 'mood') {
      const face = document.createElement('span'); face.className = 'currency-fly-icon is-mood'
      face.style.backgroundImage = `url('${base}ui/mood-sprites.png')`; return face
    }
    const img = document.createElement('img'); img.className = 'currency-fly-icon'; img.alt = ''
    img.src = `${base}ui/${unit === 'money' ? 'currency-nkap' : unit === 'energy' ? 'currency-energy' : 'currency-respo'}.png`; return img
  }
  function showLayer() {
    // Rouvrir le popover le replace au sommet, au-dessus d'une fenêtre ouverte après lui.
    try { if (layer.matches(':popover-open')) layer.hidePopover(); layer.showPopover() } catch { /* Navigateur sans popover : calque ordinaire. */ }
  }
  let active = 0
  function tileOf(unit: Unit) {
    // Fenêtre ouverte : le bandeau du haut est caché derrière ; viser la ligne de ressources de la fenêtre.
    const stat = document.querySelector<HTMLElement>(`dialog[open] [data-popup-stat="${unit}"]`)?.parentElement
    return stat && stat.getBoundingClientRect().width ? stat : document.querySelector<HTMLElement>(sources[unit].tile)
  }
  // Dépense : pas d'envol, seulement le montant perdu qui descend sous la case et une case qui rougit.
  function lose(unit: Unit, delta: number) {
    const tile = tileOf(unit)
    if (!tile) return
    if (unit === 'money') playSound('loss')
    tile.classList.remove('hud-drop'); void tile.offsetWidth; tile.classList.add('hud-drop')
    if (reduced.matches) return
    const box = tile.getBoundingClientRect()
    showLayer(); active++
    const label = document.createElement('span'); label.className = `currency-fly-label is-${unit} is-loss`
    label.textContent = `−${delta.toLocaleString('fr-FR')}`; label.style.left = `${box.left + box.width / 2}px`; label.style.top = `${box.bottom + 6}px`
    label.prepend(icon(unit)); layer.append(label)
    const done = () => { label.remove(); if (--active === 0) try { layer.hidePopover() } catch { /* Sans popover. */ } }
    label.animate([{ opacity: 0, transform: 'translate(-50%,-40%) scale(.85)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1)', offset: .2 }, { opacity: 0, transform: 'translate(-50%,40px) scale(.95)' }], { duration: 1200, easing: 'ease-out' }).finished.then(done, done)
  }
  function fly(unit: Unit, delta: number) {
    const tile = tileOf(unit)
    if (!tile) return
    playSound(unit === 'money' ? 'coin' : 'gain')
    const bump = () => { tile.classList.remove('hud-bump'); void tile.offsetWidth; tile.classList.add('hud-bump') }
    if (reduced.matches) { bump(); return }
    const target = (tile.querySelector<HTMLElement>(':scope > img, :scope > .mood-icon, :scope > .currency-icon') ?? tile)
    const to = target.getBoundingClientRect().width ? target.getBoundingClientRect() : tile.getBoundingClientRect()
    const end = { x: to.left + to.width / 2, y: to.top + to.height / 2 }, start = origin()
    const count = Math.max(3, Math.min(9, Math.ceil(Math.log10(Math.abs(delta) + 1) * 3)))
    showLayer(); active++
    // Montant gagné qui s'élève au point de départ.
    const label = document.createElement('span'); label.className = `currency-fly-label is-${unit}`
    // Plusieurs gains au même moment : les montants s'empilent au lieu de se superposer.
    const stack = layer.querySelectorAll('.currency-fly-label').length
    label.textContent = `+${delta.toLocaleString('fr-FR')}`; label.style.left = `${start.x}px`; label.style.top = `${start.y - stack * 40}px`
    label.prepend(icon(unit)); layer.append(label)
    label.animate([{ opacity: 0, transform: 'translate(-50%,-30%) scale(.8)' }, { opacity: 1, transform: 'translate(-50%,-90%) scale(1)', offset: .25 }, { opacity: 0, transform: 'translate(-50%,-200%) scale(1)' }], { duration: 1300, easing: 'ease-out' }).finished.then(() => label.remove(), () => label.remove())
    let arrived = 0
    for (let i = 0; i < count; i++) {
      const coin = icon(unit); layer.append(coin)
      const spread = { x: (Math.random() - .5) * 70, y: (Math.random() - .5) * 40 }
      const peak = { x: (start.x + end.x) / 2 + (Math.random() - .5) * 120, y: Math.min(start.y, end.y) - 60 - Math.random() * 60 }
      const at = (p: { x: number; y: number }, s: number) => `translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${s})`
      coin.animate([
        { transform: at(start, .4), opacity: 0 },
        { transform: at({ x: start.x + spread.x, y: start.y + spread.y }, 1.1), opacity: 1, offset: .18 },
        { transform: at(peak, 1), opacity: 1, offset: .55 },
        { transform: at(end, .7), opacity: .9 },
      ], { duration: 900 + i * 40, delay: i * 70, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'backwards' }).finished.then(() => {
        coin.remove()
        // Chaque arrivée fait rebondir la case ; la dernière ferme le calque s'il n'y a plus rien en vol.
        bump()
        if (++arrived === count && --active === 0) try { layer.hidePopover() } catch { /* Sans popover. */ }
      }, () => coin.remove())
    }
  }
  // Observer les compteurs : une hausse déclenche l'envol, une baisse affiche la perte sous la case.
  for (const unit of Object.keys(sources) as Unit[]) {
    const element = document.querySelector<HTMLElement>(sources[unit].amount)
    if (!element) continue
    let previous = read(element.textContent), ready = false
    // Ignorer les valeurs posées au chargement de la partie.
    setTimeout(() => { previous = read(element.textContent); ready = true }, 1500)
    new MutationObserver(() => {
      const value = read(element.textContent)
      if (ready && value > previous) fly(unit, value - previous)
      // L'énergie a déjà sa pastille de variation (player-resources.ts).
      else if (ready && value < previous && unit !== 'energy') lose(unit, previous - value)
      previous = value
    }).observe(element, { childList: true, characterData: true, subtree: true })
  }
}
