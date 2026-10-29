import {mountSportEnergy} from './sport-energy-ui'
import {mountFoodBag} from './food-bag-ui'
import { mountAccompaniedOutings } from './accompanied-outings-ui'
import { getAccompaniedState, onAccompaniedChange } from './accompanied-outings'
import { getGuidedPresentation, isGuidedOutingActive, setGuidedProgress } from './guided-outing-state'
import { mountMoodEffects } from './mood-effects-ui'
import { mountHouseBills } from './house-bills-ui'
import { mountRespoLevelNotice } from './respo-level-ui'
import { getRespoProgress } from './respo-level'
import { mountDaylight } from './daylight'
import type { DayPeriod } from './daylight'
import './daylight.css'
/*
 * Point d’entrée : relie la scène Babylon, les menus et les règles de gameplay.
 * Les modules métier restent responsables des ressources, de l’heure et des routines.
 */

import './style.css'

import { mountGameClock, onGameTimeChange } from './game-clock'

import { mountWallet } from './currency'

import { mountPlayerResources, getPlayerResources } from './player-resources'
import { mountTravel } from './travel-ui'
import { mountVenues } from './venue-ui'
import { npcTemplates, isNPCAvailable, getNPCZone, getNPCState } from './npcs'
import { getNPCMapPosition } from './npc-navigation'
import { npcNeedsService } from './npc-relationships'
import { mountNPCDialogue } from './npc-dialogue-ui'
import { mountWaiting } from './waiting-ui'
import type { TravelPoint, TravelMode } from './travel'

import { createSurfaceKit } from './surfaces'

import { createCityLife } from './city-life'

import { cityScale, cityPosition } from './city-layout'

import { ColorCurves } from '@babylonjs/core/Materials/colorCurves'

import { SpotLight } from '@babylonjs/core/Lights/spotLight'

import { Engine } from '@babylonjs/core/Engines/engine'

import { Scene } from '@babylonjs/core/scene'

import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'

import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Viewport } from '@babylonjs/core/Maths/math.viewport'

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'

import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'

import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'

import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader'

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'

import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'

import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'

import { Mesh } from '@babylonjs/core/Meshes/mesh'

import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'

import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'

import '@babylonjs/loaders/glTF'
import { mountPopupShell } from './popup-shell'
import { mountHudEnhance } from './hud-enhance'
import './popups.css'
import './hud.css'
import './ui-theme.css'
import './ui-composition.css'
import './ui-readability.css'
import './menu-cards.css'



const base = import.meta.env.BASE_URL

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `

<canvas id="city" aria-label="Mboa Ville en 3D : glisser pour tourner, molette pour zoomer"></canvas>

<header><a class="brand" href="${base}" aria-label="Mboa Ville, accueil"><span class="brand-icon">M</span><span>MBOA<span class="brand-light">VILLE</span><small>LA VILLE PREND DU RELIEF</small></span></a><div class="player-card" role="group" aria-label="Le Respo, votre personnage"><span class="player-ring"><span class="player-photo"><img class="hero-portrait" src="${base}portraits/respo.png" alt=""/></span><span class="player-level" aria-label="Niveau"><small>NIV</small><b id="player-level">1</b></span></span><span class="player-info"><b class="player-name">Le Respo</b><span class="player-xp"><b id="player-xp-text">0 / 190</b> pts Respo</span><span class="player-xp-bar"><i></i></span></span></div><div class="header-right"><div class="hud-stats"><div class="resource-stats"><div class="game-wallet" role="group" aria-label="Argent disponible"><img src="${base}ui/currency-nkap.png" alt="" width="58" height="48"/><div class="game-wallet-details"><span class="wallet-heading"><span class="game-wallet-label">Argent</span><button id="bills-open" type="button" title="Factures de la maison" aria-label="Ouvrir les factures">Factures</button></span><span id="money-amount" class="game-wallet-amount">0</span></div></div><div id="karma-counter" class="game-wallet karma-wallet" role="group" aria-label="Karma : points de moralité"><img src="${base}ui/currency-karma.png" alt="" width="48" height="48"/><div class="game-wallet-details"><span class="game-wallet-label">Karma</span><span id="karma-amount" class="game-wallet-amount">0</span></div></div><div id="energy-counter" class="game-wallet energy-wallet" role="group" aria-label="Énergie : 100 sur 100"><img src="${base}ui/currency-energy.png" alt="" width="48" height="48"/><div class="game-wallet-details"><span class="game-wallet-label">Énergie</span><span id="energy-amount" class="game-wallet-amount">100 / 100</span></div></div><div id="respo-counter" class="game-wallet respo-wallet" role="group" aria-label="Points Respo"><img src="${base}ui/currency-respo.png" alt="" width="48" height="48"/><div class="game-wallet-details"><span class="respo-heading"><span class="game-wallet-label">Points Respo</span><span id="respo-level">Niv. 1</span></span><span id="respo-amount" class="game-wallet-amount">0 / 190</span><progress id="respo-progress" max="190" value="0" aria-label="Progression vers le prochain niveau"></progress></div></div><div id="mood-counter" class="game-wallet mood-wallet" role="group" aria-label="Humeur"><span id="mood-icon" class="mood-icon" style="background-image:url('${base}ui/mood-sprites.png')" aria-hidden="true"></span><div class="game-wallet-details"><span class="mood-heading"><span class="game-wallet-label">Humeur</span><button id="mood-effects-open" type="button" aria-label="Consulter les effets sur l’humeur">Effets</button></span><span id="mood-amount" class="game-wallet-amount">90</span><span id="mood-label" class="mood-label">Content</span></div></div></div><div class="game-clock" role="group" aria-label="Calendrier du jeu"><span id="game-time" class="game-clock-time">08:00</span><span id="game-day" class="game-clock-day">Lundi</span><span class="game-clock-week"><span id="game-week">Semaine 1</span><span id="game-period">Jour</span></span><button id="wait-open" class="clock-wait-button" type="button" disabled>◷ Attendre</button></div></div><div class="header-actions"><span class="edition"><i></i> EXPLOREZ LE MBOA</span><button id="bag-open" type="button" disabled>Sac · 0/1</button><button id="compare" aria-pressed="false">▧ <span>Voir la référence</span></button><button id="help" aria-expanded="false" aria-controls="help-panel" aria-label="Aide à la navigation">?</button></div></div></header>

<div id="reference" hidden><img src="${base}reference/worldmap-wsp.png" alt="Vue de la ville dans la scène Unity de référence"/><span>LA VILLE D’ORIGINE</span></div>

<aside id="help-panel" hidden><b>Explorez la ville</b><p>Glissez pour tourner autour de la ville.<br>Utilisez la molette ou pincez pour zoomer.<br>Clic droit + glisser ou flèches du clavier pour vous déplacer (Maj pour aller plus vite).</p><p>Choisissez un lieu en bas pour vous en approcher.</p></aside>

<div id="landmarks" aria-label="Lieux de la ville"></div>

<footer><div class="place-picker"><button id="places-toggle" type="button" aria-expanded="false" aria-controls="places-panel"><span class="places-pin" aria-hidden="true">📍</span><span class="places-text"><small>Vous regardez</small><span id="view-name">Au cœur de Mboa Ville</span></span><span class="places-caret" aria-hidden="true">▴</span></button><nav id="places-panel" class="places" aria-label="Points de vue" hidden><span class="places-title">Aller voir un lieu</span><button data-view="city" class="active">Vue d’ensemble</button><button data-view="square">Rond-point</button><button data-view="market">Marché</button><button data-view="ministry">Ministère</button><button data-view="pilton">Petit Tripl (Pilton, Farmous, ...)</button><button data-view="hill">Présidence</button><button data-view="stadium">Omnisport</button><button data-view="airport">Nsimaport</button><button data-view="culture">Avenue Culturel</button><button data-view="njoka">Njoka</button><button data-view="home">Maison</button><button data-view="palms">Cité des palmiers</button><button data-view="jcd">Rue JCD</button><button data-view="baos">Rue des BAOs</button><button data-view="education">Education</button><button data-view="supermarket">Supermarché</button><button data-view="tekno">Tekno shop</button><button data-view="ahann">Plateau Ahannn</button><button data-view="club">Club matango 2-0</button><button data-view="village">Mboa village</button></nav></div><div class="tools"><button id="orbit" aria-pressed="false" title="Visite automatique">▷ <span>Visite</span></button><button id="motion" data-label="Pause" aria-pressed="false" aria-label="Mettre la ville en pause" title="Mettre la ville en pause">Ⅱ</button><button id="reset" data-label="Recentrer" aria-label="Retrouver la vue de référence" title="Vue de référence">↺</button><button id="light" data-label="Ambiance" aria-pressed="false" aria-label="Activer l’ambiance du soir" title="Changer l’ambiance">☀</button></div></footer>

<div class="loading" role="status"><div class="loading-mark">M</div><b>Mboa prend du relief.</b><span id="load-status">Chargement de la ville et de ses textures…</span><div class="loading-track"><i></i></div></div>

<div id="dialogue" class="dialogue" hidden><div class="dialogue-bubble"><img id="dialogue-portrait" class="dialogue-portrait hero-portrait" alt=""/></div><div class="dialogue-box"><b id="dialogue-name"></b><p id="dialogue-text"></p><button id="dialogue-close" aria-label="Fermer le dialogue">×</button></div></div>`

