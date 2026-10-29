// Restaurant solo et accompagné : horaires, recharge au repas et reprise des trajets.

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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});await call('Page.addScriptToEvaluateOnNewDocument',{source:'window.__MBOA_GUIDED_QA_PAUSED__=true'});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-accompanied-outings-v1');localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.removeItem('mboa-food-bag-v1');localStorage.setItem('mboa-money-v1','50000');localStorage.setItem('mboa-player-zone-v1','market');localStorage.setItem('mboa-game-minutes-v1','660')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}




 const pause=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>evaluate('JSON.parse(window.render_game_to_text())')
 const click=selector=>evaluate(`document.querySelector('${selector}').click()`)
 const check=(ok,message)=>{if(!ok)throw Error(message)}
 for(const [day,zone] of ['market','supermarket','njoka'].entries()){
  if(day){await click('.places [data-view='+zone+']');await click('[data-travel-mode=yonga]');await evaluate('window.__MBOA_QA__.advanceJourney(120)');await pause(100);await click('.venue-close');await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${day*1440+660}-c.getGameTime().totalMinutes))`)}
  await evaluate(`import('/src/player-resources.ts').then(r=>{r.restoreEnergy(100);r.spendEnergy(30);r.setMood(90)})`)
  await click('.places [data-view='+zone+']');await click('[data-venue-outing]');const p=(await state()).outings.preview;check(p.activity.id==='restaurant-'+zone,'Wrong restaurant '+zone);check(p.option.money===800&&p.energyGain===20,'Wrong menu');await click('[data-outing-option=complete]');await click('[data-outing-confirm]');check(await evaluate(`import('/src/player-resources.ts').then(r=>r.getPlayerResources().energy===100)`),'Energy reward');await capture('restaurant-'+zone+'-receipt.png');await click('[data-outing-back]');await click('.venue-close')
 }
 await click('.places [data-view=home]');await click('[data-travel-mode=yonga]');await evaluate('window.__MBOA_QA__.advanceJourney(120)');await pause(100);await click('.venue-close');await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${3*1440+930}-c.getGameTime().totalMinutes))`);await evaluate(`import('/src/player-resources.ts').then(r=>{r.spendEnergy(40);r.setMood(90)})`);await click('.places [data-view=home]');await click('#venue-people-tab');await click('[data-invite-npc=bae]')
 for(const zone of ['market','supermarket','njoka']){await evaluate(`document.querySelector('#accompanied-activity').value='restaurant-${zone}';document.querySelector('#accompanied-activity').dispatchEvent(new Event('change'))`);const p=(await state()).accompanied.preview;check(p.destination===zone,'Wrong duo route '+zone);check(!p.reason,p.reason);check(p.energyGain===20,'Duo gain missing')}
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});await pause(100);await capture('restaurant-njoka-duo-320.png');check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow');await click('[data-accompanied-confirm]');for(let i=0;i<3;i++)await evaluate('window.__MBOA_QA__.advanceGuided()');check((await state()).accompanied.state.phase==='done','Njoka return failed');check((await state()).player.zone==='home','Origin lost');check((await state()).accompanied.state.energyGain===20,'Meal gain missing')
 if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({threeLocalMenus:true,soloRewards:true,threeDuoDestinations:true,njokaRoundTrip:true,mobile320:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-accompanied-outings-v1','mboa-city-outings-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1','mboa-npc-consideration-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
