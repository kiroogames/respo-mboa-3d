// Contrôles isolés des sauvegardes de relations, des bornes et des achats uniques.
// Un faux localStorage garde ces scénarios séparés des données du navigateur du joueur.

import assert from 'node:assert/strict'
const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}
const state=await import('../src/npc-relationships.ts')
assert.equal(state.getConsideration('bae'),50)
state.changeConsideration('bae',1000);assert.equal(state.getConsideration('bae'),100)
state.changeConsideration('bae',-1000);assert.equal(state.getConsideration('bae'),0)
state.changeConsideration('bae',NaN);assert.equal(state.getConsideration('bae'),0)
assert.equal(state.completeNPCRequest('kitchen'),false)
assert.equal(state.acceptNPCRequest('invalid'),false)
const wallet=await import('../src/currency.ts')
for(const request of [...state.getNPCRequests('bae')]){
 assert.equal(state.purchaseNPCImprovement(request.id).ok,false)
 assert.equal(state.acceptNPCRequest(request.id),true)
 assert.equal(state.acceptNPCRequest(request.id),false)
 assert.equal(state.purchaseNPCImprovement(request.id).ok,false)
 wallet.addMoney(request.money);const before=wallet.getMoneyBalance()
 assert.equal(state.purchaseNPCImprovement(request.id).ok,true)
 assert.equal(wallet.getMoneyBalance(),before-request.money)
 assert.equal(state.purchaseNPCImprovement(request.id).ok,false)
 assert.equal(wallet.getMoneyBalance(),before-request.money)
 assert.equal(state.completeNPCRequest(request.id),false)
}
assert.equal(state.npcNeedsService('bae'),false)
const restored=await import('../src/npc-relationships.ts?restored')
assert.equal(restored.getConsideration('bae'),0);assert.equal(restored.npcNeedsService('bae'),false)
console.log('Relationship bounds, request lifecycle, duplicate protection and persistence passed')

assert.equal(state.getConsideration('elanga'),50)
state.changeConsideration('elanga',-100);assert.equal(state.getConsideration('elanga'),0)
assert.equal(state.getConsideration('hector'),50)
state.changeConsideration('unknown',100);assert.equal(state.getConsideration('unknown'),0)
const restoredOthers=await import('../src/npc-relationships.ts?other-restored')
assert.equal(restoredOthers.getConsideration('elanga'),0)
console.log('Independent NPC consideration, persistence and unknown NPC rejection passed')
