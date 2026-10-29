globalThis.__MBOA_NO_HUNGER__=true // Faim testée à part (hunger-check).
import {bestRoute} from './queue-route-solver.mjs'
import {createQueueRoute,scoreQueueRoute,routePayout} from '../src/queue-route.ts'
import assert from 'node:assert/strict'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),money=await import('../src/currency.ts'),w=await import('../src/waiting.ts'),d=await import('../src/dossier-work.ts')
let q=await import('../src/user-queue.ts')
// Les confirmations de la file exigent désormais une solution ; conserver les autres gardes historiques.
const prepared=new Map()
function prepareRequest(index){const p=q.prepareUserRequest(index);prepared.set(p.id,{index,start:p.queue.start});return p}
// Bilan attendu de chaque demande réussie (meilleur parcours), pour vérifier argent, énergie et humeur.
const expected={money:0,mood:0}
function confirmRequest(id,ctx){const saved=prepared.get(id);if(!saved)return q.confirmUserRequest(id,ctx,[]);const board=createQueueRoute(`queue:${saved.start}/${saved.index}`,saved.index),route=bestRoute(board),pay=routePayout(scoreQueueRoute(board,route)),out=q.confirmUserRequest(id,ctx,route);if(out.ok){expected.money+=pay.money;expected.mood+=pay.mood;assert.equal(out.energy,15+pay.energyLoss)}return out}
const context={zone:'ministry',travelling:false,allowed:true},at=n=>c.advanceGameTime(n-c.getGameTime().totalMinutes,'sleep')
for(const day of [0,4,5,6])for(const minute of [599,600,779,780,959,960,1079,1080]){const queue=q.getUserQueue(day*1440+minute);assert.equal(queue.open,day<5&&(minute>=600&&minute<780||minute>=960&&minute<1080));assert.ok(queue.next.totalMinutes>day*1440+minute)}
assert.equal(q.getUserQueue(4*1440+1080).next.day,'Lundi');assert.equal(q.getUserQueue(6*1440+1080).next.week,2)
for(const index of [-1,5,NaN,1.5])assert.throws(()=>q.previewUserRequest(index))
at(600);const pile=structuredClone(d.getDossierBatch())
let quote=prepareRequest(0);q.cancelUserRequest(quote.id);assert.equal(confirmRequest(quote.id,context).ok,false)
for(const bad of [{...context,zone:'home'},{...context,travelling:true},{...context,allowed:false}]){quote=prepareRequest(0);assert.equal(confirmRequest(quote.id,bad).ok,false)}
quote=prepareRequest(0);quote.index=4;quote.to.totalMinutes=0;assert.equal(confirmRequest(quote.id,context).ok,true);assert.equal(confirmRequest(quote.id,context).ok,false)
assert.equal(money.getMoneyBalance(),expected.money);assert.ok(r.getPlayerResources().energy<=85);assert.equal(r.getPlayerResources().ptRespo,8);assert.equal(c.getGameTime().time,'10:45');assert.deepEqual(q.getUserQueue().done,[0]);assert.deepEqual(d.getDossierBatch(),pile)
quote=prepareRequest(0);assert.equal(confirmRequest(quote.id,context).ok,false)
q=await import('../src/user-queue.ts?reload');assert.deepEqual(q.getUserQueue().done,[0])
quote=prepareRequest(1);r.spendEnergy(1);assert.equal(confirmRequest(quote.id,context).ok,false);r.restoreEnergy(1)
quote=prepareRequest(1);c.advanceGameTime(5);assert.equal(confirmRequest(quote.id,context).ok,false)
at(735);quote=prepareRequest(1);assert.equal(confirmRequest(quote.id,context).ok,true);assert.equal(c.getGameTime().time,'13:00')
at(960);assert.deepEqual(q.getUserQueue().done,[]);assert.equal(q.getUserQueue().remaining,5)
r.spendEnergy(r.getPlayerResources().energy);quote=prepareRequest(0);assert.equal(confirmRequest(quote.id,context).ok,false);assert.equal(q.getUserQueue().remaining,5);r.restoreEnergy(100)
at(1036);assert.match(q.previewUserRequest(0).reason,/fermeture/)
at(1440+600);let wait=w.prepareWaiting(30);w.confirmWaiting(wait.id,true);quote=prepareRequest(4);assert.equal(confirmRequest(quote.id,context).ok,true);assert.equal(w.getContinuousWaiting(),0)
assert.equal(r.getPlayerResources().mood,Math.max(0,Math.min(140,90+expected.mood)));assert.equal(r.getPlayerResources().karma,0);assert.equal(money.getMoneyBalance(),expected.money);assert.equal(r.getPlayerResources().ptRespo,24)
store.set('mboa-user-queue-v1',JSON.stringify({start:2040,done:[0,0]}));const corrupt=await import('../src/user-queue.ts?corrupt');assert.equal(corrupt.getUserQueue().remaining,5)
store.set('mboa-user-queue-v1',JSON.stringify({start:2040,done:[0,1,2,3,4]}));const exhausted=await import('../src/user-queue.ts?exhausted');assert.equal(exhausted.getUserQueue().remaining,0);assert.match(exhausted.getUserQueue().reason,/traitées/)
console.log('Queue windows, weekends, next week, exact closing, energy/rewards, cancellation, stale/context/duplicate guards, reload, new files, corrupt saves and dossier independence passed')
