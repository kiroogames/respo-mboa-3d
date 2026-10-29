globalThis.__MBOA_NO_HUNGER__=true // Faim testée à part (hunger-check).
// Les sauts de date des fixtures représentent une période reposée ; les activités testées restent en temps normal.
import assert from 'node:assert/strict'
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}
const r=await import('../src/player-resources.ts'),c=await import('../src/game-clock.ts'),s=await import('../src/sleeping.ts'),w=await import('../src/waiting.ts'),m=await import('../src/currency.ts'),v=await import('../src/venue-services.ts')
const context={zone:'home',travelling:false,allowed:true}
for(const n of [0,-30,15,31,961,NaN,Infinity])assert.throws(()=>s.previewSleeping(n))
r.spendEnergy(100);r.setMood(90)
assert.equal(s.previewSleeping(60).energyGain,12);assert.equal(s.previewSleeping(60).moodGain,1)
assert.equal(s.previewSleeping(240).energyGain,50);assert.equal(s.previewSleeping(240).moodGain,5)
assert.equal(s.previewSleeping(480).energyGain,100);assert.equal(s.previewSleeping(960).moodGain,10)
let q=s.prepareSleeping(240);s.cancelSleeping(q.id);assert.equal(s.confirmSleeping(q.id,context).ok,false)
for(const bad of [{...context,zone:'market'},{...context,travelling:true},{...context,allowed:false}]){q=s.prepareSleeping(240);assert.equal(s.confirmSleeping(q.id,bad).ok,false)}
assert.equal(c.getGameTime().time,'08:00');assert.equal(r.getPlayerResources().energy,0)
q=s.prepareSleeping(240);q.to.totalMinutes=0;assert.equal(s.confirmSleeping(q.id,context).ok,true);assert.equal(c.getGameTime().time,'12:00');assert.equal(r.getPlayerResources().energy,50);assert.equal(r.getPlayerResources().mood,95);assert.equal(s.confirmSleeping(q.id,context).ok,false)
q=s.prepareSleeping(60);r.restoreEnergy(1);assert.equal(s.confirmSleeping(q.id,context).ok,false)
q=s.prepareSleeping(60);c.advanceGameTime(5);assert.equal(s.confirmSleeping(q.id,context).ok,false)
r.restoreEnergy(47);r.setMood(139);assert.equal(s.previewSleeping(480).energyGain,2);assert.equal(s.previewSleeping(480).moodGain,1)
q=s.prepareSleeping(480);s.confirmSleeping(q.id,context);assert.equal(r.getPlayerResources().energy,100);assert.equal(r.getPlayerResources().mood,140)
assert.equal(v.useVenueService('home-sleep','home').ok,false)
const wait=w.prepareWaiting(180);w.confirmWaiting(wait.id,true);assert.equal(w.getContinuousWaiting(),180)
q=s.prepareSleeping(30);s.confirmSleeping(q.id,context);assert.equal(w.getContinuousWaiting(),0)
c.advanceGameTime(6*1440+1430-c.getGameTime().totalMinutes,'sleep');q=s.prepareSleeping(30);assert.equal(q.to.day,'Lundi');assert.equal(q.to.week,2);assert.equal(q.to.time,'00:20');s.confirmSleeping(q.id,context)
assert.equal(m.getMoneyBalance(),0);assert.equal(r.getPlayerResources().ptRespo,0);assert.equal(r.getPlayerResources().karma,0)
r.setMaxEnergy(200);r.spendEnergy(200);assert.equal(s.previewSleeping(240).energyGain,100)
console.log('Sleep durations, gains, caps, cancellation, contexts, duplicates, stale quotes, week rollover, waiting reset and unchanged economy passed')
