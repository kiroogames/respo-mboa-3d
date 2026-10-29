import assert from 'node:assert/strict'
import {solve} from './citizen-puzzle-solver.mjs'
const m=new Map();globalThis.localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),a=await import('../src/advanced-dossiers.ts'),e=await import('../src/anneke-extra.ts'),p=await import('../src/dossier-puzzle.ts')
const ctx={zone:'ministry',travelling:false,allowed:true};r.changeRespoPoints(1330)
assert.equal(e.confirmExtra(e.prepareExtra('accept',0,ctx).token,ctx).ok,true)
const b=a.getAdvancedBatch(),paths=solve(p.createDossierPuzzle(`${b.id}/0`,a.advancedRules.dossiers[0].difficulty)),result=a.completeAdvancedDossier(b.id,0,p.encodeDossierPairs([paths[0],paths[1],[],[]]),ctx);assert.equal(result.ok,true);assert.equal(result.money,450)
c.advanceGameTime(1080-c.getGameTime().totalMinutes,'sleep');r.restoreEnergy(100);assert.equal(e.confirmExtra(e.prepareExtra('start',0,ctx).token,ctx).ok,true);const eb=e.getExtraBatch(),ep=solve(p.createDossierPuzzle(`${eb.id}/0`,0)),er=e.completeExtra(eb.id,0,p.encodeDossierPairs([ep[0],[],[],[]]),ctx);assert.equal(er.ok,true);assert.equal(er.money,225);assert.equal(e.completeExtra(eb.id,0,p.encodeDossierPairs(ep),ctx).ok,false)
console.log('Advanced50%450 and Anneke25%225 authoritative scaled payout, existing context/unique-payment guards passed')
