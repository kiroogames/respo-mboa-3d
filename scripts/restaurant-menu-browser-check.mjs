import {solve} from './citizen-puzzle-solver.mjs'
// Parcours réel de fatigue : attente, sommeil, capacités, sauvegarde et hôtel.

import {spawn} from 'node:child_process'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import path from 'node:path'
const settings=JSON.parse(await readFile(new URL('../city-layout.json',import.meta.url),'utf8'));const layoutScale=settings.horizontalScale
const out=path.resolve('artifacts');await mkdir(out,{recursive:true})
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-extensions','--disable-dev-shm-usage','--disable-gpu-sandbox','--no-first-run','--no-default-browser-check','--remote-debugging-port=9244',`--user-data-dir=${path.join(out,'restaurant-profile')}`,'--use-angle=d3d11','--enable-unsafe-swiftshader','--window-size=1557,831','about:blank'],{stdio:'ignore',windowsHide:true})
let ws;const errors=[];const messages=[]
try {
 let targets
 for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9244/json/list')).json();break}catch{await new Promise(r=>setTimeout(r,300))}}
 console.log('Chrome prêt');const target=targets.find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl)
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
 let id=0;const pending=new Map()
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}}else{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled')messages.push({type:m.params.type,args:m.params.args.map(a=>a.value??a.description)})}}
 const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>reject(Error('CDP timeout: '+method)),15000);pending.set(key,{resolve:(v)=>{clearTimeout(timer);resolve(v)},reject:(e)=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id:key,method,params}))})
 const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
 console.log('Session connectée');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-accompanied-outings-v1');localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.removeItem('mboa-food-bag-v1');localStorage.removeItem('mboa-sport-energy-v1');localStorage.removeItem('mboa-fatigue-v1');localStorage.removeItem('mboa-rested-energy-v1');localStorage.removeItem('mboa-meal-energy-v1');localStorage.removeItem('mboa-dossier-draft-v1-pairs-v1');localStorage.removeItem('mboa-user-queue-v1');localStorage.removeItem('mboa-user-queue-draft-v1-pairs-v1');localStorage.setItem('mboa-money-v1','50000');localStorage.setItem('mboa-player-zone-v1','ministry');localStorage.setItem('mboa-game-minutes-v1','660')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load '+JSON.stringify(errors))
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}





 const pause=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>evaluate('JSON.parse(window.render_game_to_text())')
 const click=selector=>evaluate(`document.querySelector('${selector}').click()`),check=(v,message)=>{if(!v)throw Error(message)}
 const stats=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts'),import('/src/fatigue.ts')]).then(([r,m,c,f])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes,fatigue:f.getFatigueAt()}))`)
 const advance=n=>evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${n}))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 const sleep=async minutes=>{await click('.places [data-view=home]');await click('[data-service=home-sleep]');await evaluate(`document.querySelector('#sleep-duration').value='${minutes}';document.querySelector('#sleep-duration').dispatchEvent(new Event('input'))`)}
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})






 await evaluate("document.querySelector('[data-start-continue]')?.click()");
 await click('.landmark[data-view=restaurant]');
 check(!await evaluate("!!document.querySelector('dialog[open]')"),'Menu opened before focus');
 for(let i=0;i<100;i++){if(await evaluate("!!document.querySelector('dialog[open]')"))break;await pause(100)}
 check(await evaluate("document.querySelector('#travel-title')?.textContent==='Restaurant du Mboa'"),'Restaurant destination');
 await evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())");await pause(300);await capture('restaurant-building.png');
 const before=await stats();await evaluate('window.__MBOA_QA__.openTravel("restaurant")');await click('[data-travel-go]');await pause(200);await click('[data-travel-mode=yonga]');await pause(1500);await evaluate('window.__MBOA_QA__.advanceJourney(120)');await pause(600);
 check((await state()).player.zone==='restaurant','Arrival restaurant');
 await evaluate('window.__MBOA_QA__.openVenue("restaurant")');await pause(400);check(await evaluate("!document.querySelector('[data-venue-outing]').hidden"),'Restaurant service missing');await capture('restaurant-services.png');
 await click('[data-venue-outing]');await pause(400);check(await evaluate("document.querySelector('#outings-heading').textContent==='Restaurant du Mboa'"),'Wrong activity');await capture('restaurant-meals.png');
 const names=await evaluate("[...document.querySelectorAll('[data-outing-option] b')].map(b=>b.textContent)");check(names.length===5&&names.includes('Ndolé · plantain')&&names.includes('Poulet DG')&&names.includes('Mafé · riz sauce arachide'),'Dish names');
 for(const width of [390,320]){await call('Emulation.setDeviceMetricsOverride',{width,height:width===320?568:844,deviceScaleFactor:1,mobile:true});await pause(400);check(await evaluate("(()=>{const b=document.querySelector('.outings-dialog .popup-body');return b.scrollHeight<=b.clientHeight+2})()"),'Menu overflow');await capture('restaurant-menu-'+width+'.png')}
 await click('[data-outing-option=rice-beans]');await pause(300);const mealBefore=await stats();check(await evaluate("document.querySelector('[data-outing-confirm]').textContent==='Commander'"),'Order label');await click('[data-outing-confirm]');await pause(400);const mealAfter=await stats();check(mealBefore.money-mealAfter.money===450,'Wrong dish cost');check(mealAfter.time-mealBefore.time===30,'Wrong meal duration');await capture('restaurant-order.png');

 const activity=await evaluate("import('/src/city-outings.ts').then(m=>m.cityOutings.find(a=>a.id==='restaurant'))");check(activity.zone==='restaurant','Activity wrong zone');check(!errors.length,'JS exceptions');console.log('Restaurant landmark, focus, travel, arrival and meal menu passed',JSON.stringify({zone:(await state()).player.zone,moneyBefore:before.money,moneyAfter:(await stats()).money}));
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
