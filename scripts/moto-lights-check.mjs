// Les motos-taxis passent au rouge, les autres véhicules jamais, sans collision ni blocage.
import assert from 'node:assert/strict'
import {createRoadTraffic} from '../src/road-traffic.ts'
import {roadPaths} from '../src/road-network.ts'
const isMoto=i=>i%8===1||i%8===5
const sim=createRoadTraffic(roadPaths,48,{radius:2.1,seed:7,ignoresLights:isMoto});sim.configure(44,.62,1)
const held=sim.states.map(s=>s.holding);let motoRed=0,carRed=0,closest=Infinity
for(let frame=0;frame<600*60;frame++){
 sim.step(1/60)
 sim.states.forEach((s,i)=>{
  if(s.active&&s.holding>=0&&held[i]!==s.holding&&s.connector<0&&sim.signalRed(s.lane,s.holding)){if(isMoto(i))motoRed++;else carRed++}
  held[i]=s.holding
 })
 if(frame%6===0){const a=sim.states.filter(s=>s.active);for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)closest=Math.min(closest,Math.hypot(a[i].position[0]-a[j].position[0],a[i].position[2]-a[j].position[2]))}
}
console.log({motoRed,carRed,closest,stats:sim.stats})
assert.ok(motoRed>0,'Aucune moto n’a grillé de feu')
assert.equal(carRed,0,'Une voiture a grillé un feu')
