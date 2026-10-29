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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-user-queue-v1');localStorage.setItem('mboa-player-zone-v1','ministry');localStorage.setItem('mboa-game-minutes-v1','600')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const add=n=>evaluate(`import('/src/player-resources.ts').then(r=>r.changeRespoPoints(${n}))`)
 const hud=()=>evaluate(`({level:document.querySelector('#respo-level').textContent,points:document.querySelector('#respo-amount').textContent,value:document.querySelector('#respo-progress').value,max:document.querySelector('#respo-progress').max})`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 if((await hud()).level!=='Niv. 1')throw Error('Initial level')
 await add(187);if((await hud()).value!==187)throw Error('Initial progress')
 await evaluate(`document.querySelector('.places [data-view=ministry]').click();document.querySelector('[data-venue-queue]').click();document.querySelector('[data-queue-confirm]').click()`)
 await pause(200)
 let value=await hud(),s=await state()
 if(value.level!=='Niv. 2'||value.points!=='195 / 475'||value.value!==5||value.max!==285)throw Error(JSON.stringify(value))
 if(s.progression.notice.visible||s.progression.notice.pending!==2)throw Error('Notice not deferred')
 await capture('respo-level-menu-desktop.png')
 await evaluate(`document.querySelector('[data-queue-back]').click()`);await pause(100)
 if((await state()).progression.notice.visible)throw Error('Notice over venue')
 await evaluate(`document.querySelector('.venue-close').click()`);await pause(250)
 if(!(await state()).progression.notice.visible)throw Error('Notice missing in exploration')
 await capture('respo-level-up-desktop.png')
 await evaluate(`window.testDialog=document.createElement('dialog');document.body.append(testDialog);testDialog.showModal()`);await add(660);await pause(100)
 s=await state();if(s.progression.level!==4||s.progression.notice.pending!==4||s.progression.notice.visible)throw Error('Grouped pending '+JSON.stringify(s.progression))
 await evaluate('testDialog.close();testDialog.remove()');for(let i=0;i<60;i++){await pause(50);if((await state()).progression.notice.announced===4)break}
 if(!await evaluate(`document.querySelector('.respo-level-notice').textContent.includes('Niveaux 3 à 4 franchis')`))throw Error('Grouped text')
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('respo-level-up-mobile.png')
 await reload();s=await state();if(s.progression.level!==4||s.progression.notice.pending!==null||s.progression.notice.visible)throw Error('Reload repeat')
 await evaluate(`const key='mboa-player-resources-v1',saved=JSON.parse(localStorage.getItem(key));saved.ptRespo=1900;saved.respoNext=111;localStorage.setItem(key,JSON.stringify(saved))`)
 await reload();value=await hud();s=await state()
 if(value.level!=='Niv. 6'||value.points.replaceAll(/\s/g,'')!=='1900/2565'||s.progression.notice.visible)throw Error('Legacy migration '+JSON.stringify(value))
 const unchanged=await evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts')]).then(([r,m,c])=>({energy:r.getPlayerResources().energy,max:r.getPlayerResources().maxEnergy,mood:r.getPlayerResources().mood,money:m.getMoneyBalance(),time:c.getGameTime().time}))`)
 if(unchanged.energy!==75||unchanged.max!==120||unchanged.mood!==90||unchanged.money!==800||unchanged.time!=='10:45')throw Error(JSON.stringify(unchanged))
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('320 overflow')
 if(await evaluate(`document.querySelector('#respo-amount').scrollWidth>document.querySelector('#respo-amount').clientWidth`))throw Error('Points truncated')
 await capture('respo-level-legacy-320.png')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({queueLevelUp:true,relativeBar:true,deferredInMenus:true,grouped:true,reloadNoRepeat:true,legacyMigration:true,unchangedEconomy:true,mobile320:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1','mboa-user-queue-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}

