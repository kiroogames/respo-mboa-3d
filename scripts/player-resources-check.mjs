// Les sauts de date des fixtures représentent une période reposée ; les activités testées restent en temps normal.
// Régression des ressources, trajets, conditions de trafic, services et disponibilités de Bae.
// Teste notamment les refus sans fonds et les gains réellement plafonnés.

import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
const saved=new Map()
globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}
const resources=await import('../src/player-resources.ts')
assert.deepEqual(resources.getPlayerResources(),{karma:0,energy:100,maxEnergy:100,ptRespo:0,respoNext:190,mood:90})
resources.changeKarma(-10);resources.changeKarma(15);assert.equal(resources.getPlayerResources().karma,5)
assert.equal(resources.spendEnergy(101),false);assert.equal(resources.spendEnergy(25),true)
resources.restoreEnergy(1000);assert.equal(resources.getPlayerResources().energy,100)
resources.setMaxEnergy(150);resources.restoreEnergy(1000);assert.equal(resources.getPlayerResources().energy,150)
resources.setMaxEnergy(100);assert.equal(resources.getPlayerResources().energy,100)
resources.changeMood(-1000);assert.equal(resources.getPlayerResources().mood,0)
resources.changeMood(1000);assert.equal(resources.getPlayerResources().mood,140)
const cases=[[0,6],[20,6],[21,5],[40,5],[41,4],[60,4],[61,3],[80,3],[81,2],[100,2],[101,1],[120,1],[121,0],[140,0]]
for(const [value,index] of cases){resources.setMood(value);assert.equal(resources.getMoodStatus().spriteIndex,index)}
assert.throws(()=>resources.changeMood(NaN));resources.setMood(90)
resources.changeRespoPoints(200);assert.equal(resources.getPlayerResources().ptRespo,200)
assert.equal(resources.getPlayerResources().respoNext,475)
resources.changeRespoPoints(-1000);assert.equal(resources.getPlayerResources().ptRespo,0)
const reloaded=await import('../src/player-resources.ts?reload=1')
assert.deepEqual(reloaded.getPlayerResources(),resources.getPlayerResources())
const {createTravelRoute,quoteTravel,travelModes}=await import('../src/travel.ts')
const main=readFileSync('src/main.ts','utf8'),scale=JSON.parse(readFileSync('city-layout.json')).horizontalScale
const home=JSON.parse(readFileSync('public/data/wsp-traffic.json')).layout.home
const from=[home[0],18,home[1]],routes={}
for(const match of main.matchAll(/(\w+):\{target:new Vector3\(([-.\d]+),([-.\d]+),([-.\d]+)\)/g)){
 const [,key,x,y,z]=match;if(key==='city'||key==='home')continue
 const to=[Number(x)*scale,Math.max(10,Number(y)+12),Number(z)*scale]
 const route=createTravelRoute(from,to);assert.deepEqual(route[0],from);assert.deepEqual(route.at(-1),to)
 for(const mode of travelModes){const quote=quoteTravel(route,mode.id);assert.ok(quote.minutes>0&&quote.minutes%5===0);assert.ok(quote.money>=0&&quote.energy>=0)}
 routes[key]=route.length
}
assert.ok(Object.keys(routes).length>=18)
writeFileSync('artifacts/player-resources-check.json',JSON.stringify({resourceChecks:'pass',smileyBoundaries:cases.length,persistence:'pass',travelDestinations:routes},null,2))
console.log('Resources, 14 smiley boundaries, persistence, and travel routes passed:',Object.keys(routes).length)

const short=[[0,8,0],[50,8,0]],far=[[0,8,0],[450,8,0]]
assert.ok(quoteTravel(far,'taxi').money>quoteTravel(short,'taxi').money)
assert.ok(quoteTravel(far,'walk').energy>quoteTravel(short,'walk').energy)
assert.ok(quoteTravel(far,'walk').minutes>quoteTravel(short,'walk').minutes)
const {isNPCAvailable,getNPCsAtZone}=await import('../src/npcs.ts')
for(const [minute,available] of [[479,true],[480,false],[929,false],[930,true],[1439,true],[0,true]])assert.equal(isNPCAvailable('bae',minute),available)
assert.equal(isNPCAvailable('unknown',930),false)
assert.equal(getNPCsAtZone('home').length,0)
const {advanceGameTime}=await import('../src/game-clock.ts')
advanceGameTime(450,'sleep');assert.equal(getNPCsAtZone('home')[0].id,'bae')
advanceGameTime(990,'sleep');assert.equal(getNPCsAtZone('home').length,0)
console.log('Distance-sensitive prices and Bae daily availability boundaries passed')

const {trafficLevels,sampleTraffic,getTrafficConditions}=await import('../src/traffic-conditions.ts')
assert.equal(sampleTraffic(0).id,'clear');assert.equal(sampleTraffic(.6).id,'busy');assert.equal(sampleTraffic(.99).id,'jammed')
const cityTrip=[[0,8,0],[1000,8,0]]
const clearTaxi=quoteTravel(cityTrip,'taxi',trafficLevels.clear),jamTaxi=quoteTravel(cityTrip,'taxi',trafficLevels.jammed)
assert.ok(jamTaxi.minutes>clearTaxi.minutes)
assert.equal(jamTaxi.money,clearTaxi.money)
assert.equal(quoteTravel(cityTrip,'walk',trafficLevels.clear).minutes,quoteTravel(cityTrip,'walk',trafficLevels.jammed).minutes)
assert.ok(quoteTravel(cityTrip,'moto',trafficLevels.jammed).minutes>quoteTravel(cityTrip,'moto',trafficLevels.clear).minutes)
const conditions=getTrafficConditions();assert.deepEqual(getTrafficConditions(),conditions)
const reloadedTraffic=await import('../src/traffic-conditions.ts?reload=1');assert.deepEqual(reloadedTraffic.getTrafficConditions(),conditions)
console.log('Large-city durations, all traffic conditions, walking exemption, and saved traffic passed:',{clearTaxi:clearTaxi.minutes,jammedTaxi:jamTaxi.minutes})

const {getVenueServices,useVenueService}=await import('../src/venue-services.ts')
const money=await import('../src/currency.ts'),clock=await import('../src/game-clock.ts')
const beforeDenied={resources:resources.getPlayerResources(),clock:clock.getGameTime(),money:money.getMoneyBalance()}
assert.equal(useVenueService('hotel-rest','hotel').ok,false)
assert.deepEqual({resources:resources.getPlayerResources(),clock:clock.getGameTime(),money:money.getMoneyBalance()},beforeDenied)
assert.equal(useVenueService('hotel-rest','market').ok,false)
money.addMoney(10000);resources.spendEnergy(60);resources.setMood(139)
const serviceStart=clock.getGameTime().totalMinutes
const paid=useVenueService('hotel-rest','hotel');assert.equal(paid.ok,true)
assert.equal(money.getMoneyBalance(),8500);assert.equal(resources.getPlayerResources().energy,75);assert.equal(resources.getPlayerResources().mood,140)
assert.equal(clock.getGameTime().totalMinutes-serviceStart,60)
const night=useVenueService('hotel-night','hotel');assert.equal(night.ok,true);assert.equal(resources.getPlayerResources().energy,100)
const training=useVenueService('training','education');assert.equal(training.ok,true);assert.equal(resources.getPlayerResources().ptRespo,10)
assert.ok(getVenueServices('ministry').length>0)
assert.ok(getVenueServices('hotel').every(s=>s.minutes>0&&s.minutes%5===0))
console.log('Venue costs, insufficient funds, location restrictions, energy/mood caps, sleep, and Respo gains passed')

const common=quoteTravel(cityTrip,'taxi',trafficLevels.clear),privateTaxi=quoteTravel(cityTrip,'yonga',trafficLevels.clear)
assert.ok(privateTaxi.money>common.money)
assert.ok(privateTaxi.minutes<common.minutes)
assert.ok(quoteTravel(cityTrip,'yonga',trafficLevels.jammed).minutes>privateTaxi.minutes)
console.log('Shared taxi and Yonga distinct fares, stops, and congestion passed')

for(const zone of ['home','pilton','market','stadium','ministry','hill','village','airport'])assert.ok(!getVenueServices(zone).some(s=>s.id==='sleep-on-ground'))
resources.setMood(5);resources.spendEnergy(resources.getPlayerResources().energy)
const floorMoney=money.getMoneyBalance(),floorTime=clock.getGameTime().totalMinutes
const floorSleep=useVenueService('sleep-on-ground','village')
assert.equal(floorSleep.ok,false);assert.equal(resources.getPlayerResources().energy,0);assert.equal(resources.getPlayerResources().mood,5)
assert.equal(money.getMoneyBalance(),floorMoney);assert.equal(clock.getGameTime().totalMinutes-floorTime,0)
console.log('Ground sleeping removed everywhere: rejected without resource or calendar mutation')
