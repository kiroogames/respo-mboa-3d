/* HUD vivant : recopie les compteurs existants vers la carte du Respo, les jauges et l'horloge.
   Les modules de ressources restent la seule source ; ici on ne fait que lire leur affichage. */

const watch = (node: Node | null, update: () => void) => {
  if (!node) return
  new MutationObserver(update).observe(node, { childList: true, characterData: true, subtree: true, attributes: true })
  update()
}
const ratio = (text: string, fallbackMax: number) => {
  const [value, max] = text.replace(/\s/g, '').split('/').map(part => Number(part.replace(/[^\d.-]/g, '')))
  return Math.max(0, Math.min(1, (value ?? 0) / (max || fallbackMax)))
}

export function mountHudEnhance() {
  // Composition de jeu de vie : personnage et besoins dans une console, argent séparé du calendrier.
  const header=document.querySelector('#app header')!,stats=document.querySelector('.resource-stats')!,player=document.querySelector('.player-card')!,energyTile=document.querySelector('#energy-counter')!,moodTile=document.querySelector('#mood-counter')!
  stats.classList.add('hud-command-center')
  const consolePanel=document.createElement('section');consolePanel.className='respo-console';consolePanel.setAttribute('aria-label','Votre personnage et ses besoins')
  const caption=document.createElement('span');caption.className='console-caption';caption.textContent='LE RESPONSABLE MBOA'
  consolePanel.append(caption,player)
  // Toutes les ressources alignées en haut : argent, influence, énergie, humeur.
  const wallet=document.createElement('div');wallet.className='city-wallet-strip';const money=document.querySelector('#money-amount')!.closest('.game-wallet')!,karma=document.querySelector('#influence-counter')!;wallet.append(money,karma,energyTile,moodTile)
  stats.append(consolePanel,wallet);header.append(stats)
  const clockWidget=document.querySelector('.game-clock')!,actions=document.querySelector<HTMLElement>('.header-actions')!;header.append(clockWidget,actions);actions.hidden=true
  const menu=document.createElement('button');menu.id='ui-menu-toggle';menu.type='button';menu.textContent='☰ Menu';menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-controls','hud-menu-actions');actions.id='hud-menu-actions';header.append(menu)
  const closeMenu=()=>{actions.hidden=true;menu.setAttribute('aria-expanded','false')}
  menu.onclick=()=>{actions.hidden=!actions.hidden;menu.setAttribute('aria-expanded',String(!actions.hidden))}
  actions.addEventListener('click',event=>{if((event.target as HTMLElement).closest('button'))closeMenu()})
  document.addEventListener('pointerdown',event=>{if(!actions.contains(event.target as Node)&&!menu.contains(event.target as Node))closeMenu()})
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu()})

  // La tuile entière est cliquable au doigt ; le bouton natif reste l’accès clavier.
  for(const selector of ['#bills-open','#mood-effects-open','#energy-effects-open']){
    const action=document.querySelector<HTMLButtonElement>(selector),tile=action?.closest<HTMLElement>('.game-wallet')
    if(action&&tile){tile.style.cursor='pointer';tile.addEventListener('click',event=>{if(!(event.target as HTMLElement).closest('button')&&!action.disabled)action.click()})}
  }
  const card = document.querySelector<HTMLElement>('.player-card')!
  const respoAmount = document.querySelector<HTMLElement>('#respo-amount'), respoLevel = document.querySelector<HTMLElement>('#respo-level')
  const respoProgress = document.querySelector<HTMLProgressElement>('#respo-progress')
  const syncRespo = () => {
    card.querySelector('#player-level')!.textContent = respoLevel?.textContent?.replace(/\D/g, '') || '1'
    card.querySelector('#player-xp-text')!.textContent = respoAmount?.textContent ?? ''
    const fill = respoProgress && respoProgress.max ? respoProgress.value / respoProgress.max : 0
    card.style.setProperty('--xp', String(Math.max(0, Math.min(1, fill))))
  }
  watch(respoAmount, syncRespo); watch(respoLevel, syncRespo); watch(respoProgress, syncRespo)

  const energy = document.querySelector<HTMLElement>('#energy-amount'), mood = document.querySelector<HTMLElement>('#mood-amount')
  watch(energy, () => document.querySelector<HTMLElement>('#energy-counter')?.style.setProperty('--fill', String(ratio(energy!.textContent ?? '', 100))))
  watch(mood, () => {
    const value = ratio(mood!.textContent ?? '', 140)
    const counter = document.querySelector<HTMLElement>('#mood-counter')
    counter?.style.setProperty('--fill', String(value))
    if (counter) counter.dataset.level = value < .3 ? 'low' : value < .6 ? 'mid' : 'high'
  })

  const period = document.querySelector<HTMLElement>('#game-period'), clock = document.querySelector<HTMLElement>('.game-clock')
  watch(period, () => { if (clock) clock.dataset.period = period!.textContent?.trim() || 'Jour' })

  // Une valeur qui change fait « rebondir » sa carte, pour que le joueur voie l'effet de son action.
  for (const id of ['#money-amount', '#influence-amount', '#energy-amount', '#mood-amount', '#respo-amount']) {
    const amount = document.querySelector<HTMLElement>(id)
    if (!amount) continue
    let previous = amount.textContent
    new MutationObserver(() => {
      if (amount.textContent === previous) return
      previous = amount.textContent
      const target = id === '#respo-amount' ? card : amount.closest<HTMLElement>('.game-wallet')
      target?.classList.remove('hud-bump'); void target?.offsetWidth; target?.classList.add('hud-bump')
    }).observe(amount, { childList: true, characterData: true, subtree: true })
  }
}
