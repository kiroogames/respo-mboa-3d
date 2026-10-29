// Capture les déplacements et les zooms de caméra pour examiner les défauts de profondeur du sol.

import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
const baseline=process.argv.includes('--baseline'),out=path.resolve('artifacts')
await mkdir(out,{recursive:true})
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-port=9227',`--user-data-dir=${path.join(out,'chrome-depth-profile')}`,'--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1024,768','about:blank'],{stdio:'ignore',windowsHide:true})
let ws;const errors=[]
try{
 let targets
 for(let i=0;i<80;i++){try{targets=await(await fetch('http://127.0.0.1:9227/json/list')).json();break}catch{await new Promise(r=>setTimeout(r,250))}}
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
 let id=0;const pending=new Map()
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)}
 const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>reject(Error(method+' timed out')),25000);pending.set(key,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id:key,method,params}))})
 const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready==="true"');if(ready)break}
 if(!ready)throw Error('City did not load')
 await evaluate(`(async()=>{
  const code=await(await fetch('/src/main.ts')).text();const enginePath=code.match(/from ["']([^"']*core_Engines_engine[^"']*)/)[1];const mathPath=code.match(/from ["']([^"']*core_Maths_math_+vector[^"']*)/)[1]
  const {Engine}=await import(enginePath),math=await import(mathPath),engine=Engine.Instances.find(e=>e.scenes.length),scene=engine.scenes[0]
  window.__DEPTH_TEST__={engine,scene,math,base:scene.meshes.find(m=>m.material?.name==='WSP Terre des abords').material}
  if(!window.__MBOA_QA__.metrics().life.paused)document.querySelector('#motion').click()
 })()`)
 const frames=async(n=3)=>evaluate(`new Promise(resolve=>{let n=${n};const tick=()=>--n?requestAnimationFrame(tick):resolve(true);requestAnimationFrame(tick)})`)
 await frames()
 const gps=await evaluate(`(()=>{const pin=document.querySelector('.player-pin'),head=pin.querySelector('.hero-portrait'),frame=pin.querySelector('.player-pin-frame'),r=pin.getBoundingClientRect();return {portraitTransform:head?getComputedStyle(head).transform:null,frameTransform:frame?getComputedStyle(frame).transform:null,frame:frame?.getAttribute('src'),clip:{x:r.x-4,y:r.y-4,width:r.width+8,height:r.height+8,scale:1}}})()`)
 if(gps.clip.x>0&&gps.clip.y>0){const s=await call('Page.captureScreenshot',{format:'png',clip:gps.clip});await writeFile(path.join(out,'gps-upright.png'),Buffer.from(s.data,'base64'))}
 await evaluate(`(()=>{const style=document.createElement('style');style.textContent='header,footer,#landmarks,.scene-caption,#dialogue{display:none!important}';document.head.append(style);const m=window.__DEPTH_TEST__.base;m.diffuseColor.set(1,0,1);m.emissiveColor.set(1,0,1);m.disableLighting=true;m.fogEnabled=false})()`)
 const sample=()=>evaluate(`(()=>{
  const {engine,scene,math}=window.__DEPTH_TEST__,canvas=document.querySelector('#city'),copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const context=copy.getContext('2d',{willReadFrequently:true});context.drawImage(canvas,0,0);const data=context.getImageData(0,0,copy.width,copy.height).data
  const vp=scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight());let exposed=0,total=0
  for(let i=0;i<11;i++)for(let j=0;j<9;j++){const p=math.Vector3.Project(new math.Vector3((scene.activeCamera.radius>700?-350:-200)+i*8,0,(scene.activeCamera.radius>700?100:40)+j*8),math.Matrix.Identity(),scene.getTransformMatrix(),vp),x=Math.round(p.x),y=Math.round(p.y);if(x<1||y<1||x>=copy.width-1||y>=copy.height-1||p.z<0||p.z>1)continue;const k=4*(y*copy.width+x);total++;if(data[k]>180&&data[k+2]>180&&data[k+1]<130)exposed++}
  return {exposed,total,near:scene.activeCamera.minZ,radius:scene.activeCamera.radius}
 })()`)
 const cases=[]
 for(const [name,alpha,beta,radius] of [['overview',Math.PI/2,.82,512],['far',Math.PI/2,1.15,1040],['far-grazing',1.15,1.35,1040],['far-reverse',3.5,1.3,1040]]){
  for(const delta of [0,.0002,-.0002]){
   await evaluate(`window.__MBOA_QA__.setCamera(${alpha+delta},${beta},${radius},[0,0,0])`);await frames();const result=await sample();cases.push({name,delta,...result})
   if(name==='far'&&delta===0){const s=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,baseline?'depth-before.png':'depth-after.png'),Buffer.from(s.data,'base64'))}
  }
 }
 const diagnostics=await evaluate(`(()=>{const {scene,engine}=window.__DEPTH_TEST__,gl=document.querySelector('#city').getContext('webgl2'),baseMeshes=scene.meshes.filter(m=>m.material?.name==='WSP Terre des abords');return {depthBits:gl.getParameter(gl.DEPTH_BITS),upwardBaseVertices:baseMeshes.reduce((n,m)=>n+Array.from(m.getVerticesData('normal')??[]).filter((v,i)=>i%3===1&&v>.9).length,0),near:scene.activeCamera.minZ,far:scene.activeCamera.maxZ,webglVersion:engine.webGLVersion}})()`)
 const result={baseline,gps,diagnostics,cases,errors};await writeFile(path.join(out,baseline?'render-stability-before.json':'render-stability-after.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
 if(!baseline&&(cases.some(c=>c.total<15||c.exposed>0)||diagnostics.upwardBaseVertices!==0||gps.portraitTransform!=='matrix(0, -1.1, 1.1, 0, 0, 0)'||errors.length))process.exitCode=1
} catch(error){console.error(error);process.exitCode=1} finally{ws?.close();chrome.kill()}