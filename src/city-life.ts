/*
 * Habillage vivant de la ville : voitures, bateaux et oiseaux.
 * Le delta de rendu est en millisecondes ; cette animation ne fait pas avancer le calendrier.
 */

import { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh'
import '@babylonjs/core/Meshes/instancedMesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Scene } from '@babylonjs/core/scene'
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { cityScale } from './city-layout'
import { createRoadTraffic } from './road-traffic'
import { roadPaths, roadHeight, walkPaths } from './road-network'
import { createWalkers } from './street-walkers'
import { applyToon, inkEdges } from './toon-city'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Constants } from '@babylonjs/core/Engines/constants'
import { getTrafficConditions } from './traffic-conditions'
import { planeOffsets, planeRoar, planeState } from './airport-traffic'

// Le mélange de la circulation : surtout des taxis jaunes, quelques particuliers, 4×4 et minibus de ligne.
const fleet:{model:string;scale:number;half:number;paint:string[]}[]=[
  {model:'WSP Traffic prototype',scale:.74,half:2.2,paint:['#F2C230']},
  {model:'WSP Traffic prototype Moto',scale:.8,half:1.15,paint:['#D9472F','#2F3A42','#3E6E9E']},
  {model:'WSP Traffic prototype',scale:.74,half:2.2,paint:['#F7F4EA','#B9C2C8','#3E6E9E','#B5412F','#2F3A42']},
  {model:'WSP Traffic prototype SUV',scale:.74,half:2.3,paint:['#F7F4EA','#2F3A42','#7C8A6B','#A9B4BA']},
  {model:'WSP Traffic prototype',scale:.74,half:2.2,paint:['#F2C230']},
  {model:'WSP Traffic prototype Moto',scale:.8,half:1.15,paint:['#E9984A','#F7F4EA','#3F9A5B']},
  {model:'WSP Traffic prototype',scale:.74,half:2.2,paint:['#F2C230']},
  {model:'WSP Traffic prototype Minibus',scale:.66,half:2.95,paint:['#F7F4EA','#2F7F8F','#D9722E']},
]
// Rayon de sécurité commun : celui du plus long véhicule, le minibus.
const trafficRadius=2.1
// Là où ça bouchonne : le rond-point de la statue, le carrefour du Ministère et l'abord du marché.
const trafficHotspots:[number,number][]=[[-25.4,1.1],[4,-34],[-70,28]]

