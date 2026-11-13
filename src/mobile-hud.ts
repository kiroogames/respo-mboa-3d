/*
 * Organisation « jeu mobile » (demande du 13 novembre 2026, guide Clash Royale / Brawl Stars) :
 * - sur mobile, barre d'onglets en bas (Missions, Lieux, Filtrer, Vue, Menu) qui remplace la pile
 *   filtres + « Vous regardez » + outils, et barre de ressources compacte en haut (mobile-hud.css).
 * Ce module ne fait que relayer des clics vers les boutons existants : aucune règle de jeu ici.
 */
import { loc } from './i18n.ts'

type Panel = 'places' | 'filter' | 'view'

export function mountMobileHud(base: string) {
  const app = document.querySelector<HTMLElement>('#app')!
  const click = (selector: string) => document.querySelector<HTMLButtonElement>(selector)?.click()

  // ---------- Onglets du bas (affichés sur mobile seulement, voir la feuille) ----------
  const tabs = document.createElement('nav')
  tabs.className = 'mobile-tabs'; tabs.setAttribute('aria-label', loc('Navigation'))
  const tab = (id: string, icon: string, label: string) => `<button type="button" data-tab="${id}"><span class="mobile-tab-icon" aria-hidden="true">${icon}</span><span class="mobile-tab-label">${label}</span></button>`
  tabs.innerHTML = [
    tab('missions', `<img src="${base}ui/kit/icon-dossier.png" alt=""/>`, loc('Missions')),
    tab('places', `<img src="${base}ui/gps-pin.png" alt=""/>`, loc('Lieux')),
    tab('filter', '🔍', loc('Filtrer')),
    tab('view', '🎥', loc('Vue')),
    tab('menu', '☰', loc('Menu')),
  ].join('')
  app.append(tabs)

  let open: Panel | null = null
  const setPanel = (panel: Panel | null) => {
    open = panel
    app.dataset.mobilePanel = panel ?? ''
    for (const button of tabs.querySelectorAll<HTMLButtonElement>('[data-tab]')) button.setAttribute('aria-pressed', String(button.dataset.tab === panel))
    // La liste des lieux s'ouvre directement avec l'onglet, et se referme avec lui.
    const toggle = document.querySelector<HTMLButtonElement>('#places-toggle')
    const listOpen = toggle?.getAttribute('aria-expanded') === 'true'
    if ((panel === 'places') !== listOpen) toggle?.click()
  }
  // Le menu se ferme lui-même au premier appui ailleurs : on note son état avant cet appui.
  let menuWasOpen = false
  tabs.addEventListener('pointerdown', () => { menuWasOpen = document.querySelector('#ui-menu-toggle')?.getAttribute('aria-expanded') === 'true' }, true)
  tabs.addEventListener('click', event => {
    const id = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tab]')?.dataset.tab
    if (!id) return
    if (id === 'missions') { setPanel(null); click('#missions-open') }
    else if (id === 'menu') { setPanel(null); if (!menuWasOpen) click('#ui-menu-toggle') }
    else setPanel(open === id ? null : id as Panel)
  })
  // Choisir un lieu, un filtre ou un réglage de vue referme le panneau.
  document.querySelector('#places-panel')?.addEventListener('click', event => { if ((event.target as HTMLElement).closest('button[data-view]')) setPanel(null) })
  document.querySelector('.map-filter')?.addEventListener('click', event => { if ((event.target as HTMLElement).closest('button')) setTimeout(() => setPanel(null), 150) })
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && open) setPanel(null) })

  // ---------- Horloge compacte : un appui ouvre « Attendre » ----------
  const clock = document.querySelector<HTMLElement>('.game-clock')
  clock?.addEventListener('click', event => {
    if (!matchMedia('(max-width:760px)').matches || (event.target as HTMLElement).closest('button')) return
    const wait = document.querySelector<HTMLButtonElement>('#wait-open')
    if (wait && !wait.disabled) wait.click()
  })
}
