// Parcours réel de fatigue : attente, sommeil, capacités, sauvegarde et hôtel.

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
 console.log('Session connectée');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-accompanied-outings-v1');localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.removeItem('mboa-food-bag-v1');localStorage.removeItem('mboa-sport-energy-v1');localStorage.removeItem('mboa-fatigue-v1');localStorage.removeItem('mboa-rested-energy-v1');localStorage.removeItem('mboa-meal-energy-v1');localStorage.setItem('mboa-money-v1','50000');localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}





 const pause=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>evaluate('JSON.parse(window.render_game_to_text())')
 const click=selector=>evaluate(`document.querySelector('${selector}').click()`),check=(v,message)=>{if(!v)throw Error(message)}
 const stats=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts'),import('/src/fatigue.ts')]).then(([r,m,c,f])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes,fatigue:f.getFatigueAt()}))`)
 const advance=n=>evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${n}))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 const sleep=async minutes=>{await click('.places [data-view=home]');await click('[data-service=home-sleep]');await evaluate(`document.querySelector('#sleep-duration').value='${minutes}';document.querySelector('#sleep-duration').dispatchEvent(new Event('input'))`)}
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})



 const close=async()=>{await click('dialog[open] .travel-close');await pause(300)}
 const initial=await stats();await pause(500)

 for(const [width,height] of [[1557,831],[1024,768],[390,844],[320,568],[844,390]]){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await pause(150);const fit=await evaluate(`(()=>{const h=document.querySelector('.respo-console').getBoundingClientRect(),f=document.querySelector('#app footer').getBoundingClientRect(),w=document.querySelector('.city-wallet-strip').getBoundingClientRect(),c=document.querySelector('.game-clock').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,headerBottom:h.bottom,footerTop:f.top,width:innerWidth,walletRight:w.right,clockLeft:c.left}})()`);await capture('readability-hud-'+width+'x'+height+'.png');check(!fit.overflow&&fit.headerBottom+8<fit.footerTop&&fit.walletRight+2<fit.clockLeft,'HUD overlap '+JSON.stringify(fit));check(await evaluate(`(()=>{const e=document.querySelector('#energy-amount').getBoundingClientRect(),m=document.querySelector('#mood-amount').getBoundingClientRect(),p=document.querySelector('.respo-console').getBoundingClientRect();return e.right<=m.left || e.bottom<=m.top})()`),'Overlapping vital values')}
 await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});await click('#money-amount');await capture('readability-bills-desktop.png');await close();await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await click('#ui-menu-toggle');check(await evaluate(`!document.querySelector('.header-actions').hidden`),'Utility menu');await capture('readability-utility-390.png');await click('#ui-menu-toggle');await click('#money-amount');check(await evaluate(`document.querySelector('[data-bill-confirm]').hidden`),'No invoice must hide payment');await capture('readability-bills-390.png');await close();await click('#energy-effects-open');check(await evaluate(`document.querySelector('[data-sport-capacity]').textContent.includes('100 / 100')`),'Energy detail values');await capture('readability-energy-390.png');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await pause(300);check(!await evaluate(`!!document.querySelector('dialog[open]')`),'Escape close');await click('#places-toggle');await capture('readability-destinations-390.png');await click('.places [data-view=home]');await capture('readability-venue-390.png');await click('[data-service=home-sleep]');await capture('readability-sleep-390.png');await click('[data-sleep-cancel]');await click('.venue-close');check(JSON.stringify(await stats())===JSON.stringify(initial),'Menus changed game economy or clock');if(errors.length)throw Error(JSON.stringify(errors));await writeFile(path.join(out,'ui-redesign-browser-state.json'),JSON.stringify(await state(),null,2));console.log('5 HUD sizes without overlap/overflow, bills/energy/destinations/venue/sleep menus, Escape, unchanged economy/clock, no JS errors passed')
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