mountGameClock(document.querySelector<HTMLElement>('.game-clock')!)

mountWallet(document.querySelector<HTMLElement>('.game-wallet')!)

mountPlayerResources(document.querySelector<HTMLElement>('.resource-stats')!)

const canvas = document.querySelector<HTMLCanvasElement>('#city')!

const engine = new Engine(canvas, true, {preserveDrawingBuffer:true, stencil:true})

engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.6))

const scene = new Scene(engine)

scene.useRightHandedSystem = true

scene.clearColor = new Color4(.72,.88,.90,1)

scene.fogMode = Scene.FOGMODE_LINEAR

scene.fogStart = 410*cityScale; scene.fogEnd = 790*cityScale; scene.fogColor = new Color3(.72,.88,.90)

scene.ambientColor = new Color3(.12,.12,.12)

const grade=new ColorCurves();grade.globalSaturation=-10;grade.highlightsExposure=-6;grade.midtonesExposure=3

scene.imageProcessingConfiguration.colorCurves=grade;scene.imageProcessingConfiguration.colorCurvesEnabled=true

scene.imageProcessingConfiguration.contrast=1.035

const surfaces=createSurfaceKit(scene)

function overviewRadius(){return 320*cityScale*Math.max(1,Math.min(1.7,1.6/(innerWidth/innerHeight)))} 

const camera = new ArcRotateCamera('Vue de référence', Math.PI/2, .82, overviewRadius(), cityPosition(new Vector3(-25,0,0)), scene)

camera.fov=.7; camera.minZ=Math.max(.5,camera.radius*.02); camera.maxZ=4200

camera.attachControl(canvas,true)

camera.lowerBetaLimit=.22; camera.upperBetaLimit=1.4

camera.lowerRadiusLimit=30; camera.upperRadiusLimit=650*cityScale

camera.wheelDeltaPercentage=.025; camera.panningSensibility=90;camera.pinchDeltaPercentage=.006

const ambient = new HemisphericLight('Lumière du ciel',new Vector3(.2,1,.1),scene)

ambient.intensity=.88;ambient.groundColor=new Color3(.6,.6,.55)

const sun = new DirectionalLight('Soleil',new Vector3(-.6,-1,-.4),scene)

sun.position.copyFrom(cityPosition(new Vector3(120,220,90)));sun.intensity=.55;sun.diffuse=new Color3(1,.96,.85)

const shadows = new ShadowGenerator(2048,sun)

shadows.usePercentageCloserFiltering=true;shadows.bias=.002;shadows.normalBias=.04;shadows.darkness=.25

sun.autoCalcShadowZBounds=true;sun.shadowMinZ=1;sun.shadowMaxZ=650*cityScale

const palaceLight=new SpotLight('Éclairage de la présidence',cityPosition(new Vector3(-177,51,-40)),new Vector3(0,-.35/cityScale,-1),Math.PI/2,2,scene)

palaceLight.diffuse=new Color3(1,.82,.57);palaceLight.intensity=0;palaceLight.range=75*cityScale



type View = {target:Vector3;radius:number;alpha:number;beta:number;label:string}

// Repères des lieux : les X/Z sont ensuite adaptés à l’échelle de la carte ; Y conserve la hauteur du décor.
const views:Record<string,View>={

 city:{target:new Vector3(-25,0,0),radius:overviewRadius(),alpha:Math.PI/2,beta:.82,label:'Au cœur de Mboa Ville'},

 square:{target:new Vector3(-15.86,9,-.7),radius:65,alpha:Math.PI/2+.13,beta:.98,label:'La place de Mougabiang'},

 market:{target:new Vector3(-53,1,27),radius:85,alpha:Math.PI/2+.1,beta:.7,label:'Le marché de Mboa'},

 ministry:{target:new Vector3(3.74,10,-34.39),radius:78,alpha:Math.PI/2+.15,beta:.95,label:'Le quartier du ministère'},

 hill:{target:new Vector3(-177.98,42,-64.55),radius:155,alpha:Math.PI/2+.12,beta:.85,label:'La présidence'},

 stadium:{target:new Vector3(96,3,12),radius:86,alpha:Math.PI/2+.12,beta:.72,label:'Omnisport'},

 airport:{target:new Vector3(86,5,-44),radius:95,alpha:Math.PI/2+.2,beta:.8,label:'Nsimaport'},

 culture:{target:new Vector3(110,10,20),radius:60,alpha:Math.PI/2+.12,beta:.78,label:'Avenue Culturel'},

 njoka:{target:new Vector3(53,3,37),radius:80,alpha:Math.PI/2+.08,beta:.8,label:'La rue du Njoka'},

 pilton:{target:new Vector3(38,16,-75),radius:90,alpha:Math.PI/2+.1,beta:.84,label:'Petit Tripl (Pilton, Farmous, ...)'},

 home:{target:new Vector3(-18,6,71),radius:65,alpha:Math.PI/2+.1,beta:.82,label:'Maison'},

 palms:{target:new Vector3(-33,5,65),radius:68,alpha:Math.PI/2+.1,beta:.82,label:'Cité des palmiers'},

 jcd:{target:new Vector3(-76,5,41),radius:75,alpha:Math.PI/2+.1,beta:.78,label:'Rue JCD'},

 baos:{target:new Vector3(-79,6,-16),radius:80,alpha:Math.PI/2+.1,beta:.8,label:'La rue des BAOs'},

 education:{target:new Vector3(-47,6,-65),radius:80,alpha:Math.PI/2+.1,beta:.8,label:'Le complexe scolaire'},

 supermarket:{target:new Vector3(-12,9,-67),radius:55,alpha:Math.PI/2+.1,beta:.8,label:'Le supermarché'},

 tekno:{target:new Vector3(26,9,-27),radius:60,alpha:Math.PI/2+.1,beta:.8,label:'Tekno shop'},

 ahann:{target:new Vector3(26,10,0),radius:55,alpha:Math.PI/2+.1,beta:.8,label:'Plateau Ahannn'},

 club:{target:new Vector3(30,3,63),radius:50,alpha:Math.PI/2+.1,beta:.8,label:'Club matango 2-0'},

 village:{target:new Vector3(29,3,85),radius:60,alpha:Math.PI/2+.1,beta:.8,label:'Mboa village'},

}

