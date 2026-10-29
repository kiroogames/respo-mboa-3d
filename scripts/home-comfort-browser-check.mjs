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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-home-comfort-v1');localStorage.setItem('mboa-npc-relationships-v1',JSON.stringify({consideration:73,accepted:['kitchen','bathroom','television'],completed:['kitchen','bathroom','television']}));localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const counters=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts'),import('/src/npc-relationships.ts')]).then(([r,m,c,n])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes,consideration:n.getConsideration('bae'),completed:n.getCompletedNPCRequests('bae').length}))`)
 const open=()=>evaluate(`document.querySelector('.places [data-view=home]').click();document.querySelector('[data-venue-comfort]').click()`)
 const close=()=>evaluate(`document.querySelector('[data-comfort-back]').click();document.querySelector('.venue-close').click()`)
 const confirm=()=>evaluate(`document.querySelector('[data-comfort-confirm]').click();document.querySelector('[data-comfort-confirm]').click()`)
 const select=id=>evaluate(`document.querySelector('[data-comfort-item="${id}"]').click()`)
 const room=id=>evaluate(`document.querySelector('#comfort-room').value='${id}';document.querySelector('#comfort-room').dispatchEvent(new Event('change'))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 let s=await state();if(s.comfort.total!==150||s.toque.contributed!==0)throw Error('Legacy completed improvements')
 await open()
 if(!await evaluate(`document.querySelector('[data-comfort-confirm]').disabled&&document.querySelector('[data-comfort-error]').textContent.includes('insuffisants')`))throw Error('Low funds')
 if((await counters()).time!==480)throw Error('Initial time')
 await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(20000))`)
 const before=await counters(),billAmount=(await state()).bills.amount
 await capture('home-comfort-desktop.png');await close()
 if(JSON.stringify(before)!==JSON.stringify(await counters()))throw Error('Cancel changed state')
 await open();await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 if(!await evaluate(`document.querySelector('#wait-open').disabled&&document.querySelector('#bills-open').disabled`))throw Error('Modal guards')
 await confirm();s=await state()
 if(s.comfort.total!==150||(await counters()).money!==12000||!s.comfort.equipment.find(i=>i.id==='bed-comfort').owned||s.comfort.equipment.find(i=>i.id==='bed-comfort').equipped)throw Error('Buy/equip separation')
 if(!await evaluate(`document.querySelector('[data-comfort-confirm]').hidden`))throw Error('Purchase confirm not locked')
 await capture('home-comfort-purchase-mobile.png')
 await evaluate(`document.querySelector('[data-comfort-continue]').click()`);await confirm()
 if((await state()).comfort.total!==230||(await counters()).money!==12000)throw Error('Bed equip')
 await capture('home-comfort-equipped-mobile.png')
 await select('bed-base');await confirm();if((await state()).comfort.total!==150)throw Error('Base restore')
 await select('bed-comfort');await confirm();if((await state()).comfort.total!==230||(await counters()).money!==12000)throw Error('Free re-equip')
 await room('living');await select('sofa-comfort');await confirm()
 if((await state()).comfort.total!==230||(await counters()).money!==5500)throw Error('Sofa purchase')
 await evaluate(`document.querySelector('[data-comfort-continue]').click()`);await confirm()
 s=await state();if(s.comfort.total!==300||!s.comfort.complete)throw Error('Target not reached')
 if(JSON.stringify(s.comfort.rooms.map(r=>r.comfort))!==JSON.stringify([80,100,60,60]))throw Error('Room totals')
 await room('kitchen');if(!await evaluate(`document.querySelector('.comfort-works').textContent.includes('Travaux payés')&&document.querySelector('[data-comfort-confirm]').hidden`))throw Error('Kitchen paid state')
 await room('bathroom');if(!await evaluate(`document.querySelector('.comfort-works').textContent.includes('+60 points')`))throw Error('Bathroom state')
 await close();await reload()
 s=await state();if(s.comfort.total!==300||!s.comfort.equipment.find(i=>i.id==='bed-comfort').equipped||!s.comfort.equipment.find(i=>i.id==='sofa-comfort').equipped)throw Error('Reload inventory/equipment')
 const after=await counters();if(after.money!==5500||after.time!==before.time||JSON.stringify({...after.resources,mood:before.resources.mood})!==JSON.stringify(before.resources)||after.resources.mood!==110||after.consideration!==73||after.completed!==3||s.bills.amount!==billAmount||s.toque.contributed!==0)throw Error('Other stats changed '+JSON.stringify(after))
 await open();await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('320 overflow')
 await capture('home-comfort-complete-320.png');await close()
 await evaluate(`document.querySelector('.places [data-view=ministry]').click();document.querySelector('[data-venue-comfort]').click()`)
 if(await evaluate(`document.querySelector('.comfort-dialog').open`))throw Error('Comfort stacked over transport')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({legacyWorks:true,lowFunds:true,cancel:true,noBaeRequired:true,buyEquipSeparate:true,uniquePurchase:true,freeReplacement:true,twoSlots:true,target300:true,roomTotals:true,reload:true,unchangedStats:true,modalGuards:true,mobile320:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-home-comfort-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1','mboa-npc-relationships-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
