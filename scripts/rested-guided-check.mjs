// Les sauts de date des fixtures représentent une période reposée ; les activités testées restent en temps normal.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
store.set('mboa-game-minutes-v1','960');store.set('mboa-rested-energy-v1',JSON.stringify({version:1,start:630,end:990}));store.set('mboa-player-resources-v1',JSON.stringify({karma:0,energy:110,maxEnergy:100,ptRespo:0,mood:90}))
const main=readFileSync('src/main.ts','utf8'),scale=JSON.parse(readFileSync('city-layout.json')).horizontalScale,places={}
for(const match of main.matchAll(/(home|palms|culture|club):\{target:new Vector3\(([^)]+)\)/g)){const [x,y,z]=match[2].split(',').map(Number);places[match[1]]=[x*scale,Math.max(10,y+12),z*scale]}
const home=JSON.parse(readFileSync('public/data/wsp-traffic.json')).layout.home;places.home=[home[0],18,home[1]]
const locate=id=>places[id],ctx=(zone='home',extra={})=>({zone,travelling:false,allowed:true,...extra})
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),money=await import('../src/currency.ts'),n=await import('../src/npcs.ts'),rel=await import('../src/npc-relationships.ts'),traffic=await import('../src/traffic-conditions.ts'),travel=await import('../src/travel.ts'),solo=await import('../src/city-outings.ts'),busy=await import('../src/guided-outing-state.ts'),services=await import('../src/venue-services.ts'),w=await import('../src/waiting.ts'),sleep=await import('../src/sleeping.ts')
let g=await import('../src/accompanied-outings.ts')

money.addMoney(30000)
const f=await import('../src/fatigue.ts')
const q=g.prepareAccompanied('bae','cinema','standard','yonga',ctx(),locate),before=money.getMoneyBalance()
assert.equal(q.reason,'');assert.equal(q.maxEnergyAfter,100)
assert.equal(g.confirmAccompanied(q.token,ctx(),locate).ok,true)
for(const phase of ['outbound','activity','return'])assert.equal(g.finishAccompaniedPhase(phase),true)
assert.equal((await import('../src/rested-energy.ts')).getRestedEffect(),null)
assert.equal(r.getPlayerResources().energy,q.energyAfter)
assert.equal(r.getPlayerResources().maxEnergy,q.maxEnergyAfter)
assert.equal(money.getMoneyBalance(),before-q.money)
assert.equal(g.finishAccompaniedPhase('return'),false)
assert.equal(rel.getConsideration('bae'),52)
console.log('Guided roundtrip across rested expiry: preview/actual energy, reserved costs once, single reward passed')
