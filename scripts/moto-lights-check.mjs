// Les motos-taxis foncent, remontent les files et grillent les feux ; les autres véhicules restent prudents, sans collision ni blocage.
// La périphérie reste vivante : même dans un bouchon, une bonne part des véhicules roule loin du centre.
import assert from 'node:assert/strict'
import {createRoadTraffic} from '../src/road-traffic.ts'
import {roadPaths} from '../src/road-network.ts'
const isMoto=i=>i%8===1||i%8===5
const size=i=>isMoto(i)?[1.15,.4]:i%8===7?[1.97,.76]:[1.65,.76]
function corners(s,i){const [l,w]=size(i),fx=-Math.sin(s.yaw),fz=-Math.cos(s.yaw),rx=-fz,rz=fx,[x,,z]=s.position;return [[1,1],[1,-1],[-1,-1],[-1,1]].map(([a,b])=>[x+fx*l*a+rx*w*b,z+fz*l*a+rz*w*b])}
function overlap(a,i,b,j){const A=corners(a,i),B=corners(b,j);for(const poly of [A,B])for(let k=0;k<4;k++){const p=poly[k],q=poly[(k+1)%4],nx=-(q[1]-p[1]),nz=q[0]-p[0],pa=A.map(c=>c[0]*nx+c[1]*nz),pb=B.map(c=>c[0]*nx+c[1]*nz);if(Math.max(...pa)<Math.min(...pb)||Math.max(...pb)<Math.min(...pa))return false}return true}
const hotspots=[[-25.4,1.1],[4,-34],[-70,28]]
const results={}
for(const [level,count,multiplier,jam] of [['fluide',10,1,0],['charge',30,.62,1],['bouchon',66,.26,2]]){
 const sim=createRoadTraffic(roadPaths,72,{radius:2.1,seed:7,isMoto,hotspots});sim.configure(count,multiplier,jam)
 const held=sim.states.map(s=>s.holding);let motoRed=0,carRed=0,motoSpeed=0,motoN=0,carSpeed=0,carN=0,maxJump=0,passing=0,carCar=0,withMoto=0,samples=0,present=0,outside=0
 for(let frame=0;frame<300*60;frame++){
  const before=sim.states.map(s=>s.active?[...s.position]:null)
  sim.step(1/60)
  sim.states.forEach((s,i)=>{
   if(s.active&&s.holding>=0&&held[i]!==s.holding&&s.connector<0&&sim.signalRed(s.lane,s.holding)){if(isMoto(i))motoRed++;else carRed++}
   held[i]=s.holding
   if(!s.active)return
   if(frame>=3600)present++;if(frame>=3600&&!hotspots.some(h=>Math.hypot(s.position[0]-h[0],s.position[2]-h[1])<70))outside++
   if(isMoto(i)){motoSpeed+=s.speed;motoN++;if(s.side>1)passing++}else{carSpeed+=s.speed;carN++}
   if(before[i])maxJump=Math.max(maxJump,Math.hypot(s.position[0]-before[i][0],s.position[2]-before[i][2]))
  })
  if(frame%6===0)samples+=sim.states.filter((s,i)=>s.active&&isMoto(i)).length
  if(frame%6===0)sim.states.forEach((a,i)=>{if(a.active)sim.states.forEach((b,j)=>{if(j>i&&b.active&&Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2])<5&&overlap(a,i,b,j)){if(isMoto(i)||isMoto(j))withMoto++;else carCar++}})})
 }
 results[level]={motoSpeed:+(motoSpeed/motoN).toFixed(2),carSpeed:+(carSpeed/carN).toFixed(2),motoRed,carRed,passing,carCar,contactRate:+(withMoto/samples).toFixed(4),outsideShare:+(outside/present).toFixed(2),maxJump:+maxJump.toFixed(3),...sim.stats}
}
console.log(results)
const {fluide,charge,bouchon}=results
assert.ok(fluide.motoSpeed>fluide.carSpeed*1.4,'Les motos ne vont pas assez vite')
assert.ok(bouchon.motoSpeed>bouchon.carSpeed*3,'Les motos restent coincées dans les bouchons')
assert.ok(charge.motoRed+bouchon.motoRed>0,'Aucune moto n’a grillé de feu')
assert.ok(bouchon.passing>0,'Aucune moto n’a remonté de file')
assert.ok(bouchon.outsideShare>=.33,'Le bouchon vide la périphérie')
assert.ok(fluide.outsideShare>=.5,'La circulation fluide reste au centre')
for(const r of Object.values(results)){assert.equal(r.carRed,0,'Une voiture a grillé un feu');assert.equal(r.carCar,0,'Deux voitures se sont touchées');assert.ok(r.contactRate<.03,'Les motos touchent trop souvent les voitures');
 // À 60 images/s, une moto en virage serré peut balayer .4 par image avec son décalage : c'est un écart vif, pas une téléportation.
 assert.ok(r.maxJump<.45,'Saut de véhicule')}
