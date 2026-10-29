/*
 * File d'attente façon Pragmata : tracer un seul chemin du dossier à la signature, sans repasser sur ses pas.
 * Chaque case traversée ajoute (+) ou retire (−) des monnaies ; le bilan s'affiche en direct et s'applique à la validation.
 */
import {createQueueRoute,scoreQueueRoute,routePayout,routeNeighbours} from './queue-route'
import type {QueueRoute,RouteTotals,RouteUnit} from './queue-route'
import {dossierRules as standardRules,getDossierBatch as standardBatch,dossierWorkReason as standardReason} from './dossier-work'
import {onGameTimeChange} from './game-clock'
import {onPlayerResourcesChange} from './player-resources'
import './citizen-puzzle.css'

type CompleteResult={ok:true;money:number;respo:number;energy:number;minutes:number;title:string;mood?:number;influence?:number}|{ok:false;reason:string}
const stories=[
 {name:'Mme Amina',face:'👩🏾',text:'Mon dossier d’aide familiale est bloqué depuis des semaines. Mes enfants attendent.'},
 {name:'M. Fopa',face:'👨🏿',text:'Je viens régulariser ma situation. On m’a renvoyé de bureau en bureau.'},
 {name:'Mme Ngo',face:'👵🏾',text:'Trois déplacements et toujours pas de réponse. Aujourd’hui, je ne repars pas sans signature.'},
 {name:'M. Njoya',face:'👨🏾‍🦱',text:'Ma boutique ne peut pas ouvrir sans cette déclaration. Chaque jour perdu me coûte cher.'},
 {name:'Mlle Ekané',face:'👩🏿‍🎓',text:'Je dois envoyer ce dossier avant vendredi pour ma bourse. Le temps presse !'}
]
const levelNames=['Simple','Simple','Délicate','Compliquée','Très compliquée']
const unitLabels:Record<RouteUnit,string>={nkap:'Nkap',energy:'énergie',mood:'humeur',influence:'influence'}

