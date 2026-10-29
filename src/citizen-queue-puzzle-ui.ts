import {createDossierPuzzle,encodeDossierPairs,scoreDossierPairs,dossierPayout,validPairDraft} from './dossier-puzzle'
import type {DossierPuzzle} from './dossier-puzzle'
import {completeDossier as standardComplete,dossierRules as standardRules,dossierWorkReason as standardReason,getDossierBatch as standardBatch} from './dossier-work'
import {onGameTimeChange} from './game-clock'
import {onPlayerResourcesChange} from './player-resources'
import './citizen-puzzle.css'
const topics=['Santé','Scolarité','Logement','Formalités']
const colors=['#087f95','#cc850d','#d55d3e','#31835b']
const stories=[
 {name:'Mme Amina',text:'Mon dossier d’aide familiale est bloqué. Aidez-moi à réunir les services pour mes enfants.'},
 {name:'M. Fopa',text:'Je viens régulariser mon dossier. Il me manque les liaisons entre les services concernés.'},
 {name:'Mme Ngo',text:'J’ai fait plusieurs déplacements sans réponse. Pouvez-vous faire avancer ma demande ?'},
 {name:'M. Njoya',text:'Ma famille attend ces documents. Chaque service relié nous rapproche d’une solution.'}
]
export function mountCitizenQueuePuzzle(options: { base: string; currentZone: () => string; travelling: () => boolean; back: () => void; work?: {rules:typeof standardRules;getBatch:typeof standardBatch;reason:typeof standardReason;complete:typeof standardComplete;draftKey:string;difficulty?:(index:number)=>number;cardInfo?:(index:number)=>string;profile?:(index:number)=>{energyCost:number;minutes:number;moneyGain:number;respoGain:number};presentation?:{id:string;eyebrow:string;intro:string;listTitle:string}} }) {

 const rules=options.work?.rules??standardRules,batchOf=options.work?.getBatch??standardBatch,reason=options.work?.reason??standardReason,complete=options.work?.complete??standardComplete
 const difficulty=(i:number)=>options.work?.difficulty?.(i)??i,profile=(i:number)=>options.work?.profile?.(i)??rules
 const headingId=options.work?.presentation?.id??(options.work?'extra-citizen-heading':'citizen-heading')
 const draftKey=(options.work?.draftKey??'mboa-dossier-draft-v1')+'-pairs-v1'
 const dialog=document.createElement('dialog');dialog.className='travel-dialog citizen-puzzle-dialog'+(options.work?.presentation?.id==='queue-puzzle-heading'?' queue-puzzle-dialog':options.work?.presentation?' advanced-puzzle-dialog':options.work?' extra-puzzle-dialog':'');dialog.setAttribute('aria-labelledby',headingId)
 dialog.innerHTML=`<button class="travel-close" data-work-close aria-label="Fermer">×</button><span class="travel-eyebrow">MINISTÈRE · AU SERVICE DES MBOANAIS</span><h2 id="${headingId}">Une demande, une solution</h2><section data-work-list><p>Un habitant vous explique sa demande. Reliez les icônes identiques : chaque paire résolue vaut 25 % de satisfaction et de la prime maximale.</p><p data-work-notice role="status"></p><div data-work-cards class="citizen-cards"></div></section><section data-work-puzzle hidden><div class="citizen-request"><span class="citizen-avatar" aria-hidden="true">👤</span><div><b data-citizen-name></b><p data-citizen-problem></p></div></div><div class="citizen-objective"><b>Objectif : 4 paires</b><span data-work-score></span></div><div class="citizen-pair-tabs" aria-label="Choisir une paire"></div><div class="citizen-board" data-work-grid tabindex="0" role="group" aria-label="Relier les icônes identiques sans croiser les lignes"></div><p data-work-feedback class="citizen-feedback" role="status"></p><div class="citizen-controls"><button data-work-undo aria-label="Annuler un pas">↶</button><button data-work-reset>Effacer</button><button data-work-confirm disabled>Valider</button></div><button data-work-pile class="citizen-pile">← Revenir aux demandes</button></section><section data-work-receipt hidden role="status"></section><button class="travel-cancel" data-work-leave>Retour au ministère</button>`
 document.body.append(dialog)
 const query=(s:string)=>dialog.querySelector<HTMLElement>(s)!,boardEl=query('[data-work-grid]'),cards=query('[data-work-cards]'),confirm=query('[data-work-confirm]') as HTMLButtonElement,feedback=query('[data-work-feedback]')
 let active:{batch:string;index:number;board:DossierPuzzle;paths:number[][];selected:number}|null=null,mode='list',paying=false,pointer:number|null=null,pointerPosition:{x:number;y:number}|null=null
 const onsite=()=>options.currentZone()===rules.zone&&!options.travelling()
 const icon=(i:number)=>`<span class="citizen-icon icon-${i}" role="img" aria-label="${topics[i]}"></span>`
 function show(view:string){mode=view;dialog.dataset.mode=view;query('[data-work-list]').hidden=view!=='list';query('[data-work-puzzle]').hidden=view!=='puzzle';query('[data-work-receipt]').hidden=view!=='receipt'}
 function persist(){if(!active)return;try{localStorage.setItem(draftKey,JSON.stringify({version:1,batch:active.batch,index:active.index,paths:active.paths}))}catch{/* Brouillon en mémoire. */}}
 function fullPaths(){return active!.paths.map((path,i)=>path.length>1&&active!.board.pairs![i]!.includes(path.at(-1)!)?path:[])}
 function renderList(message=''){
  active=null;show('list');const batch=batchOf();query('[data-work-notice]').textContent=message||batch.reason||`${batch.remaining} demandes disponibles`;cards.replaceChildren()
  for(const item of batch.dossiers){const p=profile(item.index),b=document.createElement('button');b.dataset.dossierIndex=String(item.index);b.className='citizen-card';const why=reason(options.currentZone(),batch.id,item.index);b.disabled=item.done||!!why;b.innerHTML=`${icon(item.index%4)}<span><b></b><small></small></span>`;b.querySelector('b')!.textContent=item.title;b.querySelector('small')!.textContent=item.done?'✓ Demande traitée':`${p.energyCost} énergie · ${p.minutes} min · jusqu’à ${p.moneyGain} Nkap · +${p.respoGain} Respo${why?' · '+why:''}`;cards.append(b)}
 }
 function render(){
  if(!active)return;const a=active,encoded=encodeDossierPairs(fullPaths()),count=scoreDossierPairs(a.board,encoded)??0,p=profile(a.index),money=dossierPayout(a.board,encoded,p.moneyGain)
  query('[data-work-score]').textContent=`${count*25} % · ${money} / ${p.moneyGain} Nkap`
  query('.citizen-pair-tabs').innerHTML=topics.map((name,i)=>`<button data-pair="${i}" aria-label="${name}, ${fullPaths()[i]!.length?'relié':'à relier'}" aria-pressed="${a.selected===i}" style="--pair-color:${colors[i]}">${icon(i)}<small>${fullPaths()[i]!.length?'✓':'○'}</small></button>`).join('')
  boardEl.replaceChildren()
  for(let cell=0;cell<25;cell++){
   const b=document.createElement('button');b.dataset.workCell=String(cell);b.type='button';const pair=a.board.pairs!.findIndex(p=>p.includes(cell)),occupied=a.paths.findIndex(path=>path.includes(cell));b.className='citizen-cell';b.tabIndex=-1
   b.classList.toggle('is-blocked',a.board.blocked.includes(cell));b.classList.toggle('is-endpoint',pair>=0);b.classList.toggle('is-current',a.paths[a.selected]?.at(-1)===cell)
   if(occupied>=0)b.style.setProperty('--cell-color',colors[occupied]!)
   b.setAttribute('aria-label',`Ligne ${Math.floor(cell/5)+1}, colonne ${cell%5+1}, ${pair>=0?topics[pair]:a.board.blocked.includes(cell)?'obstacle':'passage'}`)
   if(pair>=0)b.innerHTML=icon(pair);else if(a.board.blocked.includes(cell))b.textContent='•';boardEl.append(b)
  }
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 500 500');svg.setAttribute('aria-hidden','true')
  a.paths.forEach((path,i)=>{const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',path.map(c=>`${c%5*100+50},${Math.floor(c/5)*100+50}`).join(' '));line.setAttribute('stroke',colors[i]!);svg.append(line)});boardEl.append(svg)
  const why=onsite()?reason(options.currentZone(),a.batch,a.index):'Rejoignez le ministère.';confirm.disabled=!count||!!why||paying;confirm.textContent=count?`Valider · ${money} Nkap`:'Reliez une paire';(query('[data-work-undo]') as HTMLButtonElement).disabled=!a.paths[a.selected]?.length
  feedback.textContent=why||`${count} / 4 paires · ${p.energyCost} énergie · ${p.minutes} min · +${p.respoGain} Respo. ${count===4?'Satisfaction maximale !':'Reliez les mêmes icônes sans croiser les lignes.'}`
 }
 function openPuzzle(index:number){
  const batch=batchOf(),why=reason(options.currentZone(),batch.id,index);if(why){renderList(why);return}
  const board=createDossierPuzzle(`${batch.id}/${index}`,difficulty(index));active={batch:batch.id,index,board,paths:[[],[],[],[]],selected:index%4}
  try{const d=JSON.parse(localStorage.getItem(draftKey)??'null');if(d?.version===1&&d.batch===batch.id&&d.index===index&&Array.isArray(d.paths)&&d.paths.length===4){if(validPairDraft(board,d.paths))active.paths=d.paths}}catch{/* Brouillon ancien ou invalide ignoré. */}
  const citizen=stories[index%4]!;query('.citizen-avatar').innerHTML=icon(index%4);query('[data-citizen-name]').textContent=citizen.name;query('[data-citizen-problem]').textContent=citizen.text;show('puzzle');render();boardEl.focus({preventScroll:true})
 }
 function move(cell:number,allowSwitch=true){
  if(!active||paying||cell<0||cell>=25||active.board.blocked.includes(cell))return
  const a=active,pair=a.board.pairs!.findIndex(p=>p.includes(cell)),current=a.paths[a.selected]!
  if(pair>=0&&(pair!==a.selected||!current.length)){if(!allowSwitch&&pair!==a.selected)return;a.selected=pair;a.paths[pair]=[cell];persist();render();return}
  const path=a.paths[a.selected]!,last=path.at(-1);if(last===undefined){feedback.textContent='Commencez sur une icône.';return}
  const existing=path.indexOf(cell);if(existing>=0){a.paths[a.selected]=path.slice(0,existing+1);persist();render();return}
  if(path.length>1&&a.board.pairs![a.selected]!.includes(last))return
  if(Math.abs(cell%5-last%5)+Math.abs(Math.floor(cell/5)-Math.floor(last/5))!==1||a.paths.some((p,i)=>i!==a.selected&&p.includes(cell))||pair>=0&&pair!==a.selected)return
  path.push(cell);persist();render()
 }
 cards.onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-dossier-index]');if(b&&!b.disabled)openPuzzle(Number(b.dataset.dossierIndex))}
 query('.citizen-pair-tabs').onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-pair]');if(b&&active){active.selected=Number(b.dataset.pair);render();boardEl.focus({preventScroll:true})}}
 boardEl.onclick=e=>{if(pointer!==null)return;const b=(e.target as HTMLElement).closest<HTMLElement>('[data-work-cell]');if(b)move(Number(b.dataset.workCell))}
 boardEl.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointer=e.pointerId;pointerPosition={x:e.clientX,y:e.clientY};boardEl.setPointerCapture(e.pointerId);const b=(e.target as HTMLElement).closest<HTMLElement>('[data-work-cell]');if(b)move(Number(b.dataset.workCell))}
 boardEl.onpointermove=e=>{if(pointer!==e.pointerId||!pointerPosition)return;const r=boardEl.getBoundingClientRect(),from=pointerPosition,to={x:e.clientX,y:e.clientY},samples=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/(r.width/20)));for(let i=1;i<=samples;i++){const x=from.x+(to.x-from.x)*i/samples-r.left,y=from.y+(to.y-from.y)*i/samples-r.top;if(x>=0&&y>=0&&x<r.width&&y<r.height)move(Math.floor(y/r.height*5)*5+Math.floor(x/r.width*5),false)}pointerPosition=to}
 for(const event of ['pointerup','pointercancel','lostpointercapture'])boardEl.addEventListener(event,()=>{pointer=null;pointerPosition=null})
 boardEl.onkeydown=e=>{if(!active)return;const offsets:Record<string,number>={ArrowUp:-5,ArrowDown:5,ArrowLeft:-1,ArrowRight:1};if(e.key in offsets){e.preventDefault();const path=active.paths[active.selected]!;if(!path.length)path.push(active.board.pairs![active.selected]![0]!);move((path.at(-1)??active.board.pairs![active.selected]![0]!)+offsets[e.key]!)}else if(e.key==='Backspace'){e.preventDefault();active.paths[active.selected]!.pop();persist();render()}}
 query('[data-work-undo]').onclick=()=>{if(active){active.paths[active.selected]!.pop();persist();render()}}
 query('[data-work-reset]').onclick=()=>{if(active){active.paths=[[],[],[],[]];persist();render()}}
 query('[data-work-pile]').onclick=()=>{persist();renderList()}
 confirm.onclick=()=>{
  if(!active||confirm.disabled||paying)return;paying=true;const paths=fullPaths(),count=scoreDossierPairs(active.board,encodeDossierPairs(paths))??0
  const result=complete(active.batch,active.index,encodeDossierPairs(paths),onsite()?options.currentZone():'');paying=false
  if(!result.ok){feedback.textContent=result.reason;return}
  try{localStorage.removeItem(draftKey)}catch{/* Déjà payé dans le registre du travail. */}
  show('receipt');query('[data-work-receipt]').innerHTML=`<h3>Merci pour votre aide !</h3><p>${count} / 4 paires · satisfaction ${count*25} %</p><strong>+${result.money} Nkap</strong><p>+${result.respo} Respo · −${result.energy} énergie · ${result.minutes} min</p><button data-next>Demande suivante</button>`;query('[data-next]').onclick=()=>renderList();active=null
 }
 query('[data-work-close]').onclick=()=>dialog.close();query('[data-work-leave]').onclick=()=>{dialog.close();if(onsite())options.back()}
 const refresh=()=>{if(!dialog.open||paying)return;if(!onsite()){dialog.close();return}if(active&&(batchOf().id!==active.batch||reason(options.currentZone(),active.batch,active.index)))renderList('La disponibilité a changé.');else if(active)render();else if(mode==='list')renderList()}
 onGameTimeChange(refresh);onPlayerResourcesChange(refresh)
 return {open(){if(!onsite())return;renderList();if(!dialog.open)dialog.showModal()},snapshot(){return dialog.open?{mode,batch:active?.batch??batchOf().id,dossier:active?.index,board:active?.board,paths:active?.paths,path:active?encodeDossierPairs(fullPaths()):undefined,satisfaction:active?(scoreDossierPairs(active.board,encodeDossierPairs(fullPaths()))??0)*25:undefined,remaining:batchOf().remaining}:{mode:'closed'}}}
}
