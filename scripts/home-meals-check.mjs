import assert from 'node:assert/strict'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),money=await import('../src/currency.ts'),w=await import('../src/waiting.ts')
let m=await import('../src/home-meals.ts')
const context={zone:'home',travelling:false,allowed:true}
const at=n=>c.advanceGameTime(n-c.getGameTime().totalMinutes,'sleep')
// Repas illimités (13 novembre 2026) : après le repas gratuit, on peut remanger en payant.
// Services gratuits tous les jours : 6 h–10 h, 11 h–14 h, 18 h–23 h 30.
for(const day of [0,4,5,6])for(const minute of [359,360,599,600,659,660,839,840,1079,1080,1409,1410]){
 const s=m.getHomeMealService(day*1440+minute),expected=minute>=360&&minute<600||minute>=660&&minute<840||minute>=1080&&minute<1410
 assert.equal(s.open,expected,`${day}/${minute}`);assert.ok(s.next.totalMinutes>day*1440+minute)
}
// 08:00, service du matin : repas gratuit, même sans argent.
r.spendEnergy(70);r.setMood(90);assert.equal(money.getMoneyBalance(),0)
let p=m.previewHomeMeal('rice');assert.equal(p.free,true);assert.equal(p.price,0);assert.equal(p.reason,'');assert.equal(p.energyGain,50)
let q=m.prepareHomeMeal('rice');m.cancelHomeMeal(q.id);assert.equal(m.confirmHomeMeal(q.id,context).ok,false)
for(const bad of [{...context,zone:'market'},{...context,travelling:true},{...context,allowed:false}]){q=m.prepareHomeMeal('rice');assert.equal(m.confirmHomeMeal(q.id,bad).ok,false)}
q=m.prepareHomeMeal('rice');q.meal.money=999;q.to.totalMinutes=0;assert.equal(m.confirmHomeMeal(q.id,context).ok,true);assert.equal(money.getMoneyBalance(),0);assert.equal(r.getPlayerResources().energy,80);assert.equal(r.getPlayerResources().mood,96);assert.equal(c.getGameTime().time,'08:30');assert.equal(m.confirmHomeMeal(q.id,context).ok,false)
// Après le repas gratuit : le plat redevient payant, et un second vrai repas dans la même période est refusé.
p=m.previewHomeMeal('ndole');assert.equal(p.free,false);assert.equal(p.price,500);assert.equal(p.reason,'Argent insuffisant.')
m=await import('../src/home-meals.ts?reload');assert.equal(m.getHomeMealService().consumed,true)
// 15:00, hors service, période de midi sans repas : payant au prix du plat.
at(900);assert.equal(m.getHomeMealService().open,false);p=m.previewHomeMeal('porridge');assert.equal(p.free,false);assert.equal(p.price,150);assert.equal(p.reason,'Argent insuffisant.')
money.addMoney(2000);q=m.prepareHomeMeal('porridge');assert.equal(q.reason,'');assert.equal(m.confirmHomeMeal(q.id,context).ok,true);assert.equal(money.getMoneyBalance(),1850)
// 18:00, service du soir : gratuit ; aperçus périmés refusés.
at(1080);assert.equal(m.getHomeMealService().open,true)
q=m.prepareHomeMeal('porridge');r.spendEnergy(1);assert.equal(m.confirmHomeMeal(q.id,context).ok,false)
q=m.prepareHomeMeal('porridge');c.advanceGameTime(5);assert.equal(m.confirmHomeMeal(q.id,context).ok,false)
q=m.prepareHomeMeal('ndole');assert.equal(q.free,true);assert.equal(m.confirmHomeMeal(q.id,context).ok,true);assert.equal(money.getMoneyBalance(),1850);assert.equal(m.getHomeMealService().consumed,true)
// 23:00 : service déjà utilisé, période du soir déjà prise.
at(1380);p=m.previewHomeMeal('rice');assert.equal(p.free,false);assert.equal(p.reason,'')
// Midi en semaine comme le week-end.
at(1440+700);assert.equal(m.getHomeMealService().open,true);assert.equal(m.previewHomeMeal('rice').free,true)
at(5*1440+720);assert.equal(m.getHomeMealService().open,true);q=m.prepareHomeMeal('porridge');assert.equal(m.confirmHomeMeal(q.id,context).ok,true)
at(6*1440+1410);assert.equal(m.getHomeMealService().next.day,'Lundi');assert.equal(m.getHomeMealService().next.week,2)
at(7*1440+360);let wait=w.prepareWaiting(180);w.confirmWaiting(wait.id,true);q=m.prepareHomeMeal('porridge');m.confirmHomeMeal(q.id,context);assert.equal(w.getContinuousWaiting(),0)
assert.equal(r.getPlayerResources().ptRespo,0);assert.equal(r.getPlayerResources().karma,0)
store.set('mboa-home-meals-v1','{broken');const repaired=await import('../src/home-meals.ts?corrupt');assert.equal(repaired.getHomeMealService().open,true)
console.log('Free meal per service (morning, noon, evening, every day), paid meals outside services, unlimited paid meals, stale/context/duplicate guards, reload limit, waiting reset and corrupt save passed')
