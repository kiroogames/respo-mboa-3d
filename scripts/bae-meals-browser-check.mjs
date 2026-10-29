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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-home-meals-v1');localStorage.removeItem('mboa-sport-energy-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','360')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}



 const pause=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>evaluate('JSON.parse(window.render_game_to_text())')
 const click=selector=>evaluate(`document.querySelector('${selector}').click()`),check=(v,message)=>{if(!v)throw Error(message)}
 const variant=v=>evaluate(`document.querySelector('#meal-variant').value='${v}';document.querySelector('#meal-variant').dispatchEvent(new Event('change'))`)
 const stats=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts'),import('/src/npc-relationships.ts')]).then(([r,m,c,n])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes,consideration:n.getConsideration('bae')}))`)
 const clock=total=>evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${total}-c.getGameTime().totalMinutes))`)
 const open=async()=>{await click('.places [data-view=home]');await click('[data-service=home-meals]')}
 const close=async()=>{await click('[data-meal-cancel]');await click('.venue-close')}
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(20000))`);await open();await variant('bae');check((await state()).meals.preview.reason.includes('cuisine'),'Kitchen guard');await evaluate(`import('/src/npc-relationships.ts').then(n=>{n.acceptNPCRequest('kitchen');n.purchaseNPCImprovement('kitchen');n.changeConsideration('bae',9)})`);check((await state()).meals.preview.reason.includes('60'),'59 guard/live kitchen');await evaluate(`import('/src/npc-relationships.ts').then(n=>n.changeConsideration('bae',1))`);check(!(await state()).meals.preview.reason,'60 eligibility refresh');await evaluate(`import('/src/player-resources.ts').then(r=>r.spendEnergy(30))`);const before=await stats();await capture('bae-meal-eligible-desktop.png');await close();check(JSON.stringify(await stats())===JSON.stringify(before),'Cancel effects')
 await clock(465);await open();await variant('bae');await click('[data-meal=rice]');check((await state()).meals.preview.reason.includes('part'),'Late departure guard');await click('[data-meal=porridge]');check(!(await state()).meals.preview.reason&&(await state()).meals.preview.to.time==='08:00','Exact08 refused');await call('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});await pause(200);await capture('bae-meal-preview-320.png');check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow');await evaluate(`document.querySelector('[data-meal-confirm]').click();document.querySelector('[data-meal-confirm]').click()`);let paid=await stats();check(paid.money===before.money-150&&paid.resources.energy===82&&paid.resources.mood===98&&paid.time===480&&paid.consideration===60,'Bae actual gains');await capture('bae-meal-receipt-320.png');await reload();check(JSON.stringify(await stats())===JSON.stringify(paid),'Reload replay');await open();await variant('bae');check((await state()).meals.service.consumed,'Shared service lost');await close()
 await clock(1080);await open();await variant('bae');check((await state()).meals.preview.reason.includes('aujourd'),'Daily Bae guard');await variant('regular');await click('[data-meal=rice]');check(!(await state()).meals.preview.reason,'Regular dinner incorrectly blocked');await click('[data-meal-confirm]');check((await stats()).resources.mood===104,'Regular meal unexpectedly boosted');await close()
 await clock(1440+360);await evaluate(`import('/src/player-resources.ts').then(r=>r.setMood(139))`);await open();await variant('bae');await click('[data-meal=porridge]');check((await state()).meals.preview.moodGain===1,'Actual mood cap');await click('[data-meal-confirm]');check((await stats()).resources.mood===140,'Cap result');await close();await clock(1440+1080);await open();await variant('bae');check((await state()).meals.preview.reason.includes('aujourd'),'Capped Bae bonus not consumed');await close()
 await clock(2*1440+480);await open();await variant('bae');check((await state()).meals.preview.reason.includes('absente'),'Absent Bae accepted');await variant('regular');check(!(await state()).meals.preview.reason,'Regular when Bae absent');await close()
 if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({kitchenAnd59_60:true,liveEligibility:true,cancel:true,wholePresenceAndExact08:true,nominalPlus5ActualGains:true,singleDebit:true,reload:true,sharedService:true,dailyLimit:true,regularUnchanged:true,capStillConsumes:true,absence:true,mobile320:true,errors},null,2))
 await writeFile(path.join(out,'bae-meal-browser-state.json'),JSON.stringify(await state(),null,2))
 await evaluate(`for(const key of ['mboa-home-meals-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1','mboa-npc-relationships-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}

