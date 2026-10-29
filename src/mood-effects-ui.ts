/* Consultation du seul effet de confort validé ; pas d’avance de temps ou d’action payante. */
import {getMoodDetails,getMoodStatus,onPlayerResourcesChange} from './player-resources'
import {comfortMoodTiers} from './comfort-mood'
import './mood-effects.css'
export function mountMoodEffects(options:{button:HTMLButtonElement;canOpen:()=>boolean}){
 const dialog=document.createElement('dialog');dialog.className='travel-dialog mood-effects-dialog';dialog.setAttribute('aria-labelledby','mood-effects-heading')
 dialog.innerHTML=`<button class="travel-close" data-mood-close aria-label="Fermer">×</button><span class="travel-eyebrow">COMMENT VOUS VOUS SENTEZ</span><h2 id="mood-effects-heading">Humeur et effets</h2><section class="mood-effective"><span>Humeur affichée</span><strong data-mood-displayed></strong><small data-mood-status></small></section><div class="mood-calculation"><div><span>Humeur de fond</span><b data-mood-base></b></div><span>+</span><div><span>Confort de la maison</span><b data-mood-bonus></b></div></div><p class="mood-cap" data-mood-cap></p><section class="mood-effect-card"><span data-mood-effect-status></span><h3 data-mood-effect-name></h3><p data-mood-comfort></p><p>Un seul effet lié à votre maison. Il reste actif en ville et change avec vos équipements et travaux.</p></section><details class="mood-tiers"><summary>Voir les paliers de confort</summary><div data-mood-tiers></div></details><p class="mood-explanation">Le bonus est recalculé, jamais ajouté à l’humeur de fond. Équiper plusieurs fois ou recharger ne le cumule pas. Les activités modifient l’humeur de fond ; leurs aperçus montrent la variation visible après plafonnement.</p><button class="mood-effects-back" data-mood-back type="button">Retour à la ville</button>`
 document.body.append(dialog)
 const text=(selector:string,value:string)=>{dialog.querySelector(selector)!.textContent=value}
 const format=(n:number)=>n.toLocaleString('fr-FR',{maximumFractionDigits:1})
 const allowed=()=>options.canOpen()&&![...document.querySelectorAll('dialog[open]')].some(d=>d!==dialog)
 function availability(){options.button.disabled=dialog.open||!allowed()}
 function render(){
  const mood=getMoodDetails()
  text('[data-mood-displayed]',`${format(mood.displayed)} / 140`);text('[data-mood-status]',getMoodStatus(mood.displayed).label)
  text('[data-mood-base]',format(mood.base));text('[data-mood-bonus]',`+${mood.bonus}`)
  text('[data-mood-cap]',mood.base+mood.bonus>140?'Le total est plafonné à 140. Une variation de fond peut rester masquée tant que le plafond est atteint.':'Humeur affichée = humeur de fond + bonus de confort, avec un plafond de 140.')
  text('[data-mood-effect-status]',mood.bonus?'Effet système actif':'Aucun bonus de confort actif');text('[data-mood-effect-name]',`${mood.effect.name} · +${mood.bonus}`)
  text('[data-mood-comfort]',`Confort actuel : ${mood.effect.score} / 300`)
  dialog.querySelector('[data-mood-tiers]')!.innerHTML=comfortMoodTiers.map((tier,i)=>`<div data-current="${tier.minimum===mood.effect.minimum}"><span>${tier.minimum}${i===comfortMoodTiers.length-1?'':`–${comfortMoodTiers[i+1]!.minimum-1}`} · ${tier.name}</span><b>+${tier.bonus}</b></div>`).join('')
 }
 function close(){dialog.close();availability();if(!options.button.disabled)options.button.focus({preventScroll:true})}
 options.button.onclick=()=>{if(!allowed()||dialog.open)return;render();dialog.showModal();availability()}
 for(const selector of ['[data-mood-close]','[data-mood-back]'])dialog.querySelector(selector)!.addEventListener('click',close)
 dialog.addEventListener('close',availability)
 onPlayerResourcesChange(()=>{if(dialog.open)render()})
 const observer=new MutationObserver(availability);observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['open','data-ready']})
 for(const overlay of document.querySelectorAll('#dialogue,#reference'))observer.observe(overlay,{attributes:true,attributeFilter:['hidden']})
 queueMicrotask(()=>{for(const mask of document.querySelectorAll('.wait-transition'))observer.observe(mask,{attributes:true,attributeFilter:['hidden']})})
 availability()
 return {snapshot:()=>({mode:dialog.open?'details':'closed',...getMoodDetails()})}
}
