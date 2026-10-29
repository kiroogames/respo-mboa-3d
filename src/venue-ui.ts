import { popupScroller } from './popup-shell'
import {mountAdvancedDossiers} from './advanced-dossiers-ui'
import {advancedRules,getAdvancedBatch,onAdvancedChange} from './advanced-dossiers'
import {getRespoProgress} from './respo-level'
import {onPlayerResourcesChange} from './player-resources'
import {mountCanteen} from './canteen-ui'
import {getCanteenService,onCanteenChange} from './canteen'
import {mountAnnekeExtra} from './anneke-extra-ui'
import {getExtraState,onExtraChange} from './anneke-extra'
import {mountMinfiMeetings} from './minfi-meetings-ui'
import {getMeetingSchedule,onMeetingChange} from './minfi-meetings'
import {bagFoods} from './food-bag'
import { mountCityOutings } from './city-outings-ui'
import { cityOutings, getOutingSchedule, onCityOutingChange } from './city-outings'
import { mountHomeComfort } from './home-comfort-ui'
import { getHomeComfort, onComfortChange } from './home-comfort'
import { mountBaeToque } from './bae-toque-ui'
import { getToqueState, onToqueChange } from './bae-toque'
import { mountProMissions } from './pro-missions-ui'
import { missionRules, getMissionState, onMissionChange } from './pro-missions'
import { mountUserQueue } from './user-queue-ui'
import { getUserQueue, userQueueRules } from './user-queue'
import { mountHomeMeals } from './home-meals-ui'
import { mountSleeping } from './sleeping-ui'
/*
 * Menu du lieu : sépare les services du bâtiment et ceux des personnes présentes.
 * Les cartes sont recalculées quand l’heure ou l’état des demandes change.
 */

import { projectVenueEnergy,getVenueServices, useVenueService } from './venue-services'
import { getMoneyBalance } from './currency'
import { getPlayerResources, previewMoodChange } from './player-resources'
import { getNPCsAtZone, isNPCAvailable, getNPCState, getNPCSchedule } from './npcs'
import { onGameTimeChange } from './game-clock'
import { getConsideration, getNPCRequests, getCompletedNPCRequests, isRequestAccepted, npcNeedsService, onNPCRelationshipChange } from './npc-relationships'
import { mountDossierWork } from './dossier-work-ui'
import { dossierRules, getDossierBatch } from './dossier-work'

