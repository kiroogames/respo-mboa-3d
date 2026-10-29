import assert from 'node:assert/strict'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),money=await import('../src/currency.ts'),w=await import('../src/waiting.ts')
let m=await import('../src/home-meals.ts')
const context={zone:'home',travelling:false,allowed:true}
const at=n=>c.advanceGameTime(n-c.getGameTime().totalMinutes,'sleep')
for(const day of [0,4,5,6])for(const minute of [359,360,599,600,719,720,899,900,1079,1080,1409,1410]){
 const s=m.getHomeMealService(day*1440+minute),expected=minute>=360&&minute<600||minute>=1080&&minute<1410||day>=5&&minute>=720&&minute<900
 assert.equal(s.open,expected,`${day}/${minute}`);assert.ok(s.next.totalMinutes>day*1440+minute)
}
r.spendEnergy(70);r.setMood(90)
let p=m.previewHomeMeal('rice');assert.equal(p.reason,'Argent insuffisant.');assert.equal(p.energyGain,25)
let q=m.prepareHomeMeal('rice');assert.equal(m.confirmHomeMeal(q.id,context).ok,false);assert.equal(r.getPlayerResources().energy,30)
money.addMoney(2000)
q=m.prepareHomeMeal('rice');m.cancelHomeMeal(q.id);assert.equal(m.confirmHomeMeal(q.id,context).ok,false)
for(const bad of [{...context,zone:'market'},{...context,travelling:true},{...context,allowed:false}]){q=m.prepareHomeMeal('rice');assert.equal(m.confirmHomeMeal(q.id,bad).ok,false)}
q=m.prepareHomeMeal('rice');q.meal.money=0;q.to.totalMinutes=0;assert.equal(m.confirmHomeMeal(q.id,context).ok,true);assert.equal(money.getMoneyBalance(),1650);assert.equal(r.getPlayerResources().energy,55);assert.equal(r.getPlayerResources().mood,96);assert.equal(c.getGameTime().time,'08:30');assert.equal(m.confirmHomeMeal(q.id,context).ok,false)
q=m.prepareHomeMeal('ndole');assert.equal(m.confirmHomeMeal(q.id,context).ok,false)
m=await import('../src/home-meals.ts?reload');assert.equal(m.getHomeMealService().consumed,true)
at(1080);assert.equal(m.getHomeMealService().open,true)
q=m.prepareHomeMeal('porridge');r.restoreEnergy(1);assert.equal(m.confirmHomeMeal(q.id,context).ok,false)
q=m.prepareHomeMeal('porridge');c.advanceGameTime(5);assert.equal(m.confirmHomeMeal(q.id,context).ok,false)
r.restoreEnergy(42);r.setMood(139);p=m.previewHomeMeal('ndole');assert.equal(p.energyGain,7);assert.equal(p.moodGain,1)
q=m.prepareHomeMeal('ndole');money.spendMoney(money.getMoneyBalance());assert.equal(m.confirmHomeMeal(q.id,context).ok,false);assert.equal(m.getHomeMealService().consumed,false)
money.addMoney(2000);at(1380);p=m.previewHomeMeal('rice');assert.equal(p.reason,'');assert.equal(m.previewHomeMeal('ndole').reason,'Ce repas se terminerait après la fermeture.')
q=m.prepareHomeMeal('rice');assert.equal(m.confirmHomeMeal(q.id,context).ok,true);assert.equal(c.getGameTime().time,'23:30');assert.equal(r.getPlayerResources().energy,105);assert.equal(r.getPlayerResources().mood,140)
at(5*1440+720);assert.equal(m.getHomeMealService().open,true);q=m.prepareHomeMeal('porridge');assert.equal(m.confirmHomeMeal(q.id,context).ok,true)
at(6*1440+1410);assert.equal(m.getHomeMealService().next.day,'Lundi');assert.equal(m.getHomeMealService().next.week,2)
at(7*1440+360);let wait=w.prepareWaiting(180);w.confirmWaiting(wait.id,true);q=m.prepareHomeMeal('porridge');m.confirmHomeMeal(q.id,context);assert.equal(w.getContinuousWaiting(),0)
assert.equal(r.getPlayerResources().ptRespo,0);assert.equal(r.getPlayerResources().karma,0)
store.set('mboa-home-meals-v1','{broken');const repaired=await import('../src/home-meals.ts?corrupt');assert.equal(repaired.getHomeMealService().open,true)
console.log('Meal windows, weekends, weekly rollover, exact closing, prices/gains, caps, cancellation, stale/context/duplicate guards, reload limit, waiting reset and corrupt save passed')

