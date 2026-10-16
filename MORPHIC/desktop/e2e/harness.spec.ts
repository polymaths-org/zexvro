/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { FakeVroai, launch, profile } from './helpers'
import { createRequire } from 'node:module'

const requireFixture = createRequire(__filename)
const { startSites } = requireFixture('../evals/sites.mjs')
const action = (goal: string, url?: string) => `<<action ${JSON.stringify({ tool: 'start_browsing', args: { goal, ...(url ? { url } : {}) } })}>>`

test('same-page follow-up preserves wizard DOM and full request with personal memory off', async () => {
  const sites = await startSites()
  const model = new FakeVroai()
  const endpoint = await model.start()
  model.delayMs = 30
  const { app, page } = await launch(profile({ onboarded: true, name: 'Rushi', introAnimation: false, memory: false }), endpoint)
  try {
    model.queue = [action('Open settings', `${sites.base}/settings`),
      '{"actions":[{"do":"select","id":1,"option":"Support"}]}',
      '{"actions":[{"do":"type","id":2,"text":"Rushi"},{"do":"click","id":3}]}',
      '{"actions":[{"do":"select","id":4,"option":"Daily"}]}',
      '{"actions":[{"do":"click","id":5}]}',
      '{"done":true,"result":"Daily draft saved."}']
    await page.getByLabel('What do you need help with?').fill(`Open ${sites.base}/settings, choose Support, name Rushi, and save a Daily draft.`)
    await page.keyboard.press('Enter')
    await expect.poll(() => sites.state.drafts.length).toBe(1)
    await expect(page.getByRole('region', { name: 'Browsing task' }).getByText('Finished', { exact: true })).toBeVisible()
    expect(model.prompts[1]).toContain('name Rushi, and save a Daily draft')
    model.queue = [action('Change frequency'),
      '{"actions":[{"do":"select","id":4,"option":"Weekly"}]}',
      '{"actions":[{"do":"click","id":5}]}',
      '{"done":true,"result":"Weekly draft saved."}']
    await page.getByLabel('What do you need help with?').fill('Change it to Weekly on this same page and save the draft.')
    await page.keyboard.press('Enter')
    await expect.poll(() => sites.state.drafts.length).toBe(2)
    await expect(page.getByRole('region', { name: 'Browsing task' }).last().getByText('Finished', { exact: true })).toBeVisible()
    expect(sites.state.resets).toBe(1)
    expect(sites.state.drafts).toEqual([{ workspace: 'Support', name: 'Rushi', frequency: 'Daily' }, { workspace: 'Support', name: 'Rushi', frequency: 'Weekly' }])
    expect(model.prompts.some(p => p.includes('Current browser observation') && p.includes('Daily draft saved'))).toBe(true)
  } finally { await app.close(); model.stop(); await sites.close() }
})

test('stale element changed after observation is rejected before any click', async () => {
  const sites = await startSites()
  const model = new FakeVroai()
  const endpoint = await model.start()
  model.delayMs = 600
  const { app, page } = await launch(profile({ onboarded: true, name: 'Rushi', introAnimation: false }), endpoint)
  try {
    model.queue = [action('Review inventory', `${sites.base}/inventory`), '{"actions":[{"do":"click","id":4}]}', '{"handoff":"Please review the changed page."}']
    await page.getByLabel('What do you need help with?').fill(`Open ${sites.base}/inventory and review the request.`)
    await page.keyboard.press('Enter')
    await expect.poll(() => model.prompts.length).toBeGreaterThanOrEqual(2)
    // id 4 is Review request in this fixture. Change its meaning while the model answers.
    await app.evaluate(async ({ webContents }) => {
      const wc = webContents.getAllWebContents().find(w => w.getURL().includes('/inventory'))!
      await wc.executeJavaScript(`document.querySelector('button').textContent = 'Pay now'`)
    })
    await expect(page.getByText(/Stale element:/)).toBeVisible({ timeout: 15000 })
    expect(sites.state.orders).toHaveLength(0)
    await page.getByRole('button', { name: 'Stop', exact: true }).first().click()
  } finally { await app.close(); model.stop(); await sites.close() }
})

test('text snapshots expose media alternatives and never pretend to send visual input', async () => {
  const sites = await startSites()
  const model = new FakeVroai()
  const endpoint = await model.start()
  const { app, page } = await launch(profile({ onboarded: true, introAnimation: false }), endpoint)
  try {
    await page.evaluate(url => window.morphic.browser.navigate(url), `${sites.base}/media`)
    await expect.poll(() => page.evaluate(async () => (await window.morphic.browser.snapshot())?.title)).toBe('Accessible training')
    const snapshot = await page.evaluate(() => window.morphic.browser.snapshot())
    expect(snapshot?.elements.some(e => e.label === 'Read image text alternative')).toBe(true)
    expect(snapshot?.elements.some(e => e.label === 'Read video transcript')).toBe(true)
    expect(snapshot?.media?.some(m => m.kind === 'img')).toBe(true)
    expect(snapshot).not.toHaveProperty('image')
  } finally { await app.close(); model.stop(); await sites.close() }
})


test('delayed fixture reveals a working Technical lookup before live-model scoring', async () => {
  const sites = await startSites()
  const model = new FakeVroai()
  const endpoint = await model.start()
  const { app, page } = await launch(profile({ onboarded: true, introAnimation: false }), endpoint)
  try {
    await page.evaluate(url => window.morphic.browser.navigate(url), `${sites.base}/dynamic`)
    await expect.poll(() => page.evaluate(async () => (await window.morphic.browser.snapshot())?.title)).toBe('Dynamic help desk')
    const evaluate = async (code: string) => app.evaluate(async ({ webContents }, source) => {
      const wc = webContents.getAllWebContents().find(w => w.getURL().includes('/dynamic'))!
      return wc.executeJavaScript(source)
    }, code)
    await evaluate(`document.getElementById('department').value='Support';document.getElementById('department').dispatchEvent(new Event('change'))`)
    await expect.poll(() => evaluate(`!!document.getElementById('topic')`)).toBe(true)
    await evaluate(`document.getElementById('topic').value='Technical';document.getElementById('find').click()`)
    await expect.poll(() => evaluate(`document.getElementById('answer').textContent`)).toContain('TECH-402')
  } finally { await app.close(); model.stop(); await sites.close() }
})

test('approval expires when a person changes the reviewed form before approving', async () => {
  const sites = await startSites()
  const model = new FakeVroai()
  const endpoint = await model.start()
  model.delayMs = 50
  const { app, page } = await launch(profile({ onboarded: true, name: 'Rushi', introAnimation: false }), endpoint)
  try {
    model.queue = [action('Review inventory', `${sites.base}/inventory`), '{"actions":[{"do":"click","id":4}]}', '{"actions":[{"do":"click","id":5}]}', '{"handoff":"Please review the changed quantity."}']
    await page.getByLabel('What do you need help with?').fill(`Open ${sites.base}/inventory and submit the request after my review.`)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Yes, go ahead' })).toBeVisible()
    await app.evaluate(async ({ webContents }) => {
      const wc = webContents.getAllWebContents().find(w => w.getURL().includes('/inventory'))!
      await wc.executeJavaScript(`document.getElementById('quantity').value='30'`)
    })
    await page.getByRole('button', { name: 'Yes, go ahead' }).click()
    await expect(page.getByText('Review expired because the page or form changed')).toBeVisible()
    expect(sites.state.orders).toHaveLength(0)
    await page.getByRole('button', { name: 'Stop', exact: true }).first().click()
  } finally { await app.close(); model.stop(); await sites.close() }
})
