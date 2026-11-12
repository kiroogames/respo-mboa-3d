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
import { getDowryState, onDowryChange } from './dowry.ts'
import { getHomeMealService } from './home-meals.ts'

// Icône peinte du kit pour chaque objectif ; l'émoji reste le repli.
const kitIcons: Record<string, string> = { broke: 'savings', dowry: 'savings', job: 'dossier', relax: 'mood', eat: 'meal', hungry: 'meal', meal: 'meal', go: 'transport', work: 'dossier', sleep: 'sleep', tired: 'sleep', bills: 'bills', energy: 'energy', mood: 'mood', tontine: 'tontine', ceremony: 'ceremony', save: 'savings', level: 'level' }

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

// Une seule action à faire maintenant : d'abord ce qui ne peut pas attendre, puis ce qui fait avancer la dot.
function nextStep(zone: string): Goal {
  const urgent = priorities().find(goal => ['bills', 'broke', 'hungry', 'meal', 'tired', 'energy'].includes(goal.id))
  if (urgent) {
    // Repas : à la maison, c'est gratuit aux heures de repas.
    if (urgent.id === 'meal' && getHomeMealService().open) return { ...urgent, hint: loc('Maison › Manger à la maison · gratuit maintenant'), zone: 'home' }
    return urgent
  }
  const time = getGameTime().totalMinutes, minute = time % 1440, day = Math.floor(time / 1440) % 7, resources = getPlayerResources()
  const money = getMoneyBalance(), bills = getHouseBilling(), dowry = getDowryState(), amount = (value: number) => value.toLocaleString(gameLocale)
  if (minute >= 1320 || minute < 360) return { id: 'sleep', icon: '🛏️', title: loc('Il est tard : va dormir'), hint: loc('Maison › Dormir · demain, on travaille pour la dot'), zone: 'home' }
  if (resources.mood < 60) return { id: 'relax', icon: '🙂', title: loc('Humeur basse : détends-toi'), hint: loc('Tes gains baissent de 15 % : ludo au village, match au bar, cinéma…') }
  // Argent en trop (au-delà de la prochaine facture) : il va dans la caisse de la dot.
  const reserve = bills.amount + 1000, spare = Math.floor((money - reserve) / 1000) * 1000
  if (!dowry.complete && spare >= 2000) return { id: 'dowry', icon: '💰', title: loc('Mets {0} Nkap de côté pour la dot', amount(Math.min(spare, dowry.remaining))), hint: loc('Maison › Caisse de la dot · garde {0} Nkap pour les factures', amount(reserve)), zone: 'home', action: 'dowry' }
  if (day < 5 && minute >= 480 && minute < 1080) return { id: 'work', icon: '📂', title: loc('Travaille au ministère'), hint: loc('Dossiers et usagers : l’argent de la dot se gagne ici'), zone: 'ministry' }
  // Hors bureau : le petit job ouvert le mieux payé.
  const jobs = ['jcd', 'market', 'njoka', 'club', 'education', 'supermarket', 'nsimaport', 'baos'].flatMap(z => getVenueServices(z).filter(s => s.job && !venueServiceReason(s)).map(s => ({ z, s })))
  const best = jobs.sort((a, b) => (b.s.moneyGain ?? 0) - (a.s.moneyGain ?? 0))[0]
  if (best) return { id: 'job', icon: '🛵', title: loc('Petit job : {0}', best.s.name), hint: loc('+{0} Nkap pour la dot · {1} min', amount(best.s.moneyGain ?? 0), best.s.minutes), zone: best.z }
  void zone
  return { id: 'relax', icon: '🙂', title: loc('Repose-toi un moment'), hint: loc('Rien d’ouvert pour gagner de l’argent : profite pour te détendre') }
}

export function mountGuide(options: { currentZone: () => string; goTo: (zone: string) => void; busy: () => boolean }) {
  const panel = document.createElement('aside'); panel.id = 'guide'; panel.setAttribute('aria-label', loc('À faire'))
  panel.innerHTML = `<button type="button" class="guide-head" aria-controls="guide-list"><b>${loc('Quête : réunir la dot')}</b><span aria-hidden="true">▾</span></button><button type="button" class="guide-quest" aria-label="${loc('Caisse de la dot')}"><span class="guide-quest-bar"><i></i></span><small class="guide-quest-text"></small></button><ol id="guide-list" class="guide-list"></ol>`
  document.querySelector('#app')!.append(panel)
  const head = panel.querySelector<HTMLButtonElement>('.guide-head')!, list = panel.querySelector<HTMLElement>('.guide-list')!, quest = panel.querySelector<HTMLButtonElement>('.guide-quest')!
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
    const goals: Goal[] = teaching ? [urgent[0] ?? steps[step]!] : [nextStep(zone)]
    const dowry = getDowryState()
    const next = `${dowry.saved}|${kitCount()}|${collapsed}|${teaching ? `${step + 1}/${steps.length}` : ''}|${goals.map(goal => `${goal.id}:${goal.title}:${goal.hint}`).join('|')}`
    if (next === signature) return
    signature = next
    panel.dataset.collapsed = String(collapsed); head.setAttribute('aria-expanded', String(!collapsed))
    head.querySelector('b')!.textContent = teaching ? loc('Premiers pas · {0}/{1}',step + 1,steps.length) : dowry.complete ? loc('Quête accomplie : la dot est réunie !') : loc('Quête : réunir la dot')
    quest.hidden = collapsed || teaching
    quest.querySelector<HTMLElement>('i')!.style.width = `${Math.round(dowry.share * 100)}%`
    quest.querySelector('small')!.textContent = loc('{0} / {1} Nkap', dowry.saved.toLocaleString(gameLocale), dowry.target.toLocaleString(gameLocale))
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
  quest.onclick = () => { if (options.busy()) return; if (options.currentZone() === 'home') window.dispatchEvent(new Event('mboa:open-dowry')); else options.goTo('home') }
  list.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.guide-goal')
    if (!button || button.disabled || options.busy()) return
    if (button.dataset.guideAction === 'bills') document.querySelector<HTMLButtonElement>('#bills-open')?.click()
    else if (button.dataset.guideAction === 'dowry' && options.currentZone() === 'home') window.dispatchEvent(new Event('mboa:open-dowry'))
    else if (button.dataset.guideZone) options.goTo(button.dataset.guideZone)
  })
  onGameTimeChange(render); onPlayerResourcesChange(render); onMoneyBalanceChange(render); onHungerChange(render); onHouseBillChange(render); onDowryChange(render)
  // Le lieu du joueur change sans événement dédié : un contrôle léger suffit.
  setInterval(render, 1500)
  render()
}
