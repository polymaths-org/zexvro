/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { FakeVroai, launch, profile, shot } from './helpers'

const vroai = new FakeVroai()
let url = ''

test.beforeAll(async () => {
  url = await vroai.start()
})
test.afterAll(() => vroai.stop())

test('conversations: ask, follow up, rename, reopen, delete, retry, stop, themes', async () => {
  const userData = profile({ onboarded: true, name: 'Asha', theme: 'dark' })
  const { app, page } = await launch(userData, url)
  const sidebar = page.getByRole('complementary', { name: 'Conversations' })

  await expect(page.getByRole('heading', { name: /, Asha\.$/ })).toBeVisible({ timeout: 10_000 })
  await expect(sidebar.getByText('Morph is ready')).toBeVisible()
  await expect(sidebar.getByText('Your conversations with Morph will show up here.')).toBeVisible()
  await page.waitForTimeout(400)
  await shot(page, 'c01-home-sidebar')

  // Ask from a starter tile.
  vroai.reply = 'Here is how:\n\n1. Open the video call app.\n\n2. Press the green camera button.\n\n3. Wait for them to answer.'
  vroai.delayMs = 1500
  await page.getByRole('button', { name: /Step-by-step help/ }).click()
  await page.keyboard.type('make a video call')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Having a little think…' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, 'c02-thinking')
  await expect(page.getByText('Press the green camera button.')).toBeVisible()
  await page.getByRole('button', { name: 'Copy' }).first().click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toContain('Press the green camera button.')
  // VROAI puts blank lines between steps; they must still form one list numbered 1, 2, 3.
  await expect(page.locator('main ol')).toHaveCount(1)
  await expect(page.locator('main ol li')).toHaveCount(3)
  await expect(sidebar.getByRole('button', { name: /Show me step by step how to make a video call/ })).toBeVisible()
  await page.waitForTimeout(400)
  await shot(page, 'c03-answer')

  // The prompt carries Morph's persona, the person's name and the question.
  const first = vroai.prompts.at(-1)!
  expect(first).toContain('you are Morph.')
  expect(first).toContain('Their name is Asha.')
  expect(first).toContain('Person: Show me step by step how to make a video call')

  // Follow-up includes the earlier answer as history.
  vroai.delayMs = 300
  vroai.reply = "You're welcome, Asha!"
  await page.getByLabel('What do you need help with?').fill('Thank you')
  await page.keyboard.press('Enter')
  await expect(page.getByText("You're welcome, Asha!")).toBeVisible()
  expect(vroai.prompts.at(-1)).toContain('Morph: Here is how:')

  // Rename.
  await page.getByRole('button', { name: 'Rename' }).click()
  await page.getByLabel('Conversation name').fill('Video call help')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Video call help' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: /Video call help/ })).toBeVisible()

  // New conversation goes home; the old one reopens from the list.
  await sidebar.getByRole('button', { name: 'New conversation' }).click()
  await expect(page.getByRole('heading', { name: /, Asha\.$/ })).toBeVisible()
  await sidebar.getByRole('button', { name: /Video call help/ }).click()
  await expect(page.getByText('Press the green camera button.')).toBeVisible()

  // A failed answer offers Try again, which then works.
  vroai.fail = true
  await page.getByLabel('What do you need help with?').fill('One more question')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await shot(page, 'c04-failed')
  vroai.fail = false
  vroai.reply = 'Here is the answer to your question.'
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Here is the answer to your question.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)

  // Stop cancels a slow answer.
  vroai.delayMs = 8000
  await page.getByLabel('What do you need help with?').fill('Something slow')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByText('You stopped this answer.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask again' })).toBeVisible()
  vroai.delayMs = 300

  // Themes: each swatch previews itself; picking one re-themes the app.
  await sidebar.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, 'c05-settings-themes')
  await page.keyboard.press('Escape')
  // Wait for React to unmount the closing dialog before sending the reopen shortcut.
  await expect(page.getByRole('heading', { name: 'Settings', includeHidden: true })).toHaveCount(0)
  await page.keyboard.press('Control+,')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await page.getByRole('button', { name: 'Look', exact: true }).click()
  await page.getByText('Ocean', { exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.palette)).toBe('ocean')
  await page.waitForTimeout(900)
  await shot(page, 'c06-ocean-settings')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.waitForTimeout(400)
  await shot(page, 'c07-ocean-conversation')

  await sidebar.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Look', exact: true }).click()
  await page.getByText('Sunrise', { exact: true }).click()
  await page.getByText('Light', { exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.waitForTimeout(900)
  await shot(page, 'c08-sunrise-light')

  await sidebar.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Look', exact: true }).click()
  await page.getByText('High contrast', { exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.waitForTimeout(900)
  await shot(page, 'c09-contrast-light')
  const eyeVsBg = () =>
    page.evaluate(() => {
      const s = getComputedStyle(document.documentElement)
      return [s.getPropertyValue('--eye').trim(), s.getPropertyValue('--bg').trim()]
    })
  const [eyeLight, bgLight] = await eyeVsBg()
  expect(eyeLight).not.toBe(bgLight)
  await page.keyboard.press('Control+,')
  await page.getByRole('button', { name: 'Look', exact: true }).click()
  await page.getByText('Dark', { exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.waitForTimeout(900)
  await shot(page, 'c09b-contrast-dark')
  const [eyeDark, bgDark] = await eyeVsBg()
  expect(eyeDark).not.toBe(bgDark)

  // Hide and show the list.
  await sidebar.getByRole('button', { name: 'Hide this list' }).click()
  await expect(sidebar.getByRole('button', { name: 'Show list' })).toBeVisible()
  await page.waitForTimeout(400)
  await shot(page, 'c10-rail')
  await sidebar.getByRole('button', { name: 'Show list' }).click()

  // Delete asks first, then removes it from the list.
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('heading', { name: 'Delete this conversation?' })).toBeVisible()
  await shot(page, 'c11-delete-confirm')
  await page.getByRole('button', { name: 'Delete conversation' }).click()
  await expect(page.getByRole('heading', { name: /, Asha\.$/ })).toBeVisible()
  await expect(sidebar.getByText('Your conversations with Morph will show up here.')).toBeVisible()

  // Delete all, from Settings, after a confirmation.
  await page.getByLabel('What do you need help with?').fill('Throwaway question')
  await page.keyboard.press('Enter')
  await expect(sidebar.getByRole('button', { name: /Throwaway question/ })).toBeVisible()
  await page.keyboard.press('Control+,')
  await page.getByRole('button', { name: 'Memory & privacy' }).click()
  await page.getByRole('button', { name: 'Delete all conversations' }).click()
  await expect(page.getByRole('heading', { name: 'Delete all conversations?' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete all', exact: true }).click()
  await expect(page.getByText('You have no saved conversations.')).toBeVisible()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  // The page stays inert until Settings has finished sliding away.
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeHidden()
  await expect(sidebar.getByText('Your conversations with Morph will show up here.')).toBeVisible()

  // A conversation survives a restart.
  vroai.reply = 'Saved for later.'
  await page.getByLabel('What do you need help with?').fill('Remember this')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Saved for later.')).toBeVisible()
  await app.close()

  const again = await launch(userData, url)
  const list = again.page.getByRole('complementary', { name: 'Conversations' })
  await list.getByRole('button', { name: /Remember this/ }).click()
  await expect(again.page.getByText('Saved for later.')).toBeVisible()
  expect(await again.page.evaluate(() => document.documentElement.dataset.palette)).toBe('contrast')
  await expect(list.getByRole('button', { name: /Throwaway question/ })).toHaveCount(0)
  await again.app.close()
})

test('offline: home says Morph cannot connect', async () => {
  const { app, page } = await launch(profile({ onboarded: true }), 'http://127.0.0.1:9')
  await expect(page.getByText("Morph can't connect right now.")).toBeVisible({ timeout: 10_000 })
  await app.close()
})
