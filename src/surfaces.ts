/*
 * Matériaux animés : reflets de l’eau, normales et éclairage du soir.
 * Les textures et matériaux sont réutilisés pour limiter le coût du rendu.
 */

import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Scene } from '@babylonjs/core/scene'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'

export function createSurfaceKit(scene:Scene){
  const waterNames=new Set(['WSP Eau turquoise','WSP Mer vivante'])
  const water=new DynamicTexture('Reflets du littoral',{width:512,height:512},scene,true)
  const context=water.getContext();context.fillStyle='#dae6dd';context.fillRect(0,0,512,512)
  for(let i=0;i<52;i++){
    const x=(i*97)%512,y=(i*137)%512
    context.strokeStyle=`rgba(255,255,255,${.12+(i%4)*.035})`;context.lineWidth=.8
    context.beginPath();context.moveTo(x,y);context.quadraticCurveTo(x+22,y-3,x+48,y);context.stroke()
  }
  water.wrapU=Texture.WRAP_ADDRESSMODE;water.wrapV=Texture.WRAP_ADDRESSMODE;water.anisotropicFilteringLevel=8;water.update()
  const normal=new DynamicTexture('Ondulation de la mer',{width:128,height:128},scene,true)
  const nc=normal.getContext(),pixels=nc.getImageData(0,0,128,128)
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const i=(y*128+x)*4
    pixels.data[i]=Math.round(128+18*Math.sin(x*Math.PI/16+y*Math.PI/32))
    pixels.data[i+1]=Math.round(128+15*Math.cos(y*Math.PI/16-x*Math.PI/32));pixels.data[i+2]=253;pixels.data[i+3]=255
  }
  nc.putImageData(pixels,0,0);normal.update();normal.wrapU=Texture.WRAP_ADDRESSMODE;normal.wrapV=Texture.WRAP_ADDRESSMODE;normal.level=.22
  const lamps:StandardMaterial[]=[],windows:StandardMaterial[]=[],nightSigns:StandardMaterial[]=[]
  let paused=false
  return {
    styleMaterial(name:string,m:StandardMaterial){
      if(waterNames.has(name)){
        m.diffuseTexture=water;m.bumpTexture=normal;m.diffuseColor=Color3.FromHexString('#459DA5');m.emissiveColor=new Color3(.035,.06,.06)
        m.specularColor=new Color3(.48,.52,.48);m.specularPower=96
        if(name==='WSP Mer vivante')m.alpha=.76
      }
      if(name==='Verre des lampadaires'){lamps.push(m);m.emissiveColor=new Color3(.14,.12,.045)}
      if(name==='WSP Fenetres habitees'){windows.push(m);m.specularColor=new Color3(.17,.2,.2);m.specularPower=64}
      if(/Rue_joka/.test(name)){nightSigns.push(m);m.emissiveColor=new Color3(.06,.06,.06)}
    },
    // Les UV de l’eau suivent ses coordonnées mondiales pour garder une texture continue après fusion des maillages.
    prepareMesh(mesh:Mesh){
      if(!waterNames.has(mesh.material?.name??''))return
      const positions=mesh.getVerticesData('position');if(!positions)return
      const matrix=mesh.getWorldMatrix(),uv=new Float32Array(positions.length/3*2)
      for(let i=0;i<positions.length;i+=3){const world=Vector3.TransformCoordinates(Vector3.FromArray(positions,i),matrix);uv[i/3*2]=world.x/16;uv[i/3*2+1]=-world.z/16}
      mesh.setVerticesData('uv',uv,false,2)
    },
    // Les surfaces émissives simulent les fenêtres et lampadaires sans multiplier les sources lumineuses.
    setEvening(value:boolean){
      for(const m of lamps)m.emissiveColor=value?new Color3(1,.65,.19):new Color3(.14,.12,.045)
      for(const m of windows)m.emissiveColor=value?new Color3(.35,.24,.09):new Color3(.025,.025,.025)
      for(const m of nightSigns)m.emissiveColor=value?new Color3(.24,.22,.2):new Color3(.06,.06,.06)
    },
    setPaused(value:boolean){paused=value},
    tick(delta:number){if(paused)return;const d=Math.min(delta,100);water.uOffset=(water.uOffset+d*.000006)%1;normal.uOffset=(normal.uOffset+d*.000009)%1;normal.vOffset=(normal.vOffset+d*.000003)%1},
  }
}