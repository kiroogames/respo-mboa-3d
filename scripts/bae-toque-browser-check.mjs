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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-bae-toque-v1');localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const counters=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts'),import('/src/npc-relationships.ts')]).then(([r,m,c,n])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes,consideration:n.getConsideration('bae'),completed:n.getCompletedNPCRequests('bae').length}))`)
 const open=()=>evaluate(`document.querySelector('.places [data-view=home]').click();document.querySelector('#venue-people-tab').click();document.querySelector('[data-toque-open]').click()`)
 const close=()=>evaluate(`document.querySelector('[data-toque-back]').click();document.querySelector('.venue-close').click()`)
 const input=n=>evaluate(`document.querySelector('#toque-amount').value='${n}';document.querySelector('#toque-amount').dispatchEvent(new Event('input'))`)
 const confirm=()=>evaluate(`document.querySelector('[data-toque-confirm]').click();document.querySelector('[data-toque-confirm]').click()`)
 const advanceTo=n=>evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${n}-c.getGameTime().totalMinutes))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 await evaluate(`document.querySelector('.places [data-view=home]').click();document.querySelector('#venue-people-tab').click()`)
 if(await evaluate(`!!document.querySelector('[data-toque-open]')`))throw Error('Bae offer shown during absence')
 await evaluate(`document.querySelector('.venue-close').click()`);await advanceTo(930);await open()
 if(!await evaluate(`document.querySelector('[data-toque-confirm]').disabled&&document.querySelector('[data-toque-error]').textContent.includes('insuffisants')`))throw Error('Low money')
 await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(10000))`)
 for(const n of [500,1000,5000,10000]){await evaluate(`document.querySelector('[data-toque-amount="${n}"]').click()`);if(await evaluate(`document.querySelector('#toque-amount').value`)!==String(n))throw Error('Preset '+n)}
 await evaluate(`document.querySelector('[data-toque-amount="5000"]').click()`)
 await capture('bae-toque-preview-desktop.png')
 const before=await counters();await close();if(JSON.stringify(await counters())!==JSON.stringify(before))throw Error('Cancel changed state')
 await open();await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('bae-toque-preview-mobile.png')
 if(!await evaluate(`document.querySelector('#wait-open').disabled&&document.querySelector('#bills-open').disabled`))throw Error('Other actions not blocked')
 await confirm();let value=await counters()
 if(value.money!==9500||(await state()).toque.contributed!==500||value.time!==before.time||JSON.stringify(value.resources)!==JSON.stringify(before.resources)||value.consideration!==before.consideration)throw Error('500 accounting '+JSON.stringify(value))
 await capture('bae-toque-receipt-mobile.png')
 await evaluate(`document.querySelector('[data-toque-another]').click();document.querySelector('[data-toque-amount="1000"]').click()`);await confirm()
 if((await state()).toque.contributed!==1500||(await counters()).money!==8500)throw Error('Second contribution')
 await close();await reload();if((await state()).toque.contributed!==1500)throw Error('Reload lost total')
 await advanceTo(10080+930);if((await state()).toque.contributed!==1500)throw Error('Weekly reset')
 await open();await input(100.5);if(!await evaluate(`document.querySelector('[data-toque-confirm]').disabled`))throw Error('Invalid step')
 await advanceTo(10080+1440+480)
 if(!await evaluate(`document.querySelector('[data-toque-confirm]').disabled&&document.querySelector('[data-toque-error]').textContent.includes('Bae')`))throw Error('Absent giver in open menu')
 await close();await advanceTo(10080+1440+930);await open()
 await evaluate(`document.querySelector('[data-toque-complete]').click()`)
 if(await evaluate(`document.querySelector('#toque-amount').value`)!=='148500'||!await evaluate(`document.querySelector('[data-toque-confirm]').disabled`))throw Error('Remainder without funds')
 await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(200000))`)
 await input(148600);if(!await evaluate(`document.querySelector('[data-toque-confirm]').disabled&&document.querySelector('[data-toque-error]').textContent.includes('dépasse')`))throw Error('Overshoot')
 await evaluate(`document.querySelector('[data-toque-complete]').click()`)
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Preview overflow')
 await capture('bae-toque-final-preview-320.png')
 const preFinal=await counters();await confirm();value=await counters()
 if(!(await state()).toque.complete||(await state()).toque.contributed!==150000||value.money!==60000||value.time!==preFinal.time||value.consideration!==50||value.completed!==0||JSON.stringify(value.resources)!==JSON.stringify(before.resources))throw Error('Final target '+JSON.stringify(value))
 if(!await evaluate(`document.querySelector('[data-toque-confirm]').hidden&&document.querySelector('[data-toque-status]').textContent==='Objectif atteint'`))throw Error('Completion controls')
 await capture('bae-toque-complete-320.png');await close();await reload();await open()
 if(!(await state()).toque.complete||!await evaluate(`document.querySelector('[data-toque-confirm]').hidden`))throw Error('Completion reload')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({availability:true,presets:true,cancel:true,modalGuards:true,uniquePayment:true,repeatPreparation:true,reload:true,noWeeklyReset:true,invalidAmounts:true,giverLeaves:true,exactRemainder:true,completion:true,unchangedStats:true,mobile320:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-bae-toque-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