export function mountVenues(options: {
  base: string
  currentZone: () => string
  label: (key: string) => string
  travelling: () => boolean
  interact: (npcId: string, serviceId: string) => void
  takeAway: (foodId:string)=>void
  invite: (npcId:string)=>void
}) {
  const dialog = document.createElement('dialog')
  dialog.className = 'travel-dialog venue-dialog'
  dialog.setAttribute('aria-labelledby', 'venue-title')
  dialog.innerHTML = `<button class="venue-close travel-close" aria-label="Fermer">×</button><span class="travel-eyebrow">SUR PLACE</span><h2 id="venue-title"></h2><p>À vous de jouer.</p><div class="venue-tabs" role="tablist" aria-label="Services disponibles"><button id="venue-place-tab" role="tab" aria-selected="true" aria-controls="venue-place-panel" data-venue-tab="place">Services du lieu</button><button id="venue-people-tab" role="tab" aria-selected="false" aria-controls="venue-people-panel" tabindex="-1" data-venue-tab="people">Personnes présentes <span id="venue-people-count">0</span></button></div><div id="venue-place-panel" role="tabpanel" aria-labelledby="venue-place-tab"><div id="venue-result" role="status" hidden></div><div id="venue-services"></div></div><div id="venue-people-panel" role="tabpanel" aria-labelledby="venue-people-tab" hidden><div id="venue-people"></div></div><button class="venue-cancel travel-cancel">Retour à la ville</button>`
  document.body.append(dialog)
  let zone = '', selecting = false, readyAt = 0
  const takeaway=document.createElement('button');takeaway.className='venue-service';takeaway.dataset.foodTakeaway='';takeaway.hidden=true
  dialog.querySelector('#venue-place-panel')!.append(takeaway)
  takeaway.onclick=()=>{const food=bagFoods.find(f=>f.zone===zone);if(!food||options.travelling()||options.currentZone()!==zone)return;dialog.close();options.takeAway(food.id)}

  const list = dialog.querySelector<HTMLElement>('#venue-services')!
  const result = dialog.querySelector<HTMLElement>('#venue-result')!
  const people = dialog.querySelector<HTMLElement>('#venue-people')!
  const tabs = [...dialog.querySelectorAll<HTMLButtonElement>('[data-venue-tab]')]
  // Le travail est une activité du ministère sur la carte actuelle, pas une scène de bureau séparée.
  const work = mountDossierWork({ base: options.base, currentZone: options.currentZone, travelling: options.travelling, back: () => {
    if (options.travelling() || options.currentZone() !== zone) return
    render(); setTab('place'); if (!dialog.open) dialog.showModal()
  } })
  const sleeping=mountSleeping({base:options.base,currentZone:options.currentZone,travelling:options.travelling,back:()=>{
    if(options.travelling()||options.currentZone()!=='home')return
    render();setTab('place');if(!dialog.open)dialog.showModal()
  }})
  const meals=mountHomeMeals({base:options.base,currentZone:options.currentZone,travelling:options.travelling,back:()=>{
    if(options.travelling()||options.currentZone()!=='home')return
    render();setTab('place');if(!dialog.open)dialog.showModal()
  }})
  const userQueue=mountUserQueue({base:options.base,currentZone:options.currentZone,travelling:options.travelling,back:()=>{
    if(options.travelling()||options.currentZone()!=='ministry')return
    render();setTab('place');if(!dialog.open)dialog.showModal()
  }})
  const meetings=mountMinfiMeetings({currentZone:options.currentZone,travelling:options.travelling,back:()=>{
    if(options.travelling()||options.currentZone()!=='ministry')return
    render();setTab('place');if(!dialog.open)dialog.showModal()
  }})
  const meetingEntry=document.createElement('button');meetingEntry.className='venue-service';meetingEntry.dataset.venueMeeting='';meetingEntry.hidden=true
  dialog.querySelector('#venue-place-panel')!.append(meetingEntry)
  meetingEntry.onclick=()=>{if(options.travelling()||options.currentZone()!=='ministry'||zone!=='ministry')return;dialog.close();meetings.open()}
  onMeetingChange(()=>{if(dialog.open)renderWorkEntry()})
  const extra=mountAnnekeExtra({base:options.base,currentZone:options.currentZone,travelling:options.travelling,back:tab=>{
    if(options.travelling()||options.currentZone()!=='ministry')return
    render();setTab(tab);if(!dialog.open)dialog.showModal()
  }})
  const extraEntry=document.createElement('button');extraEntry.className='venue-service';extraEntry.dataset.venueExtra='';extraEntry.hidden=true
  dialog.querySelector('#venue-place-panel')!.append(extraEntry)
  extraEntry.onclick=()=>{if(options.travelling()||options.currentZone()!=='ministry'||zone!=='ministry')return;dialog.close();extra.open('start')}
  onExtraChange(()=>{if(dialog.open){renderPeople();renderWorkEntry()}})
  const canteen=mountCanteen({base:options.base,currentZone:options.currentZone,travelling:options.travelling,back:tab=>{
    if(options.travelling()||options.currentZone()!=='ministry')return
    render();setTab(tab);if(!dialog.open)dialog.showModal()
  }})
  const canteenEntry=document.createElement('button');canteenEntry.className='venue-service';canteenEntry.dataset.venueCanteen='';canteenEntry.hidden=true
  dialog.querySelector('#venue-place-panel')!.append(canteenEntry)
  canteenEntry.onclick=()=>{if(options.travelling()||options.currentZone()!=='ministry'||zone!=='ministry')return;dialog.close();canteen.open('place')}
  onCanteenChange(()=>{if(dialog.open)renderWorkEntry()})
  const queueEntry=document.createElement('button');queueEntry.className='venue-service';queueEntry.dataset.venueQueue='';queueEntry.hidden=true
  dialog.querySelector('#venue-place-panel')!.append(queueEntry)
  queueEntry.onclick=()=>{if(options.travelling()||options.currentZone()!=='ministry'||zone!=='ministry')return;dialog.close();userQueue.open()}
  const missions=mountProMissions({label:options.label,currentZone:options.currentZone,travelling:options.travelling})
  const missionEntry=document.createElement('button');missionEntry.className='venue-service';missionEntry.dataset.venueMission='';missionEntry.hidden=true
  dialog.querySelector('#venue-place-panel')!.append(missionEntry)
  missionEntry.onclick=()=>{
    if(options.travelling()||options.currentZone()!==zone)return
    const mission=missionRules.missions.find(m=>m.zone===zone&&getMissionState(m.id)?.stage==='active')
    if(!mission)return
    dialog.close();missions.open(mission.id,()=>{if(options.currentZone()!==zone||options.travelling())return;render();setTab('place');if(!dialog.open)dialog.showModal()})
  }
  const toque=mountBaeToque({currentZone:options.currentZone,travelling:options.travelling,back:()=>{
    if(options.travelling()||options.currentZone()!=='home')return
    render();setTab('people');if(!dialog.open)dialog.showModal()
  }})
  const comfort=mountHomeComfort({currentZone:options.currentZone,travelling:options.travelling,back:()=>{
    if(options.travelling()||options.currentZone()!=='home')return
    render();setTab('place');if(!dialog.open)dialog.showModal()
  }})
  const comfortEntry=document.createElement('button');comfortEntry.className='venue-service';comfortEntry.dataset.venueComfort='';comfortEntry.hidden=true
  dialog.querySelector('#venue-place-panel')!.append(comfortEntry)
  comfortEntry.onclick=()=>{if(options.travelling()||options.currentZone()!=='home'||zone!=='home')return;dialog.close();comfort.open()}
  const outings=mountCityOutings({currentZone:options.currentZone,travelling:options.travelling,back:()=>{
    if(options.travelling()||options.currentZone()!==zone)return
    render();setTab('place');if(!dialog.open)dialog.showModal()
  }})
  const outingEntry=document.createElement('button');outingEntry.className='venue-service';outingEntry.dataset.venueOuting='';outingEntry.hidden=true
  dialog.querySelector('#venue-place-panel')!.append(outingEntry)
  outingEntry.onclick=()=>{if(options.travelling()||options.currentZone()!==zone)return;const activity=cityOutings.find(a=>a.zone===zone);if(!activity)return;dialog.close();outings.open(activity.id)}
  const advanced=mountAdvancedDossiers({base:options.base,currentZone:options.currentZone,travelling:options.travelling,back:()=>{
    if(options.travelling()||options.currentZone()!==zone)return
    render();setTab('place');if(!dialog.open)dialog.showModal()
  }})
  const advancedEntry=document.createElement('button');advancedEntry.className='venue-service';advancedEntry.dataset.venueAdvanced='';advancedEntry.hidden=true
  dialog.querySelector('#venue-place-panel')!.append(advancedEntry)
  advancedEntry.onclick=()=>{if(options.travelling()||options.currentZone()!=='ministry'||zone!=='ministry')return;dialog.close();advanced.open()}
  onAdvancedChange(()=>{if(dialog.open)renderWorkEntry()})
  onPlayerResourcesChange(()=>{if(dialog.open)renderWorkEntry()})
  const workEntry = document.createElement('button'); workEntry.className = 'venue-service dossier-launch'; workEntry.dataset.venueWork = ''; workEntry.hidden = true
  dialog.querySelector('#venue-place-panel')!.append(workEntry)
  function renderWorkEntry() {
    advancedEntry.hidden=zone!=='ministry'||getRespoProgress(getPlayerResources().ptRespo).level<advancedRules.visibleLevel
    if(!advancedEntry.hidden){const batch=getAdvancedBatch();advancedEntry.innerHTML=`<b>Dossiers avancés</b><span class="venue-description">Niveaux 3, 4 et 5 · travaux de votre service</span><span class="venue-gains">900 à 1500 Nkap · 10 à 16 Respo</span><small>${batch.reason||`${batch.remaining} dossier(s) débloqué(s) restant(s)`}</small>`}

    canteenEntry.hidden=zone!=='ministry'
    if(!canteenEntry.hidden){const s=getCanteenService();canteenEntry.innerHTML=`<b>Cantine du ministère</b><span class="venue-description">Lundi–vendredi · 11h–14h · menu du jour</span><span class="venue-gains">Repas dès 200 Nkap · énergie et humeur selon le plat</span><small>${s.reason||`${s.menu.length-s.done.length} plat(s) encore disponible(s)`}</small>`}

    extraEntry.hidden=zone!=='ministry'
    if(!extraEntry.hidden){const s=getExtraState();extraEntry.innerHTML=`<b>Taf extra d’Anneke</b><span class="venue-description">Lundi–vendredi · 18h–23h · commande récupérée en journée</span><span class="venue-gains">+900 Nkap · +8 Respo · 25 énergie · 60 min</span><small>${s.expired?'Commande expirée à 23h':s.order?.day===s.day?(s.order.done?'Commande rémunérée':s.title):'Récupérez une commande auprès d’Anneke'}</small>`}

    meetingEntry.hidden=zone!=='ministry'
    if(!meetingEntry.hidden){const schedule=getMeetingSchedule();meetingEntry.innerHTML=`<b>Réunion MINFI</b><span class="venue-description">Lundi–vendredi · 08h–16h · une réunion par jour</span><span class="venue-gains">${schedule.topic??'Pas de réunion le week-end'} · +5 ou +12 Respo</span><small>${schedule.reason||'Disponible'}</small>`}

    const outing=cityOutings.find(a=>a.zone===zone)
    outingEntry.hidden=!outing
    if(outing){const schedule=getOutingSchedule(outing.id);outingEntry.innerHTML=`<b>Sorties · ${outing.name}</b><span class="venue-description">${outing.hours}</span><span class="venue-gains">Choisir une sortie</span><small>${schedule.reason||'Disponible sur place'}</small>`}

    comfortEntry.hidden=zone!=='home'
    if(!comfortEntry.hidden){const state=getHomeComfort();comfortEntry.innerHTML=`<b>Confort et équipements</b><span class="venue-description">Chambre, salon, cuisine et salle de bain.</span><span class="venue-gains">Confort : ${state.total} / ${state.target}${state.complete?' · objectif atteint':''}</span><small>Acheter · équiper · revendre</small>`}

    const localMissions=missionRules.missions.filter(m=>m.zone===zone&&getMissionState(m.id)?.stage==='active')
    missionEntry.hidden=!localMissions.length
    if(localMissions.length)missionEntry.innerHTML=`<b>Mission : ${localMissions[0]!.title}</b><span class="venue-description">${localMissions.length} activité(s) de mission à réaliser sur place.</span><span class="travel-costs">−${missionRules.energyCost} énergie · ${missionRules.minutes} min par activité</span><span class="venue-gains">Gain au compte rendu</span>`

    queueEntry.hidden=zone!=='ministry'
    if(!queueEntry.hidden){const q=getUserQueue();queueEntry.innerHTML=`<b>Accueillir les usagers</b><span class="venue-description">Tracez le parcours de chaque dossier · lundi–vendredi · 10h–13h et 16h–18h.</span><span class="travel-costs">Dès −${userQueueRules.energyCost} énergie · ${userQueueRules.minutes} min</span><span class="venue-gains">Environ ${userQueueRules.moneyGain} Nkap pour un bon parcours · +${userQueueRules.respoGain} points Respo</span><small>${q.reason||`${q.remaining} demandes disponibles dans la file`}</small>`}

    workEntry.hidden = zone !== dossierRules.zone
    if (workEntry.hidden) return
    const batch = getDossierBatch()
    workEntry.innerHTML = `<b>Traiter les dossiers</b><span class="venue-description">Dossiers du jour</span><span class="travel-costs"><span>−${dossierRules.energyCost} énergie</span><span>◷ ${dossierRules.minutes} min</span></span><span class="venue-gains">+${dossierRules.moneyGain} Nkap · +${dossierRules.respoGain} points Respo</span><small>${batch.reason || `${batch.remaining} dossiers disponibles dans la pile`}</small>`
  }
  workEntry.addEventListener('click', () => {
    if (options.travelling() || options.currentZone() !== dossierRules.zone || zone !== dossierRules.zone) return
    dialog.close(); work.open()
  })
  // Maintient sélection ARIA, ordre de tabulation et panneau visible en cohérence pour le clavier.
  function setTab(tab: 'place' | 'people') {
    for (const button of tabs) {
      const selected = button.dataset.venueTab === tab
      button.setAttribute('aria-selected', String(selected))
      button.tabIndex = selected ? 0 : -1
    }
    dialog.querySelector<HTMLElement>('#venue-place-panel')!.hidden = tab !== 'place'
    dialog.querySelector<HTMLElement>('#venue-people-panel')!.hidden = tab !== 'people'
  }
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => setTab(button.dataset.venueTab as 'place' | 'people'))
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length
      setTab(tabs[next]!.dataset.venueTab as 'place' | 'people'); tabs[next]!.focus()
    })
  })
  // Résout les résidents à l’heure courante : aucun PNJ ne doit rester dans son ancien lieu après son départ.
  function renderPeople() {
    const residents = options.currentZone() === zone && !options.travelling() ? getNPCsAtZone(zone) : []
    dialog.querySelector('#venue-people-tab')!.classList.toggle('has-request', residents.some(npc => npcNeedsService(npc.id)))
    dialog.querySelector('#venue-people-count')!.textContent = String(residents.length)
    people.replaceChildren()
    if (!residents.length) {
      const empty = document.createElement('p')
      empty.className = 'venue-people-empty'; empty.textContent = 'Personne n’est disponible ici pour le moment.'
      people.append(empty)
    }
    for (const npc of residents) {
      const card = document.createElement('section'); card.className = 'venue-resident'; card.dataset.resident = npc.id
      const header = document.createElement('div'); header.className = 'venue-resident-header'
      const image = document.createElement('img'); image.src = options.base + npc.portrait; image.alt = ''; image.width = 60; image.height = 60
      const identity = document.createElement('div'), name = document.createElement('h3'), relationship = document.createElement('p')
      name.textContent = npc.name; relationship.textContent = npc.relationship; identity.append(name, relationship); header.append(image, identity)
      card.append(header)
      const state = getNPCState(npc.id)
      if (state) {
        const activity = document.createElement('p'); activity.className = 'npc-activity'
        const until = state.until === 1440 ? 'minuit' : `${String(Math.floor(state.until / 60)).padStart(2, '0')} h ${String(state.until % 60).padStart(2, '0')}`
        activity.textContent = `${state.rank} · ${state.activity} jusqu’à ${until}`
        card.append(activity)
        const agenda = document.createElement('details'); agenda.className = 'npc-agenda'
        const summary = document.createElement('summary'); summary.textContent = 'Programme du jour'
        const transport = document.createElement('p'); transport.textContent = `Transport habituel : ${{ taxi: 'taxi commun', yonga: 'Yonga · taxi privé', moto: 'moto', walk: 'à pied' }[state.transport] ?? state.transport}`
        const periods = document.createElement('ol')
        const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
        for (const period of getNPCSchedule(npc.id)) {
          const item = document.createElement('li')
          item.textContent = `${clock(period.from)}–${clock(period.until)} · ${period.activity}${period.zone ? ` · ${options.label(period.zone)}` : ''}`
          periods.append(item)
        }
        agenda.append(summary, transport, periods); card.append(agenda)
      }
      const consideration = document.createElement('p'); consideration.className = 'npc-consideration'
      consideration.innerHTML = `<span aria-hidden="true">♥</span> Considération <strong>${getConsideration(npc.id)} %</strong>`
      card.append(consideration)
      for (const request of getNPCRequests(npc.id)) {
        const action = document.createElement('button'); action.className = 'venue-person-service npc-request'
        action.dataset.npcService = `request:${request.id}`; action.dataset.person = npc.id
        const title = document.createElement('b'), description = document.createElement('span'), cost = document.createElement('small')
        title.textContent = `! ${request.title}`; description.textContent = isRequestAccepted(request.id) ? 'Demande en cours · Voir les détails' : 'Bae a besoin de votre aide · Écouter sa demande'
        cost.textContent = `${request.money.toLocaleString('fr-FR')} Nkap · ${getMoneyBalance() < request.money ? 'Solde insuffisant pour payer' : 'Paiement après confirmation'}`
        action.append(title, description, cost); card.append(action)
      }
      for (const request of getCompletedNPCRequests(npc.id)) {
        const done = document.createElement('p'); done.className = 'npc-improvement-done'; done.textContent = `✓ ${request.title} — payé`; card.append(done)
      }
      if(npc.id==='makala'&&zone==='ministry'){
        const action=document.createElement('button');action.className='venue-person-service';action.dataset.makalaCanteen=''
        action.innerHTML='<b>Menu de la cantine</b><span>Consulter les plats du jour · service de 11h à 14h.</span>'
        action.onclick=()=>{if(options.travelling()||options.currentZone()!=='ministry'||!getNPCsAtZone('ministry').some(n=>n.id==='makala'))return;dialog.close();canteen.open('people')}
        card.append(action)
      }
      if(npc.id==='anneke'&&zone==='ministry'){
        const action=document.createElement('button');action.className='venue-person-service';action.dataset.annekeExtra=''
        action.innerHTML='<b>Commande de taf extra</b><span>Choisir votre commande du soir · échéance aujourd’hui à 23h.</span>'
        action.onclick=()=>{if(options.travelling()||options.currentZone()!=='ministry'||!getNPCsAtZone('ministry').some(n=>n.id==='anneke'))return;dialog.close();extra.open('accept')}
        card.append(action)
      }
      if(npc.id==='bae'&&zone==='home'){
        const state=getToqueState(),action=document.createElement('button');action.className='venue-person-service';action.dataset.toqueOpen=''
        action.innerHTML=`<b>Cotiser au Toqué</b><span>${state.contributed.toLocaleString('fr-FR')} / ${state.target.toLocaleString('fr-FR')} Nkap · ${state.complete?'Objectif atteint':'Voir la cotisation'}</span>`
        action.onclick=()=>{if(options.travelling()||options.currentZone()!=='home'||!isNPCAvailable('bae'))return;dialog.close();toque.open()}
        card.append(action)
      }
      if((npc.id==='bae'&&zone==='home')||(npc.id==='crystal'&&zone==='palms'&&state?.activity.toLowerCase().includes('temps libre'))){
        const invite=document.createElement('button');invite.className='venue-person-service';invite.dataset.inviteNpc=npc.id
        invite.innerHTML='<b>Proposer une sortie</b><span>Cinéma ou snack · devis pour deux avec retour.</span>'
        invite.onclick=()=>{if(options.travelling()||options.currentZone()!==zone)return;dialog.close();options.invite(npc.id)}
        card.append(invite)
      }
      const offers=missionRules.missions.filter(m=>m.giver===npc.id)
      if(offers.length&&zone==='ministry'){
        const action=document.createElement('button');action.className='venue-person-service';action.dataset.missionGiver=npc.id
        action.innerHTML='<b>Missions professionnelles</b><span>Consulter les offres, vos objectifs et rendre compte.</span>'
        action.onclick=()=>{
          if(options.travelling()||options.currentZone()!=='ministry'||!getNPCsAtZone('ministry').some(n=>n.id===npc.id))return
          const selected=offers.find(m=>getMissionState(m.id)?.stage==='ready')??offers.find(m=>getMissionState(m.id)?.stage==='active')??offers[0]!
          dialog.close();missions.open(selected.id,()=>{if(options.currentZone()!=='ministry'||options.travelling())return;render();setTab('people');if(!dialog.open)dialog.showModal()})
        }
        card.append(action)
      }
      for (const service of npc.services) {
        const action = document.createElement('button'); action.className = 'venue-person-service'; action.dataset.npcService = service.id; action.dataset.person = npc.id
        const title = document.createElement('b'), description = document.createElement('span'), cost = document.createElement('small')
        title.textContent = service.label; description.textContent = service.description; cost.textContent = service.costLabel
        action.append(title, description, cost); card.append(action)
      }
      people.append(card)
    }
  }
  // Ne fait pas confiance à une ancienne carte DOM : revérifie la présence et l’action autorisée avant interaction.
  people.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-npc-service]')
    if (!button || options.travelling() || options.currentZone() !== zone) return
    const npc = getNPCsAtZone(zone).find(item => item.id === button.dataset.person)
    if (!npc || !isNPCAvailable(npc.id) || !(npc.services.some(service => service.id === button.dataset.npcService) || getNPCRequests(npc.id).some(request => `request:${request.id}` === button.dataset.npcService))) { renderPeople(); return }
    dialog.close()
    options.interact(npc.id, button.dataset.npcService!)
  })
  onGameTimeChange(() => { if (dialog.open) { renderPeople(); renderWorkEntry() } })
  onNPCRelationshipChange(() => { if (dialog.open) renderPeople() })
  onMissionChange(()=>{if(dialog.open){renderPeople();renderWorkEntry()}})
  onToqueChange(()=>{if(dialog.open)renderPeople()})
  onComfortChange(()=>{if(dialog.open)renderWorkEntry()})
  onCityOutingChange(()=>{if(dialog.open)renderWorkEntry()})
  const close = () => dialog.close()
  dialog.querySelector('.venue-close')!.addEventListener('click', close)
  dialog.querySelector('.venue-cancel')!.addEventListener('click', close)
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return
    const r = dialog.getBoundingClientRect()
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close()
  })
  function render() {
    const food=bagFoods.find(f=>f.zone===zone);takeaway.hidden=!food
    if(food)takeaway.innerHTML=`<b>${food.name}</b><span class="venue-description">Pour plus tard · 1 emplacement dans le sac</span><span class="travel-costs">${food.money} Nkap · achat 5 min · conservation ${food.life/60} h</span><span class="venue-gains">À consommer ensuite : +${food.energy} énergie · +${food.mood} humeur de base</span>`

    const money = getMoneyBalance(), resources = getPlayerResources()
    list.innerHTML = (zone==='home'?`<button class="venue-service" data-service="home-meals"><b>Manger à la maison</b><span class="venue-description">Bouillie et beignets, riz sauce arachide ou ndolé et plantain.</span><span class="travel-costs">Dès 150 Nkap · un repas par service</span><span class="venue-gains">Énergie + humeur</span></button>`:'') + getVenueServices(zone).map(service => {
      if(service.id==='home-sleep')return `<button class="venue-service" data-service="home-sleep"><b>Dormir</b><span class="venue-description">30 min–16 h</span><span class="travel-costs">Gratuit · durée au choix</span><span class="venue-gains">Récupération selon la durée</span></button>`
      const reason = money < service.money ? 'Argent insuffisant' : resources.energy < service.energyCost ? 'Énergie insuffisante' : ''
      const projection=projectVenueEnergy(service),energyGain=projection.energyGain
      const energyReward = service.fullEnergy || service.energyGain ? `<span class="venue-energy-gain"><img src="${options.base}ui/currency-energy.png" alt=""/><strong>${service.fullEnergy ? 'Recharge complète' : `+${service.energyGain} énergie`}</strong></span><span class="venue-energy-preview">${energyGain > 0 ? `${resources.energy} → ${projection.energyAfter} / ${projection.maxEnergyAfter} (+${energyGain} à la fin)` : `Fin : ${projection.energyAfter} / ${projection.maxEnergyAfter}${projection.energyLoss?" · baisse de capacité":" · énergie pleine"}`}</span>` : ''
      const visibleMood=previewMoodChange(service.moodGain).delta
      const otherGains = [visibleMood < 0 ? `<span class="venue-penalty">${visibleMood} humeur</span>` : visibleMood ? `+${visibleMood} humeur` : service.moodGain ? 'Humeur affichée inchangée' : '', service.respoGain ? `+${service.respoGain} points Respo` : ''].filter(Boolean).join(' · ')
      const energyCost = service.energyCost ? `<span><img src="${options.base}ui/currency-energy.png" alt=""/>−${service.energyCost} énergie</span>` : ''
      return `<button class="venue-service" data-service="${service.id}" ${reason ? 'disabled' : ''}><b>${service.name}</b><span class="venue-description">${service.description}</span><span class="venue-section-label">Coûts</span><span class="travel-costs"><span><img src="${options.base}ui/currency-nkap.png" alt="Argent"/>${service.money ? service.money.toLocaleString('fr-FR') : 'Gratuit'}</span>${energyCost}<span>◷ ${service.minutes} min</span></span><span class="venue-gains"><span class="venue-section-label">Gains et effets</span>${energyReward}<span class="venue-other-gains">${otherGains}</span></span>${reason ? `<small>${reason}</small>` : ''}</button>`
    }).join('')
    renderPeople()
    renderWorkEntry()
  }
  list.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-service]')
    if (!button || button.disabled || selecting || performance.now() < readyAt || options.travelling() || options.currentZone() !== zone) return
    if(button.dataset.service==='home-meals'){dialog.close();meals.open();return}
    if(button.dataset.service==='home-sleep'){dialog.close();sleeping.open();return}
    selecting = true
    // Le court verrou évite qu’un double clic applique deux fois un service après reconstruction de la liste.
    readyAt = performance.now() + 500
    const before = getPlayerResources()
    const outcome = useVenueService(button.dataset.service!, zone)
    result.hidden = false
    if (!outcome.ok) result.textContent = outcome.reason
    else {
      const after = getPlayerResources()
      const details = [outcome.mood ? `${outcome.mood > 0 ? '+' : ''}${outcome.mood} humeur` : '', outcome.respo ? `+${outcome.respo} points Respo` : ''].filter(Boolean).join(' · ')
      const energyMessage = outcome.energy > 0 ? `+${outcome.energy} énergie` : outcome.energy < 0 ? `${outcome.energy} énergie` : after.energy === after.maxEnergy ? 'Énergie déjà au maximum' : 'Énergie inchangée'
      result.innerHTML = `<b>${outcome.service.name} terminé</b><span class="venue-energy-result"><img src="${options.base}ui/currency-energy.png" alt="Énergie"/><strong>${energyMessage}</strong></span><span>${before.energy} → ${after.energy} / ${after.maxEnergy}</span><small>${outcome.service.minutes} min écoulées${details ? ` · ${details}` : ''}</small>`
    }
    render()
    selecting = false
    // Return focus to the same service after the list updates.
    list.querySelector<HTMLButtonElement>(`[data-service="${button.dataset.service}"]`)?.focus({ preventScroll: true })
    popupScroller(dialog).scrollTop = 0
  })
  return {
    workState: () => work.snapshot(),
    advancedState: () => advanced.snapshot(),
    sleepState: () => sleeping.snapshot(),
    mealState: () => meals.snapshot(),
    queueState: () => userQueue.snapshot(),
    meetingState: () => meetings.snapshot(),
    extraState: () => extra.snapshot(),
    canteenState: () => canteen.snapshot(),
    missionState: () => missions.snapshot(),
    toqueState: () => toque.snapshot(),
    comfortState: () => comfort.snapshot(),
    outingState: () => outings.snapshot(),
    open(key: string, tab: 'place' | 'people' = 'place') {
      if (options.travelling() || options.currentZone() !== key) return
      zone = key
      dialog.querySelector('#venue-title')!.textContent = options.label(key)
      result.textContent = ''
      result.hidden = true
      render()
      setTab(tab)
      if (!dialog.open) dialog.showModal()
    },
  }
}
