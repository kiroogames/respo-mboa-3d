/*
 * Retours de jeu communs : petits sons synthétisés, appui des boutons, refus visibles et alertes de besoins.
 * Tout est déduit de l'interface existante (clics, fenêtres, messages d'erreur, compteurs) : aucune règle de jeu ne change.
 */
import './game-feedback.css'

export type Sound = 'click' | 'open' | 'close' | 'coin' | 'gain' | 'loss' | 'error'
const soundKey = 'mboa-sound-v1'
let muted = false
try { muted = localStorage.getItem(soundKey) === 'off' } catch { /* Préférence non disponible : son actif. */ }
let audio: AudioContext | null = null

// Chaque son est une courte suite de notes : [fréquence de départ, fréquence d'arrivée, début (s), durée (s)].
const notes: Record<Sound, { wave: OscillatorType; volume: number; steps: [number, number, number, number][] }> = {
  click: { wave: 'triangle', volume: .05, steps: [[1300, 900, 0, .035]] },
  open: { wave: 'sine', volume: .06, steps: [[420, 720, 0, .12]] },
  close: { wave: 'sine', volume: .05, steps: [[620, 360, 0, .1]] },
  coin: { wave: 'triangle', volume: .07, steps: [[1320, 1320, 0, .07], [1980, 1980, .07, .16]] },
  gain: { wave: 'sine', volume: .06, steps: [[660, 660, 0, .08], [880, 880, .08, .14]] },
  loss: { wave: 'sine', volume: .045, steps: [[340, 220, 0, .16]] },
  error: { wave: 'square', volume: .035, steps: [[190, 170, 0, .08], [190, 170, .11, .1]] },
}

export function playSound(sound: Sound) {
  if (muted || !audio || audio.state !== 'running') return
  const { wave, volume, steps } = notes[sound], now = audio.currentTime
  for (const [from, to, start, length] of steps) {
    const osc = audio.createOscillator(), gain = audio.createGain()
    osc.type = wave
    osc.frequency.setValueAtTime(from, now + start); osc.frequency.exponentialRampToValueAtTime(to, now + start + length)
    gain.gain.setValueAtTime(0, now + start); gain.gain.linearRampToValueAtTime(volume, now + start + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + start + length)
    osc.connect(gain).connect(audio.destination); osc.start(now + start); osc.stop(now + start + length + .02)
  }
}

export function mountGameFeedback() {
  // Le navigateur n'autorise le son qu'après un geste du joueur.
  const unlock = () => { try { audio ??= new AudioContext(); if (audio.state === 'suspended') void audio.resume() } catch { /* Pas d'audio. */ } }
  let lastGesture = 0
  document.addEventListener('pointerdown', event => {
    unlock(); lastGesture = performance.now()
    const hit = document.elementFromPoint(event.clientX, event.clientY)
    // Un bouton grisé ne reçoit pas le clic : il tremble pour dire « pas possible maintenant ».
    const refused = hit?.closest<HTMLElement>('button:disabled,[aria-disabled="true"]')
    if (refused) { shake(refused); playSound('error'); return }
    if (hit?.closest('button,[role="button"],a[href]')) playSound('click')
  }, true)
  document.addEventListener('keydown', event => { unlock(); lastGesture = performance.now(); if ((event.key === 'Enter' || event.key === ' ') && (event.target as HTMLElement | null)?.closest?.('button')) playSound('click') }, true)

  // Ouverture et fermeture des fenêtres.
  new MutationObserver(records => {
    for (const record of records) {
      const dialog = record.target as HTMLElement
      if (dialog.tagName !== 'DIALOG' || !dialog.classList.contains('travel-dialog')) continue
      const open = dialog.hasAttribute('open')
      if (open !== (record.oldValue !== null)) playSound(open ? 'open' : 'close')
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'], attributeOldValue: true })

  // Message d'erreur qui apparaît juste après une action du joueur : la fenêtre tremble.
  const shown = new WeakMap<Element, string>()
  new MutationObserver(() => {
    for (const alert of document.querySelectorAll<HTMLElement>('dialog[open] [role="alert"]')) {
      const text = alert.hidden ? '' : alert.textContent?.trim() ?? ''
      if (text && text !== shown.get(alert) && performance.now() - lastGesture < 800) { shake(alert.closest<HTMLElement>('dialog') ?? alert); playSound('error') }
      shown.set(alert, text)
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] })

  // Besoins au plus bas : le compteur d'énergie clignote doucement (l'humeur basse a déjà data-level=low).
  const energy = document.querySelector<HTMLElement>('#energy-amount'), energyTile = document.querySelector<HTMLElement>('#energy-counter')
  if (energy && energyTile) {
    const sync = () => { const value = Number((energy.textContent ?? '').split('/')[0]!.replace(/\D/g, '')); energyTile.dataset.alert = value <= 20 ? 'low' : '' }
    new MutationObserver(sync).observe(energy, { childList: true, characterData: true, subtree: true }); sync()
  }

  // Interrupteur du son dans le menu.
  const actions = document.querySelector<HTMLElement>('.header-actions')
  if (actions) {
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.id = 'sound-toggle'
    const render = () => { toggle.innerHTML = muted ? '🔇 <span>Son coupé</span>' : '🔊 <span>Son activé</span>'; toggle.setAttribute('aria-pressed', String(!muted)) }
    toggle.onclick = () => { muted = !muted; try { localStorage.setItem(soundKey, muted ? 'off' : 'on') } catch { /* Préférence pour cette session. */ } render(); playSound('click') }
    render(); actions.append(toggle)
  }
}

function shake(element: HTMLElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  element.classList.remove('feedback-shake'); void element.offsetWidth; element.classList.add('feedback-shake')
  element.addEventListener('animationend', () => element.classList.remove('feedback-shake'), { once: true })
}
