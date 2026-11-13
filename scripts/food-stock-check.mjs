// Stock journalier des plats hors maison : 2 à 8 par plat et par jour, tirage stable, épuisement, renouvellement le lendemain.
import assert from 'node:assert/strict'
const store=new Map([['mboa-game-minutes-v1','600']]);globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}
const c=await import('../src/game-clock.ts'),s=await import('../src/food-stock.ts')
const items=['canteen:rice','venue:food-bhb@market','outing:restaurant:classic','bag:meal@market']
for(let day=0;day<20;day++)for(const item of items){const st=s.getFoodStock(item,day*1440+600);assert.ok(st.initial>=2&&st.initial<=8,`${item} jour ${day} : ${st.initial}`)}
const first=s.getFoodStock('canteen:rice');assert.equal(s.getFoodStock('canteen:rice').initial,first.initial,'Même tirage pendant la journée')
for(let i=0;i<first.initial;i++){assert.equal(s.foodStockReason('canteen:rice'),'');s.consumeFoodStock('canteen:rice')}
assert.equal(s.getFoodStock('canteen:rice').soldOut,true);assert.notEqual(s.foodStockReason('canteen:rice'),'')
assert.equal(s.getFoodStock('venue:food-bhb@market').remaining,s.getFoodStock('venue:food-bhb@market').initial,'Les autres plats gardent leur stock')
const reload=await import('../src/food-stock.ts?reload');assert.equal(reload.getFoodStock('canteen:rice').soldOut,true,'Le stock consommé est sauvegardé')
c.advanceGameTime(1440,'sleep');assert.equal(reload.getFoodStock('canteen:rice').soldOut,false,'Le stock se renouvelle le lendemain')
console.log('Food stock: 2–8 per dish and day, stable draw, sold out, saved, renewed next day passed')
