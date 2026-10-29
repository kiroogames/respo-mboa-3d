import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),m=await import('../src/currency.ts'),s=await import('../src/city-outings.ts'),g=await import('../src/accompanied-outings.ts'),t=await import('../src/traffic-conditions.ts')
const scale=JSON.parse(readFileSync('city-layout.json')).horizontalScale,places={}
for(const match of readFileSync('src/main.ts','utf8').matchAll(/(home|market|supermarket|njoka):\{target:new Vector3\(([^)]+)\)/g)){const [x,y,z]=match[2].split(',').map(Number);places[match[1]]=[x*scale,Math.max(10,y+12),z*scale]}
const home=JSON.parse(readFileSync('public/data/wsp-traffic.json')).layout.home;places.home=[home[0],18,home[1]];const locate=id=>places[id],ctx=zone=>({zone,travelling:false,allowed:true})
m.addMoney(100000)
for(const [day,zone] of ['market','supermarket','njoka'].entries()){
 c.advanceGameTime(day*1440+660-c.getGameTime().totalMinutes);r.restoreEnergy(100);r.spendEnergy(30);r.setMood(90)
 const id='restaurant-'+zone,p=s.prepareCityOuting(id,'classic');assert.equal(p.activity.zone,zone);assert.equal(s.confirmCityOuting(p.token,ctx('home')).ok,false)
 const money=m.getMoneyBalance();assert.equal(s.confirmCityOuting(s.prepareCityOuting(id,'complete').token,ctx(zone)).ok,true);assert.equal(m.getMoneyBalance(),money-1200);assert.equal(r.getPlayerResources().energy,100)
 c.advanceGameTime(day*1440+930-c.getGameTime().totalMinutes);r.restoreEnergy(100);r.spendEnergy(30);r.setMood(90)
 for(const mode of ['walk','taxi','moto','yonga']){const p=g.previewAccompanied('bae',id,'classic',mode,ctx('home'),locate,t.trafficLevels.clear);assert.equal(p.destination,zone);assert.deepEqual(p.outwardRoute.at(-1),places[zone]);assert.equal(p.energyGain,Math.min(20,100-(70-p.energy)))}
 const q=g.prepareAccompanied('bae',id,'classic','yonga',ctx('home'),locate);assert.equal(q.reason,'');assert.equal(g.confirmAccompanied(q.token,ctx('home'),locate).ok,true);assert.equal(g.getAccompaniedState().plan.destination,zone);g.finishAccompaniedPhase('outbound');g.finishAccompaniedPhase('activity');g.finishAccompaniedPhase('return');assert.equal(s.getOutingSchedule(id).consumed,false)
}
console.log('Market, supermarket and Njoka restaurants: menus, local guards, solo rewards, four route quotes, guided meal/return and repeatability passed')

