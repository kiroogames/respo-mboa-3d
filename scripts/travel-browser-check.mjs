// Parcours navigateur des transports et services ; utilise un profil Chrome de test isolé.
// Scénario historique à maintenir lorsque les menus ou les règles de trajet changent.

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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1'])localStorage.removeItem(key)`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}
 const readState=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/game-clock.ts'),import('/src/currency.ts')]).then(([r,c,m])=>({resources:r.getPlayerResources(),clock:c.getGameTime(),money:m.getMoneyBalance(),player:window.__MBOA_QA__.metrics().player}))`)
 const initial=await readState()
 if(initial.resources.energy!==100||initial.resources.maxEnergy!==100||initial.resources.mood!==90||initial.resources.ptRespo!==0||initial.resources.respoNext!==190)throw Error(JSON.stringify(initial))
 await capture('resources-desktop.png')
 const layouts=[]
 for(const width of [1280,1024,390,320]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<760})
  const layout=await evaluate(`(()=>{const cards=[...document.querySelectorAll('.resource-stats .game-wallet')].map(el=>el.getBoundingClientRect()),actions=document.querySelector('.header-actions').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,collision:cards.some(c=>c.left<actions.right&&c.right>actions.left&&c.top<actions.bottom&&c.bottom>actions.top)}})()`)
  layouts.push({width,...layout});if(layout.overflow||layout.collision)throw Error(JSON.stringify(layouts))
  if(width===390)await capture('resources-mobile.png')
 }
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await evaluate(`document.querySelector('.landmark[data-view=market]').click()`)
 const modal=await evaluate(`({open:document.querySelector('.travel-dialog').open,distance:document.querySelector('#travel-distance').textContent,walkDisabled:document.querySelector('[data-travel-mode=walk]').disabled,taxiDisabled:document.querySelector('[data-travel-mode=taxi]').disabled})`)
 if(!modal.open||modal.walkDisabled||!modal.taxiDisabled)throw Error(JSON.stringify(modal))
 await capture('travel-popup-mobile.png')
 await evaluate(`document.querySelector('.travel-cancel').click()`)
 const cancelled=await readState();if(JSON.stringify(cancelled)!==JSON.stringify(initial))throw Error('Cancel changed game state')
 await evaluate(`document.querySelector('.landmark[data-view=market]').click();document.querySelector('[data-travel-mode=walk]').click();document.querySelector('[data-travel-mode=walk]').click()`)
 const afterDeparture=await readState()
 if(!afterDeparture.player.travelling||afterDeparture.resources.energy>=100||afterDeparture.clock.time==='08:00'||afterDeparture.money!==0)throw Error(JSON.stringify(afterDeparture))
 const waitArrival=async()=>{for(let i=0;i<160;i++){await new Promise(r=>setTimeout(r,250));if(!await evaluate('window.__MBOA_QA__.metrics().player.travelling'))return}throw Error('Trip never arrived')}
 await new Promise(r=>setTimeout(r,900));const midway=await readState()
 if(midway.player.position.every((v,i)=>Math.abs(v-initial.player.position[i])<.01))throw Error('GPS did not move')
 await waitArrival();const arrived=await readState()
 if(arrived.player.zone!=='market')throw Error(JSON.stringify(arrived))
 if(!await evaluate('document.querySelector(".venue-dialog").open'))throw Error('Arrival services did not open')
 await evaluate('document.querySelector(".venue-cancel").click()')
 if(arrived.resources.energy!==afterDeparture.resources.energy||arrived.clock.time!==afterDeparture.clock.time)throw Error('Trip charged twice')
 await evaluate(`import('/src/currency.ts').then(m=>m.addMoney(10000))`)
 await evaluate(`document.querySelector('.places [data-view=hill]').click()`)
 const nextOrigin=await evaluate('document.querySelector("#travel-origin").textContent')
 if(!nextOrigin.includes('marché'))throw Error('Quote did not use current location: '+nextOrigin)
 await capture('travel-funded-mobile.png')
 await evaluate(`document.querySelector('[data-travel-mode=taxi]').click()`)
 const taxiStart=await readState();if(taxiStart.money>=10000||taxiStart.resources.energy!==arrived.resources.energy)throw Error(JSON.stringify(taxiStart))
 await waitArrival();const taxiEnd=await readState();if(taxiEnd.player.zone!=='hill')throw Error(JSON.stringify(taxiEnd))
 await evaluate('document.querySelector(".venue-cancel").click()')
 await call('Page.reload',{})
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));if(await evaluate('document.documentElement.dataset.ready === "true"'))break}
 const restored=await readState();if(restored.player.zone!=='hill'||restored.money!==taxiEnd.money||restored.clock.time!==taxiEnd.clock.time)throw Error('Travel state did not persist')
 await evaluate(`import('/src/player-resources.ts').then(m=>{m.spendEnergy(m.getPlayerResources().energy)})`)
 await evaluate(`document.querySelector('.places [data-view=market]').click()`)
 if(!await evaluate(`document.querySelector('[data-travel-mode=walk]').disabled`))throw Error('Walking enabled without energy')

 await evaluate(`document.querySelector('.travel-cancel').click()`)
 const npcSetup=await evaluate(`Promise.all([import('/src/game-clock.ts')]).then(([c])=>{const now=c.getGameTime().minuteOfDay;c.advanceGameTime((929-now+1440)%1440);localStorage.setItem('mboa-player-zone-v1','home');return c.getGameTime()})`)
 await call('Page.reload',{})
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));if(await evaluate('document.documentElement.dataset.ready === "true"'))break}
 if(!await evaluate('document.querySelector("[data-npc=bae]").hidden'))throw Error('Bae visible before 15:30')
 await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(1))`)
 await new Promise(r=>setTimeout(r,500))
 if(await evaluate('document.querySelector("[data-npc=bae]").hidden'))throw Error('Bae absent at 15:30')
 await evaluate(`document.querySelector('[data-npc=bae]').click()`)
 const bae=await evaluate(`({name:document.querySelector('#dialogue-name').textContent,src:document.querySelector('#dialogue-portrait').getAttribute('src'),transform:getComputedStyle(document.querySelector('#dialogue-portrait')).transform})`)
 if(bae.name!=='Bae'||bae.transform!=='none'||!bae.src.endsWith('bae.png'))throw Error(JSON.stringify(bae))
 await capture('bae-dialogue-mobile.png')
 await evaluate(`document.querySelector('#dialogue-close').click();document.querySelector('.places [data-view=home]').click()`)
 const homeBefore=await readState()
 await evaluate(`document.querySelector('[data-service=home-rest]').click();document.querySelector('[data-service=home-rest]').click()`)
 const homeAfter=await readState()
 if(homeAfter.resources.energy!==homeBefore.resources.energy+20||homeAfter.clock.totalMinutes-homeBefore.clock.totalMinutes!==30)throw Error('Home rest charged twice or restored incorrectly')
 await evaluate(`document.querySelector('.venue-cancel').click();document.querySelector('.places [data-view=pilton]').click()`)
 if(!await evaluate('document.querySelector("[data-travel-mode=yonga]")&&!document.querySelector("[data-travel-mode=yonga]").disabled'))throw Error('Yonga missing or unavailable with funds')
 await capture('transport-four-modes-mobile.png')
 await evaluate(`document.querySelector('[data-travel-mode=yonga]').click()`)
 await waitArrival()
 if(!await evaluate('document.querySelector(".venue-dialog").open'))throw Error('Hotel services not opened on arrival')
 await capture('hotel-services-mobile.png')
 const hotelBefore=await readState()
 await evaluate(`document.querySelector('[data-service=hotel-rest]').click()`)
 const hotelAfter=await readState()
 if(hotelBefore.money-hotelAfter.money!==1500||hotelAfter.clock.totalMinutes-hotelBefore.clock.totalMinutes!==60||hotelAfter.resources.energy!==Math.min(100,hotelBefore.resources.energy+35))throw Error('Hotel service costs incorrect')
 await evaluate(`document.querySelector('.venue-cancel').click()`)
 await evaluate(`import('/src/game-clock.ts').then(c=>{const minute=c.getGameTime().minuteOfDay;c.advanceGameTime((480-minute+1440)%1440)})`)
 await new Promise(r=>setTimeout(r,400))
 if(!await evaluate('document.querySelector("[data-npc=bae]").hidden'))throw Error('Bae visible at 08:00 next day')
 if(await evaluate('document.querySelector("[data-view=hotel]")!==null'))throw Error('Duplicate hotel exists')
 if(!await evaluate(`document.querySelector('.places [data-view=pilton]').textContent.includes('Pilton, Farmous')`))throw Error('Full hotel name missing')
 if(errors.length)throw Error(JSON.stringify(errors))
 const report={initial,layouts,modal,afterDeparture,midway,arrived,taxiStart,taxiEnd,restored,errors}
 await writeFile(path.join(out,'travel-browser-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({layouts,walkArrival:arrived.player.zone,taxiArrival:taxiEnd.player.zone,persistence:true,bae,hotelService:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
