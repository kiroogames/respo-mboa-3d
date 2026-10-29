// Les sauts de date des fixtures représentent une période reposée ; les activités testées restent en temps normal.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
store.set('mboa-game-minutes-v1','930')
const main=readFileSync('src/main.ts','utf8'),scale=JSON.parse(readFileSync('city-layout.json')).horizontalScale,places={}
for(const match of main.matchAll(/(home|palms|culture|club):\{target:new Vector3\(([^)]+)\)/g)){const [x,y,z]=match[2].split(',').map(Number);places[match[1]]=[x*scale,Math.max(10,y+12),z*scale]}
const home=JSON.parse(readFileSync('public/data/wsp-traffic.json')).layout.home;places.home=[home[0],18,home[1]]
const locate=id=>places[id],ctx=(zone='home',extra={})=>({zone,travelling:false,allowed:true,...extra})
const c=await import('../src/game-clock.ts'),r=await import('../src/player-resources.ts'),money=await import('../src/currency.ts'),n=await import('../src/npcs.ts'),rel=await import('../src/npc-relationships.ts'),traffic=await import('../src/traffic-conditions.ts'),travel=await import('../src/travel.ts'),solo=await import('../src/city-outings.ts'),busy=await import('../src/guided-outing-state.ts'),services=await import('../src/venue-services.ts'),w=await import('../src/waiting.ts'),sleep=await import('../src/sleeping.ts')
let g=await import('../src/accompanied-outings.ts')
const at=time=>c.advanceGameTime(time-c.getGameTime().totalMinutes,'sleep')
assert.equal(g.companionAvailableUntil('bae',1410),1920);assert.equal(g.companionAvailableUntil('bae',480),480);assert.equal(g.companionAvailableUntil('crystal',600),600)
const empty=g.previewAccompanied('bae','cinema','standard','yonga',ctx(),locate,traffic.trafficLevels.clear);assert.match(empty.reason,/Nkap/)
money.addMoney(30000);rel.changeConsideration('bae',49)


