/// <reference lib="dom" />
import { expect,test } from '@playwright/test'
import { createRequire } from 'node:module'
import { FakeVroai,launch,profile } from './helpers'
const {startHardSites}=createRequire(__filename)('../evals/hard-sites.mjs')
const action=(url:string)=>`<<action ${JSON.stringify({tool:'start_browsing',args:{goal:'Inspect enterprise catalogue',url}})}>>`

test('scoped inspection reaches an offscreen exact row among 5400 duplicate controls',async()=>{
 const sites=await startHardSites({seed:3}), model=new FakeVroai(), endpoint=await model.start()
 model.delayMs=60
 const {app,page}=await launch(profile({onboarded:true,introAnimation:false}),endpoint)
 try{
  model.queue=[action(`${sites.base}/dense`),JSON.stringify({actions:[{do:'inspect',query:sites.sku}]}),JSON.stringify({blocked:'Fixture inspection complete; no request authorized.'})]
  await page.getByLabel('What do you need help with?').fill(`Inspect the ${sites.sku} card at ${sites.base}/dense. Do not submit anything.`);await page.keyboard.press('Enter')
  await expect(page.getByText('Blocked — requirement unmet')).toBeVisible({timeout:20000})
  const snapshot=await page.evaluate(()=>window.morphic.browser.snapshot())
  expect(snapshot?.observation?.total).toBe(5401)
  expect(snapshot?.observation?.matched).toBe(3)
  expect(snapshot?.elements).toHaveLength(3)
  expect(snapshot?.elements.every(e=>e.context?.includes(sites.sku))).toBe(true)
  expect(snapshot?.text).toContain('Warehouse: Pune')
  expect(sites.state.orders).toHaveLength(0)
 }finally{await app.close();model.stop();await sites.close()}
})

test('unhappy-path fixture really exposes outage, conflict and committed-but-lost response',async()=>{
 const sites=await startHardSites(),model=new FakeVroai(),endpoint=await model.start()
 const {app,page}=await launch(profile({onboarded:true,introAnimation:false}),endpoint)
 try{
  await page.evaluate(url=>window.morphic.browser.navigate(url),`${sites.base}/resilience`)
  await expect.poll(()=>page.evaluate(async()=>(await window.morphic.browser.snapshot())?.title)).toBe('Booking operations')
  const js=async(source:string)=>app.evaluate(async({webContents},code)=>webContents.getAllWebContents().find(w=>w.getURL().includes('/resilience'))!.executeJavaScript(code),source)
  await js(`document.getElementById('availability').click()`)
  await expect.poll(()=>js(`document.getElementById('availabilityStatus').textContent`)).toContain('Temporary service outage')
  await js(`document.getElementById('availability').click()`)
  await expect.poll(()=>js(`document.getElementById('form').hidden`)).toBe(false)
  await js(`document.getElementById('seats').value='3';document.getElementById('review').click()`)
  await expect.poll(()=>js(`document.getElementById('reviewStatus').textContent`)).toContain('only 2 seats')
  await js(`document.getElementById('room').value='Birch';document.getElementById('review').click()`)
  await expect.poll(()=>js(`document.getElementById('submit').hidden`)).toBe(false)
  await js(`document.getElementById('submit').click()`)
  await expect.poll(()=>js(`document.getElementById('receipt').textContent`)).toContain('Outcome unknown')
  await js(`document.getElementById('status').click()`)
  await expect.poll(()=>js(`document.getElementById('receipt').textContent`)).toContain('REQUEST-204')
  expect(sites.state.orders).toEqual([{room:'Birch',seats:3,kind:'reservation'}])
 }finally{await app.close();model.stop();await sites.close()}
})

test('seeded product and 24-row reconciliation frontends execute their real validators',async()=>{
 const sites=await startHardSites({seed:4}),model=new FakeVroai(),endpoint=await model.start()
 const {app,page}=await launch(profile({onboarded:true,introAnimation:false}),endpoint)
 try{
  await page.evaluate(url=>window.morphic.browser.navigate(url),`${sites.base}/product?sku=${sites.sku}`)
  await expect.poll(()=>page.evaluate(async()=>(await window.morphic.browser.snapshot())?.title)).toBe('Product request')
  const js=async(source:string)=>app.evaluate(async({webContents},code)=>webContents.getAllWebContents().find(w=>/^http:/.test(w.getURL()))!.executeJavaScript(code),source)
  await js(`document.getElementById('quantity').value='3';document.getElementById('reference').value=${JSON.stringify(sites.nonce)};document.querySelector('button').click();document.querySelector('#review button').click()`)
  await expect.poll(()=>js(`document.getElementById('receipt').textContent`)).toContain('EQUIPMENT-204')
  expect(sites.state.orders).toHaveLength(1)
  await page.evaluate(url=>window.morphic.browser.navigate(url),`${sites.base}/reconcile`)
  await expect.poll(()=>page.evaluate(async()=>(await window.morphic.browser.snapshot())?.title)).toBe('Accounts reconciliation')
  const {expectedReconciliation}=createRequire(__filename)('../evals/hard-sites.mjs')
  await js(`const rows=${JSON.stringify(expectedReconciliation(4))};const f=document.getElementById('reconciliation');rows.forEach((r,i)=>{f.elements['amount-'+i].value=r.amount;f.elements['decision-'+i].value=r.decision});f.querySelector('button').click()`)
  await expect.poll(()=>js(`document.getElementById('result').textContent`)).toContain('24 records')
 }finally{await app.close();model.stop();await sites.close()}
})

