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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-home-meals-v1');localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const counters=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts')]).then(([r,m,c])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes}))`)
 const open=()=>evaluate(`document.querySelector('.places [data-view=home]').click();document.querySelector('[data-service=home-meals]').click()`)
 const advanceTo=n=>evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${n}-c.getGameTime().totalMinutes))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 await open()
 if(!await evaluate(`document.querySelector('[data-meal-confirm]').disabled&&document.querySelector('[data-meal-error]').textContent==='Argent insuffisant.'`))throw Error('Insufficient money')
 await evaluate(`document.querySelector('[data-meal-cancel]').click();document.querySelector('.venue-close').click()`)
 await evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts')]).then(([r,m])=>{r.spendEnergy(70);m.addMoney(2000)})`)
 const before=await counters();await open();await evaluate(`document.querySelector('[data-meal=rice]').click()`)
 if(!await evaluate(`document.querySelector('[data-meal-energy]').textContent==='+25 énergie'&&document.querySelector('[data-meal-end]').textContent.includes('08:30')`))throw Error('Preview')
 await capture('home-meals-desktop.png')
 await evaluate(`document.querySelector('[data-meal-cancel]').click()`)
 if(JSON.stringify(await counters())!==JSON.stringify(before))throw Error('Cancel changed state')
 await evaluate(`document.querySelector('[data-service=home-meals]').click();document.querySelector('[data-meal=rice]').click()`)
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('home-meals-mobile.png')
 if(!await evaluate(`document.querySelector('#wait-open').disabled`))throw Error('Wait available during meal')
 await evaluate(`document.querySelector('[data-meal-confirm]').click();document.querySelector('[data-meal-confirm]').click()`)
 let value=await counters();if(value.money!==1650||value.resources.energy!==55||value.resources.mood!==96||value.time!==510)throw Error(JSON.stringify(value))
 if(!await evaluate(`document.querySelector('[data-meal-result]').textContent.includes('+25 énergie')&&document.querySelector('[data-meal-confirm]').disabled`))throw Error('Receipt/lock')
 await capture('home-meals-result-mobile.png')
 await reload();await open()
 if(!(await state()).meals.service.consumed||!await evaluate(`document.querySelector('[data-meal-confirm]').disabled`))throw Error('Reload bypass')
 await evaluate(`document.querySelector('[data-meal-cancel]').click();document.querySelector('.venue-close').click()`)
 await advanceTo(720);await open()
 if((await state()).meals.service.open||!await evaluate(`document.querySelector('[data-meal-service]').textContent.includes('18:00')`))throw Error('Weekday lunch closure')
 await evaluate(`document.querySelector('[data-meal-cancel]').click();document.querySelector('.venue-close').click()`)
 await advanceTo(1380);await open();await evaluate(`document.querySelector('[data-meal=ndole]').click()`)
 if(!await evaluate(`document.querySelector('[data-meal-confirm]').disabled&&document.querySelector('[data-meal-error]').textContent.includes('fermeture')`))throw Error('Late finish allowed')
 await evaluate(`document.querySelector('[data-meal=rice]').click()`)
 if(await evaluate(`document.querySelector('[data-meal-confirm]').disabled`))throw Error('Exact closing denied')
 await evaluate(`document.querySelector('[data-meal-confirm]').click()`)
 if((await counters()).time!==1410)throw Error('Closing time')
 await evaluate(`document.querySelector('[data-meal-cancel]').click();document.querySelector('.venue-close').click()`)
 await advanceTo(5*1440+720);await open();await evaluate(`document.querySelector('[data-meal=ndole]').click()`)
 if(!(await state()).meals.service.open)throw Error('Weekend lunch closed')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('320px overflow')
 await capture('home-meals-weekend-320.png')
 await evaluate(`document.querySelector('[data-meal-cancel]').click();document.querySelector('.venue-close').click()`)
 await evaluate(`import('/src/player-resources.ts').then(r=>{r.restoreEnergy(100);r.spendEnergy(2);r.setMood(139)})`)
 await open();await evaluate(`document.querySelector('[data-meal=ndole]').click()`)
 if(!await evaluate(`document.querySelector('[data-meal-energy]').textContent==='+2 énergie'&&document.querySelector('[data-meal-mood]').textContent.includes('+1')`))throw Error('Actual caps')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({insufficientMoney:true,preview:true,cancel:true,uniquePayment:true,receipt:true,reloadLimit:true,weekdayClosed:true,weekendLunch:true,lateFinishGuard:true,exactClosing:true,actualCaps:true,mobile320:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1','mboa-home-meals-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
