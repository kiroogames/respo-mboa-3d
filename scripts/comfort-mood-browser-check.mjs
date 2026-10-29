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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-home-meals-v1');localStorage.setItem('mboa-npc-relationships-v1',JSON.stringify({consideration:61,accepted:['kitchen','bathroom','television'],completed:['kitchen','bathroom','television']}));localStorage.setItem('mboa-home-comfort-v1',JSON.stringify({owned:['bed-comfort','sofa-comfort'],equipped:{bed:'bed-comfort',sofa:'sofa-comfort'}}));localStorage.setItem('mboa-money-v1','20000');localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const mood=()=>evaluate(`import('/src/player-resources.ts').then(r=>r.getMoodDetails())`)
 const setBase=n=>evaluate(`import('/src/player-resources.ts').then(r=>r.setMood(${n}))`)
 const openEffects=()=>evaluate(`document.querySelector('#mood-effects-open').click()`)
 const closeEffects=()=>evaluate(`document.querySelector('[data-mood-back]').click()`)
 const openVenue=()=>evaluate(`document.querySelector('.places [data-view=home]').click()`)
 const closeVenue=()=>evaluate(`document.querySelector('.venue-close').click()`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 async function waitFinished(){for(let i=0;i<100;i++){await pause(50);if((await state()).waiting.mode==='closed')return}throw Error('Waiting stuck')}
 const initial=(await state()).moodEffects
 if(initial.base!==90||initial.bonus!==20||initial.displayed!==110||await evaluate(`document.querySelector('#mood-amount').textContent`)!=='110'||await evaluate(`document.querySelector('#mood-label').textContent`)!=='Heureux')throw Error('Legacy mood/comfort not displayed '+JSON.stringify(initial))
 const pos=await evaluate(`(()=>{const r=document.querySelector('#mood-effects-open').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos})
 if(!await evaluate(`document.querySelector('.mood-effects-dialog').open&&document.querySelector('[data-mood-base]').textContent==='90'&&document.querySelector('[data-mood-bonus]').textContent==='+20'`))throw Error('Effects mouse access')
 await evaluate(`document.querySelector('.mood-tiers').open=true`);await capture('comfort-mood-effects-desktop.png')
 if(!await evaluate(`document.querySelector('#wait-open').disabled&&document.querySelector('#bills-open').disabled&&document.querySelector('#missions-open').disabled`))throw Error('Modal guards')
 await closeEffects();await openVenue();await evaluate(`document.querySelector('[data-venue-comfort]').click();document.querySelector('[data-comfort-item="bed-base"]').click();document.querySelector('[data-comfort-confirm]').click()`)
 if((await mood()).base!==90||(await mood()).bonus!==10||(await mood()).displayed!==100)throw Error('Unequip recalculation')
 await evaluate(`document.querySelector('[data-comfort-item="bed-comfort"]').click();document.querySelector('[data-comfort-confirm]').click()`)
 if((await mood()).displayed!==110)throw Error('Re-equip stacked')
 await evaluate(`document.querySelector('[data-comfort-back]').click();document.querySelector('.venue-close').click()`)
 await setBase(140);await evaluate(`document.querySelector('#wait-open').click();document.querySelector('[data-wait-minutes="360"]').click()`)
 if(!await evaluate(`document.querySelector('[data-wait-mood-change]').textContent==='0'&&document.querySelector('[data-wait-mood-preview]').textContent==='140 → 140 / 140'`))throw Error('Capped wait preview')
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture('comfort-mood-wait-mobile.png')
 await evaluate(`document.querySelector('[data-wait-confirm]').click()`);await waitFinished()
 if((await mood()).base!==125||(await mood()).displayed!==140)throw Error('Hidden wait nominal penalty')
 await openVenue();await evaluate(`document.querySelector('[data-service=home-sleep]').click()`)
 if(!await evaluate(`document.querySelector('[data-sleep-mood]').textContent.includes('+0')`))throw Error('Capped sleep preview')
 await evaluate(`document.querySelector('[data-sleep-confirm]').click()`)
 for(let i=0;i<100;i++){await pause(50);if((await state()).sleeping.mode==='closed')break}
 if((await mood()).base!==135||(await mood()).displayed!==140)throw Error('Sleep nominal gain')
 await setBase(130);await openVenue()
 if(!await evaluate(`document.querySelector('[data-service=sleep-on-ground] .venue-other-gains').textContent.includes('-10 humeur')`))throw Error('Ground actual penalty preview')
 await evaluate(`document.querySelector('[data-service=sleep-on-ground]').click()`)
 if((await mood()).base!==110||(await mood()).displayed!==130||!await evaluate(`document.querySelector('#venue-result').textContent.includes('-10 humeur')`))throw Error('Ground actual penalty result')
 await closeVenue();await setBase(119);await openVenue()
 if(!await evaluate(`document.querySelector('[data-service=home-rest] .venue-other-gains').textContent.includes('+1 humeur')`))throw Error('Rest visible gain preview')
 await pause(550);await evaluate(`document.querySelector('[data-service=home-rest]').click()`)
 if((await mood()).base!==122||(await mood()).displayed!==140||!await evaluate(`document.querySelector('#venue-result').textContent.includes('+1 humeur')`))throw Error('Rest actual gain result')
 await closeVenue();await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(1440+1080-c.getGameTime().totalMinutes))`);await setBase(125)
 await pause(550);await openVenue();await evaluate(`document.querySelector('[data-service=home-meals]').click()`);if(!await evaluate(`document.querySelector('.meal-dialog').open`))throw Error('Meal dialog did not open');await evaluate(`document.querySelector('[data-meal=rice]').click()`)
 if(!await evaluate(`document.querySelector('[data-meal-mood]').textContent.includes('+0')`))throw Error('Meal visible preview')
 await evaluate(`document.querySelector('[data-meal-confirm]').click()`)
 if((await mood()).base!==131||(await mood()).displayed!==140||!await evaluate(`document.querySelector('[data-meal-result]').textContent.includes('+0 humeur')`))throw Error('Meal base/visible result '+JSON.stringify(await evaluate(`({mood:JSON.parse(window.render_game_to_text()).moodEffects,meal:JSON.parse(window.render_game_to_text()).meals,result:document.querySelector('[data-meal-result]').textContent,error:document.querySelector('[data-meal-error]').textContent})`)))
 await evaluate(`document.querySelector('[data-meal-cancel]').click();document.querySelector('.venue-close').click()`)
 await reload();if((await mood()).base!==131||(await mood()).displayed!==140)throw Error('Reload mood stacking')
 const saved=await evaluate(`JSON.parse(localStorage.getItem('mboa-player-resources-v1'))`);if(saved.mood!==131)throw Error('Stored displayed mood')
 await openEffects();await capture('comfort-mood-effects-mobile.png')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Effects overflow')
 await capture('comfort-mood-effects-320.png');await closeEffects();await capture('comfort-mood-hud-320.png')
 const rest=await evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/npc-relationships.ts')]).then(([r,m,n])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),consideration:n.getConsideration('bae')}))`)
 if(rest.resources.maxEnergy!==100||rest.resources.ptRespo!==0||rest.resources.karma!==0||rest.money!==19650||rest.consideration!==61)throw Error('Unrelated effects '+JSON.stringify(rest))
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({legacyBonus:true,effectsMouse:true,smiley:true,modalGuards:true,equipNoStack:true,cappedWait:true,nominalSleep:true,actualGroundLoss:true,partialRestGain:true,cappedMeal:true,reloadBase:true,mobile320:true,unchangedOtherStats:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-home-comfort-v1','mboa-npc-relationships-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1','mboa-waiting-v1','mboa-home-meals-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
