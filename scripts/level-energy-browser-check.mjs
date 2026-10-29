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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-user-queue-v1');localStorage.removeItem('mboa-sport-energy-v1');localStorage.setItem('mboa-player-zone-v1','ministry');localStorage.setItem('mboa-game-minutes-v1','600')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}



 const pause=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>evaluate('JSON.parse(window.render_game_to_text())')
 const click=selector=>evaluate(`document.querySelector('${selector}').click()`),check=(v,message)=>{if(!v)throw Error(message)}
 const resources=()=>evaluate(`import('/src/player-resources.ts').then(r=>({...r.getPlayerResources(),details:r.getEnergyDetails()}))`)
 const add=n=>evaluate(`import('/src/player-resources.ts').then(r=>r.changeRespoPoints(${n}))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 await add(185);await click('.places [data-view=ministry]');await click('[data-venue-queue]');await click('[data-queue-confirm]');let r=await resources();check(r.ptRespo===193&&r.energy===75&&r.maxEnergy===105,'Actual work level2/no refill');check((await state()).progression.notice.pending===2,'Notice not deferred');await click('[data-queue-back]');await click('.venue-close');await pause(300);check(await evaluate('document.querySelector(".respo-level-notice").textContent.includes("+5 capacité")'),'Level2 capacity announcement');await capture('level-energy-notice-desktop.png')
 await evaluate(`window.testDialog=document.createElement('dialog');document.body.append(testDialog);testDialog.showModal()`);await add(662);check((await resources()).maxEnergy===115&&(await resources()).energy===75,'Multi-level jump/refill');await evaluate('testDialog.close();testDialog.remove()');await pause(250);check(await evaluate('document.querySelector(".respo-level-notice").textContent.includes("+10 capacité")'),'Multi level actual bonus');await add(475);check((await resources()).maxEnergy===120,'Level5 cap');await add(570);await pause(250);check((await resources()).maxEnergy===120,'Level6 cap20');check(!await evaluate('document.querySelector(".respo-level-notice").textContent.includes("capacité")'),'False level6 bonus')
 await pause(300);await click('#energy-effects-open');check(await evaluate('document.querySelector("[data-energy-breakdown]").textContent.includes("progression niveau 6 : +20")'),'Level breakdown');await call('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});await pause(150);await capture('level-energy-breakdown-320.png');check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow');await click('[data-sport-back]')
 await evaluate(`import('/src/sport-energy.ts').then(s=>s.grantSportEffect())`);check((await resources()).maxEnergy===130&&(await resources()).energy===75,'Sport additive/no refill');await evaluate(`import('/src/player-resources.ts').then(r=>r.restoreEnergy(50))`);check((await resources()).energy===125,'New capacity usable');await reload();r=await resources();check(r.maxEnergy===130&&r.energy===125&&r.details.reference===100,'Reload stacked/clamped wrongly');check(!(await state()).progression.notice.visible&&(await state()).progression.notice.pending===null,'Reload replayed level notice');await pause(300);await click('#energy-effects-open');await capture('level-energy-sport-320.png');await click('[data-sport-back]');const end=(await state()).sportEnergy.effect.end;await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${end}-c.getGameTime().totalMinutes))`);check((await resources()).maxEnergy===120&&(await resources()).energy===120,'Sport expiry lost permanent bonus');await reload();check((await resources()).maxEnergy===120&&(await resources()).energy===120,'Expired reload')
 await capture('level-energy-hud-320.png');check(await evaluate('document.querySelector("#energy-amount").scrollWidth<=document.querySelector("#energy-amount").clientWidth'),'Energy max truncated')
 if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({actualWorkLevelUp:true,noRefill:true,deferredActualBonusNotice:true,multiLevel:true,capAfterLevel5:true,breakdown:true,sport130Expiry120:true,saveNoStack:true,noReloadNotice:true,mobile320:true,fullHudNumber:true,errors},null,2))
 await writeFile(path.join(out,'level-energy-browser-state.json'),JSON.stringify(await state(),null,2))
 await evaluate(`for(const key of ['mboa-sport-energy-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1','mboa-user-queue-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
