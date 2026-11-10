import assert from 'node:assert/strict'
import fs from 'node:fs'
const store=new Map([['mboa-money-v1','10000'],['mboa-game-minutes-v1','480']]);globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))}
globalThis.__MBOA_NO_HUNGER__=true
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),m=await import('../src/currency.ts'),v=await import('../src/venue-services.ts'),h=await import('../src/home-meals.ts')
r.spendEnergy(100);let q=h.prepareHomeMeal('porridge');assert.ok(q.energyGain>=45);const before=m.getMoneyBalance(),t=c.getGameTime().totalMinutes;assert.equal(h.confirmHomeMeal(q.id,{zone:'home',travelling:false,allowed:true}).ok,true);assert.equal(m.getMoneyBalance(),before-150);assert.equal(c.getGameTime().totalMinutes,t+15);assert.ok(r.getPlayerResources().energy>=45)
const definitions=JSON.parse(fs.readFileSync('src/data/venue-services.json'));assert.equal(definitions.filter(x=>x.id.startsWith('minfi-field-')).length,4)
r.restoreEnergy(100);r.setMood(90)
const pay=m.getMoneyBalance(),start=c.getGameTime().totalMinutes;const a=v.useVenueService('minfi-field-balances','market');assert.equal(a.ok,true);assert.equal(m.getMoneyBalance()-pay,650);assert.equal(c.getGameTime().totalMinutes-start,45);assert.match(a.service.completion,/grammes/)
assert.equal(v.useVenueService('minfi-field-balances','home').ok,false)
assert.equal(v.useVenueService('minfi-field-etiquettes','supermarket').ok,true)
assert.equal(v.useVenueService('minfi-field-chevres','village').ok,false)
for(const file of ['home-meals','canteen']){const d=JSON.parse(fs.readFileSync('src/data/'+file+'.json'));for(const item of Array.isArray(d)?d:d.dishes)assert.ok(item.energy>=45)}
for(const item of definitions.filter(x=>x.meal||['market-meal','hotel-meal'].includes(x.id)))assert.ok(item.energyGain>=45)
console.log('Meal recharge >=45, exact payment/time, 4 ministry field jobs, real wages, wrong-place guard and two-jobs/day shared limit passed')
