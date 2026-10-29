import {getMealEnergyEffect,onMealEnergyEffectChange} from './meal-energy.ts'
import {getRestedEffect,onRestedEffectChange} from './rested-energy.ts'
import {getFatigueAt,onFatigueChange} from './fatigue.ts'
import type {TimeKind} from './game-clock.ts'
import {getSportEffect,onSportEffectChange} from './sport-energy.ts'
import {getGameTime} from './game-clock.ts'
import { getComfortMoodEffect } from './comfort-mood.ts'
import { onComfortChange } from './home-comfort.ts'
import { getRespoProgress,levelEnergyBonus } from './respo-level.ts'
/*
 * État central du personnage : karma, énergie, points Respo et humeur.
 * Les bornes sont appliquées ici pour que tous les menus utilisent les mêmes règles.
 */

const storageKey = 'mboa-player-resources-v1'
let state = { karma: 0, energy: 100, maxEnergy: 100, ptRespo: 0, respoNext: 190, mood: 90 }
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
  if (saved && Number.isSafeInteger(saved.karma) && Number.isSafeInteger(saved.maxEnergy) && saved.maxEnergy > 0 &&
    Number.isSafeInteger(saved.energy) && saved.energy >= 0 && saved.energy <= saved.maxEnergy + 45) {
    state = {
      karma: saved.karma, energy: saved.energy, maxEnergy: saved.maxEnergy,
      ptRespo: Number.isSafeInteger(saved.ptRespo) && saved.ptRespo >= 0 ? saved.ptRespo : 0,
      respoNext: Number.isSafeInteger(saved.respoNext) && saved.respoNext > 0 ? saved.respoNext : 190,
      mood: Number.isFinite(saved.mood) ? Math.max(0, Math.min(140, saved.mood)) : 90,
    }
  }
} catch { /* Start with the initial resources if storage is unavailable or invalid. */ }

