import assert from 'node:assert/strict'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
const {getRespoProgress:p}=await import('../src/respo-level.ts')
const thresholds=[0,190,475,855,1330,1900]
for(let i=0;i<thresholds.length;i++){const n=thresholds[i];assert.equal(p(n).level,i+1);assert.equal(p(n).earned,0);if(n)assert.equal(p(n-1).level,i)}
for(let n=0;n<10000;n++){const v=p(n);assert.ok(v.start<=n);assert.ok(v.nextThreshold>n);assert.equal(v.earned+v.remaining,v.needed)}
for(const bad of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>p(bad))
const large=p(Number.MAX_SAFE_INTEGER);assert.equal(large.nextThreshold,null);assert.ok(large.start<=Number.MAX_SAFE_INTEGER)
const r=await import('../src/player-resources.ts'),c=await import('../src/game-clock.ts'),m=await import('../src/currency.ts')
const before={...r.getPlayerResources()},time=c.getGameTime().totalMinutes
r.changeRespoPoints(189);assert.equal(r.getPlayerResources().respoNext,190)
r.changeRespoPoints(1);assert.equal(r.getPlayerResources().respoNext,475)
r.changeRespoPoints(665);assert.equal(p(r.getPlayerResources().ptRespo).level,4);assert.equal(r.getPlayerResources().respoNext,1330)
assert.equal(r.getPlayerResources().maxEnergy,115);assert.deepEqual({...r.getPlayerResources(),maxEnergy:before.maxEnergy,ptRespo:before.ptRespo,respoNext:before.respoNext},before);assert.equal(c.getGameTime().totalMinutes,time);assert.equal(m.getMoneyBalance(),0)
const saved={karma:7,energy:43,maxEnergy:120,ptRespo:1900,respoNext:99999,mood:72}
store.set('mboa-player-resources-v1',JSON.stringify(saved))
const migrated=await import('../src/player-resources.ts?oldsave');assert.deepEqual(migrated.getPlayerResources(),{...saved,maxEnergy:140,respoNext:2565});assert.equal(p(migrated.getPlayerResources().ptRespo).level,6)
migrated.changeRespoPoints(1);assert.equal(JSON.parse(store.get('mboa-player-resources-v1')).ptRespo,1901);assert.equal(JSON.parse(store.get('mboa-player-resources-v1')).respoNext,2565)
r.changeRespoPoints(-9999);assert.equal(r.getPlayerResources().ptRespo,0);assert.equal(r.getPlayerResources().respoNext,190)
console.log('Level boundaries, cumulative curve, large totals, legacy save migration, persistence and unchanged economy/resources/time passed')
