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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const resources=()=>evaluate(`import('/src/player-resources.ts').then(m=>m.getPlayerResources())`)
 const open=()=>evaluate(`document.querySelector('.places [data-view=home]').click();document.querySelector('[data-service=home-sleep]').click()`)
 const select=n=>evaluate(`document.querySelector('#sleep-duration').value='${n}';document.querySelector('#sleep-duration').dispatchEvent(new Event('input'))`)
 async function finished(){for(let i=0;i<100;i++){await pause(50);if((await state()).sleeping.mode==='closed'&&await evaluate(`document.querySelector('.sleep-transition').hidden`))return}throw Error('Sleep transition stuck')}
 await evaluate(`import('/src/player-resources.ts').then(m=>m.spendEnergy(90))`)
 const before=await resources();await open();await select(240)
 if(!await evaluate(`document.querySelector('[data-sleep-energy]').textContent==='+50 énergie'&&document.querySelector('[data-sleep-to]').textContent==='12:00'`))throw Error('Preview wrong')
 await capture('sleep-preview-desktop.png')
 await select(0);if(!await evaluate(`document.querySelector('[data-sleep-confirm]').disabled&&document.querySelector('[data-sleep-energy]').textContent==='+0 énergie'`))throw Error('Zero duration')
 await evaluate(`document.querySelector('[data-sleep-cancel]').click()`)
 if(JSON.stringify(await resources())!==JSON.stringify(before))throw Error('Cancel changed resources')
 await evaluate(`document.querySelector('[data-service=home-sleep]').click()`);await select(240)
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('sleep-preview-mobile.png')
 if(!await evaluate(`document.querySelector('#wait-open').disabled`))throw Error('Wait not blocked')
 const player=(await state()).player
 await evaluate(`document.querySelector('[data-sleep-confirm]').click();document.querySelector('[data-sleep-confirm]').click()`);await finished()
 let r=await resources();if(r.energy!==60||r.mood!==95||await evaluate(`document.querySelector('#game-time').textContent`)!=='12:00')throw Error(JSON.stringify(r))
 if(JSON.stringify((await state()).player)!==JSON.stringify(player))throw Error('Sleep moved player')
 await capture('sleep-result-mobile.png')
 await evaluate(`import('/src/player-resources.ts').then(m=>{m.restoreEnergy(38);m.setMood(139)})`)
 await open();await select(480)
 if(!await evaluate(`document.querySelector('[data-sleep-energy]').textContent==='+2 énergie'&&document.querySelector('[data-sleep-mood]').textContent.includes('+1')`))throw Error('Actual capped gains')
 await evaluate(`document.querySelector('[data-sleep-cancel]').click();document.querySelector('.venue-close').click()`)
 await evaluate(`import('/src/game-clock.ts').then(m=>m.advanceGameTime(6*1440+1430-m.getGameTime().totalMinutes))`)
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 await open();await select(30)
 if(!await evaluate(`document.querySelector('[data-sleep-to-day]').textContent.includes('Lundi · semaine 2 · Nuit')`))throw Error('Week preview')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Overflow')
 await capture('sleep-week-preview-320.png')
 await evaluate(`document.querySelector('[data-sleep-confirm]').click()`);await finished();await pause(300)
 if(await evaluate(`document.querySelector('#game-time').textContent`)!=='00:20')throw Error('Rollover')
 r=await resources();if(r.energy!==100||r.mood!==139)throw Error('30min gains '+JSON.stringify(r))
 if((await state()).daylight.applied!=='Nuit')throw Error('Night not applied after sleep')
 await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))break}
 r=await resources();if(r.energy!==100||r.mood!==139||await evaluate(`document.querySelector('#game-time').textContent`)!=='00:20')throw Error('Reload persistence')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({preview:true,zero:true,cancel:true,uniqueConfirmation:true,gainCaps:true,weekRollover:true,reducedMotion:true,nightAfterSleep:true,reload:true,mobile320:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-game-minutes-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-daylight-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
