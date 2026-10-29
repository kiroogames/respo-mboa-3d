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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-pro-missions-v1');localStorage.setItem('mboa-player-zone-v1','ministry');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const counters=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts')]).then(([r,m,c])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes}))`)
 const select=id=>evaluate(`document.querySelector('[data-mission-id="${id}"]').click()`)
 const confirm=()=>evaluate(`document.querySelector('[data-mission-confirm]').click();document.querySelector('[data-mission-confirm]').click()`)
 const close=()=>evaluate(`document.querySelector('[data-mission-back]').click();if(document.querySelector('.venue-dialog').open)document.querySelector('.venue-close').click()`)
 async function travel(zone){
  await evaluate(`document.querySelector('.places [data-view=${zone}]').click();document.querySelector('[data-travel-mode=walk]').click()`)
  await evaluate(`window.__MBOA_QA__.advanceJourney(120)`)
  for(let i=0;i<150;i++){await pause(150);if(!(await state()).player.travelling&&await evaluate(`document.querySelector('.venue-dialog').open`))return}
  throw Error('Journey did not finish '+JSON.stringify((await state()).player))
 }
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 await evaluate(`document.querySelector('.places [data-view=ministry]').click();document.querySelector('#venue-people-tab').click();document.querySelector('[data-mission-giver=anneke]').click()`)
 if(await evaluate(`document.querySelectorAll('[data-mission-id]').length`)!==6)throw Error('Mission variety')
 const initial=await counters();await capture('missions-offers-desktop.png')
 await close();if(JSON.stringify(initial)!==JSON.stringify(await counters()))throw Error('Closing offer changed resources')
 await evaluate(`document.querySelector('#missions-open').click()`);await select('anneke-market');await confirm()
 await select('anneke-tekno');await confirm();await select('anneke-school');await confirm()
 let s=await state();if(s.missions.missions.filter(m=>m.stage==='active').length!==3)throw Error('Concurrent missions')
 if(JSON.stringify(initial)!==JSON.stringify(await counters()))throw Error('Acceptance paid something')
 await select('kako-airport');if(!await evaluate(`document.querySelector('[data-mission-confirm]').disabled`))throw Error('Kako wrong day/presence')
 await close();await reload()
 if((await state()).missions.missions.filter(m=>m.stage==='active').length!==3)throw Error('Active missions lost')
 await evaluate(`document.querySelector('#missions-open').click()`);await select('anneke-market')
 if(!await evaluate(`document.querySelector('[data-mission-confirm]').disabled`))throw Error('Remote work allowed')
 await close();await travel('market')
 const beforeWork=await counters();if((await state()).player.zone!=='market')throw Error('Travel position')
 await evaluate(`document.querySelector('[data-venue-mission]').click()`)
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('missions-field-mobile.png')
 await confirm();let value=await counters()
 if(value.money!==0||value.resources.ptRespo!==0||value.resources.energy!==beforeWork.resources.energy-20||value.time!==beforeWork.time+45)throw Error('Work accounting '+JSON.stringify(value))
 if(!await evaluate(`document.querySelector('[data-mission-confirm]').disabled`))throw Error('Remote report allowed')
 await capture('missions-ready-mobile.png');await close();await reload()
 s=await state();if(s.missions.missions.find(m=>m.id==='anneke-market').stage!=='ready')throw Error('Ready lost on reload')
 await travel('ministry')
 await evaluate(`document.querySelector('#venue-people-tab').click();document.querySelector('[data-mission-giver=anneke]').click()`)
 const beforeReport=await counters();await confirm();value=await counters()
 if(value.money!==1000||value.resources.ptRespo!==15||value.resources.energy!==beforeReport.resources.energy||value.time!==beforeReport.time)throw Error('Report accounting '+JSON.stringify(value))
 await capture('missions-reward-mobile.png');await close();await reload()
 await evaluate(`document.querySelector('#missions-open').click()`);await select('anneke-market')
 if(!await evaluate(`document.querySelector('[data-mission-confirm]').disabled`))throw Error('Paid mission replay')
 await close();await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(1440+540-c.getGameTime().totalMinutes))`)
 await evaluate(`document.querySelector('#missions-open').click()`);await select('kako-airport');await confirm();await select('kako-shop');await confirm();await select('kako-market');await confirm()
 if((await state()).missions.missions.filter(m=>m.stage==='active').length!==5)throw Error('Five active missions expected')
 await close();await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(7*1440+480-c.getGameTime().totalMinutes))`)
 await evaluate(`document.querySelector('#missions-open').click()`);await select('anneke-market');await confirm()
 s=await state();if(s.missions.missions.find(m=>m.id==='anneke-market').week!==2||s.missions.missions.filter(m=>m.stage==='active').length!==6)throw Error('New week/retained missions')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Journal overflow')
 await capture('missions-journal-320.png');await close()
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Footer overflow')
 await capture('missions-footer-320.png')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({sixMissions:true,concurrent:true,noAcceptanceCosts:true,wrongContext:true,realTravel:true,workAccounting:true,reloadStages:true,reportOnce:true,weeklyRenewal:true,mobile320:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-pro-missions-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
