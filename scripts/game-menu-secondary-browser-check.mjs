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

 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 const ministry=async(tab)=>{await closeAll();await evaluate('window.__MBOA_QA__.openVenue("ministry",'+JSON.stringify(tab??'place')+')');await pause(200)}
 await ministry();await click('[data-venue-canteen]');await inspect('canteen-390')
 await ministry();await click('[data-venue-meeting]');await inspect('meeting-390')
 await ministry('people');await click('[data-anneke-extra]');await inspect('extra-390')
 await ministry();await click('[data-venue-queue]');await inspect('queue-list-390');await click('dialog[open] [data-dossier-index="0"]');await pause(200)
 for(const [width,height] of [[1557,831],[320,568],[390,844],[844,390]]){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await pause(200);const fit=await evaluate(`(()=>{const d=document.querySelector('.citizen-puzzle-dialog[open]'),b=d.querySelector('.popup-body'),g=d.querySelector('[data-work-grid]').getBoundingClientRect();return b.scrollHeight<=b.clientHeight+2&&g.bottom<innerHeight&&g.top>=0&&!d.querySelector('.game-menu-pages')})()`);await capture('game-menu-queue-puzzle-'+width+'.png');if(!fit)console.log(await evaluate(`(()=>{const d=document.querySelector('.citizen-puzzle-dialog[open]'),b=d.querySelector('.popup-body');return {body:[b.clientHeight,b.scrollHeight],board:d.querySelector('[data-work-grid]').getBoundingClientRect().toJSON(),wrapper:!!d.querySelector('.game-menu-pages'),head:d.querySelector('.popup-head').getBoundingClientRect().toJSON()}})()`));check(fit,'Puzzle layout broken '+width)}
 await click('[data-work-pile]');await pause(200);check(await evaluate(`!!document.querySelector('.citizen-puzzle-dialog .game-menu-pages')`),'Queue list pages not restored')
 await closeAll();await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(350);await click('#wait-open');await inspect('wait-390')
 await closeAll();await click('#bag-open');await inspect('bag-390')
 await closeAll();await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(1080-c.getGameTime().totalMinutes,'sleep'))`)
 const homePeople=async()=>{await closeAll();await evaluate('window.__MBOA_QA__.openVenue("home","people")');await pause(200)}
 await homePeople();await inspect('people-390');await click('[data-toque-open]');await inspect('toque-390')
 await homePeople();await click('[data-invite-npc=bae]');await inspect('accompanied-390')
 await homePeople();await click('[data-npc-service=talk][data-person=bae]');await inspect('dialogue-390')
 await closeAll();await evaluate('window.__MBOA_QA__.openVenue("culture")');await click('[data-venue-outing]');await inspect('cinema-390')
 await closeAll();await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await evaluate('window.__MBOA_QA__.openVenue("home")');await inspect('hungry-home-320')
 check((await stats()).money===initialStats.money,'Menus spent money');if(errors.length)throw Error(JSON.stringify(errors));console.log('Secondary menus, NPCs, original queue art and puzzle/list transitions passed')
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
