// Parcours multi-horaires : départ d’un PNJ, trajet, déjeuner, vendredi au Njoka et week-end.
// Les avances passent par le calendrier du jeu pour vérifier le même comportement que les actions du joueur.

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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1'])localStorage.removeItem(key);localStorage.setItem('mboa-player-zone-v1','ministry');localStorage.setItem('mboa-game-minutes-v1','630')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}

 const snapshot=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const advance=minutes=>evaluate(`import('/src/game-clock.ts').then(clock=>clock.advanceGameTime(${minutes}))`)
 const waitFrame=()=>evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await evaluate(`document.querySelector('.places [data-view=ministry]').click();document.querySelector('#venue-people-tab').click()`)
 if(!await evaluate(`document.querySelector('#venue-people-count').textContent==='8'`))throw Error('Morning staff missing')
 await evaluate(`document.querySelector('[data-person=elanga][data-npc-service=talk]').click();document.querySelector('#npc-conversation-actions button').click()`)
 await advance(120);await waitFrame()
 if(!await evaluate(`!document.querySelector('.npc-dialogue-dialog').open`))throw Error('Conversation continued after NPC departure')
 const departing=(await snapshot()).npcs.find(npc=>npc.id==='elanga')
 if(departing.zone!==null||!departing.travelling||departing.available)throw Error('Wrong commute state')
 await advance(15);await waitFrame()
 const midpoint=(await snapshot()).npcs.find(npc=>npc.id==='elanga')
 if(Math.hypot(midpoint.position[0]-departing.position[0],midpoint.position[2]-departing.position[2])<1)throw Error('GPS did not move along route')
 const pins=await evaluate(`Array.from(document.querySelectorAll('.player-pin')).filter(pin=>!pin.hidden).map(pin=>pin.getBoundingClientRect().toJSON())`)
 for(let i=0;i<pins.length;i++)for(let j=i+1;j<pins.length;j++)if(Math.min(pins[i].right,pins[j].right)>Math.max(pins[i].left,pins[j].left)&&Math.min(pins[i].bottom,pins[j].bottom)>Math.max(pins[i].top,pins[j].top))throw Error('Moving GPS overlap')
 await capture('npc-commute-mobile.png')
 await advance(45);await waitFrame()
 const lunch=await snapshot()
 if(lunch.npcs.find(npc=>npc.id==='elanga').zone!=='pilton'||lunch.npcs.find(npc=>npc.id==='anneke').zone!=='ministry')throw Error('Rank-based lunchtime positions wrong')
 await evaluate(`document.querySelector('.places [data-view=ministry]').click();document.querySelector('#venue-people-tab').click()`)
 if(await evaluate(`!!document.querySelector('[data-resident=elanga]')`))throw Error('NPC duplicated in old venue')
 await evaluate(`document.querySelector('.venue-close').click();localStorage.setItem('mboa-player-zone-v1','pilton')`);await call('Page.reload')
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));if(await evaluate('document.documentElement.dataset.ready === "true"'))break}
 await evaluate(`document.querySelector('.places [data-view=pilton]').click();document.querySelector('#venue-people-tab').click();document.querySelector('[data-resident=elanga] .npc-agenda').open=true`)
 if(!await evaluate(`document.querySelectorAll('[data-resident]').length===3&&document.querySelector('[data-resident=elanga] .npc-agenda').textContent.includes('Yonga')`))throw Error('Lunch venue or agenda wrong')
 await capture('npc-lunch-agenda-mobile.png')
 await evaluate(`document.querySelector('[data-person=elanga][data-npc-service=talk]').click()`)
 await advance(30)
 if(!await evaluate(`!document.querySelector('.npc-dialogue-dialog').open`))throw Error('Lunch conversation did not close on departure')
 await advance(4*1440+1140-840)
 await evaluate(`localStorage.setItem('mboa-player-zone-v1','njoka')`);await call('Page.reload')
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));if(await evaluate('document.documentElement.dataset.ready === "true"'))break}
 await evaluate(`document.querySelector('.places [data-view=njoka]').click();document.querySelector('#venue-people-tab').click()`)
 const friday=await evaluate(`Array.from(document.querySelectorAll('[data-resident]')).map(card=>card.dataset.resident)`)
 if(friday.sort().join(',')!=='crystal,hector,sidonie')throw Error('Friday outings incorrect '+friday)
 await capture('npc-friday-njoka-mobile.png')
 await advance(930)
 if(!await evaluate(`document.querySelector('#venue-people-count').textContent==='0'`))throw Error('Weekend residents did not leave')
 if(!await evaluate(`import('/src/npcs.ts').then(npcs=>npcs.getNPCsAtZone('ministry').length===0)`))throw Error('Ministry open on weekend')
 const clock=await evaluate(`document.querySelector('#game-time').textContent`)
 await new Promise(resolve=>setTimeout(resolve,1000))
 if(await evaluate(`document.querySelector('#game-time').textContent`)!==clock)throw Error('Clock advanced without event')
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Mobile overflow')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({commuteGPS:true,conversationDepartureGuard:true,lunchPositions:true,agenda:true,friday,weekend:true,eventClock:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}

