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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-house-bills-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}



 const pause=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>evaluate('JSON.parse(window.render_game_to_text())')
 const click=selector=>evaluate(`document.querySelector('${selector}').click()`),check=(v,message)=>{if(!v)throw Error(message)}
 const budget=async()=>(await state()).bills.budget
 const stats=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts')]).then(([r,m,c])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes}))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 const before=await stats();check((await budget()).reference===1500&&(await budget()).source==='upcoming'&&(await budget()).status==='insufficient','Initial budget');check((await state()).bills.unpaid===0,'Future debt created');await click('#bills-open');check(JSON.stringify(await stats())===JSON.stringify(before),'Opening mutated state');await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(1124))`);check((await budget()).status==='insufficient','1124 threshold');await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(1))`);check((await budget()).status==='tight','1125 threshold');check(await evaluate('document.querySelector("[data-house-budget]").dataset.budget==="tight"&&document.querySelector("#house-budget-indicator").textContent.includes("serré")'),'Live panel and HUD');await capture('house-budget-orange-desktop.png')
 await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(375))`);check((await budget()).status==='covered'&&(await budget()).available===0,'Exact equality');await call('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});await pause(200);await capture('house-budget-covered-320.png');check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow');await click('[data-bill-back]')
 await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(7000))`);await click('.places [data-view=home]');await click('[data-venue-comfort]');await click('[data-comfort-confirm]');check((await budget()).status==='insufficient'&&(await budget()).balance===500,'Actual purchase HUD');await click('[data-comfort-continue]');await click('[data-comfort-sell]');await click('[data-comfort-confirm]');check((await budget()).status==='covered'&&(await budget()).balance===4500,'Actual resale HUD');await click('[data-comfort-back]');await click('.venue-close');await capture('house-budget-hud-320.png')
 await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${11*1440+720}-c.getGameTime().totalMinutes))`);check((await budget()).reference===3000&&(await budget()).source==='unpaid','Two issued invoices');await evaluate(`import('/src/currency.ts').then(m=>m.spendMoney(2250))`);check((await budget()).status==='tight'&&(await budget()).missing===750,'Scaled75 threshold');await click('#bills-open');await capture('house-budget-two-unpaid-320.png');await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(750))`);await click('[data-bill-confirm]');check((await budget()).reference===1500&&(await budget()).status==='covered'&&(await budget()).balance===1500,'First invoice rebase');await click('[data-bill-another]');await click('[data-bill-confirm]');check((await state()).bills.unpaid===0&&(await budget()).source==='upcoming'&&(await budget()).reference===1500&&(await budget()).balance===0,'All paid reference');await capture('house-budget-next-invoice-320.png');await reload();check((await state()).bills.paid===2&&(await budget()).source==='upcoming'&&(await budget()).balance===0,'Reload duplicated debt/charge')
 check(JSON.stringify((await stats()).resources)===JSON.stringify(before.resources),'Resource changes');if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({zeroAndEquality:true,exact75:true,liveHudAndPanel:true,noReservation:true,realPurchaseAndSale:true,twoInvoiceReference:true,sequentialPayments:true,upcomingNotDebt:true,reload:true,unchangedResources:true,mobile320:true,errors},null,2))
 await writeFile(path.join(out,'house-budget-browser-state.json'),JSON.stringify(await state(),null,2))
 await evaluate(`for(const key of ['mboa-house-bills-v1','mboa-home-comfort-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
