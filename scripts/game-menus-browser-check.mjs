import {solve} from './citizen-puzzle-solver.mjs'
// Parcours réel de fatigue : attente, sommeil, capacités, sauvegarde et hôtel.

import {spawn} from 'node:child_process'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import path from 'node:path'
const settings=JSON.parse(await readFile(new URL('../city-layout.json',import.meta.url),'utf8'));const layoutScale=settings.horizontalScale
const out=path.resolve('artifacts');await mkdir(out,{recursive:true})
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-extensions','--disable-dev-shm-usage','--disable-gpu-sandbox','--no-first-run','--no-default-browser-check','--remote-debugging-port=9236',`--user-data-dir=${path.join(out,'game-menus-profile')}`,'--use-angle=d3d11','--enable-unsafe-swiftshader','--window-size=1557,831','about:blank'],{stdio:'ignore',windowsHide:true})
let ws;const errors=[];const messages=[]
try {
 let targets
 for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9236/json/list')).json();break}catch{await new Promise(r=>setTimeout(r,300))}}
 console.log('Chrome prêt');const target=targets.find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl)
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
 let id=0;const pending=new Map()
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}}else{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled')messages.push({type:m.params.type,args:m.params.args.map(a=>a.value??a.description)})}}
 const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>reject(Error('CDP timeout: '+method)),45000);pending.set(key,{resolve:(v)=>{clearTimeout(timer);resolve(v)},reject:(e)=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id:key,method,params}))})
 const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
 console.log('Session connectée');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-accompanied-outings-v1');localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.removeItem('mboa-food-bag-v1');localStorage.removeItem('mboa-sport-energy-v1');localStorage.removeItem('mboa-fatigue-v1');localStorage.removeItem('mboa-rested-energy-v1');localStorage.removeItem('mboa-meal-energy-v1');localStorage.removeItem('mboa-dossier-draft-v1-pairs-v1');localStorage.removeItem('mboa-user-queue-v1');localStorage.removeItem('mboa-user-queue-draft-v1-pairs-v1');localStorage.setItem('mboa-money-v1','50000');localStorage.setItem('mboa-player-zone-v1','ministry');localStorage.setItem('mboa-game-minutes-v1','600')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load '+JSON.stringify(errors))
 // Fixtures réappliquées à chaque chargement pour des départs indépendants.
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}





 const pause=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>evaluate('JSON.parse(window.render_game_to_text())')
 const click=selector=>evaluate(`document.querySelector('${selector}').click()`),check=(v,message)=>{if(!v)throw Error(message)}
 const stats=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts'),import('/src/fatigue.ts')]).then(([r,m,c,f])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes,fatigue:f.getFatigueAt()}))`)
 const advance=n=>evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${n}))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 const sleep=async minutes=>{await click('.places [data-view=home]');await click('[data-service=home-sleep]');await evaluate(`document.querySelector('#sleep-duration').value='${minutes}';document.querySelector('#sleep-duration').dispatchEvent(new Event('input'))`)}
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})







 await evaluate("document.querySelector('[data-start-continue]')?.click()")
 const initialStats=await stats()
 const closeAll=async()=>{await evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())");await pause(350)}
 const inspect=async(name)=>{
 await pause(400);const layout=await evaluate(`(()=>{const d=document.querySelector('dialog[open]'),b=d.querySelector('.popup-body'),f=d.querySelector('.popup-foot'),p=d.querySelector('.game-menu-pager');return {name:d.className,vertical:b.scrollHeight-b.clientHeight,pages:p?.textContent,footer:f?.getBoundingClientRect().bottom,viewport:innerHeight,art:[...d.querySelectorAll('.game-card-art img')].every(i=>i.complete&&i.naturalWidth>0)}})()`);console.log(name,layout);await capture('game-menu-'+name+'.png');check(layout.vertical<=3,'Vertical overflow '+name);check(layout.footer<=layout.viewport,'Footer outside viewport '+name);check(layout.art,'Missing artwork '+name)
 }
 const home=async()=>{await closeAll();await evaluate('window.__MBOA_QA__.openVenue("home")')}
 for(const [width,height] of [[1557,831],[390,844],[320,568]]){
 await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await home();await inspect('home-'+width)
 const pager=await evaluate("document.querySelector('.venue-dialog [data-menu-next]').disabled");if(!pager){await click('.venue-dialog [data-menu-next]');await pause(100);check(await evaluate("document.querySelector('.venue-dialog .popup-body').scrollLeft>0"),'Next page failed')}
 await click('[data-service=home-sleep]');await inspect('sleep-'+width);await home();await click('[data-service=home-meals]');await inspect('meals-'+width);await click('[data-meal]');await pause(200);check(await evaluate("!!document.querySelector('.meal-dialog [data-meal-confirm]')"),'Meal selection lost')
 await home();await click('[data-venue-comfort]');await inspect('comfort-'+width)
 await closeAll();await click('#energy-effects-open');await inspect('energy-'+width)
 await closeAll();await click('#money-amount');await inspect('bills-'+width)
 }
 await closeAll();await evaluate('window.__MBOA_QA__.openVenue("ministry")');await click('[data-venue-work]');await inspect('work-320');await click('[data-dossier-index="0"]');await inspect('work-preview-320')
 const b=await stats();await click('dialog[open] [data-work-confirm]');check((await stats()).money===b.money+500,'Work confirmation no longer pays once');await capture('game-menu-work-receipt-320.png')
 await closeAll();await evaluate('window.__MBOA_QA__.openVenue("stadium")');await inspect('stadium-320');check(await evaluate(`document.querySelector('[data-service="sport"] .game-card-art img').src.endsWith('menu-jogging.jpg')&&document.querySelector('[data-venue-outing] .game-card-art img').src.endsWith('menu-football.jpg')`),'Sport illustrations mismatch')
 await closeAll();await evaluate('window.__MBOA_QA__.openVenue("ministry")');await pause(250);check(await evaluate(`document.querySelector('[data-venue-queue] .game-card-art img')?.src.endsWith('unity/usagers.png')`),'Original Unity queue art missing')
 await closeAll();await click('#missions-open');await inspect('missions-320')
 await closeAll();await click('#mood-effects-open');await inspect('mood-320')
 check((await stats()).time===initialStats.time+60,'Menus changed time unexpectedly')
 if(errors.length)throw Error(JSON.stringify(errors));console.log('Illustrated menus desktop/mobile, fixed pages, preserved controls, no JS errors passed')
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
