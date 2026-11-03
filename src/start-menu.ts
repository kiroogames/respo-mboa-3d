/*
 * Écran titre : continuer la partie enregistrée ou en commencer une nouvelle.
 * Les modules lisent leur sauvegarde au chargement : une nouvelle partie efface les clés « mboa- » puis recharge la page.
 */

import { getLanguage, hasChosenLanguage, loc, saveLanguage, type Language } from './i18n'
import { getGameTime } from './game-clock'

const progressKeys = ['mboa-game-minutes-v1', 'mboa-money-v1']
// Préférences d'affichage conservées d'une partie à l'autre.
const keptKeys = new Set(['mboa-daylight-v1', 'mboa-language-v1'])
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

export function mountStartMenu(base: string, isBusy: () => boolean = () => false) {
  const screen = document.createElement('div')
  screen.className = 'start-menu'
  screen.setAttribute('role', 'dialog')
  screen.setAttribute('aria-modal', 'true')
  screen.setAttribute('aria-labelledby', 'start-title')
  screen.innerHTML = `<div class="start-card">
    <img class="start-portrait" src="${base}portraits/respo.png" alt=""/>
    <span class="start-eyebrow">LE RESPONSABLE</span>
    <h1 id="start-title">MBOA</h1>
    <p class="start-tagline">${loc('Votre quotidien au cœur de Mboa Ville.')}</p>
    <div class="start-language" data-start-language hidden>
      <p>Choisissez votre langue · Choose your language</p>
      <div><button type="button" data-language="fr">Français</button><button type="button" data-language="en">English</button></div>
    </div>
    <div class="start-language-switch" data-start-language-switch role="group" aria-label="Langue · Language"><button type="button" data-language="fr">FR</button><button type="button" data-language="en">EN</button></div>
    <div class="start-actions">
      <button type="button" class="start-continue" data-start-continue><b>${loc('Continuer')}</b><small data-start-save></small></button>
      <button type="button" class="start-new" data-start-new><b>${loc('Nouvelle partie')}</b><small>${loc('Commencer lundi à 08:00, semaine 1')}</small></button>
    </div>
    <div class="start-confirm" data-start-confirm hidden>
      <p><b>${loc('Effacer la partie en cours ?')}</b> ${loc('Argent, temps, missions, relations et équipements repartiront de zéro. Cette action est définitive.')}</p>
      <div><button type="button" data-start-cancel>${loc('Garder ma partie')}</button><button type="button" class="start-danger" data-start-erase>${loc('Effacer et recommencer')}</button></div>
    </div>
  </div>`
  document.body.append(screen)
  const continueButton = screen.querySelector<HTMLButtonElement>('[data-start-continue]')!
  const confirm = screen.querySelector<HTMLElement>('[data-start-confirm]')!
  const actions = screen.querySelector<HTMLElement>('.start-actions')!

  function show() {
    const saved = hasSave()
    continueButton.hidden = !saved
    if (saved) { const time = getGameTime(); screen.querySelector('[data-start-save]')!.textContent = loc('{0} {1} · semaine {2}',time.day,time.time,time.week) }
    confirm.hidden = true; actions.hidden = !languagePicker.hidden; screen.hidden = false
    if (!languagePicker.hidden) { languagePicker.querySelector<HTMLButtonElement>(navigator.language.toLowerCase().startsWith('fr') ? '[data-language="fr"]' : '[data-language="en"]')!.focus(); return }
    ;(saved ? continueButton : screen.querySelector<HTMLButtonElement>('[data-start-new]')!).focus()
  }
  const hide = () => { screen.hidden = true }

  // Changer de langue recharge la page : tous les textes sont lus au chargement, et la sauvegarde reste intacte.
  const languagePicker = screen.querySelector<HTMLElement>('[data-start-language]')!
  function pickLanguage(next: Language) {
    const changed = next !== getLanguage() || !hasChosenLanguage()
    saveLanguage(next)
    if (next !== getLanguage()) { location.reload(); return }
    if (changed) { languagePicker.hidden = true; screen.querySelector<HTMLElement>('[data-start-language-switch]')!.hidden = false; show() }
  }
  for (const button of screen.querySelectorAll<HTMLButtonElement>('[data-language]')) {
    button.setAttribute('aria-pressed', String(button.dataset.language === getLanguage()))
    button.onclick = () => pickLanguage(button.dataset.language as Language)
  }

  continueButton.onclick = hide
  screen.querySelector<HTMLButtonElement>('[data-start-new]')!.onclick = () => {
    if (!hasSave()) { hide(); return } // Rien à effacer : la partie neuve est déjà chargée.
    actions.hidden = true; confirm.hidden = false
    screen.querySelector<HTMLButtonElement>('[data-start-cancel]')!.focus()
  }
  screen.querySelector<HTMLButtonElement>('[data-start-cancel]')!.onclick = show
  screen.querySelector<HTMLButtonElement>('[data-start-erase]')!.onclick = startNewGame
  screen.addEventListener('keydown', event => { if (event.key === 'Escape' && !confirm.hidden) { event.stopPropagation(); show() } })

  // Premier lancement : la langue se choisit avant tout le reste.
  if (!hasChosenLanguage()) { languagePicker.hidden = false; screen.querySelector<HTMLElement>('[data-start-language-switch]')!.hidden = true }

  // Retour à l'écran titre depuis le menu du jeu.
  const entry = document.createElement('button')
  entry.type = 'button'; entry.id = 'start-menu-open'; entry.textContent = loc('⌂ Écran titre')
  entry.onclick = show
  document.querySelector('.header-actions')?.append(entry)

  // Changer de langue en jeu : la partie reprend aussitôt, là où elle en était.
  const switchLanguage = document.createElement('button')
  switchLanguage.type = 'button'; switchLanguage.id = 'language-toggle'
  switchLanguage.textContent = getLanguage() === 'en' ? '🌐 Français' : '🌐 English'
  switchLanguage.onclick = () => {
    if (isBusy()) return
    saveLanguage(getLanguage() === 'en' ? 'fr' : 'en')
    try { sessionStorage.setItem(skipFlag, '1') } catch { /* L'écran titre s'affichera. */ }
    location.reload()
  }
  document.querySelector('.header-actions')?.append(switchLanguage)

  let skip = false
  try { skip = sessionStorage.getItem(skipFlag) === '1'; sessionStorage.removeItem(skipFlag) } catch { /* Afficher l'écran titre. */ }
  if (skip) hide(); else show()
}
