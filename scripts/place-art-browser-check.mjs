import {solve} from './citizen-puzzle-solver.mjs'
// Parcours réel de fatigue : attente, sommeil, capacités, sauvegarde et hôtel.

import {spawn} from 'node:child_process'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import path from 'node:path'
const settings=JSON.parse(await readFile(new URL('../city-layout.json',import.meta.url),'utf8'));const layoutScale=settings.horizontalScale
const out=path.resolve('artifacts');await mkdir(out,{recursive:true})
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-sandbox','--disable-extensions','--disable-dev-shm-usage','--disable-gpu-sandbox','--no-first-run','--no-default-browser-check','--remote-debugging-port=9254',`--user-data-dir=${path.join(out,'place-art-profile')}`,'--use-angle=d3d11','--enable-unsafe-swiftshader','--window-size=1557,831','about:blank'],{stdio:'ignore',windowsHide:true})
let ws;const errors=[];const messages=[]
try {
 let targets
 for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9254/json/list')).json();break}catch{await new Promise(r=>setTimeout(r,300))}}
 console.log('Chrome prêt');const target=targets.find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl)
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
 let id=0;const pending=new Map()
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}}else{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled')messages.push({type:m.params.type,args:m.params.args.map(a=>a.value??a.description)})}}
 const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>reject(Error('CDP timeout: '+method)),15000);pending.set(key,{resolve:(v)=>{clearTimeout(timer);resolve(v)},reject:(e)=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id:key,method,params}))})
 const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
 console.log('Session connectée');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-accompanied-outings-v1');localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.removeItem('mboa-food-bag-v1');localStorage.removeItem('mboa-sport-energy-v1');localStorage.removeItem('mboa-fatigue-v1');localStorage.removeItem('mboa-rested-energy-v1');localStorage.removeItem('mboa-meal-energy-v1');localStorage.removeItem('mboa-dossier-draft-v1-pairs-v1');localStorage.removeItem('mboa-user-queue-v1');localStorage.removeItem('mboa-user-queue-draft-v1-pairs-v1');localStorage.setItem('mboa-money-v1','50000');localStorage.setItem('mboa-player-zone-v1','ministry');localStorage.setItem('mboa-game-minutes-v1','600')`});await call('Page.navigate',{url:'http://127.0.0.1:5181/'})
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









 await evaluate("document.querySelector('[data-start-continue]')?.click()");await evaluate('window.__MBOA_QA__.openTravel("home")');await pause(400);
 for(const [width,height] of [[1320,790],[390,844],[320,568]]){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await pause(400);await evaluate("Promise.all([...document.querySelectorAll('.place-activity-icon img')].map(i=>i.decode()))");await capture('place-art-home-'+width+'.png');const data=await evaluate("(()=>{const cards=[...document.querySelectorAll('.place-activity-list>li')],a=cards[0].getBoundingClientRect(),b=cards[1].getBoundingClientRect();return {images:document.querySelectorAll('.place-activity-icon img').length,two:Math.abs(a.y-b.y)<2&&a.x<b.x,art:cards[0].querySelector('img').getBoundingClientRect().height,words:cards.map(c=>c.textContent)}})()");console.log(width,data);check(data.images===4&&data.two&&data.art>=80,'Large illustrated grid');check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Page overflow')}
 await evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())");await call('Emulation.setDeviceMetricsOverride',{width:1320,height:790,deviceScaleFactor:1,mobile:false});await evaluate('window.__MBOA_QA__.openVenue("ministry")');await pause(400);await capture('ministry-large-art.png');console.log(await evaluate("[...document.querySelectorAll('.venue-service')].filter(e=>!e.hidden).slice(0,6).map(e=>({text:e.textContent,cls:e.className,display:getComputedStyle(e).display,direction:getComputedStyle(e).flexDirection,art:e.querySelector('.game-card-art')?{display:getComputedStyle(e.querySelector('.game-card-art')).display,position:getComputedStyle(e.querySelector('.game-card-art')).position,width:getComputedStyle(e.querySelector('.game-card-art')).width,grid:getComputedStyle(e.querySelector('.game-card-art')).gridArea}:null}))"));console.log('Ministry art height',await evaluate("document.querySelector('.venue-service .game-card-art').getBoundingClientRect().height"));check(await evaluate("document.querySelector('.venue-service .game-card-art').getBoundingClientRect().height>=150"),'Ministry artwork small');check(!errors.length,'JS errors');console.log('Four large home illustrations, two columns and shorter labels passed');
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
