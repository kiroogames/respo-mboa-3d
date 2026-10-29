import assert from 'node:assert/strict'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
const c=await import('../src/game-clock.ts'),m=await import('../src/currency.ts'),b=await import('../src/house-bills.ts'),budget=await import('../src/house-budget.ts'),h=await import('../src/home-comfort.ts'),r=await import('../src/player-resources.ts')
const initial=r.getPlayerResources(),at=t=>c.advanceGameTime(t-c.getGameTime().totalMinutes)
for(const [balance,status] of [[0,'insufficient'],[1124,'insufficient'],[1125,'tight'],[1499,'tight'],[1500,'covered'],[1501,'covered']])assert.equal(budget.classifyHouseBudget(balance,1500).status,status)
for(const [balance,status] of [[2249,'insufficient'],[2250,'tight'],[2999,'tight'],[3000,'covered']])assert.equal(budget.classifyHouseBudget(balance,3000).status,status)
assert.equal(budget.getHouseBudget().source,'upcoming');assert.equal(budget.getHouseBudget().missing,1500);assert.equal(b.getHouseBilling().unpaid,0)
m.addMoney(1500);assert.equal(budget.getHouseBudget().available,0);const time=c.getGameTime().totalMinutes,keys=[...store.keys()];for(let i=0;i<10;i++)budget.getHouseBudget();assert.equal(m.getMoneyBalance(),1500);assert.deepEqual([...store.keys()],keys);assert.equal(c.getGameTime().totalMinutes,time)
at(4*1440+720);assert.equal(budget.getHouseBudget().source,'unpaid');assert.equal(budget.getHouseBudget().reference,1500);at(11*1440+720);assert.equal(budget.getHouseBudget().reference,3000);assert.equal(budget.getHouseBudget().missing,1500);m.addMoney(1500)
let q=b.prepareHouseBillPayment();b.cancelHouseBillPayment(q.token);assert.equal(m.getMoneyBalance(),3000);assert.equal(budget.getHouseBudget().reference,3000)
for(let count=0;count<2;count++){q=b.prepareHouseBillPayment();assert.equal(b.confirmHouseBillPayment(q.token,true).ok,true);assert.equal(budget.getHouseBudget().reference,1500)}
assert.equal(budget.getHouseBudget().source,'upcoming');assert.equal(budget.getHouseBudget().status,'insufficient');assert.equal(b.getHouseBilling().unpaid,0)
m.addMoney(8500);const ctx={zone:'home',travelling:false,allowed:true};assert.equal(h.confirmHomeEquipment(h.prepareHomeEquipment('bed-comfort','buy',ctx).token,ctx).ok,true);assert.equal(budget.getHouseBudget().status,'insufficient');assert.equal(h.confirmHomeEquipment(h.prepareHomeEquipment('bed-comfort','sell',ctx).token,ctx).ok,true);assert.equal(budget.getHouseBudget().status,'covered');assert.equal(budget.getHouseBudget().available,3000)
assert.deepEqual(r.getPlayerResources(),initial)
console.log('Budget exact75/100percent thresholds, zero/equality, future reference without debt, Friday issue/multiple unpaid, cancel/pay/rebase, real purchase/resale updates, no reservation/time/stats/save changes passed')
