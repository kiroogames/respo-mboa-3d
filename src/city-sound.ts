/*
 * Ambiance sonore de la ville, entièrement synthétisée : circulation, klaxons, motos, oiseaux ou grillons,
 * vagues et marché selon l'endroit regardé, avions, et bruit du véhicule pendant un trajet.
 * Plus la caméra est proche, plus la ville s'entend. Le bouton Son du menu coupe tout.
 */
import { isSoundMuted, soundContext } from './game-feedback'

type Mode = 'walk' | 'taxi' | 'yonga' | 'moto'
type Listener = { x: number; z: number; radius: number }
export type CityState = { listener: () => Listener; traffic: () => 'clear' | 'busy' | 'jammed'; evening: () => boolean; planeRoar: () => number; quiet: () => boolean }

const MARKET = [-78, 45], AIRPORT = [190, -65]
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))

export function mountCitySound(state: CityState) {
  let ctx: AudioContext | null = null, master: GainNode, meter: AnalyserNode
  let rumble: GainNode, surf: GainNode, crowd: GainNode, roar: GainNode, cricket: GainNode, engine: GainNode, engineOsc: OscillatorNode
  let nextHorn = 0, nextMoto = 0, nextBird = 0, nextStep = 0, trip: Mode | null = null

  const noise = (c: AudioContext) => {
    const buffer = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5 }
    return buffer
  }
  // Boucle de bruit filtrée, au volume réglé ensuite image par image.
  function bed(c: AudioContext, buffer: AudioBuffer, type: BiquadFilterType, frequency: number, q = 1) {
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain()
    source.buffer = buffer; source.loop = true; filter.type = type; filter.frequency.value = frequency; filter.Q.value = q; gain.gain.value = 0
    source.connect(filter).connect(gain).connect(master); source.start()
    return gain
  }
  function start(c: AudioContext) {
    ctx = c; master = c.createGain(); master.gain.value = 0; meter = c.createAnalyser(); master.connect(meter); master.connect(c.destination)
    const buffer = noise(c)
    rumble = bed(c, buffer, 'lowpass', 420); surf = bed(c, buffer, 'bandpass', 620, .5); crowd = bed(c, buffer, 'bandpass', 950, 1.2); roar = bed(c, buffer, 'bandpass', 480, .6)
    // Grillons : une note aiguë hachée.
    const chirp = c.createOscillator(), pulse = c.createOscillator(), pulseGain = c.createGain(); cricket = c.createGain(); cricket.gain.value = 0
    chirp.frequency.value = 4300; pulse.type = 'square'; pulse.frequency.value = 11; pulseGain.gain.value = .5
    pulse.connect(pulseGain.gain); chirp.connect(pulseGain).connect(cricket).connect(master); chirp.start(); pulse.start()
    // Moteur du trajet en cours.
    engineOsc = c.createOscillator(); engineOsc.type = 'sawtooth'; const engineFilter = c.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 600
    engine = c.createGain(); engine.gain.value = 0; engineOsc.connect(engineFilter).connect(engine).connect(master); engineOsc.start()
  }
  function tone(type: OscillatorType, from: number, to: number, at: number, length: number, volume: number, cutoff = 4000) {
    const c = ctx!, osc = c.createOscillator(), gain = c.createGain(), filter = c.createBiquadFilter()
    osc.type = type; filter.type = 'lowpass'; filter.frequency.value = cutoff
    osc.frequency.setValueAtTime(from, at); osc.frequency.exponentialRampToValueAtTime(to, at + length)
    gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(volume, at + Math.min(.03, length / 3)); gain.gain.setValueAtTime(volume, at + length * .7); gain.gain.exponentialRampToValueAtTime(.0001, at + length)
    osc.connect(filter).connect(gain).connect(master); osc.start(at); osc.stop(at + length + .03)
  }
  // Klaxon : souvent deux coups brefs, parfois un long quand ça bouchonne.
  function horn(now: number, angry: boolean) {
    const pitch = 330 + Math.random() * 190, volume = .03 + Math.random() * .025, count = angry && Math.random() < .35 ? 1 : 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const at = now + i * .24, length = count === 1 ? (angry ? .55 + Math.random() * .6 : .22) : .14
      tone('square', pitch, pitch, at, length, volume, 1500); tone('square', pitch * 1.26, pitch * 1.26, at, length, volume * .7, 1500)
    }
  }
  function moto(now: number) {
    const base = 95 + Math.random() * 50, length = 1.6 + Math.random() * 1.4
    tone('sawtooth', base, base * 1.6, now, length, .035, 900)
  }
  function bird(now: number) {
    const count = 2 + Math.floor(Math.random() * 4), base = 2300 + Math.random() * 1700
    for (let i = 0; i < count; i++) tone('sine', base, base * (Math.random() < .5 ? 1.25 : .82), now + i * .13, .09, .018)
  }
  const fade = (gain: GainNode, value: number) => gain.gain.setTargetAtTime(value, ctx!.currentTime, .35)

  function tick() {
    const c = soundContext()
    if (!c || c.state !== 'running') return
    if (!ctx) start(c)
    const now = c.currentTime, { x, z, radius } = state.listener(), level = state.traffic(), night = state.evening()
    // Proche = fort, vue d'ensemble = fond discret ; une fenêtre ouverte laisse passer la ville en sourdine.
    const closeness = clamp(1.15 - radius / 420, .3, 1), base = isSoundMuted() || document.hidden ? 0 : closeness * (state.quiet() ? .4 : .85)
    fade(master, base)
    const busy = level === 'jammed' ? 1 : level === 'busy' ? .62 : .35
    fade(rumble, .32 * busy * (night ? .55 : 1))
    fade(surf, .34 * clamp(1 - Math.abs(z + 170) / 75) * (.75 + .25 * Math.sin(now * .55)))
    fade(crowd, .14 * clamp(1 - Math.hypot(x - MARKET[0]!, z - MARKET[1]!) / 85) * (night ? .15 : 1))
    fade(roar, .55 * state.planeRoar() * clamp(1.25 - Math.hypot(x - AIRPORT[0]!, z - AIRPORT[1]!) / 380))
    fade(cricket, night ? .012 : 0)
    if (now > nextHorn) {
      horn(now, level === 'jammed')
      const wait = level === 'jammed' ? 1 + Math.random() * 3 : level === 'busy' ? 5 + Math.random() * 8 : 14 + Math.random() * 18
      nextHorn = now + wait * (night ? 2.5 : 1)
    }
    if (now > nextMoto) { moto(now); nextMoto = now + (night ? 14 : 4) + Math.random() * 9 }
    if (!night && now > nextBird) { bird(now); nextBird = now + 5 + Math.random() * 11 }
    // Trajet : moteur selon le véhicule, ou pas de marche.
    if (trip === 'walk') { fade(engine, 0); if (now > nextStep) { tone('triangle', 130, 70, now, .07, .05, 500); nextStep = now + .46 } }
    else if (trip) { engineOsc.frequency.setTargetAtTime(trip === 'moto' ? 118 + 16 * Math.sin(now * 2.7) : 62 + 7 * Math.sin(now * 1.3), now, .2); fade(engine, trip === 'moto' ? .05 : .065) }
    else fade(engine, 0)
  }
  return {
    tick,
    setTrip(mode: Mode | null) { trip = mode },
    // Contrôle : niveau du signal réellement produit.
    level() {
      if (!ctx) return { running: false, peak: 0 }
      const data = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(data)
      return { running: ctx.state === 'running', peak: data.reduce((max, v) => Math.max(max, Math.abs(v)), 0) }
    },
  }
}
