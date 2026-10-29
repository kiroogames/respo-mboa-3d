// Vérifie les puzzles indépendamment de leur générateur, puis les paiements et les horaires.
import assert from 'node:assert/strict'
const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}
const {createDossierPuzzle,validateDossierPath,moveDossierPath,attemptDossierMove,getDossierNextCells}=await import('../src/dossier-puzzle.ts')
function solve(board){
 const path=[board.start],seen=new Set(path)
 function visit(cell){
  if(cell===board.goal)return board.visas.every(v=>seen.has(v))
  const x=cell%board.size,y=Math.floor(cell/board.size)
  for(const next of [x>0?cell-1:-1,x<board.size-1?cell+1:-1,y>0?cell-board.size:-1,y<board.size-1?cell+board.size:-1]){
   if(next<0||seen.has(next)||board.blocked.includes(next))continue;const forced=(board.arrows??[]).find(arrow=>arrow.cell===cell);if(forced&&next!==cell+({up:-board.size,right:1,down:board.size,left:-1}[forced.direction]))continue
   seen.add(next);path.push(next);if(visit(next))return true;path.pop();seen.delete(next)
  }
  return false
 }
 assert.ok(visit(board.start),'Grille sans solution');return [...path]
}
const starts=new Set()
for(let seed=0;seed<500;seed++){
 const board=createDossierPuzzle(`test/${seed}`,seed%5),path=solve(board)
 starts.add(board.start);assert.equal(board.arrows.length,[0,1,1,2,3][seed%5])
 assert.deepEqual(board,createDossierPuzzle(`test/${seed}`,seed%5))
 assert.equal(validateDossierPath(board,path),true)
 assert.equal(validateDossierPath(board,[board.start,board.goal]),false)
 assert.equal(validateDossierPath(board,[]),false)
 assert.equal(validateDossierPath(board,null),false)
 assert.deepEqual(moveDossierPath(board,[board.start],board.goal),[board.start])
 assert.deepEqual(moveDossierPath(board,path,path[2]),path.slice(0,3))
 const bad=[...path];bad[2]=path[0];assert.equal(validateDossierPath(board,bad),false)
}
assert.equal(starts.size,4)
const directed={size:3,start:6,goal:2,visas:[3,4,5],blocked:[],arrows:[{cell:3,direction:'right'}]}
assert.equal(validateDossierPath(directed,[6,3,4,5,2]),true)
assert.equal(validateDossierPath(directed,[6,3,0,1,4,5,2]),false)
assert.equal(attemptDossierMove(directed,[6,3],0).rejected,true)
assert.deepEqual(getDossierNextCells(directed,[6,3]),[4])
assert.deepEqual(moveDossierPath(directed,[6,3],6),[6])
const drafts=await import('../src/dossier-draft.ts')
drafts.saveDossierDraft('pile',2,[6,3,4]);assert.deepEqual(drafts.restoreDossierDraft(directed,'pile',2),[6,3,4])
assert.deepEqual(drafts.restoreDossierDraft(directed,'autre-pile',2),[6])
drafts.saveDossierDraft('pile',2,[6,3,0]);assert.deepEqual(drafts.restoreDossierDraft(directed,'pile',2),[6])
drafts.saveDossierDraft('pile',2,[6,3,6]);assert.deepEqual(drafts.restoreDossierDraft(directed,'pile',2),[6])
drafts.clearDossierDraft();assert.deepEqual(drafts.restoreDossierDraft(directed,'pile',2),[6])
console.log('Direction constraints, 4 entry orientations, undo and validated draft restoration passed')
const work=await import('../src/dossier-work.ts'),clock=await import('../src/game-clock.ts'),wallet=await import('../src/currency.ts'),resources=await import('../src/player-resources.ts')
let batch=work.getDossierBatch(),path=solve(createDossierPuzzle(`${batch.id}/0`,0))
const initialTime=clock.getGameTime().totalMinutes
assert.equal(work.completeDossier(batch.id,0,path,'home').ok,false)
assert.equal(work.completeDossier(batch.id,0,[],'ministry').ok,false)
assert.equal(work.completeDossier(batch.id,-1,path,'ministry').ok,false)
assert.equal(wallet.getMoneyBalance(),0);assert.equal(resources.getPlayerResources().energy,100);assert.equal(clock.getGameTime().totalMinutes,initialTime)
assert.equal(work.completeDossier(batch.id,0,path,'ministry').ok,true)
assert.equal(wallet.getMoneyBalance(),500);assert.equal(resources.getPlayerResources().energy,80);assert.equal(resources.getPlayerResources().ptRespo,5);assert.equal(resources.getPlayerResources().mood,90);assert.equal(clock.getGameTime().totalMinutes,initialTime+60)
assert.equal(work.completeDossier(batch.id,0,path,'ministry').ok,false)
const restored=await import('../src/dossier-work.ts?reload')
assert.equal(restored.getDossierBatch().dossiers[0].done,true);assert.equal(restored.completeDossier(batch.id,0,path,'ministry').ok,false)
clock.advanceGameTime(600-clock.getGameTime().totalMinutes)
assert.equal(work.getDossierBatch().remaining,5);assert.equal(work.completeDossier(batch.id,0,path,'ministry').ok,false)
batch=work.getDossierBatch();path=solve(createDossierPuzzle(`${batch.id}/0`,0))
resources.spendEnergy(80);assert.equal(work.completeDossier(batch.id,0,path,'ministry').ok,false);assert.equal(work.getDossierBatch().remaining,5);resources.restoreEnergy(100)
clock.advanceGameTime(1325-clock.getGameTime().totalMinutes);assert.equal(work.getDossierBatch().canFinish,false)
clock.advanceGameTime(4*1440+1320-clock.getGameTime().totalMinutes)
batch=work.getDossierBatch();assert.equal(batch.nextRefill,7*1440+420);assert.equal(batch.canFinish,true)
path=solve(createDossierPuzzle(`${batch.id}/0`,0));assert.equal(work.completeDossier(batch.id,0,path,'ministry').ok,true);assert.equal(clock.getGameTime().time,'23:00');assert.equal(work.getDossierBatch().open,false)
clock.advanceGameTime(5*1440+600-clock.getGameTime().totalMinutes);assert.equal(work.getDossierBatch().open,false);assert.equal(work.getDossierBatch().nextRefill,7*1440+420)
clock.advanceGameTime(7*1440+420-clock.getGameTime().totalMinutes);assert.equal(work.getDossierBatch().remaining,5)
console.log('500 solvable deterministic puzzles; illegal paths, duplicates, storage reload, late hours, weekends, pile refresh and exact work economics passed')
