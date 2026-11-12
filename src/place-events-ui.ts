/*
 * Lieux d'événement sur la carte : quand il se passe quelque chose d'important (tontine, mariage ou deuil,
 * match des Lions, cabaret, mission en cours), l'étiquette du lieu devient dorée et pulse, et un ruban
 * dit quoi et jusqu'à quand. Un événement qui commence dans les 3 heures est annoncé « bientôt ».
 */
import { loc } from './i18n.ts'
import { getGameTime, onGameTimeChange } from './game-clock'
import { getVenueServices, venueServiceReason } from './venue-services'
import { missionRules, getMissionState, onMissionChange } from './pro-missions'

type PlaceEvent = { icon: string; text: string; soon: boolean }
const watched: Record<string, string> = { tontine: '🤝', ceremony: '🎉', 'fun-lions': '⚽', 'fun-cabaret': '🎤' }
const hour = (minute: number) => `${Math.floor(minute / 60) % 24} h${minute % 60 ? String(minute % 60).padStart(2, '0') : ''}`

function eventsAt(zone: string): PlaceEvent[] {
  const time = getGameTime().totalMinutes, minute = time % 1440, day = Math.floor(time / 1440) % 7, events: PlaceEvent[] = []
  for (const service of getVenueServices(zone)) {
    const icon = watched[service.id] ?? (service.special ? watched[service.special] : undefined)
    if (!icon) continue
    const name = service.name.replace(/ au (bar|village)$/, '')
    const deuil = /deuil/i.test(service.name)
    if (!venueServiceReason(service)) { events.push({ icon: deuil ? '🕊️' : icon, text: loc('{0} · jusqu’à {1}', name, hour(service.closing ?? 1440)), soon: false }); continue }
    const opening = service.opening ?? 0, today = !service.days || service.days.includes(day)
    if (today && opening > minute && opening - minute <= 180) events.push({ icon: deuil ? '🕊️' : icon, text: loc('Bientôt : {0} à {1}', name, hour(opening)), soon: true })
  }
  for (const mission of missionRules.missions) {
    const stage = getMissionState(mission.id)?.stage
    if (mission.zone === zone && (stage === 'active' || stage === 'ready')) events.push({ icon: '📋', text: stage === 'ready' ? loc('Mission à rendre') : loc('Mission : {0}', mission.title), soon: false })
  }
  return events
}

export function mountPlaceEvents() {
  function refresh() {
    for (const label of document.querySelectorAll<HTMLElement>('#landmarks .landmark[data-view]')) {
      const events = eventsAt(label.dataset.view!), main = events.find(e => !e.soon) ?? events[0]
      const key = main ? `${main.soon}|${main.icon}|${main.text}|${events.length}` : ''
      if (label.dataset.event === key) continue
      label.dataset.event = key
      let ribbon = label.querySelector<HTMLElement>(':scope > .landmark-event')
      label.classList.toggle('has-event', !!main && !main.soon)
      label.classList.toggle('has-event-soon', !!main && main.soon)
      if (!main) { ribbon?.remove(); continue }
      if (!ribbon) { ribbon = document.createElement('span'); ribbon.className = 'landmark-event'; ribbon.setAttribute('aria-hidden', 'true'); label.append(ribbon) }
      ribbon.textContent = `${main.icon} ${main.text}${events.length > 1 ? ` · +${events.length - 1}` : ''}`
      label.title = events.map(e => `${e.icon} ${e.text}`).join('\n')
    }
  }
  onGameTimeChange(() => queueMicrotask(refresh)); onMissionChange(refresh)
  const root = document.querySelector('#landmarks')
  if (root) new MutationObserver(refresh).observe(root, { childList: true })
  refresh()
}
