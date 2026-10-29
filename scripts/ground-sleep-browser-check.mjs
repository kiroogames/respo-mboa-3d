// Vérifie le sommeil au sol : recharge réelle, baisse d’humeur bornée et quatre heures écoulées.
// Contrôle les conséquences visibles dans les compteurs et la présence des PNJ.

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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1'])localStorage.removeItem(key)`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}

 const state=()=>evaluate(`Promise.all([import('/src/game-clock.ts'),import('/src/player-resources.ts'),import('/src/currency.ts')]).then(([c,r,m])=>({clock:c.getGameTime(),resources:r.getPlayerResources(),money:m.getMoneyBalance(),baeHidden:document.querySelector('[data-npc=bae]').hidden}))`)
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await evaluate(`import('/src/player-resources.ts').then(r=>{r.spendEnergy(80);r.setMood(10)})`)
 await evaluate(`document.querySelector('.places [data-view=home]').click()`)
 const before=await state()
 if(!await evaluate(`!document.querySelector('[data-service=sleep-on-ground]').disabled`))throw Error('Ground sleep unavailable')
 await evaluate(`document.querySelector('[data-service=sleep-on-ground]').click()`)
 const after=await state()
 if(after.resources.energy!==100||after.resources.mood!==0||after.money!==before.money||after.clock.totalMinutes-before.clock.totalMinutes!==240)throw Error(JSON.stringify({before,after}))
 await new Promise(r=>setTimeout(r,600))
 await evaluate(`document.querySelector('[data-service=sleep-on-ground]').click()`)
 const second=await state()
 if(second.clock.time!=='16:00'||second.baeHidden)throw Error(JSON.stringify(second))
 await capture('ground-sleep-mobile.png')
 if(errors.length)throw Error(JSON.stringify(errors))
 await writeFile(path.join(out,'ground-sleep-browser-check.json'),JSON.stringify({before,after,second,errors},null,2));console.log(JSON.stringify({before,after,second,errors},null,2))
 await evaluate(`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