for(const mode of ['walk','taxi','yonga','moto']){
 const p=g.previewAccompanied('bae','cinema','standard',mode,ctx(),locate,traffic.trafficLevels.clear),factor=mode==='taxi'||mode==='moto'?2:1
 assert.equal(p.money,1800+(p.outward.money+p.back.money)*factor);assert.equal(p.energy,5+p.outward.energy+p.back.energy)
}
assert.throws(()=>g.previewAccompanied('bae','football','match','yonga',ctx(),locate))
for(const bad of [ctx('market'),ctx('home',{travelling:true}),ctx('home',{allowed:false})]){const q=g.prepareAccompanied('bae','cinema','standard','yonga',bad,locate);assert.equal(g.confirmAccompanied(q.token,bad,locate).ok,false)}
let q=g.prepareAccompanied('bae','cinema','standard','yonga',ctx(),locate);g.cancelAccompanied(q.token);assert.equal(g.confirmAccompanied(q.token,ctx(),locate).ok,false)
q=g.prepareAccompanied('bae','cinema','standard','yonga',ctx(),locate);money.addMoney(1);assert.equal(g.confirmAccompanied(q.token,ctx(),locate).ok,false)
q=g.prepareAccompanied('bae','cinema','standard','yonga',ctx(),locate);const plan=structuredClone(q),before=money.getMoneyBalance();q.money=0;q.npcId='crystal'
assert.equal(g.confirmAccompanied(q.token,ctx(),locate).ok,true);assert.equal(g.confirmAccompanied(q.token,ctx(),locate).ok,false)
assert.equal(money.getMoneyBalance(),before-plan.money);assert.equal(r.getPlayerResources().energy,100-plan.energy);assert.equal(c.getGameTime().totalMinutes,plan.arrival.totalMinutes);assert.equal(r.getMoodDetails().base,90);assert.equal(rel.getConsideration('bae'),99)
assert.equal(n.getNPCState('bae').available,false);assert.equal(n.getNPCState('bae').travelling,true);assert.equal(n.getNPCState('bae').transport,'yonga');assert.equal(services.useVenueService('home-rest','home').ok,false)
assert.equal(w.confirmWaiting(w.prepareWaiting(30).id,true).ok,false);assert.equal(sleep.confirmSleeping(sleep.prepareSleeping(30).id,ctx()).ok,false)
const soloQuote=solo.prepareCityOuting('cinema','standard');assert.equal(solo.confirmCityOuting(soloQuote.token,ctx('culture')).ok,false)
g=await import('../src/accompanied-outings.ts?outbound');assert.equal(g.getAccompaniedState().phase,'outbound');assert.equal(money.getMoneyBalance(),before-plan.money)
assert.equal(g.finishAccompaniedPhase('outbound'),true);assert.equal(g.finishAccompaniedPhase('outbound'),false);assert.equal(c.getGameTime().totalMinutes,plan.activityEnd.totalMinutes);assert.equal(r.getMoodDetails().base,115);assert.equal(rel.getConsideration('bae'),100);assert.equal(solo.getOutingSchedule('cinema').consumed,true);assert.equal(n.getNPCZone('bae'),'culture');assert.equal(n.isNPCAvailable('bae'),false)
g=await import('../src/accompanied-outings.ts?activity');assert.equal(g.getAccompaniedState().phase,'activity');assert.equal(r.getMoodDetails().base,115)
assert.equal(g.finishAccompaniedPhase('activity'),true);assert.equal(c.getGameTime().totalMinutes,plan.returned.totalMinutes)
g=await import('../src/accompanied-outings.ts?return');assert.equal(g.getAccompaniedState().phase,'return');assert.equal(g.finishAccompaniedPhase('return'),true);assert.equal(g.finishAccompaniedPhase('return'),false);assert.equal(busy.isGuidedOutingActive(),false);assert.equal(n.getNPCZone('bae'),'home');assert.equal(n.isNPCAvailable('bae'),true)
assert.equal(money.getMoneyBalance(),before-plan.money);assert.equal(r.getPlayerResources().energy,100-plan.energy);assert.equal(g.getAccompaniedState().considerationGain,1)
at(1410);q=g.prepareAccompanied('bae','snack','drink','yonga',ctx(),locate);assert.equal(q.reason,'');assert.ok(q.activityEnd.totalMinutes>1440);assert.equal(g.confirmAccompanied(q.token,ctx(),locate).ok,true);g.finishAccompaniedPhase('outbound');g.finishAccompaniedPhase('activity');g.finishAccompaniedPhase('return');assert.equal(rel.getConsideration('bae'),100);assert.equal(g.getAccompaniedState().considerationGain,0)
at(1440+1080);q=g.prepareAccompanied('crystal','snack','drink','yonga',ctx('palms'),locate);assert.equal(q.reason,'');assert.equal(g.confirmAccompanied(q.token,ctx('palms'),locate).ok,true);g.finishAccompaniedPhase('outbound');g.finishAccompaniedPhase('activity');g.finishAccompaniedPhase('return');assert.equal(rel.getConsideration('crystal'),52);assert.equal(n.getNPCZone('crystal'),'palms');assert.equal(n.isNPCAvailable('crystal'),true)
// Le créneau de 17h permet un film et le retour avec Crystal en circulation fluide.
at(2*1440+1020);const crystalCinema=g.previewAccompanied('crystal','cinema','standard','yonga',ctx('palms'),locate,traffic.trafficLevels.clear);assert.equal(crystalCinema.reason,'');assert.equal(crystalCinema.arrival.totalMinutes,2*1440+1040);assert.equal(crystalCinema.activityEnd.totalMinutes,2*1440+1130);assert.equal(crystalCinema.returned.totalMinutes,2*1440+1150);assert.ok(crystalCinema.returned.totalMinutes<crystalCinema.availableUntil)
at(2*1440+1255);const late=g.previewAccompanied('crystal','snack','drink','yonga',ctx('palms'),locate,traffic.trafficLevels.clear);assert.match(late.reason,/tard/)
assert.equal(r.getPlayerResources().maxEnergy,100);assert.equal(r.getPlayerResources().karma,0);assert.equal(r.getPlayerResources().ptRespo,0)
store.set('mboa-accompanied-outings-v1',JSON.stringify({version:1,phase:'outbound',plan:{}}));const invalid=await import('../src/accompanied-outings.ts?bad');assert.equal(invalid.getAccompaniedState(),null);assert.equal(busy.isGuidedOutingActive(),false)
console.log('Accompanied tariffs, presence/windows, cancel/stale/forged/duplicate guards, upfront payment, busy locks, all three reload phases, single mood/relationship rewards, shared solo limit, midnight Bae, Crystal return and corrupt save passed')