for(const [key,view] of Object.entries(views)){

 view.target=cityPosition(view.target)

 if(key!=='city')view.radius*=Math.sqrt(cityScale)

}

let destination:View|null=null, orbit=false

let cityLife:ReturnType<typeof createCityLife>|undefined

let motionPaused=matchMedia('(prefers-reduced-motion: reduce)').matches

function setOrbit(value:boolean){orbit=value;const b=document.querySelector<HTMLButtonElement>('#orbit')!;b.innerHTML=orbit?'Ⅱ <span>Pause</span>':'▷ <span>Visite</span>';b.setAttribute('aria-pressed',String(orbit))}

function select(key:string){destination=views[key]!;setOrbit(false);document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.getAttribute('data-view')===key));document.querySelector('#view-name')!.textContent=destination.label

 if(key==='home')showDialogue(`${base}portraits/respo.png`,'Le Respo','Me revoilà à la maison… direction la mairie, j’ai un pays à gérer.')

 else hideDialogue()}

// Distingue le lieu réellement atteint de la destination sauvegardée au départ pour reprendre après rechargement.
let playerZone='home'
const playerPosition=new Vector3(0,8,0)
let guidedVisualPaused=import.meta.env.DEV&&(window as unknown as {__MBOA_GUIDED_QA_PAUSED__?:boolean}).__MBOA_GUIDED_QA_PAUSED__===true
let activeTrip:{key:string;points:Vector3[];distances:number[];length:number;elapsed:number;duration:number;done?:()=>void}|null=null
function beginTrip(key:string,route:TravelPoint[],mode:TravelMode,done?:()=>void){
  const points=route.map(p=>Vector3.FromArray(p)),distances=[0]
  for(let i=1;i<points.length;i++)distances.push(distances[i-1]!+Vector3.Distance(points[i-1]!,points[i]!))
  const length=distances.at(-1)!
  activeTrip={key,points,distances,length,elapsed:0,done,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?.1:Math.max(4,Math.min(12,length/(mode==='walk'?45:75)))}
  playerPosition.copyFrom(points[0]!)
  try{localStorage.setItem('mboa-player-zone-v1',key)}catch{/* Keep travelling in this session. */}
  hideDialogue();setOrbit(false)
  const middle=Vector3.Center(points[0]!,points.at(-1)!)
  destination={...views.city!,target:middle,radius:Math.max(120,Math.min(650*cityScale,length*1.2))}
}
const travel=mountTravel({
 base,
 origin:()=>({key:playerZone,label:views[playerZone]!.label,position:playerPosition.asArray() as TravelPoint}),
 place:key=>({key,label:views[key]!.label,position:[views[key]!.target.x,Math.max(10,views[key]!.target.y+12),views[key]!.target.z]}),
 depart:beginTrip
})
const venues=mountVenues({takeAway:id=>foodBagUI.openPurchase(id),base,currentZone:()=>playerZone,label:key=>views[key]!.label,travelling:()=>travel.isTravelling(),invite:id=>accompaniedUI.open(id),interact:(id,serviceId)=>{
 const npc=npcTemplates.find(item=>item.id===id)
 if(!npc||!isNPCAvailable(id)||travel.isTravelling()||playerZone!==getNPCZone(id))return
 npcConversation.open(id,serviceId)
}})
const npcConversation=mountNPCDialogue({base,canInteract:id=>getNPCZone(id)===playerZone&&!travel.isTravelling(),back:id=>{const zone=getNPCZone(id);if(zone)venues.open(zone,'people')}})
const accompaniedUI=mountAccompaniedOutings({currentZone:()=>playerZone,travelling:()=>travel.isTravelling(),locate:key=>[views[key]!.target.x,Math.max(10,views[key]!.target.y+12),views[key]!.target.z],label:key=>views[key]!.label,depart:beginTrip,
 positionAt(key){playerZone=key;playerPosition.copyFromFloats(views[key]!.target.x,Math.max(10,views[key]!.target.y+12),views[key]!.target.z);try{localStorage.setItem('mboa-player-zone-v1',key)}catch{/* Position en mémoire. */}hideDialogue();destination=views[key]!;setOrbit(false)},
 back:id=>{const zone=getNPCZone(id);if(zone)venues.open(zone,'people')},
})
accompaniedUI.setVisualPaused(guidedVisualPaused)
function updateGuidedControls(){for(const id of ['compare','help'])document.querySelector<HTMLButtonElement>(`#${id}`)!.disabled=isGuidedOutingActive()}
onAccompaniedChange(updateGuidedControls);updateGuidedControls()
// L’attente n’est proposée qu’en exploration, après chargement et hors déplacement ou dialogue.
const foodBagUI=mountFoodBag({button:document.querySelector<HTMLButtonElement>('#bag-open')!,currentZone:()=>playerZone,travelling:()=>travel.isTravelling(),canOpen:()=>document.documentElement.dataset.ready==='true'&&!!document.querySelector<HTMLElement>('#dialogue')!.hidden&&!!document.querySelector<HTMLElement>('#reference')!.hidden&&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden),back:()=>venues.open(playerZone)})
const sportEnergyUI=mountSportEnergy({canOpen:()=>document.documentElement.dataset.ready==='true'&&!travel.isTravelling()&&!!document.querySelector<HTMLElement>('#dialogue')!.hidden&&!!document.querySelector<HTMLElement>('#reference')!.hidden&&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)})
const waitingUI=mountWaiting({button:document.querySelector<HTMLButtonElement>('#wait-open')!,canWait:()=>document.documentElement.dataset.ready==='true'&&!travel.isTravelling()&&!!document.querySelector<HTMLDivElement>('#dialogue')!.hidden&&!!document.querySelector<HTMLDivElement>('#reference')!.hidden})
const houseBills=mountHouseBills({button:document.querySelector<HTMLButtonElement>('#bills-open')!,canOpen:()=>document.documentElement.dataset.ready==='true'&&!travel.isTravelling()
 &&!!document.querySelector<HTMLElement>('#dialogue')!.hidden&&!!document.querySelector<HTMLElement>('#reference')!.hidden
 &&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)})
