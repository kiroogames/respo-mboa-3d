// Parcours navigateur de Bae : présence, dialogue, acceptation, paiement et GPS distant.
// Chrome utilise le profil de test dans artifacts ; les sauvegardes nettoyées appartiennent à ce profil.

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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1'])localStorage.removeItem(key)`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}

 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await evaluate(`document.querySelector('.places [data-view=home]').click()`)
 const initial=await evaluate(`({place:document.querySelector('#venue-place-tab').getAttribute('aria-selected'),count:document.querySelector('#venue-people-count').textContent,services:document.querySelectorAll('#venue-services [data-service]').length})`)
 if(initial.place!=='true'||initial.count!=='0'||initial.services<3)throw Error(JSON.stringify(initial))
 await evaluate(`document.querySelector('#venue-people-tab').click()`)
 if(!await evaluate(`document.querySelector('#venue-place-panel').hidden&&!document.querySelector('[data-resident=bae]')`))throw Error('Unavailable residents leaked into tab')
 await capture('venue-people-empty-mobile.png')
 await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(450))`)
 const available=await evaluate(`({count:document.querySelector('#venue-people-count').textContent,name:document.querySelector('[data-resident=bae] h3')?.textContent,personActions:document.querySelectorAll('[data-npc-service]').length,consideration:document.querySelector('.npc-consideration strong')?.textContent})`)
 if(available.count!=='1'||available.personActions!==4||available.consideration!=='50 %')throw Error(JSON.stringify(available))
 if(!await evaluate(`!document.querySelector('.npc-request-badge').hidden`))throw Error('Local request marker missing')
 await evaluate(`document.querySelector('.venue-close').click()`)
 await capture('bae-separate-gps.png')
 if(!await evaluate(`(()=>{const bae=document.querySelector('[data-npc=bae]'),hero=document.querySelector('.player-pin:not(.npc-pin)');return !hero.hidden&&!bae.hidden&&Math.abs(parseFloat(bae.style.left)-parseFloat(hero.style.left))>=60&&!bae.classList.contains('shared-home')&&hero.getBoundingClientRect().left>document.querySelector('.resource-stats').getBoundingClientRect().right})()`))throw Error('Bae and hero GPS overlap')
 await evaluate(`document.querySelector('[data-npc=bae]').click()`)
 await capture('bae-menu-mobile.png')
 await evaluate(`document.querySelector('#venue-people-tab').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))`)
 if(!await evaluate(`document.querySelector('#venue-place-tab').getAttribute('aria-selected')==='true'&&document.activeElement.id==='venue-place-tab'`))throw Error('Keyboard tabs failed')
 await capture('venue-place-tab-mobile.png')
 await evaluate(`document.querySelector('#venue-people-tab').click();document.querySelector('[data-npc-service=talk]').click()`)
 if(!await evaluate(`document.querySelector('.npc-dialogue-dialog').open&&document.querySelectorAll('#npc-conversation-actions button').length===4`))throw Error('Conversation topics missing')
 await evaluate(`document.querySelectorAll('#npc-conversation-actions button')[2].click()`)
 for(let i=0;i<3;i++)await evaluate(`document.querySelector('#npc-conversation-actions button').click()`)
 if(!await evaluate(`document.querySelectorAll('#npc-conversation-actions button').length===4&&document.querySelector('#npc-conversation-text').dataset.source==='Message1_2_32'`))throw Error('Original dialogue responses missing')
 await capture('bae-conversation-mobile.png')
 await evaluate(`document.querySelector('#npc-conversation-actions button').click()`)
 if(!await evaluate(`document.querySelector('#npc-conversation-text').dataset.source==='Message1_2_33'`))throw Error('Wrong response branch')
 await evaluate(`document.querySelector('.npc-dialogue-dialog .travel-cancel').click();document.querySelector('[data-npc-service="request:kitchen"]').click()`)
 for(let i=0;i<4;i++)await evaluate(`document.querySelector('#npc-conversation-actions button').click()`)
 await evaluate(`document.querySelector('#npc-conversation-actions button').click()`)
 if(!await evaluate(`JSON.parse(localStorage.getItem('mboa-npc-relationships-v1')).accepted.includes('kitchen')`))throw Error('Request not saved')
 if(!await evaluate(`document.querySelector('[data-pay-improvement=kitchen]').disabled&&localStorage.getItem('mboa-money-v1')===null`))throw Error('Unfunded renovation enabled or acceptance charged money')
 await capture('bae-request-mobile.png')
 await evaluate(`import('/src/currency.ts').then(c=>c.addMoney(7000))`)
 await evaluate(`document.querySelector('.npc-dialogue-dialog .travel-cancel').click();document.querySelector('[data-npc-service="request:kitchen"]').click()`)
 for(let i=0;i<4;i++)await evaluate(`document.querySelector('#npc-conversation-actions button').click()`)
 await evaluate(`document.querySelector('[data-pay-improvement=kitchen]').click()`)
 if(!await evaluate(`localStorage.getItem('mboa-money-v1')==='0'&&JSON.parse(localStorage.getItem('mboa-npc-relationships-v1')).completed.includes('kitchen')`))throw Error('Paid renovation failed')
 await evaluate(`document.querySelector('.npc-dialogue-dialog .travel-cancel').click()`)
 if(!await evaluate(`!document.querySelector('[data-npc-service="request:kitchen"]')&&document.querySelector('.npc-improvement-done')?.textContent.includes('cuisine')`))throw Error('Paid renovation status missing')
 await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(990))`)
 if(!await evaluate(`document.querySelector('#venue-people-count').textContent==='0'&&!document.querySelector('[data-resident=bae]')&&document.querySelector('.npc-request-badge').hidden`))throw Error('Schedule not enforced')
 await evaluate(`document.querySelector('.venue-close').click();localStorage.setItem('mboa-player-zone-v1','square');localStorage.setItem('mboa-game-minutes-v1','930')`);await call('Page.reload')
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));if(await evaluate('document.documentElement.dataset.ready === "true"'))break}
 if(!await evaluate(`!document.querySelector('.npc-request-badge').hidden`))throw Error('Remote navigation notification missing')
 await evaluate(`document.querySelector('[data-npc=bae]').click()` )
 if(!await evaluate(`!document.querySelector('.venue-dialog').open&&!document.querySelector('.npc-dialogue-dialog').open`))throw Error('Remote NPC offers accessible')
 await capture('bae-navigation-notification.png')
 const dialogue={topics:4,originalChoices:4,acceptedRequest:true,schedule:true}
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('Mobile overflow')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({initial,available,dialogue,keyboard:true,schedule:true,errors},null,2))
 await evaluate(`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}

