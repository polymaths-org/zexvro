/// <reference lib="dom" />
// DOM lib above: page.evaluate callbacks run inside the app window.
import { expect, test, type Page } from '@playwright/test'
import { FakeVroai, launch, profile, shot } from './helpers'

const vroai = new FakeVroai()
let url = ''

test.beforeAll(async () => {
  url = await vroai.start()
})
test.afterAll(() => vroai.stop())

/** The card fades in once Morph has finished assembling from pixels. */
const waitForIntro = (page: Page) => expect(page.locator('main section')).toHaveCSS('opacity', '1', { timeout: 10_000 })

test('first launch: onboarding saves choices, then home remembers them', async () => {
  const userData = profile()
  const { app, page } = await launch(userData, url)

  await expect(page.getByRole('heading', { name: "Hi, I'm Morph." })).toBeVisible({ timeout: 10_000 })
  await waitForIntro(page)
  await shot(page, '01-welcome')
  await page.getByRole('button', { name: "Let's get started" }).click()

  await expect(page.getByRole('heading', { name: 'What should I call you?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible()
  await page.getByLabel('Your first name').fill('Asha')
  await shot(page, '02-name')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Which size is easiest to read?' })).toBeVisible()
  await page.getByText('Large', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.style.fontSize)).toBe('21px')
  await page.waitForTimeout(400)
  await shot(page, '03-size')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'How would you like Morph to look?' })).toBeVisible()
  await expect(page.getByText('Step 3 of 5')).toBeVisible()
  await page.getByText('Ocean', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.palette)).toBe('ocean')
  await page.waitForTimeout(900)
  await shot(page, '03b-look')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Should I read things out loud?' })).toBeVisible()
  await page.waitForTimeout(400)
  await shot(page, '04-voice')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: "I'll always ask before anything important." })).toBeVisible()
  await page.waitForTimeout(400)
  await shot(page, '05-safety')
  await page.getByRole('button', { name: 'I understand' }).click()

  await expect(page.getByRole('heading', { name: "You're all set, Asha." })).toBeVisible()
  await shot(page, '06-ready')
  await page.getByRole('button', { name: 'Start using Morph' }).click()

  await expect(page.getByRole('heading', { name: /, Asha\.$/ })).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '07-home')

  // Starter tiles fill the ask box so the person only has to finish the sentence.
  await page.getByRole('button', { name: /Explain a letter or bill/ }).click()
  await expect(page.getByLabel('What do you need help with?')).toHaveValue('Please explain this letter to me in simple words:\n')

  await page.getByRole('complementary', { name: 'Conversations' }).getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '09-settings')
  await page.getByRole('button', { name: 'Look', exact: true }).click()
  await page.getByText('Light', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.waitForTimeout(900)
  await shot(page, '10-home-light')
  await app.close()

  // Second launch skips onboarding and keeps every choice.
  const second = await launch(userData, url)
  await expect(second.page.getByRole('heading', { name: /, Asha\.$/ })).toBeVisible({ timeout: 10_000 })
  expect(await second.page.evaluate(() => document.documentElement.style.fontSize)).toBe('21px')
  expect(await second.page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
  expect(await second.page.evaluate(() => document.documentElement.dataset.palette)).toBe('ocean')
  await second.app.close()
})

test('dark theme: welcome, a question step and home render', async () => {
  // Start from a saved "Dark" choice; Electron ignores Playwright's colour-scheme emulation.
  const { app, page } = await launch(profile({ theme: 'dark' }), url)
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')

  await waitForIntro(page)
  await shot(page, 'dark-01-welcome')
  await page.getByRole('button', { name: "Let's get started" }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await expect(page.getByRole('heading', { name: 'Which size is easiest to read?' })).toBeVisible()
  await page.waitForTimeout(400)
  await shot(page, 'dark-03-size')
  for (const label of ['Continue', 'Continue', 'Continue', 'I understand']) {
    await page.getByRole('button', { name: label }).click()
  }
  await expect(page.getByRole('heading', { name: "You're all set." })).toBeVisible()
  await page.getByRole('button', { name: 'Start using Morph' }).click()
  await page.waitForTimeout(500)
  await shot(page, 'dark-07-home')
  await app.close()
})
