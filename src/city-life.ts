/*
 * Habillage vivant de la ville : voitures, bateaux et oiseaux.
 * Le delta de rendu est en millisecondes ; cette animation ne fait pas avancer le calendrier.
 */

import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Scene } from '@babylonjs/core/scene'
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { cityScale } from './city-layout'
import { createRoadTraffic } from './road-traffic'
import { roadPaths, roadHeight } from './road-network'
import { getTrafficConditions } from './traffic-conditions'

// Le mélange de la circulation : surtout des taxis jaunes, quelques particuliers, 4×4 et minibus de ligne.
const fleet:{model:string;scale:number;paint:string[]}[]=[
  {model:'WSP Traffic prototype',scale:.74,paint:['#F2C230']},
  {model:'WSP Traffic prototype',scale:.74,paint:['#F2C230']},
  {model:'WSP Traffic prototype',scale:.74,paint:['#F7F4EA','#B9C2C8','#3E6E9E','#B5412F','#2F3A42']},
  {model:'WSP Traffic prototype SUV',scale:.74,paint:['#F7F4EA','#2F3A42','#7C8A6B','#A9B4BA']},
  {model:'WSP Traffic prototype',scale:.74,paint:['#F2C230']},
  {model:'WSP Traffic prototype Minibus',scale:.66,paint:['#F7F4EA','#2F7F8F','#D9722E']},
]
// Rayon de sécurité commun : celui du plus long véhicule, le minibus.
const trafficRadius=2.1

export function createCityLife(scene:Scene,prototypes:Mesh[],shadows:ShadowGenerator){
  let time=0,paused=false
  const cars:Mesh[]=[]
  if(prototypes.length){
    // Prépare un pool fixe ; la congestion change le nombre de voitures actives sans recréer leurs maillages.
    for(let i=0;i<48;i++){
      const kind=fleet[i%fleet.length]!,prototype=prototypes.find(p=>p.name===kind.model)??prototypes[0]!
      const car=prototype.clone('Vehicule de Mboa '+i,null,true)
      car.setEnabled(true);car.rotationQuaternion=null;car.scaling.setAll(kind.scale);car.isPickable=false;car.receiveShadows=true
      if(car.material instanceof StandardMaterial){
        car.material=car.material.clone('Carrosserie '+i)
        ;(car.material as StandardMaterial).diffuseColor=Color3.FromHexString(kind.paint[i%kind.paint.length]!)
      }
      shadows.addShadowCaster(car);cars.push(car)
    }
  }
  function mat(name:string,color:string){const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=Color3.Black();return m}
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
  const driving=createRoadTraffic(roadPaths,cars.length,{radius:trafficRadius,height:roadHeight})
  let trafficLevel=''
  // Utilise la même condition de circulation que les devis pour que le trafic visible corresponde au gameplay.
  function updateTraffic(){
    const level=getTrafficConditions().id
    if(level===trafficLevel)return
    trafficLevel=level
    driving.configure(level==='jammed'?44:level==='busy'?24:10,level==='jammed'?.26:level==='busy'?.62:1,level==='jammed'?2:level==='busy'?1:0)
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
    setEvening(value:boolean){boatCabin.emissiveColor=value?new Color3(.18,.12,.045):Color3.Black()},
    metrics(){return {network:driving.network,cars:driving.states.filter(s=>s.active).length,traffic:trafficLevel,averageSpeed:driving.states.filter(s=>s.active).reduce((sum,s)=>sum+s.speed,0)/Math.max(1,driving.states.filter(s=>s.active).length),stoppedCars:driving.states.filter(s=>s.active&&s.speed<.15).length,boats:boats.length,birds:birds.length,paused,carPosition:cars[0]?.position.asArray()??[]}},
  }
}
