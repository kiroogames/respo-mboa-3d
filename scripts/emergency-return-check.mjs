import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
const e=await import('../src/emergency-return.ts'),r=await import('../src/player-resources.ts'),m=await import('../src/currency.ts'),f=await import('../src/fatigue.ts'),c=await import('../src/game-clock.ts'),t=await import('../src/travel.ts'),v=await import('../src/venue-services.ts')
const from=[0,8,0],home=[-29,18,113],ctx={origin:'market',allowed:true}
for(const zone of ['home','market','ministry','club','pilton','supermarket'])assert.equal(v.getVenueServices(zone).some(s=>s.id==='sleep-on-ground'),false)
assert.equal(v.useVenueService('sleep-on-ground','market').ok,false)
assert.ok(e.previewEmergencyReturn('market',from,home).reason);r.spendEnergy(100);m.addMoney(10000);assert.ok(e.previewEmergencyReturn('market',from,home).reason)
for(const mode of ['taxi','yonga'])assert.equal(t.quoteTravel(t.createTravelRoute(from,home),mode).energy,0)
m.spendMoney(10000);let q=e.prepareEmergencyReturn('market',from,home);assert.equal(q.reason,'');assert.equal(e.confirmEmergencyReturn(q.token,{...ctx,origin:'home'}).ok,false)
q=e.prepareEmergencyReturn('market',from,home);m.addMoney(1);assert.equal(e.confirmEmergencyReturn(q.token,ctx).ok,false);m.spendMoney(1)
q=e.prepareEmergencyReturn('market',from,home);const before=f.getFatigueAt().minutes,time=c.getGameTime().totalMinutes;assert.equal(e.confirmEmergencyReturn(q.token,ctx).ok,true);assert.equal(e.confirmEmergencyReturn(q.token,ctx).ok,false);assert.equal(c.getGameTime().totalMinutes,time+q.minutes);assert.equal(f.getFatigueAt().minutes,before+q.minutes+240);assert.equal(r.getPlayerResources().energy,0);assert.equal(m.getMoneyBalance(),0)
assert.ok(e.previewEmergencyReturn('home',home,home).reason)
const saved=store.get('mboa-fatigue-v1'),now=c.getGameTime().totalMinutes;execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',`import assert from 'node:assert/strict';const m=new Map([['mboa-fatigue-v1',${JSON.stringify(saved)}],['mboa-game-minutes-v1','${now}']]);globalThis.localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};const f=await import('./src/fatigue.ts'),c=await import('./src/game-clock.ts');assert.equal(f.getFatigueAt().minutes,${before+q.minutes+240});c.advanceGameTime(120,'sleep');assert.equal(f.getFatigueAt().minutes,${before+q.minutes});`])
console.log('No ground sleep, paid energy0 taxis, rescue context/stale/double guards, home only/no money-energy gain, +120sleep debt persisted and repaid2:1 passed')
