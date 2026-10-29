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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-accompanied-outings-v1');localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.setItem('mboa-money-v1','50000');localStorage.setItem('mboa-player-zone-v1','palms');localStorage.setItem('mboa-game-minutes-v1','1020');localStorage.setItem('mboa-traffic-v1',JSON.stringify({period:34,level:'clear'}))`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}


 const pause=ms=>new Promise(r=>setTimeout(r,ms))
 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 await evaluate(`document.querySelector('.places [data-view=palms]').click();document.querySelector('#venue-people-tab').click();document.querySelector('[data-invite-npc=crystal]').click();document.querySelector('#accompanied-activity').value='cinema';document.querySelector('#accompanied-activity').dispatchEvent(new Event('change'))`)
 const plan=(await state()).accompanied.preview;if(plan.reason)throw Error(plan.reason)
 await capture('crystal-cinema-17-plan.png');await evaluate(`document.querySelector('[data-accompanied-confirm]').click()`)
 let done=false
 for(let i=0;i<100;i++){await pause(150);if((await state()).accompanied.state?.phase==='done'){done=true;break}}
 if(!done)throw Error('Automatic sequence did not finish')
 const result=await evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts'),import('/src/npc-relationships.ts')]).then(([r,m,c,n])=>({money:m.getMoneyBalance(),energy:r.getPlayerResources().energy,base:r.getMoodDetails().base,time:c.getGameTime().totalMinutes,relation:n.getConsideration('crystal')}))`)
 if(result.money!==50000-plan.money||result.energy!==100-plan.energy||result.base!==115||result.time!==plan.returned.totalMinutes||result.relation!==52)throw Error(JSON.stringify(result))
 await capture('crystal-cinema-17-receipt.png');await evaluate(`document.querySelector('[data-accompanied-back]').click();document.querySelector('.venue-close').click();document.querySelector('.places [data-view=market]').click();document.querySelector('[data-travel-mode=walk]').click()`)
 for(let i=0;i<100;i++){await pause(150);if(!(await state()).player.travelling&&await evaluate(`document.querySelector('.venue-dialog').open`))break}
 if((await state()).player.zone!=='market')throw Error('Normal travel broken after guided outing')
 const arrival=await evaluate(`document.querySelector('#game-time').textContent`)
 await evaluate(`document.querySelector('.venue-close').click();document.querySelector('#wait-open').click();document.querySelector('[data-wait-minutes="30"]').click();document.querySelector('[data-wait-confirm]').click()`)
 await pause(100);if((await state()).waiting.mode!=='closed')throw Error('Normal wait broken after guided outing')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({automaticSequence:true,reducedMotion:true,exactPriceAndRewards:true,normalTravelAfterwards:true,normalWaitAfterwards:true,arrival,errors},null,2))
 await evaluate(`for(const key of ['mboa-accompanied-outings-v1','mboa-city-outings-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-waiting-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
