// Parcours réel de fatigue : attente, sommeil, capacités, sauvegarde et hôtel.

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
 console.log('Session connectée');await call('Network.enable');await call('Network.setCacheDisabled',{cacheDisabled:true});await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-accompanied-outings-v1');localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.removeItem('mboa-food-bag-v1');localStorage.removeItem('mboa-sport-energy-v1');localStorage.removeItem('mboa-fatigue-v1');localStorage.setItem('mboa-money-v1','50000');localStorage.setItem('mboa-player-zone-v1','home');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}





 const pause=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>evaluate('JSON.parse(window.render_game_to_text())')
 const click=selector=>evaluate(`document.querySelector('${selector}').click()`),check=(v,message)=>{if(!v)throw Error(message)}
 const stats=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts'),import('/src/fatigue.ts')]).then(([r,m,c,f])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes,fatigue:f.getFatigueAt()}))`)
 const advance=n=>evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${n}))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 const sleep=async minutes=>{await click('.places [data-view=home]');await click('[data-service=home-sleep]');await evaluate(`document.querySelector('#sleep-duration').value='${minutes}';document.querySelector('#sleep-duration').dispatchEvent(new Event('input'))`)}
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 check((await stats()).fatigue.minutes===0,'Legacy grace');const initialMoney=(await stats()).money;await advance(1070);await click('#wait-open');await click('[data-wait-minutes="10"]');check(await evaluate(`document.querySelector('.wait-dialog .wait-neutral').textContent.includes('100 → 90 / 90')`),'Wait threshold projection');await capture('fatigue-wait-threshold.png');await click('[data-wait-confirm]');await pause(1000);let s=await stats();check(s.fatigue.minutes===1080&&s.resources.maxEnergy===90&&s.resources.energy===90,'18h threshold');check(s.money===initialMoney,'Hidden financial penalty');await reload();check((await stats()).fatigue.minutes===1080&&(await stats()).resources.energy===90,'Saved fatigue reset/stack')
 await pause(300);await click('#energy-effects-open');await call('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});await pause(100);await capture('fatigue-detail-320.png');check(await evaluate(`document.querySelector('[data-fatigue-detail]').textContent.includes('18 h')`),'Fatigue detail');check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Overflow');await click('[data-sport-back]');await sleep(30);let p=(await state()).sleeping.preview;check(p.fatigueAfter.minutes===1020&&p.maxEnergyAfter===100&&p.energyAfter===96,'Nap projection');await capture('fatigue-nap-320.png');await click('[data-sleep-confirm]');await pause(1000);s=await stats();check(s.fatigue.minutes===1020&&s.resources.energy===96&&s.resources.maxEnergy===100,'Nap2for1/no free refill')
 await advance(420);check((await stats()).fatigue.penalty===20&&(await stats()).resources.maxEnergy===80,'24h threshold');await evaluate(`import('/src/player-resources.ts').then(r=>{r.changeRespoPoints(1330);r.restoreEnergy(100)})`);check((await stats()).resources.maxEnergy===96,'Level fatigue application');await evaluate(`import('/src/sport-energy.ts').then(s=>s.grantSportEffect())`);check((await stats()).resources.maxEnergy===106,'Sport additive after penalty');await advance(360);s=await stats();check(s.fatigue.minutes===1800&&s.resources.maxEnergy===84&&s.resources.energy===84,'30h/sport expiry');await sleep(480);p=(await state()).sleeping.preview;check(p.fatigueAfter.minutes===840&&p.maxEnergyAfter===120&&p.energyAfter===120,'Full sleep projection');await capture('fatigue-full-night-320.png');await click('[data-sleep-confirm]');await pause(1000);s=await stats();check(s.fatigue.minutes===840&&s.resources.energy===120&&s.resources.maxEnergy===120,'Full sleep wake');const stable=s.fatigue.minutes;await pause(400);check((await stats()).fatigue.minutes===stable,'Real-time fatigue advanced')
 await click('.places [data-view=home]');await click('[data-service=sleep-on-ground]');s=await stats();check(s.fatigue.minutes===360&&s.resources.energy===120,'Ground sleep recovery');check(s.resources.mood===80,'Ground mood penalty changed');await click('.venue-close');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});await click('.places [data-view=pilton]');await click('[data-travel-mode=yonga]');await evaluate('window.__MBOA_QA__.advanceJourney(120)');await pause(100);const arrived=await stats();check(arrived.fatigue.minutes>360,'Travel did not accrue');await click('[data-service=hotel-rest]');check((await stats()).fatigue.minutes===arrived.fatigue.minutes+60,'Short rest incorrectly sleeps');await pause(1000);await click('[data-service=hotel-night]');await pause(1000);s=await stats();check(s.fatigue.minutes===0&&s.resources.energy===120,'Hotel true sleep');check(s.money===arrived.money-6000,'Hotel/fatigue money');await reload();check((await stats()).fatigue.minutes===0,'Saved sleep failed')
 if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({legacyGrace:true,waitPreviewAnd18:true,persistence:true,nap2for1:true,thresholds24and30:true,levelAndSport:true,fullWake120:true,noRealTime:true,groundMood:true,travelAwake:true,shortRestAwake:true,hotelSleep:true,noFinancialPenalty:true,mobile320:true,errors},null,2));await writeFile(path.join(out,'fatigue-browser-state.json'),JSON.stringify(await state(),null,2))
 await evaluate(`for(const key of ['mboa-fatigue-v1','mboa-sport-energy-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1','mboa-waiting-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}