const moodEffects=mountMoodEffects({button:document.querySelector<HTMLButtonElement>('#mood-effects-open')!,canOpen:()=>document.documentElement.dataset.ready==='true'&&!travel.isTravelling()
 &&!!document.querySelector<HTMLElement>('#dialogue')!.hidden&&!!document.querySelector<HTMLElement>('#reference')!.hidden
 &&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden)})
mountPopupShell()
mountHudEnhance()
// Animation du GPS en secondes réelles : le coût et les minutes de jeu ont déjà été appliqués par travel-ui.
function tickJourney(delta:number,force=false){
 if(guidedVisualPaused&&isGuidedOutingActive()&&!force)return
 const trip=activeTrip
 if(!trip)return
 trip.elapsed+=Math.min(delta,100)/1000
 const t=Math.min(1,trip.elapsed/trip.duration),progress=t*t*(3-2*t)*trip.length
 if(isGuidedOutingActive())setGuidedProgress(t*t*(3-2*t))
 let i=1;while(i<trip.distances.length-1&&trip.distances[i]!<progress)i++
 const span=trip.distances[i]!-trip.distances[i-1]!
 playerPosition.copyFrom(Vector3.Lerp(trip.points[i-1]!,trip.points[i]!,span>0?(progress-trip.distances[i-1]!)/span:1))
 if(t===1){playerZone=trip.key;activeTrip=null;if(trip.done){trip.done();return}select(playerZone);travel.arrive(playerZone);hideDialogue();venues.open(playerZone);document.querySelector('.player-pin')?.setAttribute('aria-label',`Le Respo, ${views[playerZone]!.label}`)}
}
// Un clic regarde la ville, ouvre le menu si le joueur est sur place, ou propose un trajet dans les autres cas.
function requestZone(key:string){if(isGuidedOutingActive()){destination=views[key]!;setOrbit(false);return}if(key==='city')select(key);else if(key===playerZone&&!travel.isTravelling()){select(key);hideDialogue();venues.open(key)}else travel.open(key)}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>requestZone(b.dataset.view!))

document.querySelector<HTMLButtonElement>('#reset')!.onclick=()=>select('city')

function updateMotion(){

 cityLife?.setPaused(motionPaused);surfaces.setPaused(motionPaused)

 const b=document.querySelector<HTMLButtonElement>('#motion')!

 b.textContent=motionPaused?'▷':'Ⅱ';b.setAttribute('aria-pressed',String(motionPaused));b.setAttribute('aria-label',motionPaused?'Animer la ville':'Mettre la ville en pause');b.title=motionPaused?'Animer la ville':'Mettre la ville en pause'

}

document.querySelector<HTMLButtonElement>('#motion')!.onclick=()=>{motionPaused=!motionPaused;updateMotion()}

updateMotion()

document.querySelector<HTMLButtonElement>('#orbit')!.onclick=()=>{destination=null;setOrbit(!orbit)}
const placesToggle=document.querySelector<HTMLButtonElement>('#places-toggle')!,placesPanel=document.querySelector<HTMLElement>('#places-panel')!
function showPlaces(open:boolean){placesPanel.hidden=!open;placesToggle.setAttribute('aria-expanded',String(open))}
placesToggle.onclick=()=>showPlaces(placesToggle.getAttribute('aria-expanded')!=='true')
placesPanel.addEventListener('click',event=>{if((event.target as HTMLElement).closest('[data-view]'))showPlaces(false)})
document.addEventListener('pointerdown',event=>{if(!placesPanel.hidden&&!(event.target as HTMLElement).closest('.place-picker'))showPlaces(false)})

document.querySelector<HTMLButtonElement>('#compare')!.onclick=()=>{const panel=document.querySelector<HTMLDivElement>('#reference')!;panel.hidden=!panel.hidden;document.querySelector('#compare')!.setAttribute('aria-pressed',String(!panel.hidden));document.querySelector('#compare span')!.textContent=panel.hidden?'Voir la référence':'Revenir à la 3D'}

document.querySelector<HTMLButtonElement>('#help')!.onclick=()=>{const panel=document.querySelector<HTMLDivElement>('#help-panel')!;panel.hidden=!panel.hidden;document.querySelector('#help')!.setAttribute('aria-expanded',String(!panel.hidden))}

const dialogue=document.querySelector<HTMLDivElement>('#dialogue')!

const dialoguePortrait=document.querySelector<HTMLImageElement>('#dialogue-portrait')!

const dialogueName=document.querySelector<HTMLElement>('#dialogue-name')!

const dialogueText=document.querySelector<HTMLParagraphElement>('#dialogue-text')!

function showDialogue(portraitSrc:string,name:string,text:string){

 dialogue.dataset.npcId='';dialoguePortrait.classList.toggle('hero-portrait',portraitSrc.endsWith('/respo.png'));dialoguePortrait.src=portraitSrc;dialoguePortrait.alt=name;dialogueName.textContent=name;dialogueText.textContent=text;dialogue.hidden=false

}

function hideDialogue(){dialogue.hidden=true;dialogue.dataset.npcId=''}
onGameTimeChange(()=>{
 if(dialogue.dataset.npcId&&!isNPCAvailable(dialogue.dataset.npcId))hideDialogue()
 for(const pin of pins)if(pin.npcId)pin.button.hidden=getGuidedPresentation()?.npcId!==pin.npcId&&!isNPCAvailable(pin.npcId)
 updateNPCNotifications()
})

document.querySelector<HTMLButtonElement>('#dialogue-close')!.onclick=hideDialogue

;(window as unknown as {showDialogue:typeof showDialogue}).showDialogue=showDialogue

canvas.addEventListener('pointerdown',()=>{destination=null;setOrbit(false)})

canvas.addEventListener('contextmenu',event=>event.preventDefault())

