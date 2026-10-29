// Simulation prolongée du réseau routier : séparation des véhicules, absence de saut, couverture de la ville et fluidité.

import {writeFileSync,mkdirSync} from 'node:fs'
import assert from 'node:assert/strict'
import {createRoadTraffic} from '../src/road-traffic.ts'
import {roadPaths as streetPaths} from '../src/road-network.ts'

// Gabarit réel du taxi (prototype WSP à l'échelle .74) : demi-longueur 1,56, demi-largeur 0,76.
const HALF_L=1.56,HALF_W=.76
function corners(s){const fx=-Math.sin(s.yaw),fz=-Math.cos(s.yaw),rx=-fz,rz=fx,[x,,z]=s.position;return [[1,1],[1,-1],[-1,-1],[-1,1]].map(([a,b])=>[x+fx*HALF_L*a+rx*HALF_W*b,z+fz*HALF_L*a+rz*HALF_W*b])}
function overlap(a,b){const A=corners(a),B=corners(b);for(const poly of [A,B])for(let i=0;i<4;i++){const p=poly[i],q=poly[(i+1)%4],nx=-(q[1]-p[1]),nz=q[0]-p[0];const pa=A.map(c=>c[0]*nx+c[1]*nz),pb=B.map(c=>c[0]*nx+c[1]*nz);if(Math.max(...pa)<Math.min(...pb)||Math.max(...pb)<Math.min(...pa))return false}return true}
function run(cars,multiplier,jam,seconds){
 const sim=createRoadTraffic(streetPaths,cars,{radius:1.76,seed:7})
 sim.configure(cars,multiplier,jam)
 const visited=new Set(),travel=sim.states.map(()=>0)
 let closest=Infinity,collisions=0,maxJump=0,exits=0,frames=seconds*60
 for(let frame=0;frame<frames;frame++){
  const before=sim.states.map(s=>s.active?[...s.position]:null)
  sim.step(1/60)
  const active=sim.states.filter(s=>s.active)
  sim.states.forEach((s,i)=>{
   if(!s.active){if(before[i])exits++;return}
   if(!before[i])return
   const jump=Math.hypot(s.position[0]-before[i][0],s.position[2]-before[i][2])
   maxJump=Math.max(maxJump,jump);travel[i]+=jump
   visited.add(Math.round(s.position[0]/12)+','+Math.round(s.position[2]/12))
  })
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){const d=Math.hypot(active[i].position[0]-active[j].position[0],active[i].position[2]-active[j].position[2]);closest=Math.min(closest,d);if(d<4&&overlap(active[i],active[j]))collisions++}
 }
 return {cars,seconds,network:sim.network,separation:sim.separation,closest,collisions,maxJump,visited,exits:sim.stats.borderExits,stuck:sim.stats.stuckRemovals,averageTravel:travel.reduce((a,b)=>a+b,0)/travel.length,active:sim.states.filter(s=>s.active).length}
}
const allCells=new Set()
for(const path of streetPaths)for(let i=1;i<path.length;i++){const [a,b]=[path[i-1],path[i]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4);for(let k=0;k<=n;k++)allCells.add(Math.round((a[0]+(b[0]-a[0])*k/n)/12)+','+Math.round((a[1]+(b[1]-a[1])*k/n)/12))}

const fluid=run(10,1,0,600),busy=run(24,.62,1,600),jammed=run(44,.26,2,600)
for(const r of [fluid,busy,jammed]){
 assert.equal(r.collisions,0,`Collisions de carrosseries : ${r.collisions}`)
 assert.ok(r.maxJump<.2,`Teleport: ${r.maxJump}`)
 assert.ok(r.averageTravel>100,`Traffic barely moves: ${r.averageTravel}`)
}
const near=r=>{let n=0;for(const c of allCells){const [x,z]=c.split(',').map(Number);if([-1,0,1].some(a=>[-1,0,1].some(b=>r.visited.has((x+a)+','+(z+b)))))n++}return n/allCells.size}
const coverage=near(fluid)
for(const r of [fluid,busy,jammed]){r.coverage=near(r);delete r.visited;assert.ok(r.stuck<=r.exits*.25+2,`Trop de voitures bloquées : ${r.stuck}`)}
assert.ok(coverage>.6,`Cars stay in one part of the city: ${coverage}`)
const result={streetCells:allCells.size,coverage,fluid,busy,jammed}
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/traffic-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,1))
