// Outil de capture et de contrôle de la scène dans Chrome via son protocole de débogage.
// Les images et rapports produits servent à examiner le rendu au-delà de la compilation.

import {spawn} from 'node:child_process'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import path from 'node:path'
const settings=JSON.parse(await readFile(new URL('../city-layout.json',import.meta.url),'utf8'));const layoutScale=settings.horizontalScale
const out=path.resolve('artifacts');await mkdir(out,{recursive:true})
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-extensions','--disable-dev-shm-usage','--disable-gpu-sandbox','--no-first-run','--no-default-browser-check','--remote-debugging-port=9226',`--user-data-dir=${path.join(out,'chrome-profile')}`,'--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1557,831','about:blank'],{stdio:'ignore',windowsHide:true})
let ws;const errors=[];const messages=[]
try {
 let targets
 for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9226/json/list')).json();break}catch{await new Promise(r=>setTimeout(r,300))}}
 console.log('Chrome prêt');const target=targets.find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl)
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
 let id=0;const pending=new Map()
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}}else{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled')messages.push({type:m.params.type,args:m.params.args.map(a=>a.value??a.description)})}}
 const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>reject(Error('CDP timeout: '+method)),15000);pending.set(key,{resolve:(v)=>{clearTimeout(timer);resolve(v)},reject:(e)=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id:key,method,params}))})
 const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}
 const frames=async(count)=>evaluate(`new Promise(resolve=>{let remaining=${count};const step=()=>{if(--remaining<=0)resolve(true);else requestAnimationFrame(step)};requestAnimationFrame(step)})`)
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}
 await capture('city-overview.png')
 const checks={ready,title:await evaluate('document.title'),loading:await evaluate('document.querySelector(".loading")?.textContent ?? null')}
 if(ready){
  await evaluate('document.querySelector("[data-view=square]").click()');await new Promise(r=>setTimeout(r,1800));await capture('city-square.png')
  checks.square=await evaluate('document.querySelector("#view-name").textContent')
  checks.views={}
  for(const name of ['market','hill','ministry','stadium','airport','njoka','home','village','jcd','baos']){
   await evaluate(`document.querySelector('[data-view="${name}"]').click()`)
   await new Promise(r=>setTimeout(r,1700))
   checks.views[name]=await evaluate('document.querySelector("#view-name").textContent')
   await capture(`city-${name}.png`)
  }
  checks.metrics=await evaluate('window.__MBOA_QA__.metrics()')
  if(checks.metrics.layoutScale!==layoutScale)throw Error('Camera and model layout scales disagree')
  await evaluate('document.querySelector("#reset").click()');await new Promise(r=>setTimeout(r,1700))
  await evaluate('if(!window.__MBOA_QA__.metrics().life.paused)document.querySelector("#motion").click()');await frames(2)
  const stoppedA=await evaluate('window.__MBOA_QA__.metrics().life.carPosition')
  await frames(2);const stoppedB=await evaluate('window.__MBOA_QA__.metrics().life.carPosition')
  checks.animationPause=stoppedA.every((v,i)=>Math.abs(v-stoppedB[i])<.001)
  await evaluate('document.querySelector("#motion").click()');await frames(3)
  const moved=await evaluate('window.__MBOA_QA__.metrics().life.carPosition')
  checks.animationMoves=moved.some((v,i)=>Math.abs(v-stoppedB[i])>.01)
  if(!checks.animationPause||!checks.animationMoves||checks.metrics.life.cars<4)throw Error('Traffic animation check failed: '+JSON.stringify({stoppedA,stoppedB,moved,life:await evaluate('window.__MBOA_QA__.metrics().life')}))

  for(const [name,alpha,beta,radius] of [['east',0,.95,300],['west',Math.PI,.95,300],['north',-Math.PI/2,1.0,300],['plan',Math.PI/2,.28,340]]){
   await evaluate(`window.__MBOA_QA__.setCamera(${alpha},${beta},${radius*layoutScale},[0,0,0])`)
   await new Promise(r=>setTimeout(r,1000));await capture(`city-${name}.png`)
  }
  for(const [name,radius,target] of [['terrain',440,[0,0,0]],['eastern-extension',140,[85,0,0]]]){
   await evaluate(`window.__MBOA_QA__.setCamera(${Math.PI/2},${name==='terrain'?.28:.65},${radius*layoutScale},${JSON.stringify(target.map((value,i)=>i===1?value:value*layoutScale))})`)
   await new Promise(r=>setTimeout(r,1000));await capture(`city-${name}.png`)
  }
  await evaluate('document.querySelector("#reset").click()');await new Promise(r=>setTimeout(r,1800))
  await evaluate('document.querySelector("#compare").click()');checks.reference=await evaluate('!document.querySelector("#reference").hidden');await evaluate('document.querySelector("#compare").click()')
  await evaluate('document.querySelector("#orbit").click()');checks.orbit=await evaluate('document.querySelector("#orbit").getAttribute("aria-pressed")');await evaluate('document.querySelector("#orbit").click()')
  await evaluate('document.querySelector("#light").click()');checks.evening=await evaluate('document.querySelector("#light").getAttribute("aria-pressed")');await new Promise(r=>setTimeout(r,800));await capture('city-evening.png');await evaluate('document.querySelector("#light").click()')
  await evaluate('document.querySelector("#reset").click()');await new Promise(r=>setTimeout(r,1800))
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,1000));await capture('city-mobile.png')
  checks.overflow=await evaluate('document.documentElement.scrollWidth>innerWidth')
 }
 if(!ready || errors.length || checks.overflow || messages.some(m=>m.type==='error'))process.exitCode=1
 await writeFile(path.join(out,'browser-check.json'),JSON.stringify({checks,errors,messages},null,2));console.log(JSON.stringify({checks,errors,messages:messages.filter(m=>m.type==='error')},null,2))
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}