// Déplacement de la caméra au clavier : les flèches font glisser la vue sur le sol, dans le sens de l'écran.
camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput')
const panKeys=new Set<string>()
const panDirections:Record<string,[number,number]>={ArrowUp:[1,0],ArrowDown:[-1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}
let panFast=false
window.addEventListener('keydown',event=>{
 panFast=event.shiftKey
 if(!(event.key in panDirections)||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return
 const target=event.target as HTMLElement|null
 if(target?.closest('input,textarea,select,[contenteditable="true"],dialog')||document.querySelector('dialog[open]'))return
 event.preventDefault();panKeys.add(event.key);destination=null;setOrbit(false)
})
window.addEventListener('keyup',event=>{panFast=event.shiftKey;panKeys.delete(event.key)})
window.addEventListener('blur',()=>panKeys.clear())
function tickKeyboardPan(delta:number){
 if(!panKeys.size)return
 let forward=0,side=0
 for(const key of panKeys){const [f,s]=panDirections[key]!;forward+=f;side+=s}
 const fx=camera.target.x-camera.position.x,fz=camera.target.z-camera.position.z,length=Math.hypot(fx,fz)
 if(!length||(!forward&&!side))return
 const step=camera.radius*.0011*Math.min(delta,50)*(panFast?2.5:1),dx=fx/length,dz=fz/length,norm=Math.hypot(forward,side)
 camera.target.x+=(dx*forward-dz*side)/norm*step;camera.target.z+=(dz*forward+dx*side)/norm*step
}

window.addEventListener('keydown',event=>{if(event.key==='Escape'){showPlaces(false);document.querySelector<HTMLDivElement>('#reference')!.hidden=true;document.querySelector('#compare')!.setAttribute('aria-pressed','false');document.querySelector('#compare span')!.textContent='Voir la référence';document.querySelector<HTMLDivElement>('#help-panel')!.hidden=true;document.querySelector('#help')!.setAttribute('aria-expanded','false');hideDialogue()}})

// Boucle visuelle uniquement : caméra, eau, circulation et animation de trajet ne changent pas le calendrier.
scene.onBeforeRenderObservable.add(()=>{

 levelNotice.tick();tickDaylight();surfaces.tick(engine.getDeltaTime());cityLife?.tick(engine.getDeltaTime());tickJourney(engine.getDeltaTime());tickKeyboardPan(engine.getDeltaTime())

 const zoomOut=Math.max(0,camera.radius-350*cityScale)

 scene.fogStart=410*cityScale+zoomOut*1.6;scene.fogEnd=790*cityScale+zoomOut*2

 const blend=1-Math.exp(-engine.getDeltaTime()*.005)

 if(destination){camera.target=Vector3.Lerp(camera.target,destination.target,blend);camera.radius+=(destination.radius-camera.radius)*blend;camera.alpha+=Math.atan2(Math.sin(destination.alpha-camera.alpha),Math.cos(destination.alpha-camera.alpha))*blend;camera.beta+=(destination.beta-camera.beta)*blend;if(Math.abs(camera.radius-destination.radius)<.02&&Vector3.Distance(camera.target,destination.target)<.02)destination=null}

 if(!destination){camera.target.x=Math.max(-245*cityScale,Math.min(165*cityScale,camera.target.x));camera.target.z=Math.max(-175*cityScale,Math.min(175*cityScale,camera.target.z));camera.target.y=Math.max(0,Math.min(80,camera.target.y))}

 if(orbit)camera.alpha+=engine.getDeltaTime()*.000045

 // Keep millimetre-scale surface gaps distinct as the enlarged city recedes.

 camera.minZ=Math.max(.5,camera.radius*.02)

})

engine.runRenderLoop(()=>scene.render())

window.addEventListener('resize',()=>{engine.resize();views.city!.radius=overviewRadius();if(document.querySelector('[data-view=city]')!.classList.contains('active'))destination=views.city!})

const pins:{button:HTMLButtonElement;position:Vector3;alwaysVisible?:boolean;npcId?:string}[]=[]

function createCharacterPin(portrait:string,isHero=false){
 const button=document.createElement('button');button.className='player-pin'
 const frame=document.createElement('img');frame.className='player-pin-frame';frame.src=base+'ui/gps-pin.png';frame.alt=''
 const circle=document.createElement('span');circle.className='player-pin-portrait'
 const image=document.createElement('img');image.src=base+portrait;image.alt=''
 if(isHero)image.className='hero-portrait'
 circle.append(image);button.append(frame,circle)
 return button
}

// Installe les repères cliquables et les GPS après chargement des positions finales, notamment celle de la maison.
function createLandmarks(){

 const root=document.querySelector('#landmarks')!

 for(const [key,label,position] of [

  ['hill','Présidence',[-178,70,-65]],['ministry','Ministère',[4,33,-34]],

  ['stadium','Omnisport',[96,15,12]],['airport','Nsimaport',[86,26,-44]],['culture','Avenue Culturel',[110,20,20]],

  ['market','Marché',[-55,8,28]],['njoka','Rue du Njoka',[54,16,37]],

  ['pilton','Petit Tripl (Pilton, Farmous, ...)',[38,42,-75]],['home','Maison',[-18,14,71]],

  ['palms','Cité des palmiers',[-33,12,65]],['jcd','Rue JCD',[-75,13,42]],

  ['baos','Rue des BAOs',[-79,14,-16]],['education','Education',[-47,15,-65]],['supermarket','Supermarché',[-12,20,-67]],

  ['tekno','Tekno shop',[26,16,-27]],['ahann','Plateau Ahannn',[26,17,0]],

  ['club','Club matango 2-0',[30,12,63]],['village','Mboa village',[29,12,85]],

 ] as [string,string,number[]][]){

  const button=document.createElement('button');button.className='landmark';button.dataset.view=key;button.innerHTML='<i></i><span>'+label+'</span>';button.onclick=()=>requestZone(key);root.append(button)

  const pinPosition=cityPosition(Vector3.FromArray(position))

  if(key==='home'){pinPosition.x=views.home!.target.x;pinPosition.z=views.home!.target.z}

  pins.push({button,position:pinPosition})

 }

 const playerPin=createCharacterPin('portraits/respo.png',true);playerPin.setAttribute('aria-label','Le Respo, à la maison');playerPin.onclick=()=>requestZone(playerZone);root.append(playerPin)

 try{const stored=localStorage.getItem('mboa-player-zone-v1'),saved=stored==='hotel'?'pilton':stored;if(saved&&saved!=='city'&&views[saved])playerZone=saved}catch{/* Default to home. */}
 const guidedResume=getAccompaniedState();if(guidedResume&&guidedResume.phase!=='done')playerZone=guidedResume.phase==='outbound'?guidedResume.plan.origin:guidedResume.plan.destination
 playerPosition.copyFromFloats(views[playerZone]!.target.x,Math.max(10,views[playerZone]!.target.y+12),views[playerZone]!.target.z)
 playerPin.setAttribute('aria-label',`Le Respo, ${views[playerZone]!.label}`)
 pins.push({button:playerPin,position:playerPosition,alwaysVisible:true})
 for(const npc of npcTemplates){
  const button=createCharacterPin(npc.portrait);button.classList.add('npc-pin');button.dataset.npc=npc.id;button.hidden=true
  button.title=`${npc.name} — ${views[npc.zone]!.label}`
  button.setAttribute('aria-label',`${npc.name}, ${npc.relationship}, ${views[npc.zone]!.label}`)
  const notification=document.createElement('span');notification.className='npc-request-badge';notification.textContent='!';notification.hidden=true;notification.setAttribute('aria-label','Besoin d’un service');button.append(notification)
  button.onclick=()=>{
   if(travel.isTravelling())return
   const state=getNPCState(npc.id),zone=state?.zone??state?.destination
   if(!zone)return
   if(playerZone!==zone){requestZone(zone);return}
   if(!isNPCAvailable(npc.id))return
   hideDialogue();venues.open(zone,'people')
  }
  root.append(button)
  const zone=views[npc.zone]!
  const locationPin=pins.find(pin=>pin.button.classList.contains('landmark')&&pin.button.dataset.view===npc.zone)
  const position=locationPin?.position.clone()??zone.target.clone()
  position.y=Math.max(10,zone.target.y+12)
  pins.push({button,position,alwaysVisible:true,npcId:npc.id})
 }

}

// Place les GPS d’après les routines et indique les demandes actives ; les positions sources des bâtiments restent intactes.
function updateNPCNotifications(){
 for(const resident of pins.filter(pin=>pin.npcId)){
  const npc=npcTemplates.find(npc=>npc.id===resident.npcId)!
  const state=getNPCState(npc.id),zone=state?.zone??state?.destination
  const position=getGuidedPresentation()?.npcId===npc.id?playerPosition.asArray() as TravelPoint:getNPCMapPosition(npc.id,key=>{const view=views[key]!;return [view.target.x,Math.max(10,view.target.y+12),view.target.z]})
  if(position)resident.position.copyFromFloats(...position)
  resident.button.dataset.travelling=String(!!state?.travelling)
  resident.button.title=`${npc.name} — ${zone?views[zone]!.label:'Indisponible'}${state?` · ${state.activity}`:''}`
  const needsService=isNPCAvailable(npc.id)&&npcNeedsService(npc.id)
  const notification=resident.button.querySelector<HTMLElement>('.npc-request-badge')
  if(notification)notification.hidden=!needsService
  resident.button.setAttribute('aria-label',resident.button.title+(needsService?` — ${npc.name} a besoin d’un service`:''))
 }
}

// Projette les positions 3D dans l’interface, puis espace les GPS pour éviter les chevauchements et les compteurs.
scene.onAfterRenderObservable.add(()=>{

 updateNPCNotifications()
 const guided=getGuidedPresentation()
 const visible=camera.radius>175*Math.sqrt(cityScale)&&document.querySelector<HTMLDivElement>('#reference')!.hidden

 const viewport=camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight())
 const resourceBounds=document.querySelector<HTMLElement>('.resource-stats')!.getBoundingClientRect()
 const upperControls=[...document.querySelectorAll<HTMLElement>('.game-clock,.header-actions,.player-card')].map(node=>node.getBoundingClientRect())
 const states=new Map(npcTemplates.map(npc=>[npc.id,getNPCState(npc.id)]))
 const markerGroup=(id:string)=>{if(guided?.npcId===id)return '__guided';const state=states.get(id);return state?.zone??(state?.travelling?`${state.origin}>${state.destination}`:'')}
 const shownNPCs=npcTemplates.filter(npc=>{
  const state=states.get(npc.id),position=pins.find(pin=>pin.npcId===npc.id)?.position
  return state&&(guided?.npcId===npc.id||state.available||state.travelling)&&(guided?.npcId===npc.id||npc.id==='bae'||playerZone===state.zone||playerZone===state.destination||(position&&camera.radius<220*cityScale&&Vector3.Distance(camera.target,position)<100*cityScale))
 })
 const groups=new Map<string,string[]>()
 for(const npc of shownNPCs){const key=markerGroup(npc.id),group=groups.get(key)??[];group.push(npc.id);groups.set(key,group)}
 if(guided)groups.set('__guided',['__player',guided.npcId])
 if(!travel.isTravelling())groups.set(playerZone,['__player',...(groups.get(playerZone)??[])])
 const placedCharacters:{x:number;y:number}[]=[]

 for(const pin of pins){

  const point=Vector3.Project(pin.position,Matrix.Identity(),scene.getTransformMatrix(),viewport)

  pin.button.hidden=(!visible&&!pin.alwaysVisible&&!(pin.npcId&&guided?.npcId===pin.npcId))||point.z<0||point.z>1||!!(pin.npcId&&!shownNPCs.some(npc=>npc.id===pin.npcId))

  // Clamp to the safe area instead of hiding outright, so a label near the edge stays readable rather than disappearing.

  const isCharacter=pin.button.classList.contains('player-pin')
  const characterZone=pin.npcId?markerGroup(pin.npcId):guided?'__guided':playerZone
  const group=isCharacter?(groups.get(characterZone)??['__player']):[]
  const index=Math.max(0,group.indexOf(pin.npcId??'__player'))
  const columns=Math.min(3,Math.max(1,group.length)),rows=Math.max(1,Math.ceil(group.length/columns))
  const groupHalfWidth=isCharacter?((columns-1)*68+54)/2:40
  const groupHeight=isCharacter?(rows-1)*68+74:0
  const offsetX=isCharacter?(index%columns-(columns-1)/2)*68:0
  const offsetY=isCharacter?-Math.floor(index/columns)*68:0
  const inset=Math.max(55,groupHalfWidth+12)
  let center=Math.max(inset,Math.min(innerWidth-inset,point.x/engine.getRenderWidth()*innerWidth))
  let y=Math.max(95+(rows-1)*68,Math.min(innerHeight-145,point.y/engine.getRenderHeight()*innerHeight))
  if(isCharacter&&innerWidth<=760&&y>=resourceBounds.top&&y-groupHeight<=resourceBounds.bottom&&center-groupHalfWidth<resourceBounds.right){
   const clearCenter=resourceBounds.right+groupHalfWidth+12
   if(clearCenter<=innerWidth-groupHalfWidth-12)center=Math.max(center,clearCenter)
   else y=Math.min(innerHeight-145,Math.max(y,resourceBounds.bottom+groupHeight+10))
  }
  let x=center+offsetX
  y+=offsetY
  if(isCharacter&&innerWidth<=760)for(const obstacle of upperControls){
   if(x+30>obstacle.left&&x-30<obstacle.right&&y>obstacle.top&&y-74<obstacle.bottom)y=Math.min(innerHeight-145,obstacle.bottom+84)
  }
  if(isCharacter&&!pin.button.hidden){
   const overlaps=(cx:number,cy:number)=>placedCharacters.some(other=>Math.abs(cx-other.x)<60&&Math.abs(cy-other.y)<66)
   if(overlaps(x,y))for(const [dx,dy] of [[0,72],[0,-72],[-68,0],[68,0],[0,144],[0,-144],[-68,72],[68,72],[-68,-72],[68,-72]]){
    const cx=x+dx!,cy=y+dy!
    if(cx<35||cx>innerWidth-35||cy<95||cy>innerHeight-145||overlaps(cx,cy))continue
    if(innerWidth<=760&&[resourceBounds,...upperControls].some(obstacle=>cx+30>obstacle.left&&cx-30<obstacle.right&&cy>obstacle.top&&cy-74<obstacle.bottom))continue
    x=cx;y=cy;break
   }
   placedCharacters.push({x,y})
  }

  pin.button.style.left=x+'px';pin.button.style.top=y+'px'

 }

})

// A procedural sky keeps the model three-dimensional without flattening the reference into a backdrop.

const skyTexture=new DynamicTexture('Ciel de Mboa',{width:2048,height:1024},scene,false)

const skyContext=skyTexture.getContext()

const gradient=skyContext.createLinearGradient(0,0,0,1024)

gradient.addColorStop(0,'#64cbdc');gradient.addColorStop(.36,'#a4e6ed');gradient.addColorStop(.52,'#edf6e9');gradient.addColorStop(.7,'#bceaf0');gradient.addColorStop(1,'#8fd8e3')

skyContext.fillStyle=gradient;skyContext.fillRect(0,0,2048,1024)

for(let i=0;i<22;i++){

 const x=(i*173)%2048,y=320+(i*31)%170

 const cloud=skyContext.createRadialGradient(x,y,2,x,y,70+(i%4)*18)

 cloud.addColorStop(0,'rgba(255,255,255,.65)');cloud.addColorStop(1,'rgba(255,255,255,0)')

 skyContext.fillStyle=cloud;skyContext.fillRect(x-125,y-125,250,250)

}

skyTexture.update()

const skyMaterial=new StandardMaterial('Atmosphère',scene)

skyMaterial.diffuseTexture=skyTexture;skyMaterial.emissiveColor=Color3.White();skyMaterial.disableLighting=true;skyMaterial.fogEnabled=false

const sky=MeshBuilder.CreateSphere('Ciel',{diameter:6000,segments:32,sideOrientation:Mesh.BACKSIDE},scene)

sky.material=skyMaterial;sky.infiniteDistance=true;sky.isPickable=false

// Charge le GLB et les données routières, adapte les matériaux puis regroupe la géométrie statique pour le rendu.
async function loadCity(){

 try{

  const routeResponse=fetch(`${base}data/wsp-traffic.json?v=palace-20261023-2`)

  const container=await LoadAssetContainerAsync(`${base}models/mboa-wsp.glb?v=palace-20261023-2`,scene,{pluginOptions:{gltf:{createInstances:false}},onProgress:event=>{if(event.lengthComputable)document.querySelector('#load-status')!.textContent=`Chargement des modèles… ${Math.round(event.loaded/event.total*100)} %`}})

  container.addAllToScene()

  const traffic=await(await routeResponse).json() as {route:number[][];layout?:{home:number[]}}

  if(traffic.layout){views.home!.target.x=traffic.layout.home[0]!;views.home!.target.z=traffic.layout.home[1]!}

  let trafficPrototype:Mesh|undefined

  const mapped=new Map<number,StandardMaterial>()

  for(const source of [...container.materials]){

   if(!(source instanceof PBRMaterial))continue

   const m=new StandardMaterial(source.name,scene);m.diffuseTexture=source.albedoTexture;m.diffuseColor=source.albedoColor.toGammaSpace();m.specularColor=Color3.Black();m.emissiveColor=new Color3(.025,.025,.025);m.backFaceCulling=source.backFaceCulling

   surfaces.styleMaterial(source.name,m)

   mapped.set(source.uniqueId,m)

  }

  for(const multi of container.multiMaterials)multi.subMaterials=multi.subMaterials.map(m=>m&&mapped.has(m.uniqueId)?mapped.get(m.uniqueId)!:m)

  const groups=new Map<string,Mesh[]>()

  // The statue's exported texture is a baked grey AO map, not real colors, so it renders as a flat mannequin; give it a bronze material instead.

  const statueMaterial=new StandardMaterial('Bronze de la statue de Mougabiang',scene)

  statueMaterial.diffuseColor=new Color3(.34,.25,.15);statueMaterial.specularColor=new Color3(.22,.18,.12);statueMaterial.specularPower=42

  for(const mesh of [...container.meshes]){

   if(!(mesh instanceof Mesh)||!mesh.getTotalVertices())continue

   mesh.computeWorldMatrix(true)

   const vertexColors=mesh.getVerticesData('color')

   if(vertexColors){const stride=mesh.getVertexBuffer('color')!.getSize();const corrected=Array.from(vertexColors);for(let i=0;i<corrected.length;i++)if(i%stride<3)corrected[i]=Math.pow(Math.max(0,corrected[i]!),1/2.2);mesh.setVerticesData('color',corrected,false,stride)}

   if(mesh.material&&mapped.has(mesh.material.uniqueId))mesh.material=mapped.get(mesh.material.uniqueId)!

   if(mesh.name==='Mougabiang statue')mesh.material=statueMaterial

   if(mesh.name==='WSP Traffic prototype'){trafficPrototype=mesh;mesh.setEnabled(false);continue}

   surfaces.prepareMesh(mesh)

   mesh.receiveShadows=true

   if(mesh.material){const key=`${mesh.material.uniqueId}:${mesh.getVerticesDataKinds().sort().join(",")}`;const group=groups.get(key)??[];group.push(mesh);groups.set(key,group)}

  }

  // Batch static geometry by material to keep the detailed city responsive.

  for(const group of groups.values()){

   const merged=group.length>1?Mesh.MergeMeshes(group,true,true,undefined,false,true):group[0]

   if(!merged)continue

   merged.name=merged.material?.name??'Mboa';merged.receiveShadows=true;merged.freezeWorldMatrix();merged.isPickable=false

   if(!/Relief|Sol peint|Roche|Montagnes|Océan|Rivière|Ligne|Boulevard|Route|Trottoir|Marquage|^bg\.|WSP Terre|WSP Eau|WSP Mer vivante/.test(merged.name))shadows.addShadowCaster(merged)

  }

  cityLife=createCityLife(scene,trafficPrototype,shadows);updateMotion()

  createLandmarks()

  await scene.whenReadyAsync()

  document.querySelector('.loading')!.remove()

  document.documentElement.dataset.ready='true'
  accompaniedUI.resume()

 }catch(error){console.error('Chargement de Mboa impossible',error);const loading=document.querySelector<HTMLDivElement>('.loading')!;loading.innerHTML='<b>La ville n’a pas pu être chargée.</b><span>Vérifiez la connexion puis réessayez.</span><button id="retry">Réessayer</button>';document.querySelector<HTMLButtonElement>('#retry')!.onclick=()=>location.reload()}

}

// Les couleurs sont interpolées en temps réel sans avancer les minutes de jeu.
const daylightProfiles: Record<DayPeriod, { ambient: number; sun: number; tint: number[]; sky: number[]; glow: number[]; lamps: boolean }> = {
 Jour: {ambient:.88,sun:.55,tint:[1,.96,.85],sky:[.72,.88,.90],glow:[1,1,1],lamps:false},
 Aube: {ambient:.64,sun:.38,tint:[1,.79,.64],sky:[.61,.70,.80],glow:[.75,.72,.80],lamps:true},
 Crépuscule: {ambient:.52,sun:.42,tint:[1,.64,.34],sky:[.46,.46,.60],glow:[.64,.55,.65],lamps:true},
 Nuit: {ambient:.47,sun:.20,tint:[.65,.75,1],sky:[.12,.20,.34],glow:[.27,.35,.53],lamps:true},
}
let lightingTransition: {start:number; from:typeof lightingValues; to:typeof lightingValues}|null=null
let lightingValues={ambient:.88,sun:.55,tint:new Color3(1,.96,.85),sky:new Color3(.72,.88,.90),glow:Color3.White()}
let lampsEnabled=false
function paintLighting() {
 ambient.intensity=lightingValues.ambient;sun.intensity=lightingValues.sun;sun.diffuse=lightingValues.tint
 scene.clearColor=new Color4(lightingValues.sky.r,lightingValues.sky.g,lightingValues.sky.b,1)
 scene.fogColor=lightingValues.sky;skyMaterial.emissiveColor=lightingValues.glow
}
const daylight=mountDaylight({
 button:document.querySelector<HTMLButtonElement>('#light')!,label:document.querySelector<HTMLElement>('#game-period')!,
 canApply:()=>document.documentElement.dataset.ready==='true'&&!travel.isTravelling()&&!document.querySelector('dialog[open]')
  &&!!document.querySelector<HTMLElement>('#dialogue')!.hidden&&!!document.querySelector<HTMLElement>('#reference')!.hidden
  &&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden),
 apply(period){
  const profile=daylightProfiles[period]
  const to={ambient:profile.ambient,sun:profile.sun,tint:Color3.FromArray(profile.tint),sky:Color3.FromArray(profile.sky),glow:Color3.FromArray(profile.glow)}
  lampsEnabled=profile.lamps;surfaces.setEvening(lampsEnabled);cityLife?.setEvening(lampsEnabled);palaceLight.intensity=lampsEnabled?.85:0
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){lightingValues=to;lightingTransition=null;paintLighting()}
  else lightingTransition={start:performance.now(),from:lightingValues,to}
 },
})
function tickDaylight(){
 daylight.tick()
 if(!lightingTransition)return
 const {from,to,start}=lightingTransition
 const t=Math.min(1,(performance.now()-start)/650),ease=t*t*(3-2*t)
 lightingValues={ambient:from.ambient+(to.ambient-from.ambient)*ease,sun:from.sun+(to.sun-from.sun)*ease,
  tint:Color3.Lerp(from.tint,to.tint,ease),sky:Color3.Lerp(from.sky,to.sky,ease),glow:Color3.Lerp(from.glow,to.glow,ease)}
 paintLighting();if(t===1)lightingTransition=null
}

