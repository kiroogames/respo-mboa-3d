// Rotation des avions : pas de saut, pas de virage sec au sol, jamais deux avions sur la piste en même temps, ni trop proches.
import assert from 'node:assert/strict'
import {planeState,planeCycle} from '../src/airport-traffic.ts'
const dt=1/60;let worstJump=0,worstTurn=0,closest=Infinity,runwayShared=0
const onRunway=s=>s.visible&&s.position[1]<1&&s.position[0]>186
for(let i=0;i<2;i++){let previous=planeState(0,i)
 for(let t=dt;t<planeCycle;t+=dt){const s=planeState(t,i)
  if(s.visible&&previous.visible){worstJump=Math.max(worstJump,Math.hypot(s.position[0]-previous.position[0],s.position[1]-previous.position[1],s.position[2]-previous.position[2]))
   worstTurn=Math.max(worstTurn,Math.abs(Math.atan2(Math.sin(s.yaw-previous.yaw),Math.cos(s.yaw-previous.yaw))))}
  previous=s}}
for(let t=0;t<planeCycle;t+=dt){const a=planeState(t,0),b=planeState(t,1)
 if(a.visible&&b.visible&&a.position[1]<1&&b.position[1]<1)closest=Math.min(closest,Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2]))
 if(onRunway(a)&&onRunway(b))runwayShared++}
console.log({worstJump,worstTurn,closest,runwayShared})
assert.ok(worstJump<1.2,`Saut : ${worstJump}`)
assert.ok(worstTurn<.12,`Virage trop sec : ${worstTurn}`)
assert.equal(runwayShared,0,'Deux avions sur la piste')
// Envergure 17,2 : au-delà, les ailes ne se touchent jamais.
assert.ok(closest>17.5,`Avions trop proches au sol : ${closest}`)
