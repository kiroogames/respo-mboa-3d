/*
 * Écran titre : continuer la partie enregistrée ou en commencer une nouvelle.
 * Les modules lisent leur sauvegarde au chargement : une nouvelle partie efface les clés « mboa- » puis recharge la page.
 */

import { getGameTime } from './game-clock'

const progressKeys = ['mboa-game-minutes-v1', 'mboa-money-v1']
// Préférences d'affichage conservées d'une partie à l'autre.
const keptKeys = new Set(['mboa-daylight-v1'])
const skipFlag = 'mboa-skip-start'

function hasSave() {
  try { return progressKeys.some(key => localStorage.getItem(key) !== null) } catch { return false }
}

function startNewGame() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('mboa-') && !keptKeys.has(key)) localStorage.removeItem(key)
    sessionStorage.setItem(skipFlag, '1')
  } catch { /* Sans stockage, chaque chargement est déjà une nouvelle partie. */ }
  location.reload()
}

export function mountStartMenu(base: string) {
  const screen = document.createElement('div')
  screen.className = 'start-menu'
  screen.setAttribute('role', 'dialog')
  screen.setAttribute('aria-modal', 'true')
  screen.setAttribute('aria-labelledby', 'start-title')
  screen.innerHTML = `<div class="start-card">
    <img class="start-portrait" src="${base}portraits/respo.png" alt=""/>
    <span class="start-eyebrow">LE RESPONSABLE</span>
    <h1 id="start-title">MBOA</h1>
    <p class="start-tagline">Votre quotidien au cœur de Mboa Ville.</p>
    <div class="start-actions">
      <button type="button" class="start-continue" data-start-continue><b>Continuer</b><small data-start-save></small></button>
      <button type="button" class="start-new" data-start-new><b>Nouvelle partie</b><small>Commencer lundi à 08:00, semaine 1</small></button>
    </div>
    <div class="start-confirm" data-start-confirm hidden>
      <p><b>Effacer la partie en cours ?</b> Argent, temps, missions, relations et équipements repartiront de zéro. Cette action est définitive.</p>
      <div><button type="button" data-start-cancel>Garder ma partie</button><button type="button" class="start-danger" data-start-erase>Effacer et recommencer</button></div>
    </div>
  </div>`
  document.body.append(screen)
  const continueButton = screen.querySelector<HTMLButtonElement>('[data-start-continue]')!
  const confirm = screen.querySelector<HTMLElement>('[data-start-confirm]')!
  const actions = screen.querySelector<HTMLElement>('.start-actions')!

  function show() {
    const saved = hasSave()
    continueButton.hidden = !saved
    if (saved) { const time = getGameTime(); screen.querySelector('[data-start-save]')!.textContent = `${time.day} ${time.time} · semaine ${time.week}` }
    confirm.hidden = true; actions.hidden = false; screen.hidden = false
    ;(saved ? continueButton : screen.querySelector<HTMLButtonElement>('[data-start-new]')!).focus()
  }
  const hide = () => { screen.hidden = true }

  continueButton.onclick = hide
  screen.querySelector<HTMLButtonElement>('[data-start-new]')!.onclick = () => {
    if (!hasSave()) { hide(); return } // Rien à effacer : la partie neuve est déjà chargée.
    actions.hidden = true; confirm.hidden = false
    screen.querySelector<HTMLButtonElement>('[data-start-cancel]')!.focus()
  }
  screen.querySelector<HTMLButtonElement>('[data-start-cancel]')!.onclick = show
  screen.querySelector<HTMLButtonElement>('[data-start-erase]')!.onclick = startNewGame
  screen.addEventListener('keydown', event => { if (event.key === 'Escape' && !confirm.hidden) { event.stopPropagation(); show() } })

  // Retour à l'écran titre depuis le menu du jeu.
  const entry = document.createElement('button')
  entry.type = 'button'; entry.id = 'start-menu-open'; entry.textContent = '⌂ Écran titre'
  entry.onclick = show
  document.querySelector('.header-actions')?.append(entry)

  let skip = false
  try { skip = sessionStorage.getItem(skipFlag) === '1'; sessionStorage.removeItem(skipFlag) } catch { /* Afficher l'écran titre. */ }
  if (skip) hide(); else show()
}
