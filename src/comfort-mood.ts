/* Un seul effet dérivé, jamais ajouté à l’humeur sauvegardée ou répété avec le temps. */
import tiers from './data/comfort-mood.json' with {type:'json'}
import {getHomeComfort} from './home-comfort.ts'
export const comfortMoodTiers=tiers
export function getComfortMoodEffect(score=getHomeComfort().total){
 if(!Number.isFinite(score)||score<0)throw new RangeError('Score de confort invalide.')
 const tier=tiers.findLast(tier=>score>=tier.minimum)!
 return {...tier,score,id:'home-comfort'}
}
