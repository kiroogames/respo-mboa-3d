/*
 * Guide du joueur : un panneau « À faire » toujours visible, qui dit quoi faire maintenant et où.
 * Lecture seule : il observe l'état du jeu et ne modifie aucune règle. Le premier jour, il enseigne
 * une chose à la fois, en jouant (une phrase courte par étape) ; ensuite il affiche les priorités du moment.
 */
import { loc, gameLocale } from './i18n.ts'
import { getGameTime, onGameTimeChange } from './game-clock.ts'
import { getHunger, onHungerChange } from './hunger.ts'
import { getFatigueAt } from './fatigue.ts'
import { getPlayerResources, onPlayerResourcesChange } from './player-resources.ts'
import { getRespoProgress } from './respo-level.ts'
import { getMoneyBalance, onMoneyBalanceChange } from './currency.ts'
import { getHouseBilling, onHouseBillChange } from './house-bills.ts'
import { getVenueServices, venueServiceReason } from './venue-services.ts'
import { kitHas, kitUrl, kitCount } from './ui-kit.ts'

// Icône peinte du kit pour chaque objectif ; l'émoji reste le repli.
const kitIcons: Record<string, string> = { broke: 'savings', eat: 'meal', hungry: 'meal', meal: 'meal', go: 'transport', work: 'dossier', sleep: 'sleep', tired: 'sleep', bills: 'bills', energy: 'energy', mood: 'mood', tontine: 'tontine', ceremony: 'ceremony', save: 'savings', level: 'level' }

// Besoins qui ne peuvent pas attendre la fin des premiers pas.
const urgentIds = new Set(['broke', 'bills', 'hungry', 'meal', 'tired', 'energy', 'mood'])
type Goal = { id: string; icon: string; title: string; hint: string; zone?: string; action?: string }
const key = 'mboa-guide-v1'
let step = 0, collapsed = false
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
  if (saved && Number.isSafeInteger(saved.step) && saved.step >= 0) { step = saved.step; collapsed = saved.collapsed === true }
} catch { /* Sans sauvegarde, le guide reprend au début. */ }
function save() { try { localStorage.setItem(key, JSON.stringify({ step, collapsed })) } catch { /* Guide conservé pendant la session. */ } }

// Premiers pas : chaque étape se valide en jouant, jamais par un bouton « suivant ».
function firstSteps(zone: string): (Goal & { done: boolean })[] {
  const time = getGameTime().totalMinutes, hunger = getHunger(), resources = getPlayerResources()
  const morning = hunger.today[0]!
  return [
    { id: 'eat', icon: '🍲', title: loc('Prends ton petit-déjeuner'), hint: loc('Maison › Manger à la maison'), zone: 'home', done: hunger.today.some(slot => slot.eaten) || morning.passed || time >= 1440 },
    { id: 'go', icon: '🚕', title: loc('Va au ministère'), hint: loc('Touche « Ministère » sur la carte, puis choisis un transport'), zone: 'ministry', done: zone === 'ministry' || resources.ptRespo > 0 },
    { id: 'work', icon: '📂', title: loc('Traite ton premier dossier'), hint: loc('Ministère › Traiter les dossiers ou Accueillir les usagers'), zone: 'ministry', done: resources.ptRespo > 0 },
    { id: 'sleep', icon: '🛏️', title: loc('Ce soir, rentre dormir'), hint: loc('Maison › Dormir · 8 h rechargent toute l’énergie'), zone: 'home', done: time >= 1440 },
  ]
}

// Priorités du moment, de la plus urgente à la moins urgente ; les trois premières sont affichées.
function priorities(): Goal[] {
  const goals: Goal[] = [], time = getGameTime().totalMinutes, hunger = getHunger(), resources = getPlayerResources()
  const bills = getHouseBilling(), fatigue = getFatigueAt(), progress = getRespoProgress(resources.ptRespo)
  const amount = (value: number) => value.toLocaleString(gameLocale)
  if (bills.unpaid > 0) goals.push({ id: 'bills', icon: '🧾', title: loc('Paie les factures : {0} Nkap',amount(bills.totalDue)), hint: getMoneyBalance() < bills.amount ? loc('Il te manque {0} Nkap : travaille d’abord',amount(bills.amount - getMoneyBalance())) : loc('Touche ici pour payer · en retard : −10 d’humeur par jour'), action: 'bills' })
  if (getMoneyBalance() < 150) goals.push({ id: 'broke', icon: '💸', title: loc('Plus d’argent'), hint: loc('Traite un dossier au ministère : +500 Nkap'), zone: 'ministry' })
  if (hunger.missed) goals.push({ id: 'hungry', icon: '🍲', title: loc('Mange vite'), hint: loc('Repas sauté : tes tâches coûtent plus d’énergie'), zone: 'home' })
  else if (hunger.today.some(slot => slot.current && !slot.eaten)) goals.push({ id: 'meal', icon: '🍲', title: loc('C’est l’heure de manger'), hint: loc('Maison, cantine, marché ou restaurant') })
  if (fatigue.penalty) goals.push({ id: 'tired', icon: '🛏️', title: loc('Tu es fatigué : va dormir'), hint: loc('Maison › Dormir'), zone: 'home' })
  if (resources.energy * 10 < resources.maxEnergy * 3) goals.push({ id: 'energy', icon: '⚡', title: loc('Énergie basse'), hint: loc('Mange ou repose-toi avant de travailler') })
  if (resources.mood < 60) goals.push({ id: 'mood', icon: '🙂', title: loc('Humeur basse : détends-toi'), hint: loc('Ludo au village, match au bar, cinéma… tes gains baissent de 15 %') })
  const open = (zone: string, special: string) => { const service = getVenueServices(zone).find(item => item.special === special); return !!service && !venueServiceReason(service) }
  if (open('palms', 'tontine')) goals.push({ id: 'tontine', icon: '🤝', title: loc('Réunion de la tontine'), hint: loc('Cité des palmiers · jusqu’à 18 h'), zone: 'palms' })
  if (open('village', 'ceremony')) goals.push({ id: 'ceremony', icon: '🎉', title: loc('Cérémonie au village'), hint: loc('Mboa village · jusqu’à 20 h'), zone: 'village' })
  const day = Math.floor(time / 1440) % 7, minute = time % 1440
  if (!bills.unpaid && bills.nextIssue && bills.nextIssue.totalMinutes - time <= 1440 && getMoneyBalance() < bills.amount) goals.push({ id: 'save', icon: '💰', title: loc('Prépare {0} Nkap pour vendredi',amount(bills.amount)), hint: loc('Les factures tombent vendredi à 12 h') })
  if (progress.nextThreshold !== null) goals.push({ id: 'level', icon: '⭐', title: loc('Niveau {0} : encore {1} Respo',progress.level + 1,amount(progress.remaining)), hint: day < 5 && minute >= 480 && minute < 1080 ? loc('Dossiers, usagers et réunions au ministère') : loc('Petits jobs en ville, ou repos jusqu’à demain'), zone: day < 5 && minute >= 480 && minute < 1080 ? 'ministry' : undefined })
  return goals.slice(0, 3)
}

