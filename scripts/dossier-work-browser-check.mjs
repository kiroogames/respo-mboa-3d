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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1'])localStorage.removeItem(key);localStorage.setItem('mboa-player-zone-v1','ministry');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}

 const state=()=>evaluate(`JSON.parse(window.render_game_to_text())`)
 const counters=()=>evaluate(`({money:document.querySelector('#money-amount').textContent,energy:document.querySelector('#energy-amount').textContent,respo:document.querySelector('#respo-amount').textContent,time:document.querySelector('#game-time').textContent})`)
 const openWork=async()=>{await evaluate(`document.querySelector('.places [data-view=ministry]').click();document.querySelector('[data-venue-work]').click()`)}
 function solve(board){
  const solution=[board.start],seen=new Set(solution)
  function visit(cell){if(cell===board.goal)return board.visas.every(v=>seen.has(v));const x=cell%board.size,y=Math.floor(cell/board.size);for(const next of [x>0?cell-1:-1,x<board.size-1?cell+1:-1,y>0?cell-board.size:-1,y<board.size-1?cell+board.size:-1]){if(next<0||seen.has(next)||board.blocked.includes(next))continue;const forced=(board.arrows??[]).find(arrow=>arrow.cell===cell);if(forced&&next!==cell+({up:-board.size,right:1,down:board.size,left:-1}[forced.direction]))continue;seen.add(next);solution.push(next);if(visit(next))return true;solution.pop();seen.delete(next)}return false}
  if(!visit(board.start))throw Error('Unsolvable visible board');return solution
 }
 async function center(cell){return evaluate(`(()=>{const r=document.querySelector('[data-work-cell="${cell}"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)}
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 await openWork();await capture('dossier-pile-desktop.png')
 await evaluate(`document.querySelector('[data-dossier-index="0"]').click()`)
 let work=(await state()).work,board=work.board,solution=solve(board)
 await evaluate(`document.querySelector('[data-work-cell="${board.goal}"]').click()`)
 if((await state()).work.path.length!==1)throw Error('Illegal jump accepted')
 if(!await evaluate(`document.querySelector('[data-work-feedback]').classList.contains('puzzle-warning')`))throw Error('Illegal move lacks feedback')
 for(let i=1;i<3;i++){
  const delta=solution[i]-solution[i-1],key=delta===1?'ArrowRight':delta===-1?'ArrowLeft':delta===board.size?'ArrowDown':'ArrowUp'
  await call('Input.dispatchKeyEvent',{type:'keyDown',key});await call('Input.dispatchKeyEvent',{type:'keyUp',key})
 }
 if((await state()).work.path.length!==3)throw Error('Keyboard route failed')
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace'})
 if((await state()).work.path.length!==2)throw Error('Keyboard undo failed')
 await evaluate(`document.querySelector('[data-work-close]').click()`)

 if((await counters()).money!=='0'||(await counters()).time!=='08:00')throw Error('Cancel charged resources')
 await openWork();await evaluate(`document.querySelector('[data-dossier-index="0"]').click()`)
 if(JSON.stringify((await state()).work.board)!==JSON.stringify(board))throw Error('Reopening rerolled puzzle')
 if((await state()).work.path.length!==2)throw Error('Draft was not resumed')
 await evaluate(`document.querySelector('[data-work-reset]').click()`)

 let p=await center(board.start)
 await call('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...p})
 for(const cell of solution.slice(1)){p=await center(cell);await call('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,...p})}
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...p})
 if(await evaluate(`document.querySelector('[data-work-confirm]').disabled`))throw Error('Mouse route did not unlock validation')
 if((await counters()).money!=='0'||(await counters()).energy!=='100 / 100')throw Error('Puzzle tracing charged resources')
 await capture('dossier-puzzle-desktop.png')
 await evaluate(`document.querySelector('[data-work-confirm]').click();document.querySelector('[data-work-confirm]').dispatchEvent(new Event('click'))`)
 let paid=await counters()
 if(paid.money!=='500'||paid.energy!=='80 / 100'||paid.respo!=='5 / 190'||paid.time!=='09:00')throw Error(JSON.stringify(paid))
 await capture('dossier-receipt-desktop.png')
 await evaluate(`document.querySelector('.dossier-next').click()`)
 if(!await evaluate(`document.querySelector('[data-dossier-index="0"]').disabled`))throw Error('Completed dossier enabled')
 await reload();await openWork()
 if(!await evaluate(`document.querySelector('[data-dossier-index="0"]').disabled`))throw Error('Reload allowed repeat payment')
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1})
 await evaluate(`document.querySelector('[data-dossier-index="1"]').click();document.querySelector('[data-work-grid]').scrollIntoView({block:'center'})`)
 work=(await state()).work;board=work.board;solution=solve(board);p=await center(board.start)
 await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]})
 const turns=solution.filter((cell,index)=>index>0&&(index===solution.length-1||cell-solution[index-1]!==solution[index+1]-cell))
 for(const cell of turns){p=await center(cell);await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]})}
 await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
 if(await evaluate(`document.querySelector('[data-work-confirm]').disabled`))throw Error('Touch route did not unlock validation')
 if((await state()).work.path.length!==solution.length)throw Error('Fast drag skipped cells')
 await capture('dossier-puzzle-mobile.png')
 await evaluate(`document.querySelector('[data-work-confirm]').click()`)
 paid=await counters();if(paid.money!=='1 000'||paid.energy!=='60 / 100'||paid.respo!=='10 / 190'||paid.time!=='10:00')throw Error(JSON.stringify(paid))
 if(!await evaluate(`parseFloat(getComputedStyle(document.querySelector('.dossier-reward')).fontSize)>=30&&document.querySelector('.dossier-reward img').complete`))throw Error('Reward not visually prominent')
 await capture('dossier-receipt-mobile.png')
 await evaluate(`document.querySelector('.dossier-next').click()`)
 if((await state()).work.remaining!==5)throw Error('New pile did not replace old one at 10:00')
 await evaluate(`document.querySelector('[data-dossier-index="4"]').click();document.querySelector('[data-work-grid]').scrollIntoView({block:'center'})`)
 work=(await state()).work;board=work.board;solution=solve(board)
 if(board.arrows.length!==3||!await evaluate(`document.querySelector('[data-work-level]').textContent==='Dossier sensible'`))throw Error('Difficulty did not increase')
 let directionFeedback=false
 for(const arrow of board.arrows){
  const index=solution.indexOf(arrow.cell);if(index<0)continue
  const prefix=solution.slice(0,index+1),x=arrow.cell%board.size,y=Math.floor(arrow.cell/board.size)
  const forced=arrow.cell+({up:-board.size,right:1,down:board.size,left:-1}[arrow.direction])
  const wrong=[x>0?arrow.cell-1:-1,x<board.size-1?arrow.cell+1:-1,y>0?arrow.cell-board.size:-1,y<board.size-1?arrow.cell+board.size:-1].find(cell=>cell>=0&&!board.blocked.includes(cell)&&!prefix.includes(cell)&&cell!==forced)
  if(wrong===undefined)continue
  await evaluate(`document.querySelector('[data-work-reset]').click()`)
  for(const cell of prefix.slice(1))await evaluate(`document.querySelector('[data-work-cell="${cell}"]').click()`)
  await evaluate(`document.querySelector('[data-work-cell="${wrong}"]').click()`)
  if((await state()).work.path.length!==prefix.length||!await evaluate(`document.querySelector('[data-work-feedback]').textContent.includes('impose')`))throw Error('Wrong exit accepted')
  directionFeedback=true;break
 }
 await evaluate(`document.querySelector('[data-work-reset]').click()`)
 for(const cell of solution.slice(1))await evaluate(`document.querySelector('[data-work-cell="${cell}"]').click()`)
 if(await evaluate(`document.querySelector('[data-work-confirm]').disabled`))throw Error('Directed puzzle could not be solved')
 await capture('dossier-puzzle-complex-mobile.png')
 await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(180))`)

 if((await state()).work.mode!=='list')throw Error('Expired puzzle did not return to new pile')
 await evaluate(`document.querySelector('[data-work-confirm]').dispatchEvent(new Event('click'))`)
 if((await counters()).money!=='1 000')throw Error('Expired puzzle paid')
 await evaluate(`import('/src/player-resources.ts').then(r=>r.spendEnergy(r.getPlayerResources().energy));document.querySelector('[data-work-close]').click()`)
 await openWork()
 if(!await evaluate(`document.querySelector('[data-work-notice]').textContent.includes('Énergie insuffisante')&&Array.from(document.querySelectorAll('[data-dossier-index]')).every(button=>button.disabled)`))throw Error('Insufficient energy guard failed')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true})
 if(await evaluate('document.documentElement.scrollWidth>innerWidth'))throw Error('320px layout overflow')
 await capture('dossier-insufficient-mobile.png')
 await evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(5*1440+540-c.getGameTime().totalMinutes))`)
 if(!await evaluate(`document.querySelector('[data-work-notice]').textContent.includes('lundi au vendredi')`))throw Error('Weekend work enabled')
 if(errors.length)throw Error(JSON.stringify(errors))
 console.log(JSON.stringify({mouse:true,touch:true,keyboard:true,draftResumed:true,undo:true,fastSwipes:true,directedPuzzle:true,directionFeedback,cancelFree:true,payoutOnce:true,reloadProtected:true,refill:true,staleRejected:true,energyGuard:true,weekend:true,mobile320:true,paid,errors},null,2))
 await evaluate(`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}

