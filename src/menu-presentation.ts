/* Présentation commune des fenêtres : illustrations et pages de jeu.
 * Les contrôles restent les mêmes nœuds DOM : aucune règle, sauvegarde ou transaction ne change.
 */
type Theme='food'|'sleep'|'work'|'fun'|'home'|'budget'|'wait'|'relations'|'jogging'|'football'|'cinema'|'drink'|'porridge'|'rice'|'ndole'|'ricebeans'|'chicken'
const themes:[string,Theme][]=[['meal-dialog','food'],['canteen-dialog','food'],['food-bag-dialog','food'],['sleep-dialog','sleep'],['work-classic-dialog','work'],['citizen-puzzle-dialog','work'],['extra-dialog','work'],['meeting-dialog','work'],['missions-dialog','work'],['outings-dialog','fun'],['accompanied-dialog','relations'],['comfort-dialog','home'],['bills-dialog','budget'],['toque-dialog','budget'],['wait-dialog','wait'],['sport-energy-dialog','sleep'],['mood-effects-dialog','relations'],['npc-dialogue-dialog','relations']]
const cardSelector='.venue-service,.citizen-card,.venue-person-service,.meal-choices>button,.canteen-choices>button,.outing-options>button,.extra-choices>button,.meeting-options>button,.comfort-catalogue>button,.missions-list>button,.energy-effect-cards>article'
const policies='.comfort-policy,.outing-policy,.bills-policy,.wait-rules,.meal-intro,.place-activity-note,.wait-intro,.classic-work-preview>small,.canteen-preview>small,.extra-preview>small,.meeting-preview>small,.comfort-preview>small'
function themeOf(dialog:HTMLDialogElement):Theme{
 if(dialog.classList.contains('outings-dialog'))return artOf(dialog.querySelector('h2')?.textContent??'','fun')
 if(dialog.matches('.venue-dialog,.transport-dialog')){
  const place=dialog.querySelector('h2')?.textContent??''
  if(/omnisport|stade|stadium/i.test(place))return 'football'
  if(/minist|présiden/i.test(place))return 'work'
  if(/marché|restaurant/i.test(place))return 'food'
  if(/culture/i.test(place))return 'cinema'
  if(/njoka|club/i.test(place))return 'fun'
 }
 return themes.find(([name])=>dialog.classList.contains(name))?.[1]??'home'
}
function artOf(text:string,fallback:Theme):Theme{
 if(/entraîn|jogg|sportive/i.test(text))return 'jogging'
 if(/2-0|football/i.test(text))return 'football'
 if(/cinéma|séance/i.test(text))return 'cinema'
 if(/boire|boisson|verre/i.test(text))return 'drink'
 if(/bouillie|beignet/i.test(text))return 'porridge'
 if(/riz.*haricot/i.test(text))return 'ricebeans'
 if(/riz.*arachide/i.test(text))return 'rice'
 if(/poulet/i.test(text))return 'chicken'
 if(/ndolé/i.test(text))return 'ndole'
 if(/repas|manger|déjeuner|poisson|poulet|restaurant|nourriture/i.test(text))return 'food'
 if(/dorm|sommeil|repos|nuit/i.test(text))return 'sleep'
 if(/facture|toqué|cotis|budget|épargne|argent/i.test(text))return 'budget'
 if(/confort|équip|meuble|canapé|cuisine|douche|lit /i.test(text))return 'home'
 if(/dossier|usager|réunion|mission|travail|rapport|taf|commande/i.test(text))return 'work'
 if(/sortie|cinéma|danse|danser|match|sport|2-0/i.test(text))return 'fun'
 if(/parler|discut|bae|considération|demande/i.test(text))return 'relations'
 if(/attend|pause/i.test(text))return 'wait'
 return fallback
}
export function presentGameMenu(dialog:HTMLDialogElement){
 const base=import.meta.env.BASE_URL,body=dialog.querySelector<HTMLElement>(':scope>.popup-body')!
 // Les onglets du lieu restent accessibles pendant qu’on parcourt les cartes.
 const tabs=body.querySelector('.venue-tabs')
 if(tabs)dialog.querySelector('.popup-head')!.append(tabs)
 let theme=themeOf(dialog)
 dialog.classList.add('game-menu');dialog.dataset.menuTheme=theme
 const illustration=(kind:Theme)=>`${base}ui/menu-${kind}.jpg`
 const city=dialog.querySelector('.menu-city-art')
 if(city){city.replaceChildren();const image=document.createElement('img');image.src=illustration(theme);image.alt='';image.className='game-menu-hero';city.append(image)}
 const badge=dialog.querySelector('.popup-icon')
 if(badge){badge.replaceChildren();const image=document.createElement('img');image.src=illustration(theme);image.alt='';badge.append(image)}
 // Regroupe uniquement les textes d’aide. Les avertissements, horaires et coûts restent dans leur vue.
 const infos=document.createElement('details');infos.className='game-menu-infos';infos.innerHTML='<summary>Infos</summary>'
 function decorate(){
  theme=themeOf(dialog);dialog.dataset.menuTheme=theme
  for(const hero of dialog.querySelectorAll<HTMLImageElement>('.game-menu-hero,.popup-icon>img')){
   const portrait=dialog.querySelector<HTMLImageElement>('.npc-conversation-header img')?.getAttribute('src')
   const source=portrait??(dialog.classList.contains('citizen-puzzle-dialog')?`${base}ui/unity/usagers.png`:dialog.classList.contains('sport-energy-dialog')?`${base}ui/unity/sommeil.png`:illustration(theme))
   if(hero.getAttribute('src')!==source)hero.src=source
  }
  for(const tab of dialog.querySelectorAll('[data-venue-tab]')){const text=tab.firstChild;if(text?.nodeType===Node.TEXT_NODE){const value=tab.getAttribute('data-venue-tab')==='place'?'Activités':'Habitants ';if(text.textContent!==value)text.textContent=value}}
  const queueIntro=dialog.querySelector<HTMLElement>('[data-work-list]>p:first-child')
  if(queueIntro&&!queueIntro.dataset.compact){queueIntro.title=queueIntro.textContent??'';queueIntro.textContent='Dossier → signature. À vous de tracer !';queueIntro.dataset.compact='true'}
  const puzzleHint=dialog.querySelector<HTMLElement>('.citizen-feedback')
  if(puzzleHint?.textContent?.startsWith('Partez du dossier')){puzzleHint.title=puzzleHint.textContent;puzzleHint.textContent='Dossier → signature · sans repasser.'}
  for(const description of dialog.querySelectorAll<HTMLElement>('.venue-description'))description.classList.toggle('game-important-description',/\d/.test(description.textContent??''))
  for(const preview of dialog.querySelectorAll<HTMLElement>('.venue-energy-preview')){
   const text=preview.textContent??'',short=text.replace(/^Fin : (\d+\s*\/\s*\d+) · énergie pleine$/,'$1').replace(/\((\+\d+) à la fin\)/,'($1)')
   if(short!==text){preview.title=text;preview.setAttribute('aria-label',text);preview.textContent=short}
  }
  const shortNames:Record<string,string>={'Retour au lieu':'Retour','Retour au ministère':'Retour','Confirmer le traitement':'Traiter','Confirmer le repas':'Manger','Confirmer la réunion':'Participer','Confirmer la sortie':'Y aller','Confirmer le versement':'Verser','Confirmer l’attente':'Attendre','Confirmer la commande':'Accepter'}
  for(const button of dialog.querySelectorAll('button')){const short=shortNames[button.textContent?.trim()??''];if(short){button.setAttribute('aria-label',button.textContent!.trim());button.textContent=short}}
  for(const node of dialog.querySelectorAll<HTMLElement>(cardSelector)){
   if(node.querySelector(':scope>.game-card-art'))continue
   const art=document.createElement('span');art.className='game-card-art';art.setAttribute('aria-hidden','true')
   const image=document.createElement('img'),title=node.querySelector('b')?.textContent??node.textContent??''
   const dishArt:Record<string,Theme>={classic:'ndole',complete:'chicken','rice-beans':'ricebeans','grilled-chicken':'chicken',mafe:'rice'}
   // Les illustrations originales Unity priment lorsqu’elles représentent précisément l’activité.
   image.src=node.matches('[data-venue-queue]')||dialog.classList.contains('citizen-puzzle-dialog')?`${base}ui/unity/usagers.png`
    :node.matches('[data-venue-work],[data-venue-advanced]')||node.hasAttribute('data-dossier-index')?`${base}ui/unity/dossiers.png`
    :node.closest('.missions-list')?`${base}ui/unity/mission.png`
    :node.dataset.comfortItem?.startsWith('bed-')?`${base}ui/unity/lit.png`
    :dialog.classList.contains('outings-dialog')&&dialog.querySelector('h2')?.textContent==='Restaurant du Mboa'&&dishArt[node.dataset.outingOption??'']?illustration(dishArt[node.dataset.outingOption!]!)
    :illustration(artOf(title,theme))
   image.alt='';art.append(image);node.prepend(art)
  }
  for(const node of body.querySelectorAll<HTMLElement>(policies))if(!node.closest('.game-menu-infos'))infos.append(node)
  if(infos.children.length>1&&!infos.isConnected)body.append(infos)
 }
 decorate()
 const track=document.createElement('div');track.className='game-menu-pages';track.append(...body.childNodes);body.append(track)
 const foot=dialog.querySelector<HTMLElement>(':scope>.popup-foot')??document.createElement('div')
 if(!foot.isConnected){foot.className='popup-foot';dialog.append(foot)}
 const pager=document.createElement('nav');pager.className='game-menu-pager';pager.setAttribute('aria-label','Pages du menu')
 pager.innerHTML='<button type="button" data-menu-prev aria-label="Page précédente">‹</button><span aria-live="polite"></span><button type="button" data-menu-next aria-label="Page suivante">›</button>'
 foot.prepend(pager)
 const previous=pager.querySelector<HTMLButtonElement>('[data-menu-prev]')!,next=pager.querySelector<HTMLButtonElement>('[data-menu-next]')!,label=pager.querySelector('span')!
 let page=0,total=1,scheduled=false,reset=false,previewRequested=false,reveal:HTMLElement|null=null
 function go(value:number){page=Math.max(0,Math.min(total-1,value));body.scrollLeft=page*(track.clientWidth+24);if(label.textContent!==`${page+1} / ${total}`)label.textContent=`${page+1} / ${total}`;previous.disabled=page===0;next.disabled=page===total-1}
 function refresh(){
  scheduled=false;if(!dialog.open)return
  decorate()
  // La grille retrouve exactement sa structure et ses dimensions d’origine pendant le puzzle.
  if(dialog.dataset.mode==='puzzle'||dialog.dataset.travelStep==='go'){
   const warning=dialog.querySelector<HTMLElement>('.hunger-banner')
   dialog.style.setProperty('--game-puzzle-alert',`${warning?warning.getBoundingClientRect().height+8:0}px`)
   if(track.isConnected){track.replaceWith(...track.childNodes);body.scrollLeft=0;body.scrollTop=0}
   if(!pager.hidden)pager.hidden=true
   return
  }
  if(!track.isConnected){track.append(...body.childNodes);body.append(track);page=0}
  // Les mises à jour des modules peuvent ajouter un reçu au corps après sa mise en forme.
  for(const child of [...body.childNodes])if(child!==track)track.append(child)
  const style=getComputedStyle(body),height=body.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)
  track.style.height=Math.max(80,height)+'px';track.style.columnWidth=track.clientWidth+'px'
  total=Math.max(1,Math.ceil((track.scrollWidth+24)/(track.clientWidth+24)))
  if(pager.hidden!==(total===1))pager.hidden=total===1
  if(reset){page=0;reset=false;reveal=null;previewRequested=false}
  // Un choix mène à son aperçu, sans demander de chercher plus bas dans la fenêtre.
  const preview=reveal??(previewRequested?track.querySelector<HTMLElement>('[class$="-preview"]:not([hidden]),.classic-work-preview:not([hidden])'):null)
  if(preview){const offset=preview.getBoundingClientRect().left-track.getBoundingClientRect().left;page=Math.floor(offset/(track.clientWidth+24))}
  previewRequested=false;reveal=null;go(page)
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(refresh)}}
 previous.onclick=()=>go(page-1);next.onclick=()=>go(page+1)
 body.addEventListener('scroll',()=>{const actual=Math.round(body.scrollLeft/(track.clientWidth+24));if(actual!==page)go(actual)},{passive:true})
 dialog.addEventListener('click',event=>{if((event.target as Element).closest('button[aria-pressed]'))previewRequested=true;schedule()})
 dialog.addEventListener('input',schedule)
 new MutationObserver(records=>{
  if(records.some(r=>r.target===dialog&&r.attributeName==='open'))reset=true
  for(const record of records){
   const target=record.target instanceof Element?record.target:record.target.parentElement
   const result=target?.closest<HTMLElement>('[class$="-result"],[data-work-receipt],#venue-result,[role="alert"]')
   if(result&&!result.hidden&&result.textContent?.trim()&&track.contains(result))reveal=result
  }
  schedule()
 }).observe(dialog,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden','aria-pressed','data-mode','data-travel-step']})
 new ResizeObserver(schedule).observe(body)
 document.fonts.ready.then(schedule)
}
