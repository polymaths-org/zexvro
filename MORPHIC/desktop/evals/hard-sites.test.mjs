import test from 'node:test'
import assert from 'node:assert/strict'
import { startHardSites,expectedReconciliation } from './hard-sites.mjs'
const post=(s,path,data)=>fetch(s.base+path,{method:'POST',body:JSON.stringify(data)})
test('dense fixture has 1800 real cards and a seeded exact-product oracle',async()=>{
 const s=await startHardSites({seed:7});try{
  const html=await(await fetch(s.base+'/dense')).text();assert.equal((html.match(/<article>/g)||[]).length,1800)
  assert.equal((html.match(/<button/g)||[]).length,3600)
  assert.equal((await post(s,'/api/dense',{sku:s.sku,quantity:2,reference:s.nonce})).status,422)
  assert.equal(s.state.orders.length,0)
  assert.equal((await post(s,'/api/dense',{sku:s.sku,quantity:3,reference:s.nonce})).status,200)
  assert.equal(s.state.orders.length,1)
 }finally{await s.close()}
})
test('outage and conflict are real; lost response still commits exactly one effect',async()=>{
 const s=await startHardSites();try{
  assert.equal((await fetch(s.base+'/api/availability')).status,503)
  assert.equal((await fetch(s.base+'/api/availability')).status,200)
  assert.equal((await post(s,'/api/review',{room:'Cedar',seats:3})).status,409)
  assert.equal((await post(s,'/api/review',{room:'Birch',seats:3})).status,200)
  assert.equal((await post(s,'/api/reserve',{room:'Birch',seats:3})).status,502)
  const result=await(await fetch(s.base+'/api/status')).json();assert.equal(result.orders.length,1);assert.equal(result.receipt,'REQUEST-204')
 }finally{await s.close()}
})
test('reconciliation rejects incorrect classifications and amounts, not just a claimed completion',async()=>{
 const s=await startHardSites({seed:9});try{
  assert.equal((await post(s,'/api/reconcile',[])).status,422)
  const expected=expectedReconciliation(9);assert.equal(expected.length,24)
  assert.equal((await post(s,'/api/reconcile',expected)).status,200)
  const wrong=structuredClone(expected);wrong[1].amount+=0.01
  assert.equal((await post(s,'/api/reconcile',wrong)).status,422)
 }finally{await s.close()}
})

test('paired calendars require a real intersection, not blanket impossible-task refusal',async()=>{
 const s=await startHardSites();try{
  for(const owner of ['Mira','Dev','Atrium'])assert.ok((await(await fetch(s.docsBase+`/calendar?owner=${owner}&mode=impossible`)).text()).includes(owner))
  assert.equal((await post(s,'/api/workshop',{mode:'impossible',start:'10:00',end:'11:30'})).status,422)
  assert.equal(s.state.workshops.length,0)
  assert.equal((await post(s,'/api/workshop',{mode:'feasible',start:'09:30',end:'11:00'})).status,422)
  assert.equal((await post(s,'/api/workshop',{mode:'feasible',start:'10:00',end:'11:30'})).status,200)
 }finally{await s.close()}
})