const levelNotice=mountRespoLevelNotice(()=>document.documentElement.dataset.ready==='true'&&!travel.isTravelling()&&!document.querySelector('dialog[open]')
 &&!!document.querySelector<HTMLElement>('#dialogue')!.hidden&&!!document.querySelector<HTMLElement>('#reference')!.hidden
 &&![...document.querySelectorAll<HTMLElement>('.wait-transition')].some(mask=>!mask.hidden))

// Development-only camera control for visual checks around the complete city.

if(import.meta.env.DEV)Object.defineProperty(window,'__MBOA_QA__',{configurable:true,value:{

 setCamera(alpha:number,beta:number,radius:number,target:number[]){

  destination=null;setOrbit(false);camera.setTarget(Vector3.FromArray(target));camera.alpha=alpha;camera.beta=beta;camera.radius=radius

  camera.inertialAlphaOffset=0;camera.inertialBetaOffset=0;camera.inertialRadiusOffset=0

 },

 // Accélère uniquement l’animation de trajet pour les contrôles ; les coûts sont déjà appliqués au départ.
 advanceJourney(seconds:number){for(let elapsed=0;elapsed<Math.max(0,Math.min(120,seconds));elapsed+=.1)tickJourney(100,true)},
 pauseGuided(value:boolean){guidedVisualPaused=value;accompaniedUI.setVisualPaused(value)},
 advanceGuided(){const state=getAccompaniedState();if(state?.phase==='activity')accompaniedUI.advanceVisual();else for(let i=0;i<1500&&activeTrip;i++)tickJourney(100,true)},
 advanceLife(seconds:number){for(let elapsed=0;elapsed<Math.max(0,Math.min(120,seconds));elapsed+=.1)cityLife?.tick(100)},
 openTravel(key:string){travel.open(key)},
 // Contrôle visuel : projette des points du monde, ou les voies de circulation, à l'écran.
 project(points:number[][]){scene.updateTransformMatrix(true);const viewport=new Viewport(0,0,engine.getRenderWidth(),engine.getRenderHeight());return points.map(p=>{const q=Vector3.Project(new Vector3(p[0],p[1],p[2]),Matrix.Identity(),scene.getTransformMatrix(),viewport);return [q.x/engine.getRenderWidth()*innerWidth,q.y/engine.getRenderHeight()*innerHeight,q.z]})},
 trafficLanes(){return (cityLife?.lanePaths()??[]).map(lane=>(window as unknown as {__MBOA_QA__:{project:(p:number[][])=>number[][]}}).__MBOA_QA__.project(lane))},
 openVenue(key:string,tab?:'place'|'people'){playerZone=key;venues.open(key,tab)},
 metrics(){return {model:'mboa-wsp.glb',layoutScale:cityScale,meshes:scene.meshes.length,activeMeshes:scene.getActiveMeshes().length,vertices:scene.getTotalVertices(),landmarks:pins.length,player:{zone:playerZone,position:playerPosition.asArray(),travelling:travel.isTravelling()},camera:{target:camera.target.asArray(),radius:camera.radius},life:cityLife?.metrics()}},

}})

