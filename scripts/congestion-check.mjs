// Simulation du trafic fluide, chargé et bloqué, avec changements de population.
// Vérifie qu'aucune carrosserie ne se chevauche et que le trafic bloqué est bien plus lent que le fluide.

import {writeFileSync,mkdirSync} from 'node:fs'
import assert from 'node:assert/strict'
import {createRoadTraffic} from '../src/road-traffic.ts'
import {roadPaths as streetPaths} from '../src/road-network.ts'
const HALF_L=1.56,HALF_W=.76
function corners(s){const fx=-Math.sin(s.yaw),fz=-Math.cos(s.yaw),rx=-fz,rz=fx,[x,,z]=s.position;return [[1,1],[1,-1],[-1,-1],[-1,1]].map(([a,b])=>[x+fx*HALF_L*a+rx*HALF_W*b,z+fz*HALF_L*a+rz*HALF_W*b])}
function overlap(a,b){if(Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2])>4)return false;const A=corners(a),B=corners(b);for(const poly of [A,B])for(let i=0;i<4;i++){const p=poly[i],q=poly[(i+1)%4],nx=-(q[1]-p[1]),nz=q[0]-p[0];const pa=A.map(c=>c[0]*nx+c[1]*nz),pb=B.map(c=>c[0]*nx+c[1]*nz);if(Math.max(...pa)<Math.min(...pb)||Math.max(...pb)<Math.min(...pa))return false}return true}
const collide=active=>active.some((a,i)=>active.slice(i+1).some(b=>overlap(a,b)))

const results=[]
for(const [level,count,multiplier,jam] of [['clear',10,1,0],['busy',24,.62,1],['jammed',44,.26,2]]){
 const sim=createRoadTraffic(streetPaths,48,{radius:1.76,seed:3});sim.configure(count,multiplier,jam)
 let totalSpeed=0,samples=0,stoppedFrames=0
 for(let frame=0;frame<3600;frame++){
  sim.step(1/30)
  const active=sim.states.filter(s=>s.active)
  assert.ok(!collide(active),`${level} collision`)
  let stopped=0
  for(const s of active){totalSpeed+=s.speed;samples++;if(s.speed<.15)stopped++}
  if(stopped>=2)stoppedFrames++
 }
 assert.ok(sim.states.filter(s=>s.active).length>=count-2,`${level} missing cars`)
 results.push({level,cars:count,averageSpeed:totalSpeed/samples,stoppedFrames,...sim.stats})
}
assert.ok(results[2].averageSpeed<results[0].averageSpeed*.5)
assert.ok(results[2].stoppedFrames>results[0].stoppedFrames)
const sim=createRoadTraffic(streetPaths,48,{radius:1.76,seed:5})
for(const settings of [[10,1,0],[44,.26,2],[24,.62,1],[10,1,0],[44,.26,2]]){
 sim.configure(...settings)
 for(let i=0;i<600;i++){sim.step(1/30);assert.ok(!collide(sim.states.filter(s=>s.active)),'Collision during population change')}
}
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/congestion-check.json',JSON.stringify({results,populationChanges:'pass'},null,2));console.log(results)
