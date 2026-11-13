/*
 * Calendrier persistant du jeu : les minutes sont comptées depuis le lundi de la semaine 1.
 * Seules les actions explicites avancent cette horloge ; les animations ne la modifient jamais.
 */

import { loc, getLanguage } from './i18n.ts'
// Events advance the calendar explicitly. Real time never changes it.
const storageKey = 'mboa-game-minutes-v1'
const days = [loc('Lundi'), loc('Mardi'), loc('Mercredi'), loc('Jeudi'), loc('Vendredi'), loc('Samedi'), loc('Dimanche')]
let minutes = 8 * 60
try {
  const saved = localStorage.getItem(storageKey)
  if (saved !== null && Number.isSafeInteger(Number(saved)) && Number(saved) >= 0) minutes = Number(saved)
} catch { /* The calendar also works when browser storage is unavailable. */ }

export type TimeKind='awake'|'sleep'
export type TimeAdvance={from:number;to:number;kind:TimeKind}
const listeners = new Set<(event:TimeAdvance) => void>()

// Dérive heure, jour et semaine d’un seul compteur pour éviter des sauvegardes incohérentes.
export function getGameTime() { return getGameTimeAt(minutes) }

// Projection pure pour les aperçus : consulter une heure future ne modifie pas le calendrier.
export function getGameTimeAt(totalMinutes: number) {
  if (!Number.isSafeInteger(totalMinutes) || totalMinutes < 0) throw new RangeError(loc('Date de jeu invalide.'))
  const day = Math.floor(totalMinutes / 1440)
  return {
    time: `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`,
    day: days[day % 7]!,
    week: Math.floor(day / 7) + 1,
    minuteOfDay: totalMinutes % 1440,
    totalMinutes,
  }
}

// Nom du jour en minuscule en français (« samedi »), avec sa majuscule en anglais (« Saturday »).
const dayWord = (total: number) => { const name = days[Math.floor(total / 1440) % 7]!; return getLanguage() === 'fr' ? name.toLowerCase() : name }
// Heure courte : « 18h », « 11h35 » en français ; « 18:00 » en anglais.
export function hourLabel(total: number) {
  const h = Math.floor(total / 60) % 24, m = total % 60
  return getLanguage() !== 'fr' ? `${h}:${String(m).padStart(2, '0')}` : m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}
// « Fermé · ouvre à 18h », « … demain à 7h », « … samedi à 12h » : la prochaine ouverture à côté de la fermeture.
export function closedUntil(next: number | null, total: number, withHour = true) {
  if (next === null || !Number.isSafeInteger(next) || next <= total) return loc('Fermé à cette heure.')
  const hour = hourLabel(next)
  const gap = Math.floor(next / 1440) - Math.floor(total / 1440)
  if (!withHour) return gap === 1 ? loc('Fermé · ouvre demain.') : loc('Fermé · ouvre {0}.', dayWord(next))
  return gap === 0 ? loc('Fermé · ouvre à {0}.', hour) : gap === 1 ? loc('Fermé · ouvre demain à {0}.', hour) : loc('Fermé · ouvre {0} à {1}.', dayWord(next), hour)
}

// Ajoute une durée entière en minutes, sauvegarde puis avertit les menus et les routines.
export function advanceGameTime(elapsedMinutes: number,kind:TimeKind='awake') {
  if (!Number.isSafeInteger(elapsedMinutes) || elapsedMinutes < 0 || !Number.isSafeInteger(minutes + elapsedMinutes)) {
    throw new RangeError(loc('La durée doit être un nombre entier positif de minutes.'))
  }
  if(kind!=='awake'&&kind!=='sleep')throw new RangeError(loc('Type de temps invalide.'))
  const from=minutes
  minutes += elapsedMinutes
  try { localStorage.setItem(storageKey, String(minutes)) } catch { /* Keep the current session usable. */ }
  listeners.forEach(listener => listener({from,to:minutes,kind}))
}

// Retourne une fonction de désabonnement pour les interfaces qui seraient démontées.
export function onGameTimeChange(listener: (event:TimeAdvance) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function mountGameClock(element: HTMLElement) {
  const update = () => {
    const value = getGameTime()
    element.querySelector('#game-time')!.textContent = value.time
    element.querySelector('#game-day')!.textContent = value.day
    element.querySelector('#game-week')!.textContent = loc('Semaine {0}',value.week)
    element.setAttribute('aria-label', loc('{0}, {1}, semaine {2}',value.time,value.day,value.week))
  }
  listeners.add(update)
  update()
  return () => listeners.delete(update)
}
