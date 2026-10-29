import assert from 'node:assert/strict'
import {journeyTiming,journeyFrame,sampleJourneyPath} from '../src/journey-playback.ts'
for(const mode of ['walk','taxi','yonga','moto'])for(const minutes of [5,30,120,1440]){
 const t=journeyTiming(mode,minutes);assert(t.duration<8&&t.duration>3);assert.equal(journeyFrame(t,0).phase,'exit');assert.equal(journeyFrame(t,t.duration+1).phase,'done');assert(journeyTiming(mode,minutes,true).duration<1)
 const phases=new Set();for(let s=0;s<t.duration;s+=.01)phases.add(journeyFrame(t,s).phase)
 assert(phases.has('travel')&&phases.has('enter'));assert.equal(phases.has('board'),mode!=='walk')
}
assert(journeyTiming('walk',60).duration>journeyTiming('moto',60).duration)
assert(journeyTiming('taxi',120).duration>journeyTiming('taxi',15).duration)
assert.deepEqual(sampleJourneyPath([[0,0,0],[10,0,0],[10,0,30]],.5).point,[10,0,10])
assert.deepEqual(sampleJourneyPath([[2,0,3]],1).point,[2,0,3])
console.log('Phases sortie/embarquement/trajet/entrée, durées légères bornées et échantillonnage par distance vérifiés')
