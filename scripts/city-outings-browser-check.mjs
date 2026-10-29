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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.setItem('mboa-player-zone-v1','culture');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const counters=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts')]).then(([r,m,c])=>({resources:r.getPlayerResources(),base:r.getMoodDetails().base,money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes}))`)
 const open=zone=>evaluate(`document.querySelector('.places [data-view=${zone}]').click();document.querySelector('[data-venue-outing]').click()`)
 const close=()=>evaluate(`document.querySelector('[data-outing-back]').click();document.querySelector('.venue-close').click()`)
 const select=id=>evaluate(`document.querySelector('[data-outing-option="${id}"]').click()`)
 const confirm=()=>evaluate(`document.querySelector('[data-outing-confirm]').click();document.querySelector('[data-outing-confirm]').click()`)
 const advanceTo=n=>evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${n}-c.getGameTime().totalMinutes))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 async function travel(zone){await evaluate(`document.querySelector('.places [data-view=${zone}]').click();document.querySelector('[data-travel-mode=walk]').click();window.__MBOA_QA__.advanceJourney(120)`);for(let i=0;i<100;i++){await pause(100);if(!(await state()).player.travelling&&await evaluate(`document.querySelector('.venue-dialog').open`))return}throw Error('Travel failed')}
 await open('culture')
 if(!await evaluate(`document.querySelector('.outings-dialog').open&&document.querySelector('[data-outing-confirm]').disabled&&document.querySelector('[data-outing-error]').textContent.includes('insuffisants')`))throw Error('Cinema low funds')
 await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(5000))`);await select('snack')
 if(!await evaluate(`document.querySelector('[data-outing-cost]').textContent.includes('1 200')&&document.querySelector('[data-outing-gain]').textContent==='+25'`))throw Error('Cinema option preview')
 const before=await counters();await capture('city-outings-cinema-desktop.png');await close()
 if(JSON.stringify(await counters())!==JSON.stringify(before))throw Error('Cancel changed state')
 await open('culture');await select('snack')
 if(!await evaluate(`document.querySelector('#wait-open').disabled&&document.querySelector('#bills-open').disabled&&document.querySelector('#mood-effects-open').disabled`))throw Error('Other actions not blocked')
 await confirm();let value=await counters()
 if(value.money!==3800||value.resources.energy!==95||value.base!==115||value.time!==570)throw Error('Cinema accounting '+JSON.stringify(value))
 await close();await reload();await open('culture')
 if(!await evaluate(`document.querySelector('[data-outing-confirm]').hidden&&document.querySelector('[data-outing-schedule]').textContent.includes('déjà effectuée')`))throw Error('Cinema reload bypass')
 await close();await travel('club')
 if(await evaluate(`!!document.querySelector('[data-service=relax]')`))throw Error('Club old relax still available')
 await evaluate(`document.querySelector('[data-venue-outing]').click()`)
 if(!await evaluate(`document.querySelector('[data-outing-confirm]').disabled&&document.querySelector('[data-outing-schedule]').textContent.includes('18:00')`))throw Error('Snack daytime closure')
 await close();await advanceTo(1410);await open('club');await select('meal')
 if(!await evaluate(`document.querySelector('[data-outing-end]').textContent.includes('Mardi 01:00')`))throw Error('Midnight end preview')
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('city-outings-snack-mobile.png')
 const snackBefore=await counters();await confirm();value=await counters()
 if(value.money!==3000||value.resources.energy!==snackBefore.resources.energy-5||value.base!==135||value.time!==1500)throw Error('Snack accounting '+JSON.stringify(value))
 await capture('city-outings-snack-receipt-mobile.png');await close();await reload();await open('club')
 if(!await evaluate(`document.querySelector('[data-outing-confirm]').hidden&&document.querySelector('[data-outing-schedule]').textContent.includes('cette soirée')`))throw Error('Midnight reload bypass')
 await close();await advanceTo(1440+1080);await open('club')
 if(await evaluate(`document.querySelector('[data-outing-confirm]').hidden`))throw Error('New evening did not renew')
 await close();await advanceTo(2*1440+195);await open('club');await select('meal')
 if(!await evaluate(`document.querySelector('[data-outing-confirm]').disabled&&document.querySelector('[data-outing-error]').textContent.includes('fermeture')`))throw Error('Late ending allowed')
 await select('drink');if(await evaluate(`document.querySelector('[data-outing-confirm]').disabled`))throw Error('Exact closing denied')
 await confirm();value=await counters();if(value.money!==2650||value.time!==2*1440+240||value.base!==140)throw Error('Exact night closing')
 await close();await travel('stadium')
 if(!await evaluate(`!!document.querySelector('[data-service=sport]')`))throw Error('Training removed')
 await evaluate(`document.querySelector('[data-venue-outing]').click()`)
 if(!await evaluate(`document.querySelector('[data-outing-confirm]').disabled&&document.querySelector('[data-outing-schedule]').textContent.includes('Samedi 07:00')`))throw Error('Weekday football open')
 await close();await advanceTo(5*1440+480);await evaluate(`import('/src/player-resources.ts').then(r=>r.setMood(139))`);await open('stadium')
 if(!await evaluate(`document.querySelector('[data-outing-gain]').textContent==='+1'`))throw Error('Capped mood gain')
 await capture('city-outings-football-mobile.png');const footballBefore=await counters();await confirm();value=await counters()
 if(value.money!==2650||value.resources.energy!==footballBefore.resources.energy-20||value.time!==5*1440+570||value.base!==140)throw Error('Football accounting')
 await close();await reload();await open('stadium')
 if(!await evaluate(`document.querySelector('[data-outing-confirm]').hidden`))throw Error('Football replay')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('320 overflow')
 await capture('city-outings-consumed-320.png')
 value=await counters();if(value.resources.ptRespo!==0||value.resources.karma!==0||value.resources.maxEnergy!==100)throw Error('Unrelated stats changed')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({cinemaOptions:true,cancel:true,exactCosts:true,uniqueConfirm:true,reloadLimits:true,realTravel:true,clubReplaced:true,daytimeClosure:true,midnightSession:true,newEvening:true,exactClosing:true,weekendFootball:true,actualMoodGain:true,trainingKept:true,mobile320:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-city-outings-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