export function createCityLife(scene:Scene,prototypes:Mesh[],planePrototype:Mesh|undefined,shadows:ShadowGenerator){
  let time=0,paused=false,evening=false
  const cars:Mesh[]=[],carLights:InstancedMesh[]=[]
  const beamTexture=new DynamicTexture('Faisceau des phares',{width:128,height:256},scene,true);beamTexture.hasAlpha=true
  const beamContext=beamTexture.getContext(),beamFade=beamContext.createLinearGradient(0,0,0,256)
  beamFade.addColorStop(0,'rgba(255,240,190,.75)');beamFade.addColorStop(1,'rgba(255,240,190,0)')
  beamContext.fillStyle=beamFade;beamContext.beginPath();beamContext.moveTo(44,0);beamContext.lineTo(84,0);beamContext.lineTo(128,256);beamContext.lineTo(0,256);beamContext.closePath();beamContext.fill();beamTexture.update()
  const beamMaterial=new StandardMaterial('Phares',scene);beamMaterial.disableLighting=true;beamMaterial.emissiveTexture=beamTexture;beamMaterial.opacityTexture=beamTexture;beamMaterial.specularColor=Color3.Black();beamMaterial.alphaMode=Constants.ALPHA_ADD;beamMaterial.backFaceCulling=false
  const beamMaster=MeshBuilder.CreateGround('Faisceau',{width:3.4,height:9},scene);beamMaster.material=beamMaterial;beamMaster.isPickable=false;beamMaster.isVisible=false
  const tailMaterial=new StandardMaterial('Feux arrière',scene);tailMaterial.disableLighting=true;tailMaterial.emissiveColor=new Color3(1,.1,.06);tailMaterial.specularColor=Color3.Black()
  const tailMaster=MeshBuilder.CreateBox('Feu arrière',{width:1.5,height:.14,depth:.05},scene);tailMaster.material=tailMaterial;tailMaster.isPickable=false;tailMaster.isVisible=false
  if(prototypes.length){
    // Prépare un pool fixe ; la congestion change le nombre de voitures actives sans recréer leurs maillages.
    for(let i=0;i<72;i++){
      const kind=fleet[i%fleet.length]!,prototype=prototypes.find(p=>p.name===kind.model)??prototypes[0]!
      const car=prototype.clone('Vehicule de Mboa '+i,null,true)
      car.setEnabled(true);car.rotationQuaternion=null;car.scaling.setAll(kind.scale);car.isPickable=false;car.receiveShadows=true
      if(car.material instanceof StandardMaterial){
        car.material=car.material.clone('Carrosserie '+i)
        ;(car.material as StandardMaterial).diffuseColor=Color3.FromHexString(kind.paint[i%kind.paint.length]!)
        applyToon(car.material)
      }
      inkEdges(car)
      shadows.addShadowCaster(car);cars.push(car)
      // Phares au sol et feux arrière, allumés le soir. Le modèle regarde vers -Z.
      const beam=beamMaster.createInstance('Phares '+i);beam.parent=car;beam.position.set(0,.14,-kind.half-5.2);beam.setEnabled(false);carLights.push(beam)
      const tail=tailMaster.createInstance('Feux arrière '+i);tail.parent=car;tail.position.set(0,.78,kind.half+.04);tail.setEnabled(false);carLights.push(tail)
    }
  }
  const planes=planePrototype?planeOffsets.map((_,i)=>{const plane=planePrototype.clone('Avion de Nsimaport '+i,null,true);plane.setEnabled(true);plane.rotationQuaternion=null;plane.isPickable=false;plane.receiveShadows=true;shadows.addShadowCaster(plane);inkEdges(plane);return plane}):[]
  function mat(name:string,color:string){const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=Color3.Black();applyToon(m);return m}
  const boatPaint=mat('Coques des pirogues','#486B63'),boatWood=mat('Bois des pirogues','#D9C19A'),boatCabin=mat('Cabines des bateaux','#EFE8CE')
  const boats:TransformNode[]=[]
  for(let i=0;i<2;i++){
    const boat=new TransformNode('Bateau du littoral '+i,scene)
    const hull=MeshBuilder.CreateCylinder('Coque',{diameterTop:1.7,diameterBottom:.9,height:.65,tessellation:6},scene)
    hull.scaling.z=3.2;hull.material=boatPaint;hull.parent=boat;hull.position.y=.3
    const deck=MeshBuilder.CreateBox('Pont du bateau',{width:1.5,height:.14,depth:4.4},scene);deck.material=boatWood;deck.parent=boat;deck.position.y=.67
    const cabin=MeshBuilder.CreateBox('Cabine',{width:1.1,height:1,depth:1.5},scene);cabin.material=boatCabin;cabin.parent=boat;cabin.position.set(0,1.18,.4)
    boats.push(boat)
  }
  const wingMat=mat('Oiseaux du ciel','#3C514A');wingMat.backFaceCulling=false
  const birds:{root:TransformNode;wings:Mesh[]}[]=[]
  for(let i=0;i<7;i++){
    const root=new TransformNode('Oiseau '+i,scene),wings:Mesh[]=[]
    for(const side of [-1,1]){
      const wing=new Mesh('Aile',scene),data=new VertexData()
      data.positions=[0,0,0,side*.9,0,-.08,side*.3,0,.42];data.indices=side<0?[0,1,2]:[0,2,1]
      const normals:number[]=[];VertexData.ComputeNormals(data.positions,data.indices,normals);data.normals=normals;data.applyToMesh(wing)
      wing.material=wingMat;wing.parent=root;wings.push(wing)
    }
    birds.push({root,wings})
  }
  const driving=createRoadTraffic(roadPaths,cars.length,{radius:trafficRadius,height:roadHeight,isMoto:i=>fleet[i%fleet.length]!.model.endsWith('Moto'),hotspots:trafficHotspots})
  // Feux tricolores : un poteau par arrivée de carrefour, le feu rouge ou vert s'allume selon la phase réelle de la circulation.
  const poleMaterial=mat('Poteaux des feux','#3C4247')
  const glow=(name:string,color:Color3)=>{const m=new StandardMaterial(name,scene);m.disableLighting=true;m.emissiveColor=color;m.specularColor=Color3.Black();return m}
  const poleMaster=MeshBuilder.CreateCylinder('Poteau de feu',{height:2.6,diameter:.14,tessellation:6},scene);poleMaster.material=poleMaterial;poleMaster.isVisible=false;poleMaster.isPickable=false
  const boxMaster=MeshBuilder.CreateBox('Boîtier de feu',{width:.42,height:.95,depth:.3},scene);boxMaster.material=poleMaterial;boxMaster.isVisible=false;boxMaster.isPickable=false
  const redMaster=MeshBuilder.CreateSphere('Feu rouge',{diameter:.34,segments:6},scene);redMaster.material=glow('Feu rouge',new Color3(1,.14,.1));redMaster.isVisible=false;redMaster.isPickable=false
  const greenMaster=MeshBuilder.CreateSphere('Feu vert',{diameter:.34,segments:6},scene);greenMaster.material=glow('Feu vert',new Color3(.2,1,.42));greenMaster.isVisible=false;greenMaster.isPickable=false
  const signals=driving.signals.map((signal,i)=>{
   const y=roadHeight(signal.x,signal.z),root=new TransformNode('Feu tricolore '+i,scene);root.position.set(signal.x,y,signal.z);root.rotation.y=signal.yaw
   const pole=poleMaster.createInstance('Poteau');pole.parent=root;pole.position.y=1.3
   const box=boxMaster.createInstance('Boîtier');box.parent=root;box.position.y=2.9
   // La lentille fait face aux conducteurs qui arrivent, soit vers +Z local.
   const stop=redMaster.createInstance('Rouge');stop.parent=root;stop.position.set(0,3.15,.15)
   const go=greenMaster.createInstance('Vert');go.parent=root;go.position.set(0,2.65,.15)
   return {signal,stop,go}
  })
  // Passants : ils restent moins nombreux une fois la nuit tombée.
  const walkers=createWalkers(walkPaths,44)
  const skin=mat('Peau des passants','#8A5A3C'),trousers=mat('Pantalons des passants','#39424A')
  const shirts=['#E6CDA2','#C4603F','#3F7FA6','#5F8A4B','#E9B44C','#8A5AA6'].map((color,i)=>{
   const m=MeshBuilder.CreateCylinder('Buste '+i,{height:.72,diameterTop:.42,diameterBottom:.34,tessellation:7},scene);m.material=mat('Habits des passants '+i,color);m.isVisible=false;m.isPickable=false;return m
  })
  const legsMaster=MeshBuilder.CreateCylinder('Jambes',{height:.72,diameterTop:.32,diameterBottom:.22,tessellation:6},scene);legsMaster.material=trousers;legsMaster.isVisible=false;legsMaster.isPickable=false
  const headMaster=MeshBuilder.CreateSphere('Tête',{diameter:.3,segments:5},scene);headMaster.material=skin;headMaster.isVisible=false;headMaster.isPickable=false
  const people=walkers.walkers.map((_,i)=>{
   const root=new TransformNode('Passant '+i,scene)
   const legs=legsMaster.createInstance('Jambes');legs.parent=root;legs.position.y=.36
   const body=shirts[i%shirts.length]!.createInstance('Buste');body.parent=root;body.position.y=1.08
   const head=headMaster.createInstance('Tête');head.parent=root;head.position.y=1.6
   return root
  })
  let trafficLevel=''
  // Utilise la même condition de circulation que les devis pour que le trafic visible corresponde au gameplay.
  function updateTraffic(){
    const level=getTrafficConditions().id
    if(level===trafficLevel)return
    trafficLevel=level
    driving.configure(level==='jammed'?66:level==='busy'?42:24,level==='jammed'?.26:level==='busy'?.62:1,level==='jammed'?2:level==='busy'?1:0)
  }
  updateTraffic()
  // Limite un rattrapage à 100 ms afin qu’un retour d’onglet ne fasse pas bondir toute la simulation.
  function tick(delta:number){
    if(paused)return
    time+=Math.min(delta,100)/1000
    updateTraffic()
    driving.step(Math.min(delta,100)/1000)
    for(let i=0;i<cars.length;i++){
      const car=cars[i]!,state=driving.states[i]!
      car.setEnabled(state.active)
      if(!state.active)continue
      car.position.copyFromFloats(...state.position)
      car.rotation.y=state.yaw
      car.visibility=1
    }
    planes.forEach((plane,i)=>{
      const state=planeState(time,i)
      plane.setEnabled(state.visible)
      if(!state.visible)return
      plane.position.copyFromFloats(...state.position);plane.rotation.y=state.yaw;plane.rotation.x=state.pitch
    })
    for(const {signal,stop,go} of signals){
      const halted=driving.signalRed(signal.lane,signal.node)
      stop.setEnabled(halted);go.setEnabled(!halted)
    }
    walkers.step(Math.min(delta,100)/1000)
    walkers.walkers.forEach((walker,i)=>{
      const shown=!evening||i%5<2,person=people[i]!
      person.setEnabled(shown)
      if(!shown)return
      person.position.set(walker.x,roadHeight(walker.x,walker.z)-.04+Math.abs(Math.sin(walker.phase))*.05,walker.z);person.rotation.y=walker.yaw
    })
    boats.forEach((boat,i)=>{
      const a=time*.018+i*Math.PI
      boat.position.set((55+Math.sin(a)*23)*cityScale,.1+Math.sin(time*1.6+i)*.06,(-126+Math.cos(a)*5)*cityScale)
      boat.rotation.y=Math.atan2(23*Math.cos(a),-5*Math.sin(a));boat.rotation.z=Math.sin(time*.85+i)*.025
    })
    birds.forEach((bird,i)=>{
      const a=time*.065+i*.9
      bird.root.position.set((25+Math.cos(a)*65)*cityScale,37+i*1.3+Math.sin(a*2),(-20+Math.sin(a)*44)*cityScale)
      bird.root.rotation.y=-a
      bird.wings.forEach((wing,j)=>wing.rotation.z=(j?1:-1)*Math.sin(time*5+i)*.42)
    })
  }
  tick(16)
  return {
    tick,
    setPaused(value:boolean){paused=value},
    lanePaths:()=>driving.lanePaths(),
    planeRoar:()=>Math.max(0,...planes.map((_,i)=>planeRoar(time,i))),
    setEvening(value:boolean){evening=value;boatCabin.emissiveColor=value?new Color3(.18,.12,.045):Color3.Black();for(const light of carLights)light.setEnabled(value)},
    metrics(){return {network:driving.network,cars:driving.states.filter(s=>s.active).length,traffic:trafficLevel,averageSpeed:driving.states.filter(s=>s.active).reduce((sum,s)=>sum+s.speed,0)/Math.max(1,driving.states.filter(s=>s.active).length),stoppedCars:driving.states.filter(s=>s.active&&s.speed<.15).length,boats:boats.length,birds:birds.length,paused,carPosition:cars[0]?.position.asArray()??[]}},
  }
}
