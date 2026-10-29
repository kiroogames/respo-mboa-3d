import {presentGameMenu} from './menu-presentation'
import { onGameTimeChange } from './game-clock'
/* Charpente commune des fenêtres : en-tête fixe, contenu défilant, actions toujours visibles en bas. */

const headPart = '.travel-close, .travel-eyebrow, h2, .dossier-heading, .npc-conversation-header'
const titlePart = 'h2, .dossier-heading, .npc-conversation-header'
const footPart = '.travel-cancel, .mood-effects-back, [data-sport-back], [class$="-actions"]'
// Pictogramme d'en-tête : chaque fenêtre est reconnaissable d'un coup d'œil.
const icons: [string, string][] = [
  ['venue-dialog', '📍'], ['sleep-dialog', '🌙'], ['meal-dialog', '🍲'], ['user-queue-dialog', '🙋'], ['meeting-dialog', '💼'],
  ['extra-dialog', '📦'], ['canteen-dialog', '🍛'], ['missions-dialog', '📋'], ['toque-dialog', '💰'], ['comfort-dialog', '🛋️'],
  ['outings-dialog', '🎟️'], ['accompanied-dialog', '💞'], ['food-bag-dialog', '🎒'], ['sport-energy-dialog', '⚡'],
  ['wait-dialog', '⏳'], ['bills-dialog', '🧾'], ['mood-effects-dialog', '🙂'],
]

function shapePopup(dialog: HTMLDialogElement) {
  if (dialog.dataset.popupShaped) return
  dialog.dataset.popupShaped = 'true'
  // Des div et non header/footer : le HUD stylise ces balises globalement.
  const head = document.createElement('div'), body = document.createElement('div'), foot = document.createElement('div')
  head.className = 'popup-head'; body.className = 'popup-body'; foot.className = 'popup-foot'
  const parts = [...dialog.children]
  let start = 0
  while (start < parts.length && parts[start]!.matches(headPart)) {
    head.append(parts[start]!)
    if (parts[start++]!.matches(titlePart)) break
  }
  const eyebrow = head.querySelector(':scope > .travel-eyebrow'), title = head.querySelector(':scope > h2')
  if (title) {
    const titles = document.createElement('div'); titles.className = 'popup-titles'
    title.before(titles); titles.append(...[eyebrow, title].filter(Boolean) as Element[])
    const icon = icons.find(([name]) => dialog.classList.contains(name))?.[1] ?? (dialog.classList.contains('work-classic-dialog')?'📋':dialog.classList.contains('citizen-puzzle-dialog')?'🙋':dialog.className.trim() === 'travel-dialog' ? '🧭' : '')
    if (icon) { const badge = document.createElement('span'); badge.className = 'popup-icon'; badge.setAttribute('aria-hidden', 'true'); badge.textContent = icon; titles.before(badge) }
  }
  let end = parts.length
  while (end > start && parts[end - 1]!.matches(footPart)) end--
  body.append(...parts.slice(start, end))
  foot.append(...parts.slice(end))
  dialog.append(head, body)
  if (foot.childElementCount) dialog.append(foot)
  const context=document.createElement('aside');context.className='menu-context';context.setAttribute('aria-hidden','true')
  const theme=dialog.classList.contains('sleep-dialog')?'Une pause pour mieux repartir.':dialog.classList.contains('bills-dialog')?'Gardez le cap sur votre budget.':dialog.classList.contains('venue-dialog')?'La ville a toujours quelque chose à offrir.':'Votre quotidien au cœur de Mboa.'
  context.innerHTML=`<span class="menu-brand">LE RESPONSABLE<br><b>MBOA</b></span><div class="menu-city-art"><i></i><i></i><i></i><i></i><i></i><span>✦</span></div><p>${theme}</p><small class="menu-context-clock"></small>`
  dialog.append(context)
  const stats=document.createElement('div');stats.className='popup-stats';stats.setAttribute('role','group');stats.setAttribute('aria-label','Vos ressources actuelles')
  // Logos à la place des noms des monnaies (texte conservé pour les lecteurs d'écran).
  const base=import.meta.env.BASE_URL
  stats.innerHTML=`<span><img class="currency-icon" src="${base}ui/currency-nkap.png" alt="Nkap"/><b data-popup-stat="money"></b></span><span><img class="currency-icon" src="${base}ui/currency-energy.png" alt="Énergie"/><b data-popup-stat="energy"></b></span><span><span class="currency-icon currency-icon-mood" role="img" aria-label="Humeur" style="background-image:url('${base}ui/mood-sprites.png')"></span><b data-popup-stat="mood"></b></span><span><img class="currency-icon" src="${base}ui/currency-respo.png" alt="Influence"/><b data-popup-stat="influence"></b></span>`
  head.append(stats)
  presentGameMenu(dialog)

  const syncContext=()=>{context.querySelector('.menu-context-clock')!.textContent=`${document.querySelector('#game-day')?.textContent??''} · ${document.querySelector('#game-time')?.textContent??''}`}
  new MutationObserver(syncContext).observe(dialog,{attributes:true,attributeFilter:['open']});syncContext()
  // L'heure du panneau suit le calendrier pendant que la fenêtre est ouverte (travail, repas, sommeil…).
  onGameTimeChange(()=>{if(dialog.open)queueMicrotask(syncContext)})

}

export function mountPopupShell() {
  const shapeAll = () => document.querySelectorAll<HTMLDialogElement>('dialog.travel-dialog').forEach(shapePopup)
  shapeAll()
  const syncStats=()=>{for(const [name,id] of Object.entries({money:'money-amount',energy:'energy-amount',mood:'mood-amount',influence:'influence-amount'})){const value=document.getElementById(id)?.textContent??'—';document.querySelectorAll(`[data-popup-stat="${name}"]`).forEach(node=>{if(node.textContent!==value)node.textContent=value})}}
  const observer=new MutationObserver(syncStats)
  for(const id of ['money-amount','energy-amount','mood-amount','influence-amount']){const node=document.getElementById(id);if(node)observer.observe(node,{childList:true,characterData:true,subtree:true})}
  syncStats()
  new MutationObserver(()=>{shapeAll();syncStats()}).observe(document.body, { childList: true })
}

export function popupScroller(dialog: HTMLDialogElement) {
  return dialog.querySelector<HTMLElement>(':scope > .popup-body') ?? dialog
}