// Les seuils sauvegardés de l’ancienne version sont remplacés sans toucher au total.
state.respoNext=getRespoProgress(state.ptRespo).nextThreshold??Number.MAX_SAFE_INTEGER
state.energy=Math.min(state.energy,getEnergyMaximumAt())
const listeners = new Set<() => void>()
export function onPlayerResourcesChange(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener)}
const format = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
// Renvoie une copie : les appelants ne doivent pas contourner les validations en modifiant l’état.
export function getPlayerResources() { return { ...state, maxEnergy:getEnergyMaximumAt(), mood:getMoodDetails().displayed } }
// La sauvegarde garde la capacité de base ; le bonus est dérivé une seule fois.
export function getEnergyDetails(total=getGameTime().totalMinutes,kind:TimeKind='awake',points=state.ptRespo){
 const level=getRespoProgress(Math.min(points,Number.MAX_SAFE_INTEGER)).level,reference=state.maxEnergy,levelBonus=Math.min(levelEnergyBonus(level),Number.MAX_SAFE_INTEGER-reference),permanent=reference+levelBonus,fatigue=getFatigueAt(total,kind),fatigued=Math.max(1,Number(BigInt(permanent)*BigInt(100-fatigue.penalty)/100n)),sportBonus=Math.min(getSportEffect(total)?.bonus??0,Number.MAX_SAFE_INTEGER-fatigued)
 const restedBonus=Math.min(getRestedEffect(total)?.bonus??0,Number.MAX_SAFE_INTEGER-fatigued-sportBonus)
 const mealBonus=Math.min(getMealEnergyEffect(total)?.bonus??0,Number.MAX_SAFE_INTEGER-fatigued-sportBonus-restedBonus)
 return {reference,level,levelBonus,permanent,fatigued,fatigue,sportBonus,restedBonus,mealBonus,total:fatigued+sportBonus+restedBonus+mealBonus}
}
// État dérivé : la faim prime sur la fatigue, puis sur le surplus des bonus temporaires.
// Les produits entiers évitent les arrondis aux frontières de 10 et 30 %.
export function getEnergyStatus(){
 const details=getEnergyDetails(),energy=BigInt(state.energy),maximum=BigInt(details.total)
 if(energy*10n<maximum)return {id:'starving',label:'Affamé'}
 if(energy*10n<maximum*3n)return {id:'hungry',label:'À faim'}
 if(details.fatigue.penalty)return {id:'fatigued',label:details.fatigue.label}
 if(state.energy>details.permanent)return {id:'fit',label:'En forme'}
 return {id:'normal',label:'Normal'}
}
export function getEnergyMaximumAt(total=getGameTime().totalMinutes,kind:TimeKind='awake',points=state.ptRespo){return getEnergyDetails(total,kind,points).total}
export function projectEnergy(amount:number,end:number,start=getGameTime().totalMinutes,energy=state.energy,cost=0,kind:TimeKind='awake',points=state.ptRespo){
 const before=Math.max(0,Math.min(energy,getEnergyMaximumAt(start))-cost),maxEnergyAfter=getEnergyMaximumAt(end,kind,points)
 const energyAfter=Math.min(maxEnergyAfter,kind==='sleep'?maxEnergyAfter:getEnergyMaximumAt(start),before+amount)
 return {energyAfter,maxEnergyAfter,energyGain:Math.max(0,energyAfter-Math.min(before,maxEnergyAfter)),energyLoss:Math.max(0,before-maxEnergyAfter)}
}
onFatigueChange(()=>{state.energy=Math.min(state.energy,getEnergyMaximumAt());save()})
onMealEnergyEffectChange(()=>{state.energy=Math.min(state.energy,getEnergyMaximumAt());save()})
onRestedEffectChange(()=>{state.energy=Math.min(state.energy,getEnergyMaximumAt());save()})
onSportEffectChange(()=>{state.energy=Math.min(state.energy,getEnergyMaximumAt());save()})
// state.mood reste la valeur de fond, compatible avec les anciennes sauvegardes.
export function getMoodDetails(){
  const effect=getComfortMoodEffect(),displayed=Math.min(140,state.mood+effect.bonus)
  return {base:state.mood,bonus:effect.bonus,displayed,effect}
}
export function previewMoodChange(delta:number){
  if(!Number.isFinite(delta))throw new RangeError('Variation d’humeur invalide.')
  const before=getMoodDetails(),baseAfter=Math.max(0,Math.min(140,before.base+delta)),moodAfter=Math.min(140,baseAfter+before.bonus)
  return {baseBefore:before.base,baseAfter,bonus:before.bonus,moodBefore:before.displayed,moodAfter,delta:moodAfter-before.displayed}
}
// Un changement d’équipement actualise le HUD sans réécrire ou augmenter la valeur de fond.
onComfortChange(()=>listeners.forEach(listener=>listener()))
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)) } catch { /* Keep this session usable. */ }
  listeners.forEach(listener => listener())
}
function nonnegativeInteger(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('La valeur doit être un entier positif.')
}
export function changeKarma(delta: number) {
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(state.karma + delta)) throw new RangeError('Variation de karma invalide.')
  state.karma += delta
  save()
}
export function spendEnergy(amount: number) {
  nonnegativeInteger(amount)
  if (amount > state.energy) return false
  state.energy -= amount
  save()
  return true
}
// Une recharge est limitée à l’énergie manquante ; aucun dépassement du maximum.
export function restoreEnergy(amount: number) {
  nonnegativeInteger(amount)
  state.energy += Math.min(amount, getEnergyMaximumAt() - state.energy)
  save()
}
export function setMaxEnergy(maximum: number) {
  nonnegativeInteger(maximum)
  if (maximum === 0) throw new RangeError('L’énergie maximale doit être supérieure à zéro.')
  state.maxEnergy = maximum
  state.energy = Math.min(state.energy, getEnergyMaximumAt())
  save()
}

