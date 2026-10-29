// Parcours réel : acheter, conserver, consommer après minuit et jeter un aliment périmé.

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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-accompanied-outings-v1');localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.removeItem('mboa-food-bag-v1');localStorage.setItem('mboa-money-v1','50000');localStorage.setItem('mboa-player-zone-v1','market');localStorage.setItem('mboa-game-minutes-v1','1430')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}



 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const stats=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts')]).then(([r,m,c])=>({energy:r.getPlayerResources().energy,mood:r.getPlayerResources().mood,money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes}))`)
 const check=(condition,message)=>{if(!condition)throw Error(message)}
 const click=selector=>evaluate(`document.querySelector('${selector}').click()`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 await evaluate(`import('/src/player-resources.ts').then(r=>r.spendEnergy(30))`)
 await click('.places [data-view=market]');check(await evaluate(`!!document.querySelector('[data-service="market-meal"]')`),'Onsite meal missing')
 const before=await stats();await click('[data-food-takeaway]');check((await state()).foodBag.preview.money===250,'Market price');check((await state()).foodBag.preview.expires===1795,'Six hour expiry')
 await capture('food-bag-market-preview.png');await click('[data-bag-cancel]');check(JSON.stringify(await stats())===JSON.stringify(before),'Cancel changed resources')
 await click('[data-food-takeaway]');await evaluate(`document.querySelector('[data-bag-confirm]').click();document.querySelector('[data-bag-confirm]').click()`)
 let bought=await stats();check(bought.money===before.money-250&&bought.energy===70&&bought.mood===90&&bought.time===1435,'Upfront payment/gains');check((await state()).foodBag.item.id==='meal','Item not saved')
 await reload();check(JSON.stringify(await stats())===JSON.stringify(bought),'Reload replayed charge');await pause(300);await click('#bag-open');check((await state()).foodBag.item.id==='meal','Reload lost food')
 await click('[data-bag-eat]');let p=(await state()).foodBag.preview;check(p.energyGain===12&&p.moodGain===4&&p.end===1460,'Consumption preview')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});await pause(300);await capture('food-bag-consume-320.png');check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow')
 await evaluate(`document.querySelector('[data-bag-confirm]').click();document.querySelector('[data-bag-confirm]').click()`);let eaten=await stats();check(eaten.energy===82&&eaten.mood===94&&eaten.time===1460,'Consumption effects');check((await state()).foodBag.item===null,'Consumed item remains');await capture('food-bag-receipt-320.png')
 await reload();check(JSON.stringify(await stats())===JSON.stringify(eaten),'Reload replayed rewards');check((await state()).foodBag.item===null,'Reload restored eaten food')
 await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});await click('.places [data-view=supermarket]');await click('[data-travel-mode=yonga]');await evaluate('window.__MBOA_QA__.advanceJourney(120)');await pause(300)
 check((await state()).player.zone==='supermarket','Travel to shop failed');check(await evaluate(`!!document.querySelector('[data-service="shop-snack"]')`),'Onsite snack missing')
 await click('[data-food-takeaway]');check((await state()).foodBag.preview.money===150,'Shop price');await click('[data-bag-confirm]');const expires=(await state()).foodBag.item.expires
 await click('[data-bag-cancel]');await click('[data-food-takeaway]');check((await state()).foodBag.preview.reason.includes('plein'),'Full slot accepted');check(await evaluate(`document.querySelector('[data-bag-confirm]').disabled`),'Full slot confirm enabled');await click('[data-bag-cancel]');await click('.venue-close')
 await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${expires}-c.getGameTime().totalMinutes))`);await reload();await pause(300);await click('#bag-open');check((await state()).foodBag.item.expired,'Expiry lost on reload');check(await evaluate(`document.querySelector('[data-bag-eat]').disabled`),'Expired food edible');await capture('food-bag-expired.png')
 const discardBefore=await stats();await click('[data-bag-discard]');await click('[data-bag-cancel]');check((await state()).foodBag.item!==null,'Discard cancel lost food');await pause(300);await click('#bag-open');await click('[data-bag-discard]');await click('[data-bag-confirm]');check((await state()).foodBag.item===null,'Discard failed');check(JSON.stringify(await stats())===JSON.stringify(discardBefore),'Discard charged time/money')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({marketAndShop:true,cancel:true,singleCharge:true,saveReload:true,consumeMidnight:true,actualGains:true,mobile320:true,expiryReload:true,discard:true,errors},null,2))
 await writeFile(path.join(out,'food-bag-browser-state.json'),JSON.stringify(await state(),null,2))
 await evaluate(`for(const key of ['mboa-food-bag-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