export function mountGuide(options: { currentZone: () => string; goTo: (zone: string) => void; busy: () => boolean }) {
  const panel = document.createElement('aside'); panel.id = 'guide'; panel.setAttribute('aria-label', loc('À faire'))
  panel.innerHTML = `<button type="button" class="guide-head" aria-controls="guide-list"><b>${loc('À faire')}</b><span aria-hidden="true">▾</span></button><ol id="guide-list" class="guide-list"></ol>`
  document.querySelector('#app')!.append(panel)
  const head = panel.querySelector<HTMLButtonElement>('.guide-head')!, list = panel.querySelector<HTMLElement>('.guide-list')!
  // Une partie déjà entamée n'a pas besoin des premiers pas.
  if (step === 0 && (getPlayerResources().ptRespo > 0 || getGameTime().totalMinutes >= 1440)) { step = 99; save() }
  let signature = ''
  function render() {
    const zone = options.currentZone(), steps = firstSteps(zone)
    let advanced = false
    while (step < steps.length && steps[step]!.done) { step++; advanced = true }
    if (advanced) { save(); panel.classList.remove('guide-done'); void panel.offsetWidth; panel.classList.add('guide-done') }
    const teaching = step < steps.length
    const urgent = teaching ? priorities().filter(goal => urgentIds.has(goal.id)).slice(0, 2) : []
    const goals: Goal[] = teaching ? [...urgent, steps[step]!] : priorities()
    const next = `${kitCount()}|${collapsed}|${teaching ? `${step + 1}/${steps.length}` : ''}|${goals.map(goal => `${goal.id}:${goal.title}:${goal.hint}`).join('|')}`
    if (next === signature) return
    signature = next
    panel.dataset.collapsed = String(collapsed); head.setAttribute('aria-expanded', String(!collapsed))
    head.querySelector('b')!.textContent = teaching ? loc('Premiers pas · {0}/{1}',step + 1,steps.length) : loc('À faire')
    list.hidden = collapsed
    list.replaceChildren(...goals.map((goal, index) => {
      const item = document.createElement('li'), button = document.createElement('button')
      button.type = 'button'; button.className = 'guide-goal'; if (index === 0) button.dataset.main = 'true'
      if (goal.zone) button.dataset.guideZone = goal.zone
      if (goal.action) button.dataset.guideAction = goal.action
      if (!goal.zone && !goal.action) button.disabled = true
      const icon = document.createElement('span'); icon.className = 'guide-icon'; icon.setAttribute('aria-hidden', 'true'); const painted = `icon-${kitIcons[goal.id] ?? ''}`
      if (kitHas(painted)) { const image = document.createElement('img'); image.src = kitUrl(painted); image.alt = ''; icon.append(image); icon.dataset.painted = 'true' } else icon.textContent = goal.icon
      const text = document.createElement('span'); text.className = 'guide-text'
      const title = document.createElement('b'); title.textContent = goal.title
      const hint = document.createElement('small'); hint.textContent = goal.hint
      text.append(title, hint); button.append(icon, text)
      if (goal.zone || goal.action) { const go = document.createElement('span'); go.className = 'guide-go'; go.setAttribute('aria-hidden', 'true'); go.textContent = '›'; button.append(go) }
      item.append(button); return item
    }))
  }
  head.onclick = () => { collapsed = !collapsed; save(); render() }
  list.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.guide-goal')
    if (!button || button.disabled || options.busy()) return
    if (button.dataset.guideAction === 'bills') document.querySelector<HTMLButtonElement>('#bills-open')?.click()
    else if (button.dataset.guideZone) options.goTo(button.dataset.guideZone)
  })
  onGameTimeChange(render); onPlayerResourcesChange(render); onMoneyBalanceChange(render); onHungerChange(render); onHouseBillChange(render)
  // Le lieu du joueur change sans événement dédié : un contrôle léger suffit.
  setInterval(render, 1500)
  render()
}