// Les points cumulés déterminent le niveau et son prochain seuil.
export function changeRespoPoints(delta: number) {
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(state.ptRespo + delta)) throw new RangeError('Variation de points Respo invalide.')
  state.ptRespo = Math.max(0, state.ptRespo + delta)
  state.respoNext=getRespoProgress(state.ptRespo).nextThreshold??Number.MAX_SAFE_INTEGER
  state.energy=Math.min(state.energy,getEnergyMaximumAt())
  save()
}
// Valeur de fond bornée : les variations nominales des activités agissent ici, sans cumuler le confort.
export function setMood(value: number) {
  if (!Number.isFinite(value)) throw new RangeError('Humeur invalide.')
  state.mood = Math.max(0, Math.min(140, value))
  save()
}
export function changeMood(delta: number) {
  if (!Number.isFinite(delta)) throw new RangeError('Variation d’humeur invalide.')
  setMood(state.mood + delta)
}
// Seven bands from Unity UI_HudStat; the requested range is strictly [0, 140].
export function getMoodStatus(value = getMoodDetails().displayed) {
  const labels = ['Déprimé', 'Malheureux', 'Stressé', 'Routine', 'Content', 'Heureux', 'Très heureux']
  const band = [20, 40, 60, 80, 100, 120, 140].findIndex(limit => value <= limit)
  const index = Math.max(0, band)
  return { label: labels[index]!, spriteIndex: 6 - index }
}
// Le badge d’énergie affiche la différence effective ; une énergie déjà pleine ne crée pas de faux gain.
export function mountPlayerResources(element: HTMLElement) {
  let previousEnergy = state.energy
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined
  const counter = element.querySelector<HTMLElement>('#energy-counter')!
  const feedback = document.createElement('span')
  feedback.className = 'energy-change'
  feedback.hidden = true
  counter.append(feedback)
  const update = () => {
    const karma = element.querySelector<HTMLElement>('#karma-amount')!
    const energy = element.querySelector<HTMLElement>('#energy-amount')!
    karma.textContent = format.format(state.karma)
    karma.title = `Karma : ${format.format(state.karma)} points de moralité`
    energy.textContent = `${format.format(state.energy)} / ${format.format(getEnergyMaximumAt())}`
    element.querySelector('#karma-counter')!.setAttribute('aria-label', karma.title)
    element.querySelector('#energy-counter')!.setAttribute('aria-label', `Énergie : ${state.energy} sur ${getEnergyMaximumAt()}, ${getEnergyStatus().label}`)
    const difference = state.energy - previousEnergy
    if (difference !== 0) {
      clearTimeout(feedbackTimer)
      feedback.textContent = `${difference > 0 ? '+' : ''}${format.format(difference)}`
      feedback.dataset.direction = difference > 0 ? 'gain' : 'loss'
      feedback.hidden = false
      counter.classList.toggle('energy-gained', difference > 0)
      feedbackTimer = setTimeout(() => { feedback.hidden = true; counter.classList.remove('energy-gained') }, 4000)
    }
    previousEnergy = state.energy
    const respo = element.querySelector<HTMLElement>('#respo-amount')!
    respo.textContent = `${format.format(state.ptRespo)} / ${format.format(state.respoNext)}`
    respo.title = `${state.ptRespo} points Respo, objectif du prochain niveau : ${state.respoNext}`
    const progression=getRespoProgress(state.ptRespo)
    element.querySelector('#respo-level')!.textContent=`Niv. ${progression.level}`
    respo.title=`Niveau ${progression.level} · ${progression.points} points cumulés${progression.nextThreshold===null?' · palier maximal représentable':` · encore ${progression.remaining} points avant le niveau ${progression.level+1}`}`
    if(progression.nextThreshold===null)respo.textContent=`${format.format(state.ptRespo)} · Max`
    element.querySelector('#respo-counter')!.setAttribute('aria-label',respo.title)
    const progress=element.querySelector<HTMLProgressElement>('#respo-progress')!
    progress.max=progression.needed||1;progress.value=progression.nextThreshold===null?1:progression.earned
    progress.setAttribute('aria-label',`Progression du niveau ${progression.level}`)
    progress.setAttribute('aria-valuetext',progression.nextThreshold===null?'Palier maximal':`${progression.earned} sur ${progression.needed} points pour le niveau suivant`)
    const details=getMoodDetails(),mood = getMoodStatus(details.displayed)
    element.querySelector('#mood-amount')!.textContent = format.format(details.displayed)
    element.querySelector('#mood-label')!.textContent = mood.label
    const face = element.querySelector<HTMLElement>('#mood-icon')!
    face.style.backgroundPosition = `${(mood.spriteIndex % 4) / 3 * 100}% ${Math.floor(mood.spriteIndex / 4) * 100}%`
    element.querySelector('#mood-counter')!.setAttribute('aria-label', `Humeur : ${details.displayed} sur 140, ${mood.label}. Fond ${details.base}, confort +${details.bonus}.`)
  }
  listeners.add(update)
  update()
  return () => { listeners.delete(update); clearTimeout(feedbackTimer); feedback.remove() }
}
