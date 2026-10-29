import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
// Cas sauvegardés : capacité impaire, bonus de niveau, fatigue et sport simultanés.
for(const [base,points,awake,sport,energy,label] of [[105,0,0,false,10,'Affamé'],[105,0,0,false,11,'À faim'],[105,0,0,false,31,'À faim'],[105,0,0,false,32,'Normal'],[100,1330,0,true,120,'Normal'],[100,1330,0,true,121,'En forme'],[100,1330,1080,true,118,'Fatigué'],[100,1330,1080,true,11,'Affamé'],[100,1330,1080,true,12,'À faim']]){
 const code=`import assert from 'node:assert/strict';const m=new Map([['mboa-game-minutes-v1','1000'],['mboa-fatigue-v1',JSON.stringify({version:1,anchor:1000,awake:${awake}})],['mboa-player-resources-v1',JSON.stringify({karma:0,energy:${energy},maxEnergy:${base},ptRespo:${points},mood:90})]]);globalThis.localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};${sport?"m.set('mboa-sport-energy-v1',JSON.stringify({version:1,start:900,end:1260}));":''}const r=await import('./src/player-resources.ts');const before=JSON.stringify([...m]);assert.equal(r.getEnergyStatus().label,${JSON.stringify(label)});r.getEnergyStatus();assert.equal(JSON.stringify([...m]),before);`
 execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',code])
}
console.log('Odd capacities, level/sport permanent baseline, fatigue precedence and read-only status passed')
