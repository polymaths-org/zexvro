/// <reference lib="dom" />
import { expect, test, type ElectronApplication } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { appDir, FakeVroai, launch, profile, shot, TestSite } from './helpers'

const vroai = new FakeVroai()
const site = new TestSite()
let url = ''
let siteUrl = ''
const shots = process.env.MORPHIC_SHOTS ?? join(appDir, 'test-results', 'shots')

test.beforeAll(async () => {
  url = await vroai.start()
  siteUrl = await site.start()
  vroai.delayMs = 150
})
test.afterAll(() => {
  vroai.stop()
  site.stop()
})

/** Playwright only captures the app's own page; the browser is a separate view, so capture it directly. */
async function shootBrowser(app: ElectronApplication, name: string) {
  const png = await app.evaluate(async ({ webContents }) => {
    const view = webContents.getAllWebContents().find((wc) => wc.getURL().startsWith('http://127.0.0.1'))
    return view ? (await view.capturePage()).toPNG().toString('base64') : null
  })
  if (png) writeFileSync(join(shots, `${name}.png`), Buffer.from(png, 'base64'))
}

test('Morph browses a website step by step while the person watches, and asks before booking', async () => {
  test.setTimeout(90_000)
  const { app, page } = await launch(profile({ onboarded: true, name: 'Asha', theme: 'dark' }), url)
  await expect(page.getByRole('heading', { name: /Asha/ })).toBeVisible({ timeout: 10_000 })

  vroai.queue = [
    `I can do that in my browser.\n<<action ${JSON.stringify({ tool: 'start_browsing', args: { goal: 'Book the morning train from Pune to Mumbai', url: siteUrl } })}>>`,
    JSON.stringify({ say: 'Filling in where you are travelling', actions: [{ do: 'type', id: 1, text: 'Pune' }, { do: 'type', id: 2, text: 'Mumbai' }, { do: 'click', id: 3 }] }),
    JSON.stringify({ say: 'Booking the 8:05 train', actions: [{ do: 'click', id: 1 }] }),
    JSON.stringify({ done: true, result: 'Your 8:05 train to Mumbai is booked. Your ticket number is ZX123.' })
  ]
  await page.getByLabel('What do you need help with?').fill('Book me the morning train from Pune to Mumbai')
  await page.keyboard.press('Enter')

  // Morph starts straight away (no start card by default): browser in the middle, chat on the right.
  await expect(page.getByRole('region', { name: "Morph's browser" })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Chat with Morph' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Morph needs your OK' })).toHaveCount(0)
  const task = page.getByRole('region', { name: 'Browsing task' })
  await expect(task.getByText('Typed “Pune” into “From”')).toBeVisible({ timeout: 20_000 })
  await expect(task.getByText('Pressed “Search”')).toBeVisible({ timeout: 20_000 })

  // Booking is a real-world action: Morph stops and asks.
  await expect(page.getByText('Press “Book now” on 127.0.0.1')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Waiting for you')).toBeVisible()
  expect(site.bookings).toEqual([])
  await shot(page, 'b02-ask-before-booking')
  await shootBrowser(app, 'b03-browser-results')
  await page.getByRole('button', { name: 'Yes, go ahead' }).click()

  await expect(task.getByText('Your 8:05 train to Mumbai is booked. Your ticket number is ZX123.')).toBeVisible({ timeout: 20_000 })
  await expect(task.getByText('Finished')).toBeVisible()
  expect(site.bookings).toEqual(['08:05'])
  await expect(page.getByText("You're browsing")).toBeVisible()
  await shot(page, 'b04-task-done')
  await shootBrowser(app, 'b05-browser-booked')

  // What Morph saw: numbered elements, and its own earlier steps.
  const stepPrompt = vroai.prompts.find((p) => p.includes('Current page: Rail Desk'))!
  expect(stepPrompt).toContain('[1] text box "From"')
  expect(stepPrompt).toContain('[3] button "Search"')

  // The person can browse themselves and ask Morph to explain the page.
  vroai.reply = 'This page says your train is booked and gives your ticket number, ZX123.'
  await page.getByRole('button', { name: 'Explain this page' }).click()
  await expect(page.getByText('This page says your train is booked')).toBeVisible()
  expect(vroai.prompts.at(-1)).toContain('Your ticket number is ZX123.')

  // Settings is a pop-up window over everything; the browser steps aside while it's open.
  await page.keyboard.press('Control+,')
  await page.getByRole('button', { name: 'Connectors' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.waitForTimeout(400)
  await shot(page, 'b06-settings-connectors')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Wider chat' }).click()
  await page.waitForTimeout(400)
  await shot(page, 'b09-wider-chat')
  await page.getByRole('button', { name: 'Close the browser' }).click()
  await expect(page.getByRole('region', { name: "Morph's browser" })).toBeHidden()

  // Morph learned the way (without what was typed), and shows it on the memory page.
  await page.getByRole('complementary', { name: 'Conversations' }).getByRole('button', { name: /What I remember/ }).click()
  const learned = page.getByRole('region', { name: "Things I've learned to do" })
  await expect(learned.getByText('Book the morning train from Pune to Mumbai')).toBeVisible()
  await learned.getByText('The steps', { exact: true }).click()
  await expect(learned.getByText('Typed into “From”')).toBeVisible()
  await expect(learned.getByText('Typed “Pune”')).toHaveCount(0)
  await shot(page, 'b10-learned-routine')
  await app.close()
})

test('connectors: add an MCP program from Settings and see its tools', async () => {
  const { app, page } = await launch(profile({ onboarded: true, name: 'Asha', theme: 'light', palette: 'ocean' }), url)
  await expect(page.getByRole('heading', { name: /Asha/ })).toBeVisible({ timeout: 10_000 })
  await page.keyboard.press('Control+,')
  await page.getByRole('button', { name: 'Connectors' }).click()
  await page.getByRole('button', { name: 'Add a connector' }).click()
  await page.getByLabel('Name').fill('Pharmacy')
  await page.getByText('A program on this computer').click()
  await page.getByLabel('Program and what to give it').fill(`${process.execPath} ${join(appDir, 'e2e/fixtures/mcp-server.mjs')}`)
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(page.getByText('Connected · 1 tool')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('list', { name: 'Pharmacy tools' }).getByText('opening_hours')).toBeVisible()
  await shot(page, 'b07-connector-added')
  await page.getByRole('button', { name: 'Switch off' }).click()
  await expect(page.getByText('Switched off')).toBeVisible()
  await page.getByRole('button', { name: 'Remove Pharmacy' }).click()
  await expect(page.getByText('No apps connected yet.')).toBeVisible()
  await app.close()
})

test('the opening animation plays on start, and any key skips it', async () => {
  const { app, page } = await launch(profile({ onboarded: true, name: 'Asha', theme: 'dark', introAnimation: true }), url)
  const letters = page.locator('div.fixed.inset-0.z-50 .wordmark')
  await expect(letters).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(900)
  await shot(page, 'b08-opening')
  await page.keyboard.press('Space')
  await expect(letters).toBeHidden()
  await expect(page.getByRole('heading', { name: /Asha/ })).toBeVisible()
  await app.close()
})
