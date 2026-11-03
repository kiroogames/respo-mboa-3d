/* Ambiance horaire : seul le rendu est différé, jamais le calendrier ou les routines. */
import { getGameTime, onGameTimeChange } from './game-clock'

import { loc } from './i18n.ts'

export type DayPeriod = 'Aube' | 'Jour' | 'Crépuscule' | 'Nuit'
export function getDayPeriod(minute: number): DayPeriod {
  const time = ((minute % 1440) + 1440) % 1440
  return time < 300 || time >= 1140 ? 'Nuit' : time < 420 ? 'Aube' : time < 1020 ? 'Jour' : 'Crépuscule'
}

export function mountDaylight(options: {
  button: HTMLButtonElement; label: HTMLElement; canApply: () => boolean
  apply: (period: DayPeriod) => void
}) {
  const key = 'mboa-daylight-v1'
  let enabled = true
  try { enabled = localStorage.getItem(key) !== 'false' } catch { /* Préférence facultative. */ }
  let applied: DayPeriod | null = null
  function updateLabel() {
    const period = getDayPeriod(getGameTime().minuteOfDay)
    options.label.textContent = loc(period)
    options.label.title = enabled ? loc('Ambiance liée à l’heure') : loc('Lumière de jour pour la lisibilité')
    options.button.setAttribute('aria-pressed', String(enabled))
    options.button.setAttribute('aria-label', enabled ? loc('Désactiver l’ambiance horaire') : loc('Activer l’ambiance horaire'))
    options.button.title = enabled ? loc('Ambiance horaire activée') : loc('Lumière de jour · activer l’ambiance horaire')
    options.button.textContent = enabled ? '◐' : '☀'
  }
  // Appelé par le rendu : regroupe les changements pendant les activités en une seule application.
  function tick() {
    const target = enabled ? getDayPeriod(getGameTime().minuteOfDay) : 'Jour'
    if (target !== applied && options.canApply()) { options.apply(target); applied = target }
  }
  options.button.onclick = () => {
    enabled = !enabled
    try { localStorage.setItem(key, String(enabled)) } catch { /* Mode privé. */ }
    updateLabel(); tick()
  }
  onGameTimeChange(updateLabel); updateLabel()
  return { tick, snapshot: () => ({ enabled, period: getDayPeriod(getGameTime().minuteOfDay), applied, pending: (enabled ? getDayPeriod(getGameTime().minuteOfDay) : 'Jour') !== applied }) }
}
