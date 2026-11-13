import { loc, gameLocale } from './i18n.ts'
import {prepareEmergencyReturn,confirmEmergencyReturn,previewEmergencyReturn} from './emergency-return'
import { isGuidedOutingActive } from './guided-outing-state'
/*
 * Fenêtre de déplacement : compare les quatre moyens de transport et confirme le départ.
 * Le trafic du devis est conservé jusqu’au choix ; argent, énergie et temps sont débités une fois.
 */

import { getMoneyBalance, spendMoney } from './currency'
import { getPlayerResources, spendEnergy, changeMood } from './player-resources'
import { advanceGameTime, getGameTime, hourLabel } from './game-clock'
import { createTravelRoute, quoteTravel, travelModes } from './travel'
import type { TravelMode, TravelPoint } from './travel'
import { getTrafficConditions } from './traffic-conditions'
import { getPlaceActivities, getPlacePeople } from './place-activities'
import { popupScroller } from './popup-shell'
import type { TrafficConditions } from './traffic-conditions'

type Place = { key: string; label: string; position: TravelPoint }
export function mountTravel(options: {
  base: string
  origin: () => Place
  place: (key: string) => Place
  depart: (key: string, route: TravelPoint[], mode: TravelMode, minutes?:number) => void
}) {
  const dialog = document.createElement('dialog')
  dialog.className = 'travel-dialog transport-dialog'
  dialog.setAttribute('aria-labelledby', 'travel-title')
  dialog.innerHTML = `<button class="travel-close" aria-label="${loc('Fermer')}">×</button><span class="travel-eyebrow" id="travel-eyebrow">${loc('DESTINATION')}</span><h2 id="travel-title"></h2><p id="travel-origin"></p><div class="transport-route"><span id="travel-distance" class="travel-distance"></span><span id="travel-traffic" class="travel-traffic"></span></div><div id="travel-place-panel" class="place-activities"></div><div id="travel-go-panel" hidden><div id="travel-options"></div></div><p id="travel-message" role="status"></p><div class="travel-actions"><button type="button" data-travel-back hidden>${loc('← Retour')}</button><button type="button" data-travel-go>${loc('Y aller')}</button></div>`
  document.body.append(dialog)
  const status = document.createElement('div')
  status.className = 'travel-status'; status.hidden = true; status.setAttribute('role', 'status')
  document.body.append(status)
  // busy empêche un nouveau départ ; pending conserve le trajet et le trafic affichés dans le devis.
  let busy = false
  let pending: { key: string; route: TravelPoint[]; traffic: TrafficConditions } | null = null
  const message = dialog.querySelector<HTMLElement>('#travel-message')!
  const choices = dialog.querySelector<HTMLElement>('#travel-options')!
  dialog.querySelector('.travel-close')!.addEventListener('click', () => dialog.close())
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const r = dialog.getBoundingClientRect()
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close()
  } })

  // Deux étapes : d'abord ce que le lieu propose, puis « Y aller » ouvre le choix du transport.
  const goButton = dialog.querySelector<HTMLButtonElement>('[data-travel-go]')!, backButton = dialog.querySelector<HTMLButtonElement>('[data-travel-back]')!
  function setStep(step: 'place' | 'go') {
    dialog.dataset.travelStep=step
    dialog.querySelector<HTMLElement>('#travel-place-panel')!.hidden = step !== 'place'
    dialog.querySelector<HTMLElement>('#travel-go-panel')!.hidden = step !== 'go'
    dialog.querySelector('#travel-eyebrow')!.textContent = step === 'place' ? loc('DESTINATION') : loc('CHOISIR UN TRANSPORT')
    goButton.hidden = step !== 'place'; backButton.hidden = step !== 'go'
    message.hidden = step !== 'go' && !goButton.disabled
    popupScroller(dialog).scrollTop = 0
  }
  goButton.addEventListener('click', () => { if (pending) { setStep('go'); choices.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus() } })
  backButton.addEventListener('click', () => { setStep('place'); goButton.focus() })
  const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  // Arrivée la plus rapide possible : sert à juger ce qui sera encore ouvert en arrivant.
  const fastestArrival = () => getGameTime().totalMinutes + (pending ? Math.min(...travelModes.map(mode => quoteTravel(pending!.route, mode.id, pending!.traffic).minutes)) : 0)
  // Activités ouvertes à l'arrivée la plus rapide mais fermées si l'on arrive à « arrival ».
  const lostOnArrival = (key: string, arrival: number) => {
    const open = new Set(getPlaceActivities(key, fastestArrival()).filter(item => !item.closed).map(item => item.title))
    return getPlaceActivities(key, arrival).filter(item => item.closed && open.has(item.title)).map(item => item.title)
  }
  function renderPlace(key: string) {
    const activities = getPlaceActivities(key, fastestArrival()), people = getPlacePeople(key)
    dialog.querySelector('#travel-place-panel')!.innerHTML = (activities.length
      ? `<ul class="place-activity-list">${activities.map(item => `<li${item.closed ? ' data-closed' : ''}${item.late ? ' data-late' : ''}><span class="place-activity-icon" aria-hidden="true">${item.art ? `<img src="${options.base}ui/menu-${escape(item.art)}.jpg" alt=""/>` : item.icon}</span><span class="place-activity-body"><b>${escape(item.title)}</b><span>${escape(item.detail.replace(/^\s*·\s*/,''))}</span>${item.status ? `<small${item.closed ? ' data-closed' : ''}>${escape(item.status)}</small>` : ''}</span></li>`).join('')}</ul>`
      : `<p class="place-activity-empty">${loc('Aucune activité particulière dans ce lieu.')}</p>`)
      + `<h3 class="place-people-title">${loc('Sur place')}</h3>`
      + (people.length
        ? `<ul class="place-people">${people.map(person => `<li title="${escape(person.activity+' · '+person.stay)}"><img src="${options.base}${person.portrait}" alt="" width="40" height="40"/><span><b>${escape(person.name)}${person.request ? ' <em>!</em>' : ''}</b><small class="place-person-stay">🕒 ${escape(person.stay.split(' · ')[0]!)}</small></span></li>`).join('')}</ul>`
        : `<p class="place-activity-empty">${loc('Personne pour le moment.')}</p>`)
      + `<p class="place-activity-note">${loc('Sur place après le trajet.')}</p>`
    // Une illustration encore absente retrouve son pictogramme sans casser la carte.
    dialog.querySelectorAll<HTMLImageElement>('.place-activity-icon img').forEach((image,index)=>{
      image.onerror=()=>{image.parentElement!.textContent=activities[index]!.icon}
    })
  }

  function renderChoices() {
    if (!pending) return
    const resources = getPlayerResources(), money = getMoneyBalance()
    const length = quoteTravel(pending.route, 'walk', pending.traffic).distanceMeters
    const formatted = length >= 1000 ? loc('{0} km',(length / 1000).toLocaleString(gameLocale, { maximumFractionDigits: 1 })) : `${Math.round(length)} m`
    dialog.querySelector('#travel-distance')!.textContent = `${formatted}`
    const trafficBadge = dialog.querySelector<HTMLElement>('#travel-traffic')!
    trafficBadge.textContent = pending.traffic.label
    trafficBadge.dataset.traffic = pending.traffic.id
    choices.innerHTML = travelModes.map(mode => {
      const quote = quoteTravel(pending!.route, mode.id, pending!.traffic)
      const reason = money < quote.money ? loc('Argent insuffisant') : resources.energy < quote.energy ? loc('Énergie insuffisante') : ''
      const delay = quote.minutes - quote.clearMinutes
      // Ce transport arrive trop tard pour une activité encore ouverte avec un transport plus rapide : on prévient.
      const lost = lostOnArrival(pending!.key, getGameTime().totalMinutes + quote.minutes)
      const subtitle={walk:loc('Le pied, c’est gratuit !'),taxi:loc('On se serre un peu'),yonga:loc('La place du boss'),moto:loc('On faufile !')}[mode.id]
      const title=mode.id==='yonga'?loc('Yonga privé'):mode.label
      const cost=quote.money===0?loc('Gratuit'):'−'+quote.money.toLocaleString(gameLocale)
      return `<button class="travel-option transport-card" data-travel-mode="${mode.id}" aria-label="${loc('{0}, {1} Nkap, {2} énergie{3}, {4} minutes{5}',title,quote.money,quote.energy,quote.mood>0?loc(', −{0} humeur',quote.mood):quote.mood<0?loc(', +{0} humeur',-quote.mood):'',quote.minutes,reason?', '+reason:'')}" ${reason ? 'disabled' : ''}><span class="transport-art" aria-hidden="true"><img src="${options.base}ui/transport-${mode.id}.png?v=respo-20261110" alt=""/></span><span class="transport-copy"><b>${title}</b><span class="transport-quip">${subtitle}</span><span class="transport-costs"><span class="${quote.money?'pill-cost':'pill-free'}" title="${loc('Prix en Nkap')}"><img src="${options.base}ui/currency-nkap.png" alt="Nkap"/>${cost}</span><span class="${quote.energy?'pill-cost':'pill-free'}" title="${loc('Énergie dépensée')}"><img src="${options.base}ui/currency-energy.png" alt="${loc('Énergie')}"/>${quote.energy?'−'+quote.energy:0}</span>${quote.mood?`<span title="${quote.mood<0?loc('Humeur gagnée'):loc('Humeur perdue')}" class="transport-mood${quote.mood<0?' transport-mood-gain':''}"><span class="currency-icon currency-icon-mood" role="img" aria-label="${loc('Humeur')}" style="background-image:url('${options.base}ui/mood-sprites.png')"></span>${quote.mood<0?'+'+(-quote.mood):'−'+quote.mood}</span>`:''}<span class="pill-time" title="${loc('Durée du trajet')}">◷ ${quote.minutes}<span class="transport-unit">min</span></span></span>${reason?`<span class="transport-warning">${reason}</span>`:lost.length?`<span class="transport-warning">${lost.length===1?loc('{0} : fermé à ton arrivée ({1})',escape(lost[0]!),hourLabel(getGameTime().totalMinutes+quote.minutes)):loc('{0} activités fermées à ton arrivée ({1})',lost.length,hourLabel(getGameTime().totalMinutes+quote.minutes))}</span>`:delay>0?`<span class="transport-delay">${loc('Bouchons +{0} min',delay)}</span>`:''}</span></button>`

    }).join('')
    const from=options.origin(),home=options.place('home'),rescue=previewEmergencyReturn(from.key,from.position,home.position,pending.traffic)
    if(!rescue.reason){
      choices.insertAdjacentHTML('beforeend',`<button class="travel-option" data-emergency-home><span class="travel-symbol" aria-hidden="true">🏠</span><span class="travel-option-body"><b>${loc('Retour de secours à la maison')}</b><span class="travel-mode-description">${loc('Gratuit · 0 énergie · {0} min',rescue.minutes)}</span><small>${loc('+2 h de sommeil à récupérer, en plus de la fatigue du trajet. Aucune énergie rendue.')}</small></span><span aria-hidden="true">→</span></button>`)
      message.textContent=loc('Sans énergie et sans transport abordable, seul le retour à la maison est possible.')
    }else if(resources.energy===0)message.textContent=loc('Énergie épuisée : choisissez un taxi commun ou Yonga si vous pouvez payer le trajet.')
  }

  choices.addEventListener('click', event => {
    if((event.target as HTMLElement).closest('[data-emergency-home]')){
      if(busy||!pending||isGuidedOutingActive())return
      const from=options.origin(),home=options.place('home'),q=prepareEmergencyReturn(from.key,from.position,home.position,pending.traffic),result=confirmEmergencyReturn(q.token,{origin:from.key,allowed:dialog.open})
      if(!result.ok){message.textContent=result.reason;renderChoices();return}
      busy=true;pending=null;dialog.close();status.hidden=false;status.textContent=loc('Retour de secours · +2 h de sommeil à récupérer');options.depart('home',result.route,'yonga',result.minutes);return
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-travel-mode]')
    if (!button || button.disabled || !pending || busy || isGuidedOutingActive()) return
    const mode = button.dataset.travelMode as TravelMode
    const quote = quoteTravel(pending.route, mode, pending.traffic)
    if (getMoneyBalance() < quote.money || getPlayerResources().energy < quote.energy) {
      message.textContent = loc('Les ressources disponibles ont changé. Choisissez un autre mode.')
      renderChoices(); return
    }
    // Le paiement et l’avance du calendrier précèdent l’animation ; la fin de l’animation ne doit pas les répéter.
    busy = true
    spendMoney(quote.money); spendEnergy(quote.energy); if (quote.mood) changeMood(-quote.mood); advanceGameTime(quote.minutes)
    const { key, route } = pending
    pending = null
    dialog.close()
    status.textContent = loc('{0} → {1} · {2} min',quote.label,options.place(key).label,quote.minutes)
    status.hidden = false
    options.depart(key, route, mode, quote.minutes)
  })

  return {
    open(key: string) {
      if (busy || isGuidedOutingActive()) return
      const from = options.origin(), to = options.place(key)
      dialog.querySelector('#travel-title')!.textContent = to.label
      dialog.querySelector('#travel-origin')!.textContent = loc('Depuis : {0}',from.label)
      choices.innerHTML = ''; message.textContent = ''; pending = null
      dialog.querySelector('#travel-distance')!.textContent = ''
      dialog.querySelector('#travel-traffic')!.textContent = ''
      if (from.key === key) message.textContent = loc('Vous êtes déjà dans cette zone.')
      else {
        try { pending = { key, route: createTravelRoute(from.position, to.position), traffic: getTrafficConditions() }; renderChoices() }
        catch (error) { message.textContent = error instanceof Error ? error.message : loc('Trajet indisponible.') }
      }
      renderPlace(key)
      goButton.disabled = !pending
      if (!dialog.open) dialog.showModal()
      setStep('place')
    },
    // La durée visuelle est terminée : libère seulement le déplacement et affiche l’arrivée.
    arrive(key: string) {
      busy = false
      status.textContent = loc('Arrivée : {0}',options.place(key).label)
      window.setTimeout(() => { if (!busy) status.hidden = true }, 3500)
    },
    isTravelling: () => busy || isGuidedOutingActive(),
  }
}
