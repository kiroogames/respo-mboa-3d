// Contrôle les huit conversations Unity à 10 h 30, quand tous les personnages sont au ministère.
// Vérifie aussi les GPS distincts sur mobile et le refus des interactions à distance.

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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-daylight-v1');localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const advance=minutes=>evaluate(`import('/src/game-clock.ts').then(m=>m.advanceGameTime(${minutes}))`)
 async function period(expected){await pause(900);const v=(await state()).daylight;if(v.applied!==expected||v.pending)throw Error(JSON.stringify(v));if(await evaluate(`document.querySelector('#game-period').textContent`)!==v.period)throw Error('HUD mismatch')}
 if((await state()).daylight.period!=='Jour')throw Error('Initial day')
 const boundaries=await evaluate(`import('/src/daylight.ts').then(m=>[0,299,300,419,420,1019,1020,1139,1140,1439,1440].map(m.getDayPeriod))`)
 if(JSON.stringify(boundaries)!==JSON.stringify(['Nuit','Nuit','Aube','Aube','Jour','Jour','Crépuscule','Crépuscule','Nuit','Nuit','Nuit']))throw Error(JSON.stringify(boundaries))
 await period('Jour');await capture('daylight-day-desktop.png')
 // Une vraie fenêtre native bloque la mise à jour visuelle, mais pas la date.
 await evaluate(`window.testDialog=document.createElement('dialog');testDialog.textContent='Activité de test';document.body.append(testDialog);testDialog.showModal()`)
 await advance(540);await pause(100)
 let v=(await state()).daylight;if(v.period!=='Crépuscule'||v.applied!=='Jour'||!v.pending)throw Error('Modal did not defer '+JSON.stringify(v))
 await advance(120);await evaluate('testDialog.close();testDialog.remove()');await period('Nuit');await capture('daylight-night-desktop.png')
 await evaluate(`document.querySelector('#light').click()`);await pause(900)
 v=(await state()).daylight;if(v.enabled||v.applied!=='Jour'||v.period!=='Nuit')throw Error('Daylight override')
 await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))break}
 await pause(900);v=(await state()).daylight;if(v.enabled||v.applied!=='Jour')throw Error('Preference persistence')
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 await evaluate(`document.querySelector('#light').click()`);await period('Nuit')
 await advance(300);await period('Nuit');if(await evaluate(`document.querySelector('#game-time').textContent`)!=='00:00')throw Error('Midnight')
 await evaluate(`document.querySelector('#dialogue').hidden=false`);await advance(300);await pause(100)
 v=(await state()).daylight;if(v.applied!=='Nuit'||v.period!=='Aube'||!v.pending)throw Error('Dialogue defer')
 await evaluate(`document.querySelector('#dialogue').hidden=true`);await period('Aube');await capture('daylight-dawn-desktop.png')
 await advance(120);await period('Jour')
 await advance(600);await period('Crépuscule');await capture('daylight-dusk-desktop.png')
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await advance(120);await period('Nuit');await capture('daylight-night-mobile.png')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Mobile overflow')
 const bounds=await evaluate(`({clock:document.querySelector('.game-clock').getBoundingClientRect().toJSON(),actions:document.querySelector('.header-actions').getBoundingClientRect().toJSON()})`)
 if(bounds.actions.top<bounds.clock.bottom)throw Error('HUD overlap')
 await capture('daylight-night-320.png')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({boundaries:true,deferredModal:true,deferredDialogue:true,latestPeriod:true,override:true,reloadPreference:true,midnight:true,reducedMotion:true,mobile320:true,errors},null,2))
 await evaluate(`localStorage.removeItem('mboa-daylight-v1');localStorage.removeItem('mboa-game-minutes-v1')`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
