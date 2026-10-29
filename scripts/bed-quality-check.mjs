import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
const m=new Map();globalThis.localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}
const r=await import('../src/player-resources.ts'),h=await import('../src/home-comfort.ts'),s=await import('../src/sleeping.ts'),cash=await import('../src/currency.ts')
const ctx={zone:'home',travelling:false,allowed:true},act=(id,a)=>h.confirmHomeEquipment(h.prepareHomeEquipment(id,a,ctx).token,ctx)
cash.addMoney(20000);r.spendEnergy(100);assert.equal(s.previewSleeping(240).energyAfter,50)
assert.equal(act('bed-comfort','buy').ok,true);assert.equal(s.previewSleeping(240).energyAfter,50);assert.equal(cash.getMoneyBalance(),12000)
let q=s.prepareSleeping(240);assert.equal(act('bed-comfort','equip').ok,true);assert.equal(s.confirmSleeping(q.id,ctx).ok,false);assert.equal(r.getPlayerResources().energy,0)
q=s.prepareSleeping(240);assert.equal(q.bedBonus,8);assert.equal(q.energyAfter,58);assert.equal(s.confirmSleeping(q.id,ctx).ok,true);assert.equal(r.getPlayerResources().energy,58);assert.equal(s.confirmSleeping(q.id,ctx).ok,false)
q=s.prepareSleeping(30);assert.equal(act('bed-comfort','sell').ok,true);assert.equal(cash.getMoneyBalance(),16000);assert.equal(h.getBedSleepQuality().id,'bed-base');assert.equal(s.confirmSleeping(q.id,ctx).ok,false)
for(const equipped of [false,true])for(const duration of [30,60,240,480,600]){
 const expected=duration>=600?110:Math.min(100,Math.floor(100*Math.min(duration,480)/480)+(equipped?Math.min(duration,480)/30:0))
 const code=`import assert from 'node:assert/strict';const m=new Map([['mboa-player-resources-v1',JSON.stringify({karma:0,energy:0,maxEnergy:100,ptRespo:0,mood:90})],['mboa-home-comfort-v1',JSON.stringify({owned:['bed-comfort'],equipped:{bed:'${equipped?'bed-comfort':'bed-base'}'}})]]);globalThis.localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};const s=await import('./src/sleeping.ts'),r=await import('./src/player-resources.ts');const q=s.prepareSleeping(${duration});assert.equal(q.energyAfter,${expected});assert.equal(s.confirmSleeping(q.id,{zone:'home',travelling:false,allowed:true}).ok,true);assert.equal(r.getPlayerResources().energy,${expected});`
 execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',code])
}
console.log('Base/owned/equipped/sold bed, unchanged price/refund, stale quote, no immediate energy, 30min/1h/4h/8h/10h preview=actual and cold equipped saves passed')

for(const fixture of [{energy:95,duration:240,awake:0,points:0,effects:false,expected:100},{energy:90,duration:30,awake:1080,points:0,effects:false,expected:97},{energy:0,duration:30,awake:0,points:1330,effects:true,end:1170,expected:10},{energy:0,duration:30,awake:0,points:1330,effects:true,end:1015,expected:8}]){
 const effects=fixture.effects?`m.set('mboa-sport-energy-v1',JSON.stringify({version:1,start:${fixture.end-360},end:${fixture.end}}));m.set('mboa-rested-energy-v1',JSON.stringify({version:1,start:${fixture.end-360},end:${fixture.end}}));m.set('mboa-meal-energy-v1',JSON.stringify({version:1,start:${fixture.end-180},end:${fixture.end}}));`:''
 const code=`import assert from 'node:assert/strict';const m=new Map([['mboa-game-minutes-v1','1000'],['mboa-fatigue-v1',JSON.stringify({version:1,anchor:1000,awake:${fixture.awake}})],['mboa-player-resources-v1',JSON.stringify({karma:0,energy:${fixture.energy},maxEnergy:100,ptRespo:${fixture.points},mood:90})],['mboa-home-comfort-v1',JSON.stringify({owned:['bed-comfort'],equipped:{bed:'bed-comfort'}})]]);${effects}globalThis.localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};const s=await import('./src/sleeping.ts'),r=await import('./src/player-resources.ts');const q=s.prepareSleeping(${fixture.duration});assert.equal(q.energyAfter,${fixture.expected});assert.equal(s.confirmSleeping(q.id,{zone:'home',travelling:false,allowed:true}).ok,true);assert.equal(r.getPlayerResources().energy,${fixture.expected});`
 execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',code])
}
console.log('Near cap, fatigue recovery, level5 and all bonuses active/expiring during short sleep passed')

