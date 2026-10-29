import assert from 'node:assert/strict'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}
const r=await import('../src/player-resources.ts'),clock=await import('../src/game-clock.ts'),money=await import('../src/currency.ts'),n=await import('../src/npc-relationships.ts'),b=await import('../src/house-bills.ts'),t=await import('../src/bae-toque.ts'),w=await import('../src/waiting.ts')
let h=await import('../src/home-comfort.ts')
const context={zone:'home',travelling:false,allowed:true},act=(id,action)=>h.confirmHomeEquipment(h.prepareHomeEquipment(id,action,context).token,context)
const stats=r.getPlayerResources(),relation=n.getConsideration('bae'),toque=t.getToqueState(),bills=b.getHouseBilling().amount
assert.equal(h.getHomeComfort().total,0);assert.equal(h.getHomeComfort().equipment.filter(i=>i.equipped).length,2)
assert.equal(act('bed-comfort','equip').ok,false);assert.equal(act('bed-comfort','buy').ok,false)
money.addMoney(40000)
let q=h.prepareHomeEquipment('bed-comfort','buy',context);h.cancelHomeEquipment(q.token);assert.equal(h.confirmHomeEquipment(q.token,context).ok,false)
for(const bad of [{...context,zone:'market'},{...context,travelling:true},{...context,allowed:false}]){q=h.prepareHomeEquipment('bed-comfort','buy',bad);assert.equal(h.confirmHomeEquipment(q.token,bad).ok,false)}
q=h.prepareHomeEquipment('bed-comfort','buy',context);q.item.money=0;q.item.id='sofa-comfort';const time=clock.getGameTime().totalMinutes
assert.equal(h.confirmHomeEquipment(q.token,context).ok,true);assert.equal(h.confirmHomeEquipment(q.token,context).ok,false);assert.equal(money.getMoneyBalance(),32000);assert.equal(h.getHomeComfort().total,0)
const reloaded=await import('../src/home-comfort.ts?reload');assert.equal(reloaded.getHomeComfort().equipment.find(i=>i.id==='bed-comfort').owned,true);assert.equal(reloaded.getHomeComfort().total,0)
assert.equal(act('bed-comfort','buy').ok,false);assert.equal(act('bed-comfort','equip').ok,true);assert.equal(h.getHomeComfort().total,80);assert.equal(money.getMoneyBalance(),32000);assert.equal(act('bed-comfort','equip').ok,false)
assert.equal(act('bed-base','equip').ok,true);assert.equal(h.getHomeComfort().total,0);assert.equal(act('bed-comfort','equip').ok,true)
assert.equal(act('sofa-comfort','buy').ok,true);assert.equal(h.getHomeComfort().total,80);assert.equal(act('sofa-comfort','equip').ok,true);assert.equal(h.getHomeComfort().total,150)
q=h.prepareHomeEquipment('bed-base','equip',context);money.addMoney(1);assert.equal(h.confirmHomeEquipment(q.token,context).ok,false)
q=h.prepareHomeEquipment('bed-base','equip',context);clock.advanceGameTime(5);assert.equal(h.confirmHomeEquipment(q.token,context).ok,false)
n.acceptNPCRequest('kitchen');assert.equal(h.getHomeComfort().total,150);assert.equal(n.purchaseNPCImprovement('kitchen').ok,true);assert.equal(h.getHomeComfort().total,210)
for(const id of ['bathroom','television']){n.acceptNPCRequest(id);assert.equal(n.purchaseNPCImprovement(id).ok,true)}
assert.equal(h.getHomeComfort().total,300);assert.equal(h.getHomeComfort().complete,true);assert.deepEqual(h.getHomeComfort().rooms.map(r=>r.comfort),[80,100,60,60]);assert.equal(money.getMoneyBalance(),6001)
const wait=w.prepareWaiting(10);w.confirmWaiting(wait.id,true);const afterWaitTime=clock.getGameTime().totalMinutes
assert.equal(act('bed-base','equip').ok,true);assert.equal(h.getHomeComfort().total,220);assert.equal(act('bed-comfort','equip').ok,true);assert.equal(h.getHomeComfort().total,300);assert.equal(w.getContinuousWaiting(),10);assert.equal(clock.getGameTime().totalMinutes,afterWaitTime)
assert.deepEqual({...r.getPlayerResources(),mood:stats.mood},stats);assert.equal(r.getMoodDetails().base,stats.mood);assert.equal(r.getPlayerResources().mood,110);assert.equal(n.getConsideration('bae'),relation);assert.deepEqual(t.getToqueState(),toque);assert.equal(b.getHouseBilling().amount,bills)
store.delete('mboa-home-comfort-v1');const old=await import('../src/home-comfort.ts?old');assert.equal(old.getHomeComfort().total,150);assert.equal(money.getMoneyBalance(),6001)
store.set('mboa-home-comfort-v1',JSON.stringify({owned:['invalid','bed-comfort','bed-comfort'],equipped:{bed:'sofa-comfort',sofa:'sofa-comfort'}}));const corrupt=await import('../src/home-comfort.ts?corrupt');assert.equal(corrupt.getHomeComfort().total,150);assert.equal(corrupt.getHomeComfort().equipment.find(i=>i.id==='bed-base').equipped,true)
console.log('Comfort purchase/equip separation, exact costs, replace/re-equip, rooms/300 target, paid-only old improvements, reload/corrupt saves, cancel/context/stale/forged/duplicate guards and unchanged other stats/time/bills/toque passed')
