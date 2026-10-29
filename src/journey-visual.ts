/* Respo original animé en 2,5D et véhicules miniatures 3D.
 * Tout est réutilisé d’un trajet à l’autre : ni modèle recréé, ni coût de jeu ici.
 */
import {Mesh} from '@babylonjs/core/Meshes/mesh'
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder'
import {TransformNode} from '@babylonjs/core/Meshes/transformNode'
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial'
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture'
import {Color3} from '@babylonjs/core/Maths/math.color'
import type {Scene} from '@babylonjs/core/scene'
import type {TravelMode,TravelPoint} from './travel'
import type {JourneyPhase} from './journey-playback'
import {roadHeight} from './road-network'

type Part={sprite:string;m:[number,number,number,number,number,number]}
type AnimationData={sprites:Record<string,{x:number;y:number;w:number;h:number;px:number;py:number}>;clips:Record<string,{fps:number;frames:Part[][]}>}

export function createJourneyVisual(scene:Scene,base:string){
 const root=new TransformNode('Respo en déplacement',scene)
 const actor=new TransformNode('Respo original 2,5D',scene);actor.parent=root
 const vehicles=new Map<TravelMode,TransformNode>()
 const doors:TransformNode[]=[]
 function mat(name:string,color:string){const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=Color3.Black();return m}
 const yellow=mat('Taxi commun jaune','#e5ad28'),green=mat('Yonga vert','#174f43'),glass=mat('Vitres bleutées','#9cd3dc'),rubber=mat('Pneus','#273135'),metal=mat('Jantes','#c8cec3'),red=mat('Moto rouge','#cf4c32'),skin=mat('Conducteur','#815235'),helmet=mat('Casque moto','#e9b537'),shirt=mat('Tenue motoman','#365966'),lights=mat('Phares','#fff0bd')
 function box(parent:TransformNode,name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:StandardMaterial){const mesh=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);mesh.parent=parent;mesh.position.set(x,y,z);mesh.material=material;mesh.isPickable=false;return mesh}
 function ball(parent:TransformNode,name:string,size:number,x:number,y:number,z:number,material:StandardMaterial){const m=MeshBuilder.CreateSphere(name,{diameter:size,segments:10},scene);m.parent=parent;m.position.set(x,y,z);m.material=material;m.isPickable=false;return m}
 function wheel(parent:TransformNode,x:number,z:number,r=.58){const m=MeshBuilder.CreateCylinder('Roue',{height:.32,diameter:r*2,tessellation:12},scene);m.parent=parent;m.rotation.z=Math.PI/2;m.position.set(x,r,z);m.material=rubber;m.isPickable=false;const hub=ball(parent,'Jante',r*.85,x+Math.sign(x)*.18,r,z,metal);hub.scaling.x=.25}
 for(const mode of ['taxi','yonga'] as const){
  const car=new TransformNode(mode==='taxi'?'Taxi commun du Respo':'Yonga du Respo',scene);car.parent=root;vehicles.set(mode,car)
  const paint=mode==='taxi'?yellow:green
  box(car,'Carrosserie',2.8,.85,5.5,0,1.05,0,paint)
  box(car,'Habitacle',2.4,1.05,2.7,0,1.9,-.2,glass)
  box(car,'Toit',2.5,.22,2.65,0,2.48,-.2,paint)
  for(const x of [-1.23,1.23])for(const z of [-1.7,1.65])wheel(car,x,z)
  for(const x of [-.95,.95])box(car,'Phare',.55,.3,.1,x,1.15,2.8,lights)
  box(car,'Pare-chocs',2.75,.2,.2,0,.8,2.8,metal)
  if(mode==='taxi')box(car,'Enseigne taxi',.95,.35,.6,0,2.75,0,yellow)
  const door=new TransformNode('Porte passager',scene);door.parent=car;door.position.set(1.43,1.35,.8);doors.push(door)
  box(door,'Porte mobile',.12,.85,1.5,0,0,-.75,paint)
  box(door,'Vitre porte',.1,.6,1.4,0,.68,-.75,glass)
 }
 const bike=new TransformNode('Bendskin du Respo',scene);bike.parent=root;vehicles.set('moto',bike)
 wheel(bike,0,-1.25,.65);wheel(bike,0,1.35,.65)
 box(bike,'Cadre moto',.55,.65,2.3,0,1,0,red)
 box(bike,'Selle',.75,.22,1.65,0,1.55,-.35,rubber)
 box(bike,'Guidon',1.3,.12,.15,0,1.95,.8,metal)
 box(bike,'Fourche',.18,1,.18,0,1.1,1.3,metal)
 ball(bike,'Phare moto',.42,0,1.7,1.2,lights)
 box(bike,'Dos conducteur',.7,.9,.5,0,2.05,.15,shirt)
 ball(bike,'Tête conducteur',.55,0,2.8,.22,skin)
 ball(bike,'Casque conducteur',.67,0,3,.18,helmet)
 for(const x of [-.42,.42]){const leg=box(bike,'Jambe conducteur',.25,.85,.3,x,1.35,.3,shirt);leg.rotation.x=-.65;const arm=box(bike,'Bras conducteur',.2,.75,.2,x,2.05,.5,skin);arm.rotation.x=-.85}

 const texture=new DynamicTexture('Animations originales du Respo',{width:256,height:256},scene,false)
 texture.hasAlpha=true
 const actorMat=new StandardMaterial('Personnage original détouré',scene);actorMat.diffuseTexture=texture;actorMat.useAlphaFromDiffuseTexture=true;actorMat.emissiveColor=Color3.White();actorMat.disableLighting=true;actorMat.backFaceCulling=false
 const plane=MeshBuilder.CreatePlane('Silhouette animée du Respo',{size:5.4},scene);plane.parent=actor;plane.position.y=2.25;plane.billboardMode=Mesh.BILLBOARDMODE_Y;plane.material=actorMat;plane.isPickable=false
 const shadowMat=mat('Ombre de contact du Respo','#193b30');shadowMat.alpha=.22;shadowMat.disableLighting=true;shadowMat.emissiveColor=Color3.FromHexString('#193b30');shadowMat.zOffset=-1
 const shadow=MeshBuilder.CreateDisc('Ancrage au sol',{radius:1.05,tessellation:20},scene);shadow.parent=actor;shadow.rotation.x=Math.PI/2;shadow.scaling.y=.6;shadow.position.y=.06;shadow.material=shadowMat;shadow.isPickable=false
 let data:AnimationData|undefined,atlas:HTMLImageElement|undefined,scale=1,center=0,feet=0,lastFrame='',frameId=0,currentClip='idle',currentMode:TravelMode='walk',phase:JourneyPhase='done'
 const ready=Promise.all([
  fetch(`${base}characters/respo/respo-animation.json`).then(r=>{if(!r.ok)throw new Error('Animations du Respo indisponibles');return r.json() as Promise<AnimationData>}),
  new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Atlas du Respo indisponible'));image.src=`${base}characters/respo/respo-atlas-0.png`}),
 ]).then(([source,image])=>{
  data=source;atlas=image
  const corners=source.clips.idle!.frames[0]!.flatMap(part=>{const s=source.sprites[part.sprite]!;const [a,b,c,d,tx,ty]=part.m;return [0,s.w].flatMap(x=>[0,s.h].map(y=>{const px=x-s.px*s.w,py=y-s.py*s.h;return {x:a*px+c*py+tx,y:b*px+d*py+ty}}))})
  const minY=Math.min(...corners.map(p=>p.y));feet=Math.max(...corners.map(p=>p.y));center=(Math.min(...corners.map(p=>p.x))+Math.max(...corners.map(p=>p.x)))/2;scale=184/(feet-minY)
  draw('idle',0,false)
 })
 function draw(clip:string,seconds:number,flip:boolean){
  if(!data||!atlas)return
  const animation=data.clips[clip]??data.clips.idle!;frameId=Math.floor(seconds*animation.fps)%animation.frames.length;currentClip=clip
  const key=`${clip}/${frameId}/${flip}`;if(key===lastFrame)return;lastFrame=key
  const ctx=texture.getContext() as CanvasRenderingContext2D;ctx.clearRect(0,0,256,256);ctx.save();ctx.translate(128,235);ctx.scale(flip?-scale:scale,scale);ctx.translate(-center,-feet)
  for(const part of animation.frames[frameId]!){const s=data.sprites[part.sprite]!;ctx.save();ctx.transform(...part.m);ctx.drawImage(atlas,s.x,s.y,s.w,s.h,-s.px*s.w,-s.py*s.h,s.w,s.h);ctx.restore()}
  ctx.restore();texture.update()
 }
 root.setEnabled(false)
 return {
  ready,
  show(mode:TravelMode){currentMode=mode;root.setEnabled(true);for(const [id,vehicle] of vehicles)vehicle.setEnabled(id===mode)},
  hide(){phase='done';root.setEnabled(false)},
  update(state:{phase:JourneyPhase;progress:number;point:TravelPoint;yaw:number;seconds:number;cameraAlpha:number;vehiclePoint?:TravelPoint}){
   phase=state.phase
   const {point,yaw,progress}=state;const height=roadHeight(point[0],point[2])
   root.position.set(point[0],height,point[2])
   const riding=phase==='travel'&&currentMode!=='walk'
   actor.setEnabled(!riding||currentMode==='moto')
   actor.position.set(0,0,0);actor.scaling.setAll(1);plane.position.y=2.25
   const boarding=phase==='board',alighting=phase==='alight'
   // Le personnage rejoint la portière puis disparaît dans l’habitacle ; mouvement inverse à l’arrivée.
   if(boarding||alighting){const t=boarding?1-progress:progress;actor.position.set(Math.cos(yaw)*2.1*t,0,-Math.sin(yaw)*2.1*t);actor.scaling.setAll(.75+.25*t)}
   for(const [id,vehicle] of vehicles){
    vehicle.rotation.y=yaw;vehicle.setEnabled(id===currentMode&&phase!=='done')
    const parked=state.vehiclePoint
    vehicle.position.set(parked?parked[0]-point[0]:0,parked?roadHeight(parked[0],parked[2])-height:0,parked?parked[2]-point[2]:0)
   }
   for(const door of doors)door.rotation.y=(boarding?Math.sin(progress*Math.PI):alighting?Math.sin(progress*Math.PI):0)*1.15
   if(riding&&currentMode==='moto'){actor.position.set(-Math.sin(yaw)*.7,1.1,-Math.cos(yaw)*.7);actor.scaling.set(.72,.6,.72);shadow.setEnabled(false)}else shadow.setEnabled(true)
   // Marche de dos quand on s’éloigne de la caméra ; même rythme que les clips Unity.
   const moving=phase==='exit'||phase==='enter'||phase==='travel'&&currentMode==='walk'||boarding||alighting
   const toward=Math.cos(yaw)*Math.cos(state.cameraAlpha)+Math.sin(yaw)*Math.sin(state.cameraAlpha)
   draw(moving?(toward<0?'walk-up':'walk'):'idle',state.seconds,Math.cos(yaw-state.cameraAlpha)<0)
   return [point[0],height+4,point[2]] as TravelPoint
  },
  snapshot(){return {visible:root.isEnabled(),mode:currentMode,phase,clip:currentClip,frame:frameId,position:root.position.asArray(),actorVisible:actor.isEnabled()&&root.isEnabled(),vehicleVisible:[...vehicles.values()].some(v=>v.isEnabled()&&root.isEnabled()),source:'Respo original animé 2,5D'}},
 }
}
