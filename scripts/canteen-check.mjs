globalThis.__MBOA_NO_HUNGER__=true // Faim testée à part (hunger-check).
// Les sauts de date des fixtures représentent une période reposée ; les activités testées restent en temps normal.
import assert from 'node:assert/strict'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),m=await import('../src/currency.ts'),busy=await import('../src/guided-outing-state.ts'),bag=await import('../src/food-bag.ts'),n=await import('../src/npcs.ts')
let meal=await import('../src/canteen.ts')
const ctx=(zone='ministry',extra={})=>({zone,travelling:false,allowed:true,...extra}),at=t=>c.advanceGameTime(t-c.getGameTime().totalMinutes,'sleep'),act=id=>meal.confirmCanteenMeal(meal.prepareCanteenMeal(id).token,ctx())
const menus=[['rice','fish'],['rice','chicken'],['fish','chicken'],['rice','fish'],['rice','chicken']]
for(let day=0;day<14;day++)for(const minute of [0,659,660,839,840,1439]){const s=meal.getCanteenService(day*1440+minute);assert.equal(s.open,day%7<5&&minute>=660&&minute<840);assert.deepEqual(s.menu,menus[day%7]??[]);assert.ok(s.next.totalMinutes>day*1440+minute)}
for(const value of [-1,NaN,Infinity,.5])assert.throws(()=>meal.getCanteenService(value));assert.throws(()=>meal.prepareCanteenMeal('bad'))
at(660);assert.match(meal.previewCanteenMeal('rice').reason,/Nkap/);m.addMoney(10000);r.spendEnergy(40)
for(const context of [ctx('home'),ctx('ministry',{travelling:true}),ctx('ministry',{allowed:false})])assert.equal(meal.confirmCanteenMeal(meal.prepareCanteenMeal('rice').token,context).ok,false)
let q=meal.prepareCanteenMeal('rice');meal.cancelCanteenMeal(q.token);assert.equal(meal.confirmCanteenMeal(q.token,ctx()).ok,false);assert.match(meal.previewCanteenMeal('chicken').reason,/menu/)
const before={money:m.getMoneyBalance(),points:r.getPlayerResources().ptRespo,karma:r.getPlayerResources().karma}
q=meal.prepareCanteenMeal('rice');q.dish.money=0;q.dish.energy=900;let reentrant=false;const unsub=r.onPlayerResourcesChange(()=>{if(!reentrant){reentrant=true;assert.equal(act('rice').ok,false)}})
assert.equal(meal.confirmCanteenMeal(q.token,ctx()).ok,true);unsub();assert.equal(meal.confirmCanteenMeal(q.token,ctx()).ok,false);assert.equal(r.getPlayerResources().energy,72);assert.equal(r.getPlayerResources().mood,93);assert.equal(c.getGameTime().totalMinutes,690);assert.equal(m.getMoneyBalance(),before.money-200)
assert.equal(act('rice').ok,false);assert.equal(act('fish').ok,true);assert.equal(r.getPlayerResources().energy,92);assert.equal(r.getPlayerResources().mood,98);assert.equal(c.getGameTime().totalMinutes,735)
const after={money:m.getMoneyBalance(),resources:r.getPlayerResources()};meal=await import('../src/canteen.ts?reload');assert.deepEqual(meal.getCanteenService().done,['rice','fish']);assert.equal(act('fish').ok,false);assert.deepEqual(r.getPlayerResources(),after.resources);assert.equal(m.getMoneyBalance(),after.money)
at(1440+795);r.restoreEnergy(100);r.spendEnergy(1);r.setMood(139);q=meal.prepareCanteenMeal('chicken');assert.equal(q.energyGain,1);assert.equal(q.moodGain,1);assert.equal(meal.confirmCanteenMeal(q.token,ctx()).ok,true);assert.equal(c.getGameTime().minuteOfDay,840);assert.equal(r.getPlayerResources().energy,100);assert.equal(r.getPlayerResources().mood,140)
at(2*1440+796);assert.match(meal.previewCanteenMeal('fish').reason,/14h/)
at(3*1440+660);assert.match(meal.previewCanteenMeal('rice').reason,/maximum/);r.spendEnergy(1);r.setMood(139);assert.equal(act('rice').ok,true)
for(const mutate of [()=>m.addMoney(1),()=>r.setMood(90),()=>r.spendEnergy(1),()=>r.setMaxEnergy(110),()=>c.advanceGameTime(1)]){q=meal.prepareCanteenMeal('fish');mutate();assert.equal(meal.confirmCanteenMeal(q.token,ctx()).ok,false)}r.setMaxEnergy(100)
at(4*1440+360);m.addMoney(250);assert.equal(bag.confirmFoodBag(bag.prepareFoodBag('buy','meal',ctx('market')).token,ctx('market')).ok,true);at(4*1440+690)
q=meal.prepareCanteenMeal('chicken');busy.setGuidedPresentation({npcId:'bae',mode:'walk',phase:'outbound',origin:'home',destination:'club',zone:null,travelling:true,progress:0});assert.equal(meal.confirmCanteenMeal(q.token,ctx()).ok,false);busy.setGuidedPresentation(null);assert.equal(act('chicken').ok,true);assert.equal(bag.getFoodBag().item.expired,true)
assert.equal(n.getNPCZone('makala'),'ministry');assert.equal(r.getPlayerResources().ptRespo,before.points);assert.equal(r.getPlayerResources().karma,before.karma)
at(5*1440+660);assert.equal(act('rice').ok,false);assert.equal(meal.getCanteenService().next.totalMinutes,7*1440+660)
at(7*1440+660);r.spendEnergy(10);assert.equal(act('rice').ok,true)
store.set('mboa-canteen-v1',JSON.stringify({version:1,day:70,done:['rice']}));meal=await import('../src/canteen.ts?future');assert.deepEqual(meal.getCanteenService().done,[])
store.set('mboa-canteen-v1',JSON.stringify({version:1,day:7,done:['chicken']}));meal=await import('../src/canteen.ts?wrongmenu');assert.deepEqual(meal.getCanteenService().done,[])
console.log('Canteen five menus/hours/weekends, three dish prices/gains, per-dish shared daily limits/reload/week renewal, exact14/late refusal, caps/no-use, context/cancel/stale/forged/double/reentrant/guided guards, bag expiry, Makala routine and corrupt/future saves passed')
