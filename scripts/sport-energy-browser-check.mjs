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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-accompanied-outings-v1');localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.removeItem('mboa-food-bag-v1');localStorage.removeItem('mboa-sport-energy-v1');localStorage.setItem('mboa-money-v1','50000');localStorage.setItem('mboa-player-zone-v1','stadium');localStorage.setItem('mboa-game-minutes-v1','7620')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}




 const pause=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>evaluate('JSON.parse(window.render_game_to_text())')
 const click=selector=>evaluate(`document.querySelector('${selector}').click()`),check=(v,message)=>{if(!v)throw Error(message)}
 const stats=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/game-clock.ts')]).then(([r,c])=>({resources:r.getPlayerResources(),time:c.getGameTime().totalMinutes}))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 await click('.places [data-view=stadium]');await click('[data-venue-outing]');check(await evaluate('document.querySelector("[data-outing-energy]").textContent.includes("sans recharge")'),'Sport preview missing');await click('[data-outing-confirm]');let after=await stats();check(after.resources.energy===80&&after.resources.maxEnergy===110&&after.time===7710,'Match award/cost');check((await state()).sportEnergy.effect.end===8070,'Six hour deadline');await capture('sport-match-receipt.png');await reload();check((await stats()).resources.energy===80&&(await stats()).resources.maxEnergy===110,'Reload stacking')
 await pause(300);await click('#energy-effects-open');check(await evaluate('document.querySelector("[data-sport-effect]").textContent.includes("14:30")'),'Effect end detail');await call('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});await pause(150);await capture('sport-effect-320.png');check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow');await click('[data-sport-back]')
 await evaluate(`import('/src/player-resources.ts').then(r=>r.restoreEnergy(25))`);check((await stats()).resources.energy===105,'Extra recharge unavailable');await click('.places [data-view=home]');await click('[data-travel-mode=yonga]');await evaluate('window.__MBOA_QA__.advanceJourney(120)');await pause(100);await click('.venue-close');const expiry=(await state()).sportEnergy.effect.end
 await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${expiry-15}-c.getGameTime().totalMinutes))`);await click('.places [data-view=home]');await click('[data-service=home-sleep]');await evaluate(`document.querySelector('#sleep-duration').value='30';document.querySelector('#sleep-duration').dispatchEvent(new Event('input'))`)
 check(await evaluate('document.querySelector("[data-sleep-energy-preview]").textContent.includes("100")&&document.querySelector("[data-sleep-energy-preview]").textContent.includes("expiration")'),'Sleep expiry preview');await capture('sport-expiry-sleep-320.png');await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await click('[data-sleep-confirm]');await pause(1200);after=await stats();check(after.resources.energy===100&&after.resources.maxEnergy===100,'Expiry sleep clamp');check((await state()).sportEnergy.effect===null,'Effect persisted after expiry');await reload();check((await stats()).resources.energy===100&&(await stats()).resources.maxEnergy===100,'Expired reload stacking')
 await pause(300);await click('#energy-effects-open');check(await evaluate('document.querySelector("[data-sport-effect]").textContent.includes("Aucune")'),'Inactive detail');await capture('sport-expired-320.png');await click('[data-sport-back]')
 if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({matchCosts:true,noFreeRecharge:true,sixHours:true,reloadNoStack:true,detail:true,extraCapacityUsable:true,crossingSleepPreview:true,expiryClamp:true,expiredReload:true,mobile320:true,errors},null,2))
 await writeFile(path.join(out,'sport-energy-browser-state.json'),JSON.stringify(await state(),null,2))
 await evaluate(`for(const key of ['mboa-sport-energy-v1','mboa-city-outings-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}

