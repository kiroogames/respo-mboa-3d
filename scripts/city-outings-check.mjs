// Les sauts de date des fixtures représentent une période reposée ; les activités testées restent en temps normal.
import assert from 'node:assert/strict'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
store.set('mboa-npc-relationships-v1',JSON.stringify({consideration:58,accepted:['kitchen','bathroom','television'],completed:['kitchen','bathroom','television']}))
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),m=await import('../src/currency.ts'),w=await import('../src/waiting.ts'),v=await import('../src/venue-services.ts'),n=await import('../src/npc-relationships.ts')
let o=await import('../src/city-outings.ts')
const at=n=>c.advanceGameTime(n-c.getGameTime().totalMinutes,'sleep'),context=(zone,extra={})=>({zone,travelling:false,allowed:true,...extra})
const act=(id,option,zone)=>o.confirmCityOuting(o.prepareCityOuting(id,option).token,context(zone))
for(let day=0;day<7;day++)for(const minute of [0,239,240,419,420,479,480,839,840,1079,1080,1139,1140,1439]){
 const total=day*1440+minute
 assert.equal(o.getOutingSchedule('cinema',total).open,minute>=480&&minute<1140)
 assert.equal(o.getOutingSchedule('snack',total).open,minute>=1080||minute<240)
 assert.equal(o.getOutingSchedule('football',total).open,day>=5&&minute>=420&&minute<840)
 for(const id of ['cinema','snack','football'])assert.ok(o.getOutingSchedule(id,total).next.totalMinutes>total)
}
assert.equal(o.getOutingSchedule('snack',1430).session,o.getOutingSchedule('snack',1450).session);assert.equal(o.getOutingSchedule('snack',60).session,-1)
for(const invalid of [-1,NaN,Infinity,1.5])assert.throws(()=>o.getOutingSchedule('snack',invalid));
assert.throws(()=>o.previewCityOuting('bad','bad'));assert.equal(act('cinema','standard','culture').ok,false)
m.addMoney(10000)
for(const bad of [context('home'),context('culture',{travelling:true}),context('culture',{allowed:false})]){const q=o.prepareCityOuting('cinema','standard');assert.equal(o.confirmCityOuting(q.token,bad).ok,false)}
let q=o.prepareCityOuting('cinema','standard');o.cancelCityOuting(q.token);assert.equal(o.confirmCityOuting(q.token,context('culture')).ok,false)
q=o.prepareCityOuting('cinema','standard');r.spendEnergy(1);assert.equal(o.confirmCityOuting(q.token,context('culture')).ok,false);r.restoreEnergy(1)
q=o.prepareCityOuting('cinema','standard');m.addMoney(1);assert.equal(o.confirmCityOuting(q.token,context('culture')).ok,false)
q=o.prepareCityOuting('cinema','standard');c.advanceGameTime(5);assert.equal(o.confirmCityOuting(q.token,context('culture')).ok,false)
q=o.prepareCityOuting('cinema','snack');q.option.money=0;q.activity.zone='home';assert.equal(o.confirmCityOuting(q.token,context('culture')).ok,true);assert.equal(o.confirmCityOuting(q.token,context('culture')).ok,false)
assert.equal(m.getMoneyBalance(),8801);assert.equal(r.getPlayerResources().energy,95);assert.equal(r.getMoodDetails().base,115);assert.equal(r.getPlayerResources().mood,125);assert.equal(c.getGameTime().time,'09:35');assert.equal(act('cinema','standard','culture').ok,false)
o=await import('../src/city-outings.ts?reload');assert.equal(o.getOutingSchedule('cinema').consumed,true)
at(1440+1051);assert.match(o.previewCityOuting('cinema','standard').reason,/fermeture/)
// Une minute plus tard ne peut pas être annulée ; vérifier l’égalité sur la séance de 90 min du jour suivant.
at(2*1440+1050);r.setMood(139);q=o.prepareCityOuting('cinema','standard');assert.equal(q.moodGain,0);assert.equal(o.confirmCityOuting(q.token,context('culture')).ok,true);assert.equal(c.getGameTime().time,'19:00');assert.equal(r.getMoodDetails().base,140)
q=o.prepareCityOuting('snack','drink');r.setMood(135);q=o.prepareCityOuting('snack','drink');r.changeMood(1);assert.equal(o.confirmCityOuting(q.token,context('club')).ok,false)
r.setMood(90);assert.equal(act('snack','drink','club').ok,true);assert.equal(r.getPlayerResources().energy,90)
at(3*1440+10);assert.equal(o.getOutingSchedule('snack').consumed,true);assert.equal(act('snack','meal','club').ok,false)
o=await import('../src/city-outings.ts?after-midnight');assert.equal(o.getOutingSchedule('snack').consumed,true)
at(3*1440+1080);assert.equal(o.getOutingSchedule('snack').consumed,false)
at(4*1440+151);assert.match(o.previewCityOuting('snack','meal').reason,/fermeture/)
at(4*1440+195);assert.equal(act('snack','drink','club').ok,true);assert.equal(c.getGameTime().time,'04:00')
at(4*1440+1080);assert.equal(act('snack','meal','club').ok,true);assert.equal(r.getPlayerResources().energy,85)
at(5*1440+420);const energy=r.getPlayerResources().energy;r.spendEnergy(energy);assert.equal(act('football','match','stadium').ok,false);r.restoreEnergy(energy)
r.setMood(90);const wait=w.prepareWaiting(30);w.confirmWaiting(wait.id,true);assert.equal(act('football','match','stadium').ok,true);assert.equal(w.getContinuousWaiting(),0);assert.equal(act('football','match','stadium').ok,false)
at(6*1440+750);assert.equal(act('football','match','stadium').ok,true);assert.equal(c.getGameTime().time,'14:00')
assert.equal(m.getMoneyBalance(),6401);assert.equal(r.getPlayerResources().energy,45);assert.equal(r.getPlayerResources().maxEnergy,110);assert.equal(r.getPlayerResources().karma,0);assert.equal(r.getPlayerResources().ptRespo,0);assert.equal(n.getConsideration('bae'),58)
assert.ok(!v.getVenueServices('club').some(s=>s.id==='relax'));assert.equal(v.useVenueService('relax','club').ok,false);assert.ok(v.getVenueServices('njoka').some(s=>s.id==='relax'));assert.ok(v.getVenueServices('culture').some(s=>s.id==='culture-visit'));assert.ok(v.getVenueServices('stadium').some(s=>s.id==='sport'))
store.set('mboa-city-outings-v1',JSON.stringify({cinema:999999,snack:'bad',football:4}));const corrupt=await import('../src/city-outings.ts?corrupt');assert.equal(corrupt.getOutingSchedule('football',6*1440+600).consumed,false)
console.log('Outing weekday/night/weekend boundaries, five-option prices, context/cancel/stale/forged/duplicate guards, exact closing, midnight/reload limits, mood projection, waiting reset and unchanged other services/stats passed')
