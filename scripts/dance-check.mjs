// Les sauts de date des fixtures représentent une période reposée ; les activités testées restent en temps normal.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
store.set('mboa-game-minutes-v1','1080')
const main=readFileSync('src/main.ts','utf8'),scale=JSON.parse(readFileSync('city-layout.json')).horizontalScale,places={}
for(const match of main.matchAll(/(home|palms|culture|club):\{target:new Vector3\(([^)]+)\)/g)){const [x,y,z]=match[2].split(',').map(Number);places[match[1]]=[x*scale,Math.max(10,y+12),z*scale]}
const home=JSON.parse(readFileSync('public/data/wsp-traffic.json')).layout.home;places.home=[home[0],18,home[1]]
const locate=id=>places[id],ctx=(zone='home',extra={})=>({zone,travelling:false,allowed:true,...extra})
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),money=await import('../src/currency.ts'),n=await import('../src/npcs.ts'),rel=await import('../src/npc-relationships.ts'),traffic=await import('../src/traffic-conditions.ts'),travel=await import('../src/travel.ts'),solo=await import('../src/city-outings.ts'),busy=await import('../src/guided-outing-state.ts'),services=await import('../src/venue-services.ts'),w=await import('../src/waiting.ts'),sleep=await import('../src/sleeping.ts')
let g=await import('../src/accompanied-outings.ts')

const at=t=>c.advanceGameTime(t-c.getGameTime().totalMinutes,'sleep')
money.addMoney(100000);const soloCtx=ctx('club')
let q=solo.prepareCityOuting('snack','dance');assert.equal(q.reason,'');assert.equal(q.option.money,1000);assert.equal(q.option.energy,15);assert.equal(q.option.minutes,90);assert.equal(q.moodGain,25)
solo.cancelCityOuting(q.token);assert.equal(solo.confirmCityOuting(q.token,soloCtx).ok,false)
q=solo.prepareCityOuting('snack','dance');assert.equal(solo.confirmCityOuting(q.token,soloCtx).ok,true);assert.equal(r.getPlayerResources().energy,85);assert.equal(r.getMoodDetails().base,115);assert.equal(money.getMoneyBalance(),99000);assert.equal(solo.confirmCityOuting(q.token,soloCtx).ok,false)
at(1440+60);assert.match(solo.previewCityOuting('snack','drink').reason,/déjà/)
at(1440+1080);r.restoreEnergy(100);r.setMood(139);q=solo.prepareCityOuting('snack','dance');assert.equal(q.moodGain,1);assert.equal(solo.confirmCityOuting(q.token,soloCtx).ok,true);assert.equal(r.getMoodDetails().base,140)
at(2*1440+1080);r.restoreEnergy(100);r.setMood(90)
for(const npc of ['bae','crystal']){
 const zone=npc==='bae'?'home':'palms';if(npc==='crystal')at(3*1440+1080)
 for(const mode of ['walk','taxi','yonga','moto']){
 const p=g.previewAccompanied(npc,'snack','dance',mode,ctx(zone),locate,traffic.trafficLevels.clear),seats=mode==='taxi'||mode==='moto'?2:1
 assert.equal(p.money,2000+(p.outward.money+p.back.money)*seats);assert.equal(p.energy,15+p.outward.energy+p.back.energy)
 }
 r.restoreEnergy(100);r.setMood(90);q=g.prepareAccompanied(npc,'snack','dance','yonga',ctx(zone),locate);assert.equal(q.reason,'');const balance=money.getMoneyBalance(),relation=rel.getConsideration(npc),plan=structuredClone(q)
 assert.equal(g.confirmAccompanied(q.token,ctx(zone),locate).ok,true);assert.equal(g.confirmAccompanied(q.token,ctx(zone),locate).ok,false)
 g=await import('../src/accompanied-outings.ts?dance-'+npc+'-outbound');assert.equal(g.finishAccompaniedPhase('outbound'),true);assert.equal(g.finishAccompaniedPhase('outbound'),false)
 g=await import('../src/accompanied-outings.ts?dance-'+npc+'-activity');assert.equal(g.finishAccompaniedPhase('activity'),true)
 g=await import('../src/accompanied-outings.ts?dance-'+npc+'-return');assert.equal(g.finishAccompaniedPhase('return'),true)
 assert.equal(money.getMoneyBalance(),balance-plan.money);assert.equal(r.getPlayerResources().energy,plan.energyAfter);assert.equal(r.getMoodDetails().base,120);assert.equal(rel.getConsideration(npc),relation+2);assert.equal(solo.getOutingSchedule('snack').consumed,true)
}
at(5*1440+150);r.restoreEnergy(100);q=solo.prepareCityOuting('snack','dance');assert.equal(q.reason,'');assert.equal(q.to.time,'04:00');assert.equal(solo.confirmCityOuting(q.token,soloCtx).ok,true)
at(6*1440+151);assert.match(solo.previewCityOuting('snack','dance').reason,/fermeture/)
assert.equal(r.getPlayerResources().karma,0);assert.equal(r.getPlayerResources().ptRespo,0)
console.log('Dance tariff, solo/mood cap/night shared limit, both companions/all modes, reload all phases, unique reserved payment/reward, exact04/late guard passed')