if(import.meta.env.DEV)Object.defineProperty(window,'render_game_to_text',{configurable:true,value:()=>JSON.stringify({coordinates:'Babylon right-handed world; x/z ground, y height',player:{zone:playerZone,position:playerPosition.asArray(),travelling:travel.isTravelling()},npcs:npcTemplates.map(npc=>({id:npc.id,name:npc.name,zone:getNPCZone(npc.id),activity:getNPCState(npc.id)?.activity,rank:getNPCState(npc.id)?.rank,travelling:getNPCState(npc.id)?.travelling,destination:getNPCState(npc.id)?.destination,available:isNPCAvailable(npc.id),position:pins.find(pin=>pin.npcId===npc.id)?.position.asArray(),markerVisible:!pins.find(pin=>pin.npcId===npc.id)?.button.hidden})),bae:{zone:getNPCZone('bae'),available:isNPCAvailable('bae'),serviceNotification:playerZone==='home'&&!travel.isTravelling()&&isNPCAvailable('bae')&&npcNeedsService('bae')},work:venues.workState(),advancedWork:venues.advancedState(),sleeping:venues.sleepState(),meals:venues.mealState(),userQueue:venues.queueState(),meetings:venues.meetingState(),extra:venues.extraState(),canteen:venues.canteenState(),missions:venues.missionState(),toque:venues.toqueState(),comfort:venues.comfortState(),outings:venues.outingState(),accompanied:accompaniedUI.snapshot(),foodBag:foodBagUI.snapshot(),sportEnergy:sportEnergyUI.snapshot(),bills:houseBills.snapshot(),moodEffects:moodEffects.snapshot(),progression:{...getRespoProgress(getPlayerResources().ptRespo),notice:levelNotice.snapshot()},waiting:waitingUI.snapshot(),daylight:daylight.snapshot(),dialog:[...document.querySelectorAll('dialog[open]')].map(node=>node.className)})})

void loadCity()



















