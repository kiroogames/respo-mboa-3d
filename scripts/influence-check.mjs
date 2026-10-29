import assert from 'node:assert/strict'
const saved=new Map([['mboa-player-resources-v1',JSON.stringify({karma:37,energy:72,maxEnergy:100,ptRespo:0,respoNext:190,mood:90})]])
globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)}
const r=await import('../src/player-resources.ts')
assert.equal(r.getPlayerResources().influence,0);assert.equal(r.getPlayerResources().karma,37);assert.equal(r.getPlayerResources().energy,72)
r.changeKarma(5)
const persisted=JSON.parse(saved.get('mboa-player-resources-v1'));assert.equal(persisted.karma,42);assert.equal(persisted.influence,0)
persisted.influence=18;saved.set('mboa-player-resources-v1',JSON.stringify(persisted))
const reload=await import('../src/player-resources.ts?influence-reload');assert.equal(reload.getPlayerResources().influence,18);assert.equal(reload.getPlayerResources().karma,42)
persisted.influence=-7;saved.set('mboa-player-resources-v1',JSON.stringify(persisted))
const invalid=await import('../src/player-resources.ts?influence-invalid');assert.equal(invalid.getPlayerResources().influence,0);assert.equal(invalid.getPlayerResources().karma,42)
console.log('Influence: migration indépendante, ancien Karma, persistance et valeur invalide vérifiés')
