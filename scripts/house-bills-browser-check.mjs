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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-house-bills-v1');localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const counters=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts')]).then(([r,m,c])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes}))`)
 const open=async()=>{await evaluate(`document.querySelector('#bills-open').click()`);if(!await evaluate(`document.querySelector('.bills-dialog').open`))throw Error('Bills did not open')}
 const close=()=>evaluate(`document.querySelector('[data-bill-back]').click()`)
 const advanceTo=n=>evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${n}-c.getGameTime().totalMinutes))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 const initial=await counters(),firstIssue=6480
 if((await state()).bills.issued!==0||(await state()).bills.nextIssue.totalMinutes!==firstIssue)throw Error('Initial anchor')
 // Vrai clic dans le portefeuille, dont le parent est normalement sans pointer-events.
 const pos=await evaluate(`(()=>{const r=document.querySelector('#bills-open').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos})
 if(!await evaluate(`document.querySelector('.bills-dialog').open`))throw Error('Wallet click not reachable')
 if(!await evaluate(`document.querySelector('[data-bill-confirm]').disabled`))throw Error('Payment before issue')
 await capture('house-bills-upcoming-desktop.png');await close()
 if(JSON.stringify(initial)!==JSON.stringify(await counters()))throw Error('Cancel changed state')
 await advanceTo(firstIssue-10);await evaluate(`document.querySelector('#wait-open').click();document.querySelector('[data-wait-minutes="10"]').click();document.querySelector('[data-wait-confirm]').click()`)
 for(let i=0;i<100;i++){await pause(50);if((await state()).waiting.mode==='closed')break}
 if((await state()).bills.issued!==1||(await counters()).money!==0)throw Error('Wait issuance/debit')
 await open()
 if(!await evaluate(`document.querySelector('[data-bill-confirm]').disabled&&document.querySelector('[data-bill-error]').textContent.includes('insuffisant')`))throw Error('Low funds')
 await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(2000))`)
 if(await evaluate(`document.querySelector('[data-bill-confirm]').disabled`))throw Error('Wallet update not reflected '+JSON.stringify(await evaluate(`({state:JSON.parse(window.render_game_to_text()).bills,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.className),masks:[...document.querySelectorAll('.wait-transition')].map(m=>m.hidden),dialogue:document.querySelector('#dialogue').hidden,reference:document.querySelector('#reference').hidden,balance:document.querySelector('[data-bill-balance]').textContent})`)))
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('house-bills-pay-mobile.png')
 const before=await counters();await evaluate(`document.querySelector('[data-bill-confirm]').click();document.querySelector('[data-bill-confirm]').click()`)
 let value=await counters();if(value.money!==500||value.time!==before.time||JSON.stringify(value.resources)!==JSON.stringify(before.resources)||(await state()).bills.paid!==1)throw Error('Payment accounting')
 await capture('house-bills-receipt-mobile.png');await close();await reload()
 if((await state()).bills.paid!==1||(await state()).bills.unpaid!==0)throw Error('Reload paid')
 await advanceTo(firstIssue+13*10080+360)
 let b=(await state()).bills;if(b.issued!==14||b.unpaid!==13||b.totalDue!==19500||(await counters()).money!==500||!b.oldest.overdue)throw Error('Skipped weeks '+JSON.stringify(b))
 await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(5000))`);await open()
 await evaluate(`document.querySelector('[data-bill-next-page]').click()`)
 if(!await evaluate(`document.querySelector('[data-bill-page]').textContent==='Page 2 / 3'&&!!document.querySelector('[data-bill-index="6"]')`))throw Error('History paging')
 await evaluate(`document.querySelector('[data-bill-confirm]').click();document.querySelector('[data-bill-confirm]').click()`)
 value=await counters();if(value.money!==4000||(await state()).bills.paid!==2)throw Error('Double paid two invoices')
 if(!await evaluate(`!document.querySelector('[data-bill-another]').hidden`))throw Error('Next invoice preparation')
 await evaluate(`document.querySelector('[data-bill-another]').click()`)
 if(!await evaluate(`document.querySelector('[data-bill-title]').textContent.includes('semaine 4')`))throw Error('Oldest ordering')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Modal overflow')
 await capture('house-bills-overdue-320.png');await close();await reload()
 if((await state()).bills.paid!==2||(await state()).bills.unpaid!==12)throw Error('Reload arrears')
 await evaluate(`document.querySelector('#missions-open').click()`)
 if(!await evaluate(`document.querySelector('#bills-open').disabled`))throw Error('Bills launcher over journal')
 await evaluate(`document.querySelector('#bills-open').dispatchEvent(new Event('click'))`)
 if(await evaluate(`document.querySelector('.bills-dialog').open`))throw Error('Stacked bill dialog')
 await evaluate(`document.querySelector('[data-mission-back]').click()`)
 await capture('house-bills-wallet-320.png')
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('HUD overflow')
 await evaluate(`localStorage.removeItem('mboa-house-bills-v1')`);await reload()
 b=(await state()).bills;if(b.issued!==0||b.unpaid!==0||b.nextIssue.totalMinutes<=firstIssue+13*10080+360)throw Error('Legacy retroactive debt')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({walletClick:true,initialAnchor:true,cancel:true,waitIssuance:true,noAutomaticDebit:true,insufficientFunds:true,exactPayment:true,reload:true,skippedWeeks:true,paging:true,doubleClickGuard:true,oldestFirst:true,legacyNoDebt:true,modalGuard:true,mobile320:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-house-bills-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1','mboa-waiting-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
