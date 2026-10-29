import assert from 'node:assert/strict'
import {bestRoute} from './queue-route-solver.mjs'
const m=new Map([['mboa-game-minutes-v1','600']]);globalThis.localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}
const q=await import('../src/user-queue.ts'),p=await import('../src/dossier-puzzle.ts'),w=await import('../src/dossier-work.ts'),a=await import('../src/advanced-dossiers.ts'),e=await import('../src/anneke-extra.ts'),r=await import('../src/player-resources.ts'),c=await import('../src/game-clock.ts'),cash=await import('../src/currency.ts')
const ctx={zone:'ministry',travelling:false,allowed:true};let quote=q.prepareUserRequest(0);assert.equal(q.confirmUserRequest(quote.id,ctx).ok,false);assert.equal(cash.getMoneyBalance(),0)
const qr=await import('../src/queue-route.ts'),board=qr.createQueueRoute('queue:600/0',0),route=bestRoute(board),pay=qr.routePayout(qr.scoreQueueRoute(board,route));quote=q.prepareUserRequest(0);const out=q.confirmUserRequest(quote.id,ctx,route);assert.equal(out.ok,true);assert.equal(out.money,pay.money);assert.equal(r.getPlayerResources().energy,100-15-pay.energyLoss);assert.equal(c.getGameTime().time,'10:45');assert.equal(q.confirmUserRequest(quote.id,ctx,route).ok,false)
const afterQueue=cash.getMoneyBalance()
let batch=w.getDossierBatch();assert.equal(w.completeDossier(batch.id,0,[],'home').ok,false);assert.equal(w.completeDossier(batch.id,0,[],'ministry').money,500);assert.equal(w.completeDossier(batch.id,0,[],'ministry').ok,false)
r.changeRespoPoints(1330);r.restoreEnergy(100);batch=a.getAdvancedBatch();assert.equal(a.completeAdvancedDossier(batch.id,0,[],ctx).money,900);assert.equal(a.completeAdvancedDossier(batch.id,0,[],ctx).ok,false)
c.advanceGameTime(840-c.getGameTime().totalMinutes,'sleep');assert.equal(e.confirmExtra(e.prepareExtra('accept',0,ctx).token,ctx).ok,true);c.advanceGameTime(1080-c.getGameTime().totalMinutes,'sleep');r.restoreEnergy(100);assert.equal(e.confirmExtra(e.prepareExtra('start',0,ctx).token,ctx).ok,true);const eb=e.getExtraBatch();assert.equal(e.completeExtra(eb.id,0,[],ctx).money,900);assert.equal(e.completeExtra(eb.id,0,[],ctx).ok,false)
assert.equal(cash.getMoneyBalance(),afterQueue+2300)
console.log('Queue requires a full route and pays its tally,unique cost/reward; ordinary500/advanced900/extra900 classic without puzzle and duplicate/context guards passed')