test('scoped review remains bound to form fields outside the inspected region',async()=>{
 const sites=await startHardSites(),model=new FakeVroai(),endpoint=await model.start();model.delayMs=60
 const {app,page}=await launch(profile({onboarded:true,introAnimation:false}),endpoint)
 try{
  model.queue=[action(`${sites.base}/product?sku=${sites.sku}`),'{"actions":[{"do":"click","id":3}]}','{"actions":[{"do":"inspect","query":"Submit request"}]}','{"actions":[{"do":"click","id":4}]}','{"blocked":"The reviewed form changed."}']
  await page.getByLabel('What do you need help with?').fill(`Review the request at ${sites.base}/product?sku=${sites.sku} and submit after my review.`);await page.keyboard.press('Enter')
  await expect(page.getByRole('button',{name:'Yes, go ahead'})).toBeVisible({timeout:20000})
  const snapshot=await page.evaluate(()=>window.morphic.browser.snapshot())
  expect(snapshot?.elements).toHaveLength(1)
  expect(snapshot?.formFingerprint).toMatch(/^[a-f0-9]{64}$/)
  expect(snapshot).not.toHaveProperty('_formState')
  await app.evaluate(async({webContents})=>{await webContents.getAllWebContents().find(w=>w.getURL().includes('/product'))!.executeJavaScript(`document.getElementById('quantity').value='30'`)})
  await page.getByRole('button',{name:'Yes, go ahead'}).click()
  await expect(page.getByText('Review expired because the page or form changed')).toBeVisible()
  expect(sites.state.orders).toHaveLength(0)
 }finally{await app.close();model.stop();await sites.close()}
})

test('a form mutation during the visible highlight cannot reuse the prior approval',async()=>{
 const sites=await startHardSites(),model=new FakeVroai(),endpoint=await model.start();model.delayMs=60
 const {app,page}=await launch(profile({onboarded:true,introAnimation:false}),endpoint)
 try{
  model.queue=[action(`${sites.base}/product?sku=${sites.sku}`),'{"actions":[{"do":"click","id":3}]}','{"actions":[{"do":"click","id":4}]}','{"blocked":"The form changed before dispatch."}']
  await page.getByLabel('What do you need help with?').fill(`Review ${sites.base}/product?sku=${sites.sku} then submit after I approve.`);await page.keyboard.press('Enter')
  await expect(page.getByRole('button',{name:'Yes, go ahead'})).toBeVisible({timeout:20000})
  await app.evaluate(async({webContents})=>{await webContents.getAllWebContents().find(w=>w.getURL().includes('/product'))!.executeJavaScript(`new MutationObserver((changes,observer)=>{if(changes.some(c=>Array.from(c.addedNodes).some(n=>n.id==='__morph_mark'))){document.getElementById('quantity').value='30';observer.disconnect()}}).observe(document.documentElement,{childList:true})`)})
  await page.getByRole('button',{name:'Yes, go ahead'}).click()
  await expect(page.getByText(/Reviewed form changed before dispatch/)).toBeVisible()
  expect(sites.state.orders).toHaveLength(0)
 }finally{await app.close();model.stop();await sites.close()}
})

test('structured decimal and time fields preserve complete values',async()=>{
 const sites=await startHardSites(),model=new FakeVroai(),endpoint=await model.start();model.delayMs=60
 const {app,page}=await launch(profile({onboarded:true,introAnimation:false}),endpoint)
 try{
  model.queue=[action(`${sites.base}/reconcile`),'{"actions":[{"do":"type","id":2,"text":"12.50"}]}','{"blocked":"Decimal fixture checked."}']
  await page.getByLabel('What do you need help with?').fill(`Open ${sites.base}/reconcile and enter 12.50 in the first USD amount field; do not validate.`);await page.keyboard.press('Enter')
  await expect(page.getByText('Decimal fixture checked.')).toBeVisible({timeout:15000})
  const js=async(source:string)=>app.evaluate(async({webContents},code)=>webContents.getAllWebContents().find(w=>/^http:/.test(w.getURL()))!.executeJavaScript(code),source)
  expect(await js(`document.querySelector('input').value`)).toBe('12.50')
  model.queue=[action(`${sites.base}/schedule?mode=feasible`),'{"actions":[{"do":"type","id":4,"text":"10:00"},{"do":"type","id":5,"text":"11:30"}]}','{"blocked":"Time fixture checked."}']
  await page.getByLabel('What do you need help with?').fill(`Open ${sites.base}/schedule?mode=feasible and fill start 10:00, end 11:30. Do not confirm.`);await page.keyboard.press('Enter')
  await expect(page.getByText('Time fixture checked.')).toBeVisible({timeout:15000})
  expect(await js(`document.getElementById('start').value`)).toBe('10:00')
  expect(await js(`document.getElementById('end').value`)).toBe('11:30')
 }finally{await app.close();model.stop();await sites.close()}
})
