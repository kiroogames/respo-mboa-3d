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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});await call('Page.addScriptToEvaluateOnNewDocument',{source:'window.__MBOA_GUIDED_QA_PAUSED__=true'});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-accompanied-outings-v1');localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.setItem('mboa-money-v1','50000');localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','930')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const group=async()=>((await state()).accompanied.state)
 const counters=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts'),import('/src/npc-relationships.ts')]).then(([r,m,c,n])=>({resources:r.getPlayerResources(),base:r.getMoodDetails().base,money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes,bae:n.getConsideration('bae'),crystal:n.getConsideration('crystal')}))`)
 const invite=(id,zone)=>evaluate(`document.querySelector('.places [data-view=${zone}]').click();document.querySelector('#venue-people-tab').click();document.querySelector('[data-invite-npc=${id}]').click()`)
 const choose=(selector,value)=>evaluate(`document.querySelector('${selector}').value='${value}';document.querySelector('${selector}').dispatchEvent(new Event('change'))`)
 const confirm=()=>evaluate(`document.querySelector('[data-accompanied-confirm]').click();document.querySelector('[data-accompanied-confirm]').click()`)
 const close=()=>evaluate(`document.querySelector('[data-accompanied-back]').click();document.querySelector('.venue-close').click()`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 async function phase(expected){await pause(100);const g=await group();if(g?.phase!==expected)throw Error('Expected '+expected+' '+JSON.stringify(g))}
 await invite('bae','home')
 if(!await evaluate(`document.querySelector('.accompanied-dialog').open`))throw Error('Bae invitation entry')
 const before=await counters()
 for(const mode of ['taxi','moto','yonga','walk']){
  await choose('#accompanied-mode',mode);const p=(await state()).accompanied.preview,factor=mode==='taxi'||mode==='moto'?2:1
  if(p.money!==1800+(p.outward.money+p.back.money)*factor)throw Error('Duo tariff '+mode)
 }
 await choose('#accompanied-mode','yonga');await choose('#accompanied-option','snack')
 const plan=(await state()).accompanied.preview;if(plan.reason)throw Error(plan.reason)
 await capture('accompanied-plan-desktop.png');await close()
 if(JSON.stringify(await counters())!==JSON.stringify(before))throw Error('Cancel charged')
 await invite('bae','home');await choose('#accompanied-option','snack');const actualPlan=(await state()).accompanied.preview
 await confirm();await phase('outbound')
 let value=await counters()
 if(value.money!==before.money-actualPlan.money||value.resources.energy!==100-actualPlan.energy||value.time!==actualPlan.arrival.totalMinutes||value.base!==90||value.bae!==50)throw Error('Departure accounting '+JSON.stringify(value))
 if(!await evaluate(`document.querySelector('#wait-open').disabled&&document.querySelector('#bills-open').disabled&&document.querySelector('#missions-open').disabled`))throw Error('Busy UI guard')
 const blocked=await evaluate(`import('/src/venue-services.ts').then(m=>m.useVenueService('home-rest','home'))`);if(blocked.ok)throw Error('Other activity allowed')
 await evaluate(`window.__MBOA_QA__.advanceJourney(.6)`);await pause(1200)
 const pins=await evaluate(`(()=>{const a=document.querySelector('[data-npc=bae]'),b=document.querySelector('.player-pin:not(.npc-pin)'),ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return{count:document.querySelectorAll('[data-npc=bae]').length,hidden:a.hidden,separation:Math.hypot(ar.x-br.x,ar.y-br.y)}})()`)
 if(pins.count!==1||pins.hidden||pins.separation<60)throw Error('Distinct companion GPS '+JSON.stringify(pins))
 await capture('accompanied-two-gps-desktop.png')
 await reload();await phase('outbound');if((await counters()).money!==value.money)throw Error('Reload double charge')
 await evaluate(`window.__MBOA_QA__.advanceGuided()`);await phase('activity')
 value=await counters();if(value.time!==actualPlan.activityEnd.totalMinutes||value.base!==120||value.bae!==52)throw Error('Activity gains '+JSON.stringify(value))
 if((await state()).npcs.find(n=>n.id==='bae').zone!=='culture'||(await state()).npcs.find(n=>n.id==='bae').available)throw Error('NPC activity override')
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('accompanied-activity-mobile.png')
 await reload();await phase('activity');if((await counters()).base!==120||(await counters()).bae!==52)throw Error('Activity replay after reload')
 await evaluate(`window.__MBOA_QA__.advanceGuided()`);await phase('return')
 await reload();await phase('return');if((await counters()).money!==value.money||(await counters()).bae!==52)throw Error('Return replay')
 await evaluate(`window.__MBOA_QA__.advanceGuided()`);await phase('done')
 value=await counters();if(value.time!==actualPlan.returned.totalMinutes||(await state()).player.zone!=='home'||(await state()).player.travelling||(await state()).npcs.find(n=>n.id==='bae').zone!=='home'||!(await state()).npcs.find(n=>n.id==='bae').available)throw Error('Return/routine restoration')
 await capture('accompanied-receipt-mobile.png');await close()
 const consumed=await evaluate(`import('/src/city-outings.ts').then(m=>m.getOutingSchedule('cinema').consumed)`);if(!consumed)throw Error('Solo limit not shared')
 await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(1410-c.getGameTime().totalMinutes))`)
 await invite('bae','home');await choose('#accompanied-activity','snack');const night=(await state()).accompanied.preview
 if(night.reason||night.activityEnd.totalMinutes<1440)throw Error('Bae midnight availability '+JSON.stringify(night))
 await confirm();for(let i=0;i<3;i++)await evaluate(`window.__MBOA_QA__.advanceGuided()`);await phase('done')
 if((await counters()).bae!==54)throw Error('Second outing consideration')
 await close();await evaluate(`document.querySelector('.places [data-view=palms]').click();document.querySelector('[data-travel-mode=walk]').click();window.__MBOA_QA__.advanceJourney(120)`)
 await evaluate(`document.querySelector('.venue-close').click();import('/src/game-clock.ts').then(c=>c.advanceGameTime(1440+1080-c.getGameTime().totalMinutes))`)
 await invite('crystal','palms');await choose('#accompanied-activity','snack');const crystalPlan=(await state()).accompanied.preview
 if(crystalPlan.reason)throw Error('Crystal plan '+crystalPlan.reason)
 const crystalBefore=await counters();await confirm();for(let i=0;i<3;i++)await evaluate(`window.__MBOA_QA__.advanceGuided()`);await phase('done')
 const final=await counters(),s=await state()
 if(final.crystal!==52||final.bae!==54||final.money!==crystalBefore.money-crystalPlan.money||s.player.zone!=='palms'||!s.npcs.find(n=>n.id==='crystal').available||s.npcs.find(n=>n.id==='crystal').zone!=='palms')throw Error('Crystal reward/return')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('320 overflow');await capture('accompanied-crystal-receipt-320.png')
 if(final.resources.maxEnergy!==100||final.resources.karma!==0||final.resources.ptRespo!==0)throw Error('Unrelated stats changed')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({bothCompanions:true,duoTariffs:true,cancel:true,prepaidOnce:true,busyGuards:true,distinctGPS:true,reloadAllPhases:true,singleRewards:true,normalRoutineRestored:true,soloLimitShared:true,midnightBae:true,crystalFreeTime:true,mobile320:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-accompanied-outings-v1','mboa-city-outings-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