export function mountCitizenQueuePuzzle(options:{base:string;currentZone:()=>string;travelling:()=>boolean;back:()=>void;work:{rules:typeof standardRules;getBatch:typeof standardBatch;reason:typeof standardReason;complete:(batch:string,index:number,path:number[],zone:string)=>CompleteResult;draftKey:string;presentation?:{id:string;eyebrow:string;intro:string;listTitle:string}}}){
 const {rules,getBatch:batchOf,reason,complete}=options.work
 const headingId=options.work.presentation?.id??'citizen-heading'
 const draftKey=options.work.draftKey+'-route-v1'
 const dialog=document.createElement('dialog');dialog.className='travel-dialog citizen-puzzle-dialog queue-puzzle-dialog';dialog.setAttribute('aria-labelledby',headingId)
 dialog.innerHTML=`<button class="travel-close" data-work-close aria-label="Fermer">×</button><span class="travel-eyebrow">${options.work.presentation?.eyebrow??'MINISTÈRE · AU SERVICE DES MBOANAIS'}</span><h2 id="${headingId}">Une demande, une solution</h2>
 <section data-work-list><p>Tracez le parcours de chaque dossier jusqu’à la signature. Les cases traversées rapportent <b>(+)</b> ou coûtent <b>(−)</b> : le grand détour paie mieux, le raccourci use.</p><p class="route-fixed" data-work-fixed></p><p data-work-notice role="status"></p><div data-work-cards class="citizen-cards"></div></section>
 <section data-work-puzzle hidden><div class="citizen-request"><span class="citizen-avatar" aria-hidden="true"></span><div><b data-citizen-name></b><p data-citizen-problem></p></div></div>
 <div class="route-tally" data-route-tally role="status" aria-live="polite"></div>
 <div class="citizen-board route-board" data-work-grid tabindex="0" role="group" aria-label="Grille : tracez un chemin du dossier jusqu’à la signature"></div>
 <p data-work-feedback class="citizen-feedback" role="status"></p>
 <div class="citizen-controls"><button data-work-undo aria-label="Annuler un pas">↶</button><button data-work-reset>Effacer</button><button data-work-confirm disabled>Valider</button></div><button data-work-pile class="citizen-pile">← Revenir aux demandes</button></section>
 <section data-work-receipt hidden role="status"></section><button class="travel-cancel" data-work-leave>Retour au ministère</button>`
 document.body.append(dialog)
 const query=(s:string)=>dialog.querySelector<HTMLElement>(s)!,boardEl=query('[data-work-grid]'),cards=query('[data-work-cards]'),confirm=query('[data-work-confirm]') as HTMLButtonElement,feedback=query('[data-work-feedback]')
 let active:{batch:string;index:number;board:QueueRoute;path:number[]}|null=null,mode='list',paying=false,pointer:number|null=null,pointerPosition:{x:number;y:number}|null=null
 const onsite=()=>options.currentZone()===rules.zone&&!options.travelling()

 // Logo d'une monnaie (image, ou visage souriant pour l'humeur) ; le nom reste lisible pour les lecteurs d'écran.
 function logo(unit:RouteUnit){
  if(unit==='mood')return `<span class="currency-icon currency-icon-mood" role="img" aria-label="humeur" style="background-image:url('${options.base}ui/mood-sprites.png')"></span>`
  return `<img class="currency-icon" src="${options.base}ui/${unit==='nkap'?'currency-nkap':unit==='energy'?'currency-energy':'currency-respo'}.png" alt="${unitLabels[unit]}"/>`
 }
 const signed=(n:number)=>`${n>0?'+':n<0?'−':''}${Math.abs(n).toLocaleString('fr-FR')}`
 function amounts(totals:RouteTotals,withZero=false){
  return (['nkap','energy','mood','influence'] as RouteUnit[]).filter(u=>withZero&&u==='nkap'||totals[u]).map(u=>`<span class="route-amount ${totals[u]<0?'is-loss':'is-gain'}">${signed(totals[u])}${logo(u)}</span>`).join('')
 }
 function show(view:string){mode=view;dialog.dataset.mode=view;query('[data-work-list]').hidden=view!=='list';query('[data-work-puzzle]').hidden=view!=='puzzle';query('[data-work-receipt]').hidden=view!=='receipt'}
 function persist(){if(!active)return;try{localStorage.setItem(draftKey,JSON.stringify({version:1,batch:active.batch,index:active.index,path:active.path}))}catch{/* Brouillon en mémoire. */}}

 function renderList(message=''){
  active=null;show('list');const batch=batchOf()
  query('[data-work-fixed]').innerHTML=`Chaque demande : ${rules.minutes} min · −${rules.energyCost}${logo('energy')} · +${rules.respoGain} Respo, puis le bilan du parcours (jusqu’à ${rules.moneyGain.toLocaleString('fr-FR')}${logo('nkap')} environ).`
  query('[data-work-notice]').textContent=message||batch.reason||`${batch.remaining} usager(s) dans la file`;cards.replaceChildren()
  for(const item of batch.dossiers){
   const story=stories[item.index%stories.length]!,b=document.createElement('button');b.dataset.dossierIndex=String(item.index);b.className='citizen-card';const why=reason(options.currentZone(),batch.id,item.index);b.disabled=item.done||!!why
   b.innerHTML=`<span class="citizen-face" aria-hidden="true">${story.face}</span><span><b></b><small></small></span>`
   b.querySelector('b')!.textContent=`${story.name} · ${item.title}`
   b.querySelector('small')!.textContent=item.done?'✓ Demande traitée':`Difficulté : ${levelNames[Math.min(4,item.index)]}${why?' · '+why:''}`
   cards.append(b)
  }
 }

 function render(){
  if(!active)return
  const a=active,totals=scoreQueueRoute(a.board,a.path,false)??{nkap:0,energy:0,mood:0,influence:0},done=a.path.at(-1)===a.board.goal,payout=routePayout(totals)
  query('[data-route-tally]').innerHTML=`<span class="route-tally-label">Bilan du parcours</span>${amounts(totals,true)}${totals.nkap<0?'<small>(l’argent ne descend pas sous 0)</small>':''}`
  boardEl.replaceChildren()
  const head=a.path.at(-1)
  for(let cell=0;cell<25;cell++){
   const b=document.createElement('button');b.type='button';b.tabIndex=-1;b.dataset.workCell=String(cell);b.className='citizen-cell route-cell'
   const tile=a.board.tiles[cell],blocked=a.board.blocked.includes(cell),visited=a.path.includes(cell)
   b.classList.toggle('is-blocked',blocked);b.classList.toggle('is-visited',visited);b.classList.toggle('is-current',cell===head)
   b.classList.toggle('is-start',cell===a.board.start);b.classList.toggle('is-goal',cell===a.board.goal)
   b.classList.toggle('is-next',!done&&head!==undefined&&!visited&&!blocked&&routeNeighbours(head).includes(cell))
   if(tile)b.classList.add(tile.amount<0?'is-loss':'is-gain')
   let label='passage libre'
   if(cell===a.board.start){b.innerHTML='<span class="route-mark">📁</span><small>Dossier</small>';label='départ, dossier'}
   else if(cell===a.board.goal){b.innerHTML='<span class="route-mark">✍️</span><small>Signature</small>';label='arrivée, signature'}
   else if(blocked){b.innerHTML='<small>Fermé</small>';label='guichet fermé'}
   else if(tile){b.innerHTML=`<span class="route-amount ${tile.amount<0?'is-loss':'is-gain'}">${signed(tile.amount)}${logo(tile.unit)}</span>`;label=`${signed(tile.amount)} ${unitLabels[tile.unit]}`}
   b.setAttribute('aria-label',`Ligne ${Math.floor(cell/5)+1}, colonne ${cell%5+1}, ${label}${visited?', sur le chemin':''}`)
   boardEl.append(b)
  }
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 500 500');svg.setAttribute('aria-hidden','true')
  const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',a.path.map(c=>`${c%5*100+50},${Math.floor(c/5)*100+50}`).join(' '));svg.append(line);boardEl.append(svg)
  const why=onsite()?reason(options.currentZone(),a.batch,a.index):'Rejoignez le ministère.'
  const energyNeeded=rules.energyCost+payout.energyLoss
  confirm.disabled=!done||!!why||paying
  confirm.innerHTML=done?`Valider · ${signed(payout.money)}${logo('nkap')}`:'Rejoignez la signature'
  ;(query('[data-work-undo]') as HTMLButtonElement).disabled=a.path.length<=1
  feedback.textContent=why||(done?`Parcours complet. Énergie totale : ${energyNeeded} · ${rules.minutes} min · +${rules.respoGain} Respo.`:'Partez du dossier et rejoignez la signature sans repasser sur vos pas. Cliquez sur une case du chemin pour revenir en arrière.')
 }

 function openPuzzle(index:number){
  const batch=batchOf(),why=reason(options.currentZone(),batch.id,index);if(why){renderList(why);return}
  const board=createQueueRoute(`${batch.id}/${index}`,index);active={batch:batch.id,index,board,path:[board.start]}
  try{const d=JSON.parse(localStorage.getItem(draftKey)??'null');if(d?.version===1&&d.batch===batch.id&&d.index===index&&Array.isArray(d.path)&&scoreQueueRoute(board,d.path,false))active.path=d.path}catch{/* Brouillon ancien ou invalide ignoré. */}
  const story=stories[index%stories.length]!;query('.citizen-avatar').textContent=story.face;query('[data-citizen-name]').textContent=`${story.name} · ${levelNames[Math.min(4,index)]}`;query('[data-citizen-problem]').textContent=story.text
  show('puzzle');render();boardEl.focus({preventScroll:true})
 }
 // Un pas : prolonger depuis la tête du chemin, ou revenir en arrière en touchant une case déjà tracée.
 function move(cell:number){
  if(!active||paying||cell<0||cell>=25||active.board.blocked.includes(cell))return
  const path=active.path,existing=path.indexOf(cell)
  if(existing>=0){if(existing<path.length-1){active.path=path.slice(0,existing+1);persist();render()}return}
  const head=path.at(-1)!
  if(head===active.board.goal||!routeNeighbours(head).includes(cell))return
  path.push(cell);persist();render()
 }
 cards.onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-dossier-index]');if(b&&!b.disabled)openPuzzle(Number(b.dataset.dossierIndex))}
 boardEl.onclick=e=>{if(pointer!==null)return;const b=(e.target as HTMLElement).closest<HTMLElement>('[data-work-cell]');if(b)move(Number(b.dataset.workCell))}
 boardEl.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointer=e.pointerId;pointerPosition={x:e.clientX,y:e.clientY};boardEl.setPointerCapture(e.pointerId);const b=(e.target as HTMLElement).closest<HTMLElement>('[data-work-cell]');if(b)move(Number(b.dataset.workCell))}
 boardEl.onpointermove=e=>{
  if(pointer!==e.pointerId||!pointerPosition||!active)return
  const r=boardEl.getBoundingClientRect(),from=pointerPosition,to={x:e.clientX,y:e.clientY},samples=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/(r.width/20)))
  for(let i=1;i<=samples;i++){const x=from.x+(to.x-from.x)*i/samples-r.left,y=from.y+(to.y-from.y)*i/samples-r.top;if(x>=0&&y>=0&&x<r.width&&y<r.height){const cell=Math.floor(y/r.height*5)*5+Math.floor(x/r.width*5),index=active.path.indexOf(cell);if(index<0||index===active.path.length-2)move(cell)}}
  pointerPosition=to
 }
 for(const event of ['pointerup','pointercancel','lostpointercapture'])boardEl.addEventListener(event,()=>{pointer=null;pointerPosition=null})
 boardEl.onkeydown=e=>{if(!active)return;const offsets:Record<string,number>={ArrowUp:-5,ArrowDown:5,ArrowLeft:-1,ArrowRight:1};const head=active.path.at(-1)!
  if(e.key in offsets){e.preventDefault();const next=head+offsets[e.key]!;if(routeNeighbours(head).includes(next))move(next)}
  else if(e.key==='Backspace'){e.preventDefault();if(active.path.length>1){active.path.pop();persist();render()}}
  else if(e.key==='Enter'&&!confirm.disabled){e.preventDefault();confirm.click()}}
 query('[data-work-undo]').onclick=()=>{if(active&&active.path.length>1){active.path.pop();persist();render()}}
 query('[data-work-reset]').onclick=()=>{if(active){active.path=[active.board.start];persist();render()}}
 query('[data-work-pile]').onclick=()=>{persist();renderList()}
 confirm.onclick=()=>{
  if(!active||confirm.disabled||paying)return;paying=true
  const path=[...active.path],totals=scoreQueueRoute(active.board,path)!,story=stories[active.index%stories.length]!
  const result=complete(active.batch,active.index,path,onsite()?options.currentZone():'');paying=false
  if(!result.ok){feedback.textContent=result.reason;return}
  try{localStorage.removeItem(draftKey)}catch{/* Déjà payé dans le registre de la file. */}
  const spent:RouteTotals={nkap:result.money,energy:-result.energy,mood:result.mood??0,influence:result.influence??0}
  const mood=result.money>=600?'Merci infiniment, vous avez tout réglé !':result.money>=250?'Merci, c’est déjà mieux que la dernière fois.':'Bon… au moins c’est signé.'
  show('receipt');query('[data-work-receipt]').innerHTML=`<div class="route-receipt-head"><span class="citizen-face" aria-hidden="true">${story.face}</span><div><h3>${story.name}</h3><p>« ${mood} »</p></div></div><div class="route-receipt-amounts">${amounts(spent,true)}</div><p>+${result.respo} Respo · ${result.minutes} min${totals.nkap<0?' · l’argent du parcours était négatif, rien n’a été retiré':''}</p><button data-next>Demande suivante</button>`
  query('[data-next]').onclick=()=>renderList();active=null
 }
 query('[data-work-close]').onclick=()=>dialog.close();query('[data-work-leave]').onclick=()=>{dialog.close();if(onsite())options.back()}
 const refresh=()=>{if(!dialog.open||paying)return;if(!onsite()){dialog.close();return}if(active&&(batchOf().id!==active.batch||reason(options.currentZone(),active.batch,active.index)))renderList('La disponibilité a changé.');else if(active)render();else if(mode==='list')renderList()}
 onGameTimeChange(refresh);onPlayerResourcesChange(refresh)
 return {open(){if(!onsite())return;renderList();if(!dialog.open)dialog.showModal()},snapshot(){return dialog.open?{mode,batch:active?.batch??batchOf().id,dossier:active?.index,board:active?.board,path:active?.path,totals:active?scoreQueueRoute(active.board,active.path,false):undefined,remaining:batchOf().remaining}:{mode:'closed'}}}
}
