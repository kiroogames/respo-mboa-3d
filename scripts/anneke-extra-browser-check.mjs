// Réunions MINFI : parcours réel du menu, horaires, progression et sauvegarde.

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
 console.log('Session connectée');await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1557,height:831,deviceScaleFactor:1,mobile:false});const initialization=await call('Page.addScriptToEvaluateOnNewDocument',{source:`for(const key of ['mboa-game-minutes-v1','mboa-money-v1','mboa-player-resources-v1','mboa-player-zone-v1','mboa-traffic-v1','mboa-npc-relationships-v1','mboa-npc-consideration-v1','mboa-dossier-work-v1','mboa-dossier-draft-v1','mboa-waiting-v1'])localStorage.removeItem(key);localStorage.removeItem('mboa-accompanied-outings-v1');localStorage.removeItem('mboa-city-outings-v1');localStorage.removeItem('mboa-home-comfort-v1');localStorage.removeItem('mboa-food-bag-v1');localStorage.removeItem('mboa-minfi-meetings-v1');localStorage.removeItem('mboa-anneke-extra-v1');localStorage.removeItem('mboa-anneke-extra-draft-v1');localStorage.setItem('mboa-money-v1','50000');localStorage.setItem('mboa-player-zone-v1','ministry');localStorage.setItem('mboa-game-minutes-v1','480')`});await call('Page.navigate',{url:'http://127.0.0.1:5174/'})
 let ready=false
 for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,500));ready=await evaluate('document.documentElement.dataset.ready === "true"');if(ready)break;if(errors.length || await evaluate('!!document.querySelector("#retry")'))break}

 if(!ready)throw Error('City did not load')
 await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialization.identifier})
 const capture=async(name)=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(shot.data,'base64'))}




 function solve(board){
  const solution=[board.start],seen=new Set(solution)
  function visit(cell){if(cell===board.goal)return board.visas.every(v=>seen.has(v));const x=cell%board.size,y=Math.floor(cell/board.size);for(const next of [x>0?cell-1:-1,x<board.size-1?cell+1:-1,y>0?cell-board.size:-1,y<board.size-1?cell+board.size:-1]){if(next<0||seen.has(next)||board.blocked.includes(next))continue;const forced=(board.arrows??[]).find(arrow=>arrow.cell===cell);if(forced&&next!==cell+({up:-board.size,right:1,down:board.size,left:-1}[forced.direction]))continue;seen.add(next);solution.push(next);if(visit(next))return true;solution.pop();seen.delete(next)}return false}
  if(!visit(board.start))throw Error('Unsolvable visible board');return solution
 }

 const pause=ms=>new Promise(r=>setTimeout(r,ms)),state=()=>evaluate('JSON.parse(window.render_game_to_text())')
 const click=async selector=>{if(!await evaluate(`!!document.querySelector('${selector}')`))throw Error('Missing selector '+selector);return evaluate(`document.querySelector('${selector}').click()`)},check=(ok,message)=>{if(!ok)throw Error(message)}
 const stats=()=>evaluate(`Promise.all([import('/src/player-resources.ts'),import('/src/currency.ts'),import('/src/game-clock.ts')]).then(([r,m,c])=>({resources:r.getPlayerResources(),money:m.getMoneyBalance(),time:c.getGameTime().totalMinutes}))`)
 const clock=total=>evaluate(`import('/src/game-clock.ts').then(c=>c.advanceGameTime(${total}-c.getGameTime().totalMinutes))`)
 async function reload(){await call('Page.reload');for(let i=0;i<120;i++){await pause(500);if(await evaluate('document.documentElement.dataset.ready === "true"'))return}throw Error('Reload failed')}
 const puzzle=()=>'.extra-puzzle-dialog '
 const openExtra=async()=>{await click('.places [data-view=ministry]');await click('[data-venue-extra]')}
 const startPuzzle=async()=>{await openExtra();await click('[data-extra-confirm]');const index=(await state()).extra.state.order.index;await click(puzzle()+'[data-dossier-index="'+index+'"]')}
 // Le brouillon ordinaire doit survivre à toutes les commandes extra.
 await evaluate(`localStorage.setItem('mboa-dossier-draft-v1',JSON.stringify({version:2,batch:'ordinary-sentinel',index:0,path:[0]}))`)
 await click('.places [data-view=ministry]');await click('#venue-people-tab');check(await evaluate(`!!document.querySelector('[data-resident=anneke] [data-anneke-extra]')`),'Missing giver entry');await click('[data-anneke-extra]');const before=await stats()
 for(const i of [0,1,2]){await click('[data-extra-choice="'+i+'"]');check((await state()).extra.preview.index===i,'Missing command choice')}
 await capture('anneke-extra-offers-desktop.png');await click('[data-extra-back]');check(JSON.stringify(await stats())===JSON.stringify(before),'Offer cancel charged');await click('[data-anneke-extra]');await click('[data-extra-choice="1"]');await evaluate(`document.querySelector('[data-extra-confirm]').click();document.querySelector('[data-extra-confirm]').click()`);check((await state()).extra.state.order.index===1,'Acceptance did not preserve selection');check(JSON.stringify(await stats())===JSON.stringify(before),'Acceptance charged');await click('[data-extra-back]');await click('.venue-close');await reload();check((await state()).extra.state.order.index===1,'Accepted reload lost order')
 await openExtra();check((await state()).extra.preview.reason.includes('18h'),'Daytime work accepted');await click('[data-extra-back]');await click('.venue-close');await clock(1080);await startPuzzle();let current=(await state()).extra.puzzle,board=current.board,solution=solve(board);check(current.mode==='puzzle','Puzzle did not open');check(JSON.stringify(await stats())===JSON.stringify({...before,time:1080}),'Start charged')
 await click(puzzle()+'[data-work-cell="'+board.goal+'"]');check((await state()).extra.puzzle.path.length===1,'Illegal jump accepted')
 for(let i=1;i<=2;i++){const delta=solution[i]-solution[i-1],key=delta===1?'ArrowRight':delta===-1?'ArrowLeft':delta===board.size?'ArrowDown':'ArrowUp';await call('Input.dispatchKeyEvent',{type:'keyDown',key});await call('Input.dispatchKeyEvent',{type:'keyUp',key})}
 check((await state()).extra.puzzle.path.length===3,'Keyboard moves failed');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace'});check((await state()).extra.puzzle.path.length===2,'Undo failed');await capture('anneke-extra-puzzle-desktop.png')
 await click(puzzle()+'[data-work-leave]');check(JSON.stringify(await stats())===JSON.stringify({...before,time:1080}),'Abandon charged');await click('.venue-close');await reload();await startPuzzle();check((await state()).extra.puzzle.path.length===2,'Saved path not resumed');check(JSON.stringify((await state()).extra.puzzle.board)===JSON.stringify(board),'Puzzle changed on reload')
 await click(puzzle()+'[data-work-reset]');check((await state()).extra.puzzle.path.length===1,'Reset failed');for(const cell of solution.slice(1))await click(puzzle()+'[data-work-cell="'+cell+'"]');check(!await evaluate(`document.querySelector('.extra-puzzle-dialog [data-work-confirm]').disabled`),'Valid path refused')
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});await pause(200);await capture('anneke-extra-solved-320.png');check(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow')
 await evaluate(`document.querySelector('.extra-puzzle-dialog [data-work-confirm]').click();document.querySelector('.extra-puzzle-dialog [data-work-confirm]').click()`);const paid=await stats();check(paid.money===before.money+900&&paid.resources.energy===75&&paid.resources.ptRespo===8&&paid.time===1140,'Wrong payment');check((await state()).extra.state.order.done,'Order not paid');await capture('anneke-extra-receipt-320.png');check(await evaluate(`JSON.parse(localStorage.getItem('mboa-dossier-draft-v1')).batch==='ordinary-sentinel'`),'Ordinary draft overwritten')
 await reload();check(JSON.stringify(await stats())===JSON.stringify(paid),'Reward replay after reload');await openExtra();check((await state()).extra.preview.reason.includes('rémunérée'),'Daily choice bypass');await click('[data-extra-back]');await click('.venue-close')
 await clock(1440+480);await click('.places [data-view=ministry]');await click('#venue-people-tab');await click('[data-anneke-extra]');await click('[data-extra-choice="2"]');await click('[data-extra-confirm]');await click('[data-extra-back]');await click('.venue-close');await clock(1440+1320);await startPuzzle();current=(await state()).extra.puzzle;solution=solve(current.board);for(const cell of solution.slice(1))await click(puzzle()+'[data-work-cell="'+cell+'"]');await click(puzzle()+'[data-work-confirm]');check((await stats()).time===1440+1380,'Exact 23h rejected');await click(puzzle()+'[data-work-leave]');await click('.venue-close')
 await clock(2*1440+480);await click('.places [data-view=ministry]');await click('#venue-people-tab');await click('[data-anneke-extra]');await click('[data-extra-confirm]');await click('[data-extra-back]');await click('.venue-close');await clock(2*1440+1320);await startPuzzle();current=(await state()).extra.puzzle;solution=solve(current.board);for(const cell of solution.slice(1))await click(puzzle()+'[data-work-cell="'+cell+'"]');const unpaid=await stats();await clock(2*1440+1321);check((await state()).extra.puzzle.mode==='list','Late puzzle did not refresh');check(JSON.stringify(await stats())===JSON.stringify({...unpaid,time:2*1440+1321}),'Late path charged');await clock(2*1440+1380);check((await state()).extra.state.expired,'Expiry not shown');await reload();check((await state()).extra.state.expired,'Expired save resumed as active');await openExtra();check((await state()).extra.preview.reason.includes('expiré'),'Expired action offered')
 if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({threeOrders:true,giverEntry:true,cancelAndFreeAccept:true,daytimeRefusal:true,freeAbandon:true,keyboardUndoReset:true,stableDraftReload:true,uniqueRewards:true,ordinaryDraftPreserved:true,exact23:true,lateAndExpiredReload:true,mobile320:true,errors},null,2))
 await writeFile(path.join(out,'anneke-extra-browser-state.json'),JSON.stringify(await state(),null,2))
 await evaluate(`for(const key of ['mboa-anneke-extra-v1','mboa-anneke-extra-draft-v1','mboa-dossier-draft-v1','mboa-game-minutes-v1','mboa-player-resources-v1','mboa-money-v1','mboa-player-zone-v1'])localStorage.removeItem(key)`)
}catch(error){console.error(error);process.exitCode=1}finally{ws?.close();chrome.kill()}
