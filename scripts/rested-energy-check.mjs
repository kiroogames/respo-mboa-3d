import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
const r=await import('../src/player-resources.ts'),c=await import('../src/game-clock.ts'),s=await import('../src/sleeping.ts'),b=await import('../src/rested-energy.ts'),sport=await import('../src/sport-energy.ts'),v=await import('../src/venue-services.ts')
const ctx={zone:'home',travelling:false,allowed:true},sleep=n=>{const p=s.prepareSleeping(n);assert.equal(s.confirmSleeping(p.id,ctx).ok,true);assert.equal(r.getPlayerResources().energy,p.energyAfter);assert.equal(r.getPlayerResources().maxEnergy,p.maxEnergyAfter);assert.equal(s.confirmSleeping(p.id,ctx).ok,false);return p}
assert.equal(b.getRestedEffect(),null);assert.equal(s.previewSleeping(570).restedEligible,false)
sleep(300);sleep(300);assert.equal(b.getRestedEffect(),null)
let p=sleep(600);assert.equal(p.restedEligible,true);assert.equal(r.getPlayerResources().energy,110);assert.equal(r.getEnergyStatus().label,'En forme')
sport.grantSportEffect();assert.equal(r.getPlayerResources().maxEnergy,120);assert.equal(r.getPlayerResources().energy,110);r.restoreEnergy(10)
r.changeRespoPoints(1330);assert.equal(r.getPlayerResources().maxEnergy,140)
assert.equal(JSON.parse(map.get('mboa-player-resources-v1')).maxEnergy,100)
let end=b.getRestedEffect().end;c.advanceGameTime(359);assert.ok(b.getRestedEffect());assert.equal(r.projectEnergy(0,end).maxEnergyAfter,120);c.advanceGameTime(1);assert.equal(b.getRestedEffect(),null);assert.equal(r.getPlayerResources().energy,120)
sleep(600);assert.equal(r.getPlayerResources().energy,130);end=b.getRestedEffect().end;sleep(30);assert.equal(b.getRestedEffect().end,end)
p=sleep(600);assert.equal(b.getRestedEffect().end,p.to.totalMinutes+360);assert.equal(r.getPlayerResources().energy,130)
c.advanceGameTime(3000);p=sleep(600);assert.equal(p.restedEligible,false);assert.equal(b.getRestedEffect(),null)
// Les services hôtel et sol ne créent jamais le bonus.
const money=await import('../src/currency.ts');money.addMoney(10000);v.useVenueService('hotel-night','pilton');assert.equal(v.useVenueService('sleep-on-ground','home').ok,false);assert.equal(b.getRestedEffect(),null)
const saved=JSON.parse(map.get('mboa-rested-energy-v1'));assert.ok(saved.version===1)
console.log('9h30/10h, naps separate, full wake, sport/level stacking, expiry exact, no selfstack/renewal, residual fatigue, hotel/ground exclusion, base save passed')

// Sauvegarde de la capacité cumulée niveau5 + sport + bon sommeil : 140/140.
for(const [effect,energy,maximum] of [[{start:900,end:1260},140,140],[{start:1001,end:1361},130,130],[{start:500,end:860},130,130]]){
 const code=`import assert from 'node:assert/strict';const m=new Map([['mboa-game-minutes-v1','1000'],['mboa-player-resources-v1',JSON.stringify({karma:0,energy:${energy},maxEnergy:100,ptRespo:1330,mood:90})],['mboa-sport-energy-v1',JSON.stringify({version:1,start:900,end:1260})],['mboa-rested-energy-v1',JSON.stringify({version:1,...${JSON.stringify(effect)}})]]);globalThis.localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};const r=await import('./src/player-resources.ts');assert.equal(r.getPlayerResources().energy,${energy});assert.equal(r.getPlayerResources().maxEnergy,${maximum});`
 execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',code])
}
console.log('Cold combined140 save and invalid future/expired effects passed')
