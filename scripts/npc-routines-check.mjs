// Contrôles sans rendu : couverture hebdomadaire, limites des périodes et positions selon le rôle.
// Vérifie aussi que calculer une routine ou un trajet ne fait pas avancer le temps du jeu.

import assert from 'node:assert/strict'
import routines from '../src/data/npc-routines.json' with {type:'json'}
import {npcTemplates,getNPCState,getNPCZone,isNPCAvailable,getNPCsAtZone} from '../src/npcs.ts'
import {advanceGameTime,getGameTime} from '../src/game-clock.ts'
import {getNPCMapPosition} from '../src/npc-navigation.ts'
const zones=new Set(['home','ministry','palms','market','pilton','education','supermarket','stadium','njoka'])
for(const npc of npcTemplates){
 const routine=routines.people[npc.id];assert.ok(routine)
 for(const periods of [routine.weekday,routine.weekend,...(routine.friday?[routine.friday]:[])]){
  let end=0
  for(const p of periods){assert.equal(p.from,end);assert.ok(p.until>p.from);assert.equal(p.from%5,0);assert.equal(p.until%5,0);if(p.zone)assert.ok(zones.has(p.zone));if(p.travelling){assert.ok(zones.has(p.origin)&&zones.has(p.destination));assert.equal(p.available,false);assert.equal(p.zone,null)};end=p.until}
  assert.equal(end,1440)
 }
 for(let day=0;day<7;day++)for(let minute=0;minute<1440;minute+=5)assert.ok(getNPCState(npc.id,day*1440+minute))
}
assert.equal(getNPCZone('elanga',810),'pilton')
assert.equal(getNPCZone('anneke',810),'ministry')
assert.equal(getNPCZone('hector',765),'market')
assert.equal(getNPCZone('hector',720),null);assert.equal(getNPCState('hector',720).travelling,true);assert.equal(isNPCAvailable('hector',720),false)
for(const id of ['hector','sidonie','crystal'])assert.equal(getNPCZone(id,4*1440+1140),'njoka')
for(const npc of npcTemplates.filter(n=>n.id!=='bae')){assert.notEqual(getNPCZone(npc.id,5*1440+630),'ministry');assert.equal(isNPCAvailable(npc.id,120),false)}
for(let day=0;day<7;day++){assert.equal(isNPCAvailable('bae',day*1440+480),false);assert.equal(isNPCAvailable('bae',day*1440+930),true)}
assert.equal(getNPCState('unknown'),null)
const points={ministry:[6,22,-55],market:[-85,18,43],palms:[-53,18,104]};const locate=zone=>points[zone]
const start=getNPCMapPosition('hector',locate,720),mid=getNPCMapPosition('hector',locate,735),later=getNPCMapPosition('hector',locate,740)
assert.deepEqual(start,points.ministry);assert.notDeepEqual(mid,start);assert.notDeepEqual(mid,later);assert.ok(mid.every(Number.isFinite))
const before=getGameTime().totalMinutes;getNPCState('elanga');getNPCMapPosition('hector',locate,735);assert.equal(getGameTime().totalMinutes,before)
advanceGameTime(630-before);assert.equal(getNPCsAtZone('ministry').length,8)
advanceGameTime(180);assert.ok(getNPCsAtZone('pilton').some(npc=>npc.id==='elanga'));assert.ok(!getNPCsAtZone('ministry').some(npc=>npc.id==='elanga'))
console.log('9 complete weekly routines, role-based locations, weekends, Friday evenings, Bae boundaries, route progress and event-only time passed')

// Crystal rentre à 17h du lundi au jeudi ; vendredi et week-end gardent leur routine.
for(let day=0;day<4;day++){assert.equal(getNPCState('crystal',day*1440+1019).travelling,true);assert.equal(getNPCZone('crystal',day*1440+1020),'palms');assert.equal(isNPCAvailable('crystal',day*1440+1020),true)}
