/*
 * Calendrier persistant du jeu : les minutes sont comptées depuis le lundi de la semaine 1.
 * Seules les actions explicites avancent cette horloge ; les animations ne la modifient jamais.
 */

// Events advance the calendar explicitly. Real time never changes it.
const storageKey = 'mboa-game-minutes-v1'
const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
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
  if (!Number.isSafeInteger(totalMinutes) || totalMinutes < 0) throw new RangeError('Date de jeu invalide.')
  const day = Math.floor(totalMinutes / 1440)
  return {
    time: `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`,
    day: days[day % 7]!,
    week: Math.floor(day / 7) + 1,
    minuteOfDay: totalMinutes % 1440,
    totalMinutes,
  }
}

// Ajoute une durée entière en minutes, sauvegarde puis avertit les menus et les routines.
export function advanceGameTime(elapsedMinutes: number,kind:TimeKind='awake') {
  if (!Number.isSafeInteger(elapsedMinutes) || elapsedMinutes < 0 || !Number.isSafeInteger(minutes + elapsedMinutes)) {
    throw new RangeError('La durée doit être un nombre entier positif de minutes.')
  }
  if(kind!=='awake'&&kind!=='sleep')throw new RangeError('Type de temps invalide.')
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
    element.querySelector('#game-week')!.textContent = `Semaine ${value.week}`
    element.setAttribute('aria-label', `${value.time}, ${value.day}, semaine ${value.week}`)
  }
  listeners.add(update)
  update()
  return () => listeners.delete(update)
}
