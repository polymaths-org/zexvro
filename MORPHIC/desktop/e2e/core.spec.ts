/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { FakeVroai, launch, profile, shot } from './helpers'

const vroai = new FakeVroai()
let url = ''

test.beforeAll(async () => {
  url = await vroai.start()
  vroai.delayMs = 200
})
test.afterAll(() => vroai.stop())

const pad = (n: number) => String(n).padStart(2, '0')
const localStamp = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const action = (tool: string, args: object) => `<<action ${JSON.stringify({ tool, args })}>>`

async function ask(page: Page, text: string) {
  await page.getByLabel('What do you need help with?').fill(text)
  await page.keyboard.press('Enter')
}

test('Morph sets reminders, shows checklists and asks before opening websites', async () => {
  const { app, page } = await launch(profile({ onboarded: true, name: 'Asha', theme: 'dark' }), url)
  const sidebar = page.getByRole('complementary', { name: 'Conversations' })
  await expect(page.getByRole('heading', { name: /Asha/ })).toBeVisible({ timeout: 10_000 })

  // A reminder from the conversation, visible as a done action and on the Reminders page.
  vroai.reply = `I'll remind you in two hours.\n${action('set_reminder', { text: 'Take your tablets', when: localStamp(Date.now() + 2 * 3_600_000), repeat: 'daily' })}`
  await ask(page, 'Remind me to take my tablets in two hours, every day')
  await expect(page.getByText('Reminder set: Take your tablets')).toBeVisible()
  expect(vroai.prompts.at(-1)).toContain('set_reminder: {"text"')
  await shot(page, 'k01-reminder-action')

  // A checklist the person can tick off; the tick is kept.
  vroai.reply = `Here are the steps.\n${action('show_plan', { title: 'Make a video call', steps: ['Open WhatsApp', 'Tap the person', 'Tap the camera'] })}`
  await ask(page, 'How do I make a video call?')
  const plan = page.getByRole('region', { name: 'Make a video call' })
  await expect(plan).toBeVisible()
  await plan.getByText('Tap the person').click()
  await expect(plan.getByText('1 of 3 done')).toBeVisible()
  await shot(page, 'k02-checklist')

  // Websites open in Morph's own browser (browser mode), never the person's default browser, and without nagging.
  vroai.reply = `Here it is.\n${action('open_website', { url: url, why: 'to show you' })}`
  await ask(page, 'Open the train booking site')
  await expect(page.getByText('Opened 127.0.0.1 in my browser')).toBeVisible()
  await expect(page.getByRole('region', { name: "Morph's browser" })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Chat with Morph' })).toBeVisible()
  await shot(page, 'k03-browser-mode')
  await page.getByRole('button', { name: 'Close the browser' }).click()
  await expect(page.getByRole('region', { name: "Morph's browser" })).toBeHidden()

  // The checklist tick survived (it's saved by Core).
  await sidebar.getByRole('button', { name: 'New conversation' }).click()
  await sidebar.getByRole('button', { name: /Remind me to take my tablets/ }).click()
  await expect(page.getByRole('region', { name: 'Make a video call' }).getByText('1 of 3 done')).toBeVisible()

  // Reminders page.
  await sidebar.getByRole('button', { name: /Reminders/ }).click()
  await expect(page.getByRole('heading', { name: 'Reminders', level: 1 })).toBeVisible()
  const tabletRow = page.getByRole('listitem').filter({ hasText: 'Take your tablets' })
  await expect(tabletRow).toBeVisible()
  await expect(tabletRow.getByText('Every day')).toBeVisible()
  await shot(page, 'k04-reminders-page')

  // A reminder going off: banner with Done / Remind me in 10 minutes.
  await page.evaluate(() => window.morphic.core('reminders.add', 'Drink a glass of water', Date.now() + 1500, 'once'))
  const banner = page.getByRole('alert', { name: 'Reminder' })
  await expect(banner.getByText('Drink a glass of water')).toBeVisible({ timeout: 10_000 })
  await shot(page, 'k05-due-banner')
  await banner.getByRole('button', { name: 'Remind me in 10 minutes' }).click()
  await expect(banner).toBeHidden()
  await expect(page.getByText('Drink a glass of water')).toBeVisible()
  await page.getByRole('button', { name: 'Delete reminder: Drink a glass of water' }).click()
  await expect(page.getByText('Drink a glass of water')).toBeHidden()

  // Activity log has it all, in plain words.
  await sidebar.getByRole('button', { name: /What I remember/ }).click()
  await page.getByRole('button', { name: 'See what Morph has done' }).click()
  await expect(page.getByText('Set a reminder: Take your tablets')).toBeVisible()
  await expect(page.getByText("Opened 127.0.0.1 in Morph's browser")).toBeVisible()
  await shot(page, 'k06-activity')
  await app.close()
})

test('memory: Morph remembers when asked, and the person can see, add, change and forget', async () => {
  const { app, page } = await launch(profile({ onboarded: true, name: 'Asha', theme: 'light', palette: 'rose' }), url)
  const sidebar = page.getByRole('complementary', { name: 'Conversations' })
  await expect(page.getByRole('heading', { name: /Asha/ })).toBeVisible({ timeout: 10_000 })

  vroai.reply = `Of course, I'll remember that.\n${action('remember', { fact: "Asha's grandson is called Rohan." })}`
  await ask(page, 'Remember that my grandson is called Rohan')
  await expect(page.getByText("I'll remember: Asha's grandson is called Rohan.")).toBeVisible()

  // Next question: the memory is in Morph's prompt.
  vroai.reply = 'Rohan is lucky to have you.'
  await ask(page, 'What should I get Rohan for his birthday?')
  await expect(page.getByText('Rohan is lucky to have you.')).toBeVisible()
  expect(vroai.prompts.at(-1)).toContain("Asha's grandson is called Rohan.")

  await sidebar.getByRole('button', { name: /What I remember/ }).click()
  await expect(page.getByText("Asha's grandson is called Rohan.")).toBeVisible()
  await expect(page.getByText(/You told me/)).toBeVisible()

  await page.getByLabel('Something for Morph to remember').fill('My PIN is 4321')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText("I can't keep that.", { exact: false })).toBeVisible()
  await page.getByLabel('Something for Morph to remember').fill('I prefer phone calls to messages')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('I prefer phone calls to messages')).toBeVisible()

  // Memories are grouped by what they're about; the person can choose the group when adding.
  await page.getByLabel('Something for Morph to remember').fill("Meera's birthday is on 2 December")
  await page.getByLabel('What is it about?').selectOption('dates')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Important dates/ })).toBeVisible()
  await expect(page.getByText(/Every year on (2 December|December 2)/)).toBeVisible()
  await expect(page.getByRole('heading', { name: /Likes and preferences/ })).toBeVisible()

  // "Always remember": pinned memories go to the top and into every conversation.
  const callsRow = page.getByRole('listitem').filter({ hasText: 'I prefer phone calls to messages' })
  await callsRow.getByRole('button', { name: 'Always remember' }).click()
  await expect(page.getByRole('heading', { name: /Always remember/ })).toBeVisible()
  await expect(callsRow.getByRole('button', { name: 'Unpin' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('heading', { name: /Always remember/ }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await shot(page, 'k07b-memory-groups')

  await page.getByRole('textbox', { name: 'About you' }).fill('I live in Pune with my husband.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()
  await shot(page, 'k07-memory-page')

  await page.getByRole('button', { name: "Forget: Asha's grandson is called Rohan." }).click()
  await expect(page.getByText("Asha's grandson is called Rohan.")).toBeHidden()

  // Language and answer length reach Morph's prompt.
  await page.keyboard.press('Control+,')
  await page.getByRole('button', { name: "Morph's answers" }).click()
  await page.getByLabel('Reply language').selectOption('hi')
  await page.getByText('Short', { exact: true }).click()
  await page.waitForTimeout(300)
  await shot(page, 'k08-settings-answers')
  await page.getByRole('button', { name: 'Reading & voice' }).click()
  await expect(page.getByText('Speaking speed').or(page.getByText("doesn't have any voices installed"))).toBeVisible()
  await shot(page, 'k09-settings-reading')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeHidden()
  await sidebar.getByRole('button', { name: 'New conversation' }).click()
  vroai.reply = 'नमस्ते!'
  await ask(page, 'Hello')
  await expect(page.getByText('नमस्ते!')).toBeVisible()
  expect(vroai.prompts.at(-1)).toContain('Always reply in हिन्दी (Hindi)')
  expect(vroai.prompts.at(-1)).toContain('two to four sentences')
  expect(vroai.prompts.at(-1)).toContain('About them (they wrote this): I live in Pune with my husband.')
  expect(vroai.prompts.at(-1)).toContain('I prefer phone calls to messages (always keep in mind)')
  await app.close()
})

test("personality and soul: how Morph talks can be changed, and the safety rules stay first", async () => {
  const { app, page } = await launch(profile({ onboarded: true, name: 'Asha', theme: 'light', palette: 'forest' }), url)
  await expect(page.getByRole('heading', { name: /Asha/ })).toBeVisible({ timeout: 10_000 })

  await page.keyboard.press('Control+,')
  await page.getByRole('button', { name: "Morph's answers" }).click()
  await page.getByText('Polite and formal').click()
  await page.getByText('Yes, now and then').click()
  await page.getByLabel('What Morph calls you').fill('Aunty')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()
  await shot(page, 'k10-settings-personality')

  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  const soul = page.getByLabel("Who Morph is, in Morph's own words")
  await expect(soul).toHaveValue(/I am Morph/)
  await soul.fill('# Morph\nI am Morph. I love gardens and talk about plants when it fits.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved. Morph will use this from the next answer.')).toBeVisible()
  await shot(page, 'k11-settings-soul')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeHidden()

  vroai.reply = 'Good afternoon, Aunty.'
  await ask(page, 'Hello')
  await expect(page.getByText('Good afternoon, Aunty.')).toBeVisible()
  const prompt = vroai.prompts.at(-1)!
  expect(prompt.startsWith('These rules always apply')).toBe(true)
  expect(prompt).toContain('I love gardens and talk about plants')
  expect(prompt).toContain('polite and a little formal')
  expect(prompt).toContain('gentle humour')
  expect(prompt).toContain('Call them “Aunty” (their name is Asha).')

  // Going back to the original soul.
  await page.keyboard.press('Control+,')
  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await page.getByRole('button', { name: 'Go back to the original' }).click()
  await expect(page.getByLabel("Who Morph is, in Morph's own words")).toHaveValue(/Who I'm here for/)
  await app.close()
})
