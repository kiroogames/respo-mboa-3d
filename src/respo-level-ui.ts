/* Annonce différée jusqu’à l’exploration ; aucun paiement ni modification du temps. */
import {getEnergyDetails,getPlayerResources,onPlayerResourcesChange} from './player-resources'
import {getRespoProgress,levelEnergyBonus} from './respo-level'
import './respo-level.css'
export function mountRespoLevelNotice(canShow:()=>boolean){
  const toast=document.createElement('div');toast.className='respo-level-notice';toast.hidden=true;toast.setAttribute('role','status');document.body.append(toast)
  let announced=getRespoProgress(getPlayerResources().ptRespo).level,pending:number|null=null,expires=0
  onPlayerResourcesChange(()=>{const level=getRespoProgress(getPlayerResources().ptRespo).level;pending=level>announced?level:null;tick()})
  // Ouverture/fermeture des menus : l’annonce ne dépend pas du débit WebGL.
  const observer=new MutationObserver(()=>tick())
  observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['open','data-ready']})
  for(const overlay of document.querySelectorAll('#dialogue,#reference'))observer.observe(overlay,{attributes:true,attributeFilter:['hidden']})
  function tick(){
    if(!canShow()){toast.hidden=true;return}
    if(pending!==null){
      const level=pending;pending=null
      const capacityGain=Math.max(0,Math.min(levelEnergyBonus(level),Number.MAX_SAFE_INTEGER-getEnergyDetails().reference)-Math.min(levelEnergyBonus(announced),Number.MAX_SAFE_INTEGER-getEnergyDetails().reference))
      toast.innerHTML=`<span>RESPONSABILITÉ</span><strong>Niveau ${level} atteint !</strong><small>${level>announced+1?`Niveaux ${announced+1} à ${level} franchis`:'Votre expérience porte ses fruits.'}</small>${capacityGain?`<small>+${capacityGain} capacité d’énergie · aucune recharge offerte</small>`:''}`
      announced=level;expires=performance.now()+6500;toast.hidden=false
    }else if(performance.now()>=expires)toast.hidden=true
  }
  return {tick,snapshot:()=>({pending,visible:!toast.hidden,announced})}
}
