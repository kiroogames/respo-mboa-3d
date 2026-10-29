globalThis.__MBOA_NO_HUNGER__=true // Faim testée à part (hunger-check).
// Les sauts de date des fixtures représentent une période reposée ; les activités testées restent en temps normal.
// Attente : frontières d’ennui, cumul persistant, dates et absence de gains parasites.
import assert from 'node:assert/strict'
const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}
const clock=await import('../src/game-clock.ts'),resources=await import('../src/player-resources.ts'),money=await import('../src/currency.ts')
let waiting=await import('../src/waiting.ts')
money.addMoney(1234);resources.spendEnergy(35);resources.changeRespoPoints(17)
const initial=clock.getGameTime().totalMinutes
for(const duration of [-10,0,5,15,361,Infinity,NaN,1.5])assert.throws(()=>waiting.previewWaiting(duration),RangeError)
assert.equal(waiting.previewWaiting(10).moodLoss,0);assert.equal(waiting.previewWaiting(180).moodLoss,0);assert.equal(waiting.previewWaiting(190).moodLoss,5);assert.equal(waiting.previewWaiting(240).moodLoss,5);assert.equal(waiting.previewWaiting(360).moodLoss,15)
assert.equal(clock.getGameTime().totalMinutes,initial);assert.equal(storage.has('mboa-waiting-v1'),false)
const cancelled=waiting.prepareWaiting(60);waiting.cancelWaiting(cancelled.id);assert.equal(waiting.confirmWaiting(cancelled.id,true).ok,false)
let quote=waiting.prepareWaiting(180)
assert.equal(waiting.confirmWaiting(quote.id,false).ok,false);assert.equal(clock.getGameTime().totalMinutes,initial)
quote=waiting.prepareWaiting(180);assert.equal(waiting.confirmWaiting(quote.id,true).ok,true);assert.equal(waiting.confirmWaiting(quote.id,true).ok,false)
assert.equal(clock.getGameTime().time,'11:00');assert.equal(resources.getPlayerResources().mood,90);assert.equal(waiting.getContinuousWaiting(),180)
quote=waiting.prepareWaiting(10);assert.equal(quote.moodLoss,5);assert.equal(waiting.confirmWaiting(quote.id,true).ok,true)
quote=waiting.prepareWaiting(50);assert.equal(quote.moodLoss,0);waiting.confirmWaiting(quote.id,true)
assert.equal(clock.getGameTime().time,'12:00');assert.equal(resources.getPlayerResources().mood,85)
waiting=await import('../src/waiting.ts?reload');assert.equal(waiting.getContinuousWaiting(),240)
quote=waiting.prepareWaiting(10);assert.equal(quote.moodLoss,5);waiting.confirmWaiting(quote.id,true);assert.equal(resources.getPlayerResources().mood,80)
quote=waiting.prepareWaiting(60);clock.advanceGameTime(30);const afterActivity=clock.getGameTime().totalMinutes
assert.equal(waiting.getContinuousWaiting(),0);assert.equal(waiting.confirmWaiting(quote.id,true).ok,false);assert.equal(clock.getGameTime().totalMinutes,afterActivity)
resources.setMood(2);quote=waiting.prepareWaiting(360);assert.equal(quote.penalty,15);assert.equal(quote.moodLoss,2);waiting.confirmWaiting(quote.id,true);assert.equal(resources.getPlayerResources().mood,0)
quote=waiting.prepareWaiting(360);assert.equal(quote.penalty,30);assert.equal(quote.moodLoss,0);waiting.confirmWaiting(quote.id,true)
assert.equal(resources.getPlayerResources().mood,0);assert.equal(waiting.getContinuousWaiting(),720)
clock.advanceGameTime(6*1440+1430-clock.getGameTime().totalMinutes,'sleep');resources.setMood(90)
quote=waiting.prepareWaiting(20);assert.equal(quote.from.day,'Dimanche');assert.equal(quote.to.day,'Lundi');assert.equal(quote.to.week,2);assert.equal(quote.to.time,'00:10')
const expectedEnd=quote.to.totalMinutes;quote.to.totalMinutes+=999;quote.duration=360
const outcome=waiting.confirmWaiting(quote.id,true);assert.equal(outcome.ok,true);assert.equal(clock.getGameTime().totalMinutes,expectedEnd);assert.equal(waiting.getContinuousWaiting(),20)
quote=waiting.prepareWaiting(60);resources.setMood(35);const beforeReject=clock.getGameTime().totalMinutes
assert.equal(waiting.confirmWaiting(quote.id,true).ok,false);assert.equal(clock.getGameTime().totalMinutes,beforeReject)
clock.advanceGameTime(10);resources.setMood(90);waiting.confirmWaiting(waiting.prepareWaiting(120).id,true);waiting.confirmWaiting(waiting.prepareWaiting(120).id,true)
assert.equal(resources.getPlayerResources().mood,85);assert.equal(waiting.getContinuousWaiting(),240)
assert.equal(resources.getPlayerResources().energy,65);assert.equal(resources.getPlayerResources().maxEnergy,100);assert.equal(resources.getPlayerResources().ptRespo,17);assert.equal(resources.getPlayerResources().karma,0);assert.equal(money.getMoneyBalance(),1234)
storage.set('mboa-waiting-v1',JSON.stringify({lastEnd:clock.getGameTime().totalMinutes,continuousMinutes:-1}));const invalid=await import('../src/waiting.ts?corrupt');assert.equal(invalid.getContinuousWaiting(),0)
console.log('Wait previews, boredom boundaries, split waits, reload, activity reset, mood floor, week rollover, stale/duplicate/forged quotes and unchanged economy passed')
