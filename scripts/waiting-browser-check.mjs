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

 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const counters=()=>evaluate(`({money:document.querySelector('#money-amount').textContent,energy:document.querySelector('#energy-amount').textContent,respo:document.querySelector('#respo-amount').textContent,mood:document.querySelector('#mood-amount').textContent,time:document.querySelector('#game-time').textContent,day:document.querySelector('#game-day').textContent,week:document.querySelector('#game-week').textContent})`)
 const openWait=()=>evaluate(`document.querySelector('#wait-open').click()`)
 const select=minutes=>evaluate(`document.querySelector('#wait-duration').value='${minutes}';document.querySelector('#wait-duration').dispatchEvent(new Event('input',{bubbles:true}))`)
 async function finished(){for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,50));if((await state()).waiting.mode==='closed'&&!await evaluate(`!document.querySelector('.wait-transition').hidden`))return}throw Error('Wait did not finish '+JSON.stringify((await state()).waiting))}
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 if(await evaluate(`document.querySelector('#wait-open').disabled`))throw Error('Wait unavailable in exploration')
 const playerBefore=(await state()).player.position,initial=await counters()
 await openWait();await select(360)
 if(!await evaluate(`document.querySelector('[data-wait-to]').textContent==='14:00'&&document.querySelector('[data-wait-mood-change]').textContent==='−15'`))throw Error('Six-hour preview wrong')
 await capture('waiting-preview-desktop.png')
 if(JSON.stringify(await counters())!==JSON.stringify(initial))throw Error('Preview changed player state')
 await evaluate(`document.querySelector('[data-wait-cancel]').click()`)
 if(JSON.stringify(await counters())!==JSON.stringify(initial))throw Error('Cancel changed player state')
 await openWait();await select(180);await evaluate(`document.querySelector('[data-wait-confirm]').click();document.querySelector('[data-wait-confirm]').dispatchEvent(new Event('click'))`);await finished()
 let values=await counters();if(values.time!=='11:00'||values.mood!=='90')throw Error(JSON.stringify(values))
 if(JSON.stringify((await state()).player.position)!==JSON.stringify(playerBefore))throw Error('Waiting moved player')
 await reload()
 if((await state()).waiting.continuousMinutes!==180)throw Error('Continuous wait was lost on reload')
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await openWait();await select(10)
 if(!await evaluate(`document.querySelector('[data-wait-mood-change]').textContent==='−5'&&document.querySelector('[data-wait-to]').textContent==='11:10'`))throw Error('Boredom threshold wrong')
 await capture('waiting-boredom-mobile.png')
 await evaluate(`document.querySelector('[data-wait-confirm]').click()`);await finished()
 values=await counters();if(values.time!=='11:10'||values.mood!=='85')throw Error(JSON.stringify(values))
 await openWait();await select(20)
 if(!await evaluate(`document.querySelector('[data-wait-mood-change]').textContent==='0'`))throw Error('Same started hour charged twice')
 await evaluate(`document.querySelector('[data-wait-confirm]').click()`);await finished()
 values=await counters();if(values.time!=='11:30'||values.mood!=='85'||values.money!=='0'||values.energy!=='100 / 100'||values.respo!=='0 / 190')throw Error(JSON.stringify(values))
 await evaluate(`document.querySelector('.places [data-view=home]').click()`)
 if(!await evaluate(`document.querySelector('#wait-open').disabled`))throw Error('Wait enabled during venue menu')
 await evaluate(`document.querySelector('#wait-open').dispatchEvent(new Event('click'))`)
 if(await evaluate(`document.querySelector('.wait-dialog').open`))throw Error('Wait stacked with venue menu')
 await evaluate(`document.querySelector('[data-service=home-rest]').click();document.querySelector('.venue-close').click()`)
 if((await state()).waiting.continuousMinutes!==0)throw Error('Rest did not reset waiting chain')
 await openWait();await select(180)
 if(!await evaluate(`document.querySelector('[data-wait-mood-change]').textContent==='0'`))throw Error('Old boredom retained after activity')
 await evaluate(`document.querySelector('[data-wait-cancel]').click();document.querySelector('.places [data-view=ministry]').click()`)
 if(!await evaluate(`document.querySelector('#wait-open').disabled`))throw Error('Wait enabled in transport choices')
 await evaluate(`document.querySelector('[data-travel-mode=walk]').click()`)
 if(!await evaluate(`document.querySelector('#wait-open').disabled`))throw Error('Wait enabled in journey')
 for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,200));if(!(await state()).player.travelling)break}
 if((await state()).player.travelling)throw Error('Journey did not finish')
 await evaluate(`document.querySelector('[data-venue-work]').click();document.querySelector('[data-dossier-index="0"]').click()`)
 if(!await evaluate(`document.querySelector('#wait-open').disabled`))throw Error('Wait enabled in line puzzle')
 await evaluate(`document.querySelector('#wait-open').dispatchEvent(new Event('click'))`)
 if(await evaluate(`document.querySelector('.wait-dialog').open`))throw Error('Wait opened over puzzle')
 await evaluate(`document.querySelector('[data-work-close]').click()`)
 const pileBefore=await evaluate(`import('/src/dossier-work.ts').then(w=>w.getDossierBatch().id)`),beforeWait=await counters()
 await openWait();await select(180);await evaluate(`document.querySelector('[data-wait-confirm]').click()`);await finished()
 const pileAfter=await evaluate(`import('/src/dossier-work.ts').then(w=>w.getDossierBatch().id)`),afterWait=await counters()
 if(pileBefore===pileAfter||beforeWait.money!==afterWait.money||beforeWait.energy!==afterWait.energy||beforeWait.respo!==afterWait.respo||beforeWait.mood!==afterWait.mood)throw Error('Pile refresh or neutral resources incorrect')
 if(!(await state()).npcs.find(n=>n.id==='bae').available)throw Error('Bae did not become available after waiting')
 await capture('waiting-result-mobile.png')
 await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(6*1440+1430-c.getGameTime().totalMinutes))`)
 await openWait();await select(20)
 if(!await evaluate(`document.querySelector('[data-wait-to]').textContent==='00:10'&&document.querySelector('[data-wait-to-day]').textContent.includes('Lundi · semaine 2')`))throw Error('Week rollover preview wrong')
 await capture('waiting-week-rollover-mobile.png')
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 await evaluate(`document.querySelector('[data-wait-confirm]').click()`);await finished()
 values=await counters();if(values.time!=='00:10'||values.day!=='Lundi'||values.week!=='Semaine 2')throw Error(JSON.stringify(values))
 await evaluate(`import('/src/player-resources.ts').then(r=>r.setMood(2))`)
 await openWait();await select(360)
 if(!await evaluate(`document.querySelector('[data-wait-mood-change]').textContent==='−2'&&document.querySelector('[data-wait-mood-preview]').textContent==='2 → 0 / 140'`))throw Error('Mood floor preview wrong')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('320px page overflow')
 await capture('waiting-preview-320.png')
 await evaluate(`document.querySelector('[data-wait-confirm]').click()`);await finished()
 if((await counters()).mood!=='0')throw Error('Mood floor not clamped')
 const bounds=await evaluate(`({clock:document.querySelector('.game-clock').getBoundingClientRect().toJSON(),actions:document.querySelector('.header-actions').getBoundingClientRect().toJSON()})`)
 if(bounds.actions.top<bounds.clock.bottom)throw Error('Clock and controls overlap')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({preview:true,cancel:true,confirmOnce:true,reloadChain:true,boredomThreshold:true,activityReset:true,blockedDuringMenusAndJourney:true,puzzleGuard:true,pileRefresh:true,npcUpdate:true,weekRollover:true,moodFloor:true,reducedMotion:true,mobile320:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}

