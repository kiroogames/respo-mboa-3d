globalThis.__MBOA_NO_HUNGER__=true // Faim testée à part (hunger-check).
// Les sauts de date des fixtures représentent une période reposée ; les activités testées restent en temps normal.
import assert from 'node:assert/strict'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),money=await import('../src/currency.ts'),w=await import('../src/waiting.ts')
let m=await import('../src/pro-missions.ts')
const at=n=>c.advanceGameTime(n-c.getGameTime().totalMinutes,'sleep'),context=(zone='ministry',extra={})=>({zone,travelling:false,allowed:true,...extra})
const act=(id,zone='ministry')=>m.confirmMission(m.prepareMission(id,context(zone)).token,context(zone))
assert.equal(m.missionRules.missions.length,6)
assert.throws(()=>m.getMissionView('unknown',context()))
for(const bad of [context('home'),context('ministry',{travelling:true}),context('ministry',{allowed:false})]){const p=m.prepareMission('anneke-market',bad);assert.equal(m.confirmMission(p.token,bad).ok,false)}
let q=m.prepareMission('anneke-market',context());m.cancelMission(q.token);assert.equal(m.confirmMission(q.token,context()).ok,false)
const start=c.getGameTime().totalMinutes
for(const id of ['anneke-market','anneke-tekno','anneke-school'])assert.equal(act(id).ok,true)
assert.equal(c.getGameTime().totalMinutes,start);assert.equal(r.getPlayerResources().energy,100);assert.equal(money.getMoneyBalance(),0)
assert.match(m.getMissionView('kako-airport',context()).reason,/Retrouvez|aujourd’hui/)
assert.equal(act('anneke-market').ok,false)
q=m.prepareMission('anneke-market',context('market'));q.mission.zone='home';q.action='report';assert.equal(m.confirmMission(q.token,context('market')).ok,true)
assert.equal(r.getPlayerResources().energy,80);assert.equal(c.getGameTime().time,'08:45');assert.equal(money.getMoneyBalance(),0)
assert.equal(m.confirmMission(q.token,context('market')).ok,false);assert.equal(act('anneke-market','market').ok,false)
m=await import('../src/pro-missions.ts?reload');assert.equal(m.getMissionState('anneke-market').stage,'ready');assert.equal(m.getMissionState('anneke-tekno').stage,'active')
assert.equal(act('anneke-market').ok,true);assert.equal(money.getMoneyBalance(),1000);assert.equal(r.getPlayerResources().ptRespo,15);assert.equal(act('anneke-market').ok,false)
q=m.prepareMission('anneke-tekno',context('tekno'));r.spendEnergy(1);assert.equal(m.confirmMission(q.token,context('tekno')).ok,false);r.restoreEnergy(1)
q=m.prepareMission('anneke-tekno',context('tekno'));c.advanceGameTime(5);assert.equal(m.confirmMission(q.token,context('tekno')).ok,false)
r.spendEnergy(80);assert.equal(act('anneke-tekno','tekno').ok,false);r.restoreEnergy(100)
const wait=w.prepareWaiting(30);w.confirmWaiting(wait.id,true);assert.equal(act('anneke-tekno','tekno').ok,true);assert.equal(w.getContinuousWaiting(),0)
at(18*60);assert.equal(act('anneke-tekno').ok,false);assert.equal(m.getMissionState('anneke-tekno').stage,'ready')
at(1440+540);for(const id of ['kako-airport','kako-shop','kako-market'])assert.equal(act(id).ok,true)
assert.equal(act('anneke-tekno').ok,true);assert.equal(money.getMoneyBalance(),2000)
assert.equal(m.getMissionState('anneke-school').stage,'active')
at(7*1440+480);assert.equal(act('anneke-market').ok,true);assert.equal(m.getMissionState('anneke-market').week,2);assert.equal(act('anneke-school','education').ok,true);assert.equal(act('anneke-school').ok,true)
assert.equal(r.getPlayerResources().mood,90);assert.equal(r.getPlayerResources().karma,0);assert.equal(r.getPlayerResources().maxEnergy,100);assert.equal(money.getMoneyBalance(),3000);assert.equal(r.getPlayerResources().ptRespo,45)
store.set('mboa-pro-missions-v1',JSON.stringify({'anneke-market':{week:999,stage:'ready'},'kako-shop':{week:1,stage:'made-up'}}));const corrupt=await import('../src/pro-missions.ts?corrupt');assert.equal(corrupt.getMissionState('anneke-market'),null);assert.equal(corrupt.getMissionState('kako-shop'),null)
console.log('Six simultaneous missions, giver/days/location guards, cancellation, stale/forged/duplicate quotes, no early gains, exact activity/report costs, reload, midnight/week persistence, weekly repeat, waiting reset and corrupt saves passed')
