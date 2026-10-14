/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { FakeVroai, launch, profile, shot } from './helpers'

const vroai = new FakeVroai()
let url = ''

test.beforeAll(async () => {
  url = await vroai.start()
})
test.afterAll(() => vroai.stop())

const rootVar = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)
const rootData = (page: Page, key: string) => page.evaluate((k) => document.documentElement.dataset[k], key)

async function openSettings(page: Page) {
  await page.keyboard.press('Control+,')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}
async function closeSettings(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeHidden()
}

test('collapsed sidebar keeps Morph at the top with New below it', async () => {
  const { app, page } = await launch(profile({ onboarded: true, name: 'Asha', theme: 'dark', sidebarOpen: false }), url)
  const sidebar = page.getByRole('complementary', { name: 'Conversations' })
  await expect(sidebar.getByRole('img', { name: 'Morph' })).toBeVisible({ timeout: 10_000 })
  const mark = await sidebar.getByRole('img', { name: 'Morph' }).boundingBox()
  const newButton = await sidebar.getByRole('button', { name: 'New' }).boundingBox()
  expect(mark!.y).toBeLessThan(newButton!.y)
  await page.waitForTimeout(400)
  await shot(page, 'l01-rail')
  await app.close()
})

test('advanced settings: blur, tint, background and animations apply live, reset, and persist', async () => {
  const userData = profile({ onboarded: true, name: 'Asha', theme: 'dark' })
  const { app, page } = await launch(userData, url)
  await expect(page.getByRole('heading', { name: /Asha/ })).toBeVisible({ timeout: 10_000 })
  vroai.reply = 'Here is an answer to look at.'
  await page.getByLabel('What do you need help with?').fill('Show me a bubble')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Here is an answer to look at.')).toBeVisible()

  await openSettings(page)
  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await expect(page.getByLabel('Chat bubble blur')).toBeVisible()
  expect(await rootVar(page, '--bubble-blur')).toBe('20px')

  await page.getByLabel('Chat bubble blur').fill('0')
  await expect.poll(() => rootVar(page, '--bubble-blur')).toBe('0px')
  await page.getByLabel('Glass tint').fill('60')
  await expect.poll(() => rootVar(page, '--glass-fill')).toBe('60%')
  await page.getByLabel('Background strength').fill('150')
  await expect.poll(() => rootData(page, 'bgBrightness')).toBe('1.5')
  await page.getByText('Still', { exact: true }).click()
  await expect.poll(() => rootData(page, 'bgMotion')).toBe('still')
  await page.getByText('Fewer animations', { exact: true }).click()
  await expect.poll(() => rootData(page, 'motion')).toBe('reduced')
  await page.getByLabel('Chat bubble blur').scrollIntoViewIfNeeded()
  await shot(page, 'l02-advanced')
  await closeSettings(page)
  await page.waitForTimeout(300)
  await shot(page, 'l03-advanced-applied')
  await app.close()

  // Kept after a restart.
  const again = await launch(userData, url)
  await expect(again.page.getByRole('heading', { name: /Asha/ })).toBeVisible({ timeout: 10_000 })
  expect(await rootVar(again.page, '--bubble-blur')).toBe('0px')
  expect(await rootData(again.page, 'bgMotion')).toBe('still')

  // Reset puts everything back.
  await openSettings(again.page)
  await again.page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await again.page.getByRole('button', { name: 'Reset advanced settings' }).click()
  await expect.poll(() => rootVar(again.page, '--bubble-blur')).toBe('20px')
  await expect.poll(() => rootData(again.page, 'motion')).toBe('full')
  await expect(again.page.getByRole('button', { name: 'Reset advanced settings' })).toBeDisabled()
  await again.app.close()
})

test('each theme has its own background scene, in dark and light', async () => {
  test.setTimeout(90_000)
  const { app, page } = await launch(profile({ onboarded: true, name: 'Asha', theme: 'dark' }), url)
  await expect(page.getByRole('heading', { name: /Asha/ })).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('canvas.backdrop-gl[data-ready="true"]')).toBeAttached()

  for (const mode of ['Dark', 'Light']) {
    for (const palette of ['Lavender', 'Ocean', 'Sunrise', 'Forest', 'Rose', 'Snow', 'Desert']) {
      await openSettings(page)
      await page.getByRole('button', { name: 'Look', exact: true }).click()
      await page.getByText(palette, { exact: true }).click()
      await page.getByText(mode, { exact: true }).click()
      if (palette === 'Lavender' && mode === 'Dark') {
        await page.waitForTimeout(800)
        await shot(page, 'l04-theme-swatches')
      }
      await closeSettings(page)
      await page.waitForTimeout(900)
      await shot(page, `l05-scene-${palette.toLowerCase()}-${mode.toLowerCase()}`)
    }
  }
  await app.close()
})
