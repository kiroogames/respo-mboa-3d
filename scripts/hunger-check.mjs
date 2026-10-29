// Trois repas par jour : l'énergie ne baisse pas seule ; un repas sauté rend les activités plus coûteuses et retire de l'humeur.
import assert from 'node:assert/strict'
const store=new Map([['mboa-game-minutes-v1','480']]);globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),h=await import('../src/hunger.ts')
const at=n=>c.advanceGameTime(n-c.getGameTime().totalMinutes,'sleep')
// Lundi 08:00, rien de sauté : coût normal et énergie stable dans le temps.
assert.equal(h.getHunger().missed,0);assert.equal(h.hungerEnergyCost(20),20)
const start=r.getPlayerResources().energy;at(590);assert.equal(r.getPlayerResources().energy,start,'L’énergie ne doit pas baisser toute seule')
// 10:00 passé sans petit-déjeuner : +25 %, −5 humeur une seule fois.
const mood=r.getPlayerResources().mood;at(610);assert.equal(h.getHunger().missed,1);assert.equal(h.hungerEnergyCost(20),25);assert.equal(r.getPlayerResources().mood,mood-5)
at(700);assert.equal(r.getPlayerResources().mood,mood-5,'La pénalité d’humeur ne se répète pas')
r.spendEnergy(20);assert.equal(r.getPlayerResources().energy,start-25)
// Midi sauté aussi : +50 % (plafond), puis le soir sauté reste plafonné.
at(850);assert.equal(h.hungerEnergyCost(20),30);at(1330);assert.equal(h.getHunger().missed,3);assert.equal(h.hungerEnergyCost(20),30)
// Le surcoût ne bloque jamais une action : il est plafonné à l'énergie disponible.
r.restoreEnergy(100);const all=r.getPlayerResources().energy;assert.equal(r.spendEnergy(all),true);assert.equal(r.getPlayerResources().energy,0);r.restoreEnergy(100)
// Un repas efface la faim et coche le créneau.
at(1440+420);h.recordMeal();assert.equal(h.getHunger().missed,0);assert.equal(h.hungerEnergyCost(20),20);assert.ok(h.getHunger().today[0].eaten)
// Petit-déjeuner commencé à 9:50 : compte pour le matin même s'il finit après 10:00.
at(2*1440+590);h.recordMeal();at(2*1440+620);assert.equal(h.getHunger().missed,0)
console.log('Hunger: no passive drain, +25%/+50% surcharge capped, one-time mood loss, never blocks, meal clears, late breakfast counted passed')
