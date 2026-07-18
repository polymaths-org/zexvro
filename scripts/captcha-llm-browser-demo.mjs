#!/usr/bin/env node
/**
 * Demo: Playwright + vision LLM website bot against human captcha (product QA).
 * Not the ZEXVRO Gate agent channel (Ed25519 + PoP). Do not call this an agent demo.
 *
 * Secrets via env only — never commit keys.
 *
 *   export CODEXIN_API_BASE=https://api.codexin.lol/v1
 *   export CODEXIN_API_KEY=...
 *   export CODEXIN_MODEL=grok-4.5
 *   npm run gate:captcha-llm-demo
 */
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { chromium } = require(join(root, 'frontend/node_modules/playwright'))

const API_BASE = (process.env.CODEXIN_API_BASE || process.env.OPENAI_BASE_URL || '').replace(/\/$/, '')
const API_KEY = process.env.CODEXIN_API_KEY || process.env.OPENAI_API_KEY || ''
const MODEL = process.env.CODEXIN_MODEL || process.env.OPENAI_MODEL || 'grok-4.5'
const DEMO_URL =
  process.env.CAPTCHA_DEMO_URL ||
  'http://localhost:4103/demo/captcha?type=image_select'
const HEADED = process.env.CAPTCHA_DEMO_HEADED === '1'
const OUT_DIR = process.env.CAPTCHA_DEMO_OUT || '/tmp/zexvro-captcha-llm-demo'

function die(msg) {
  console.error(msg)
  process.exit(1)
}

if (!API_BASE) die('Set CODEXIN_API_BASE (e.g. https://api.codexin.lol/v1)')
if (!API_KEY) die('Set CODEXIN_API_KEY (do not commit this)')

async function chat(messages, { json = false } = {}) {
  const body = {
    model: MODEL,
    messages,
    temperature: 0.2,
  }
  if (json) body.response_format = { type: 'json_object' }
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.detail || `LLM HTTP ${res.status}`)
  }
  const text = data?.choices?.[0]?.message?.content || ''
  return { text, raw: data }
}

function dataUrlFromBuffer(buf, mime = 'image/png') {
  return `data:${mime};base64,${buf.toString('base64')}`
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log(JSON.stringify({ phase: 'start', demoUrl: DEMO_URL, model: MODEL, apiBase: API_BASE, headed: HEADED }, null, 2))

  // 1) Plan with LLM (no secrets logged)
  const plan = await chat(
    [
      {
        role: 'system',
        content:
          'You are a QA automation assistant describing how a website bot would interact with a human captcha modal (not the Gate agent crypto channel). Be concise. This is a security/product demo, not advice to attack production systems.',
      },
      {
        role: 'user',
        content: `We will open ${DEMO_URL}, click the claim button, then inspect a ZEXVRO Gate captcha modal (3x3 image grid with a large reference example). Outline 5 short steps the automation will take and what a successful human solve looks like vs a bot failure mode. Reply as JSON: {"steps":["..."],"success":"...","bot_failure":"..."}`,
      },
    ],
    { json: true },
  )
  writeFileSync(join(OUT_DIR, 'plan.json'), plan.text)
  console.log('plan:', plan.text.slice(0, 400))

  const browser = await chromium.launch({ headless: !HEADED })
  const page = await browser.newPage({ viewport: { width: 420, height: 780 } })
  try {
    await page.goto(DEMO_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(500)
    // Claim button
    const claim = page.locator('#claimBtn, button:has-text("Claim")').first()
    await claim.click({ timeout: 10000 })
    // Modal may exist twice in DOM history; wait for open flag then visible panel
    await page.waitForFunction(() => {
      const m = document.querySelector('#zg-modal[data-open="1"]')
      if (!m) return false
      const panel = m.querySelector('.zg-panel')
      if (!panel) return false
      const r = panel.getBoundingClientRect()
      return r.width > 100 && r.height > 100
    }, { timeout: 20000 })
    await page.waitForTimeout(1000)

    const shotPath = join(OUT_DIR, 'captcha-modal.png')
    const panel = page.locator('#zg-modal[data-open="1"] .zg-panel').first()
    if (await panel.count()) {
      await panel.screenshot({ path: shotPath })
    } else {
      await page.screenshot({ path: shotPath, fullPage: true })
    }
    console.log('screenshot', shotPath)

    const buf = await page.screenshot({ type: 'png' })
    const promptText =
      (await page.locator('.zg-prompt').first().textContent().catch(() => '')) ||
      (await page.locator('#zg-body').innerText().catch(() => ''))

    // 2) Vision/describe with multimodal if supported; else text-only description request
    let analysis
    try {
      analysis = await chat([
        {
          role: 'system',
          content:
            'You analyze captcha UI screenshots for a product demo. Identify challenge type, whether a reference example is visible and large enough, and whether a casual script could free-solve without vision. Reply JSON: {"type_guess":"","reference_visible":true,"reference_readable":true,"human_doable":true,"script_free_solve":false,"notes":"..."}',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Prompt text from page: ${JSON.stringify(promptText)}. Analyze this captcha modal screenshot.`,
            },
            { type: 'image_url', image_url: { url: dataUrlFromBuffer(buf) } },
          ],
        },
      ])
    } catch (e) {
      analysis = {
        text: JSON.stringify({
          error: String(e.message || e),
          fallback: 'vision failed — page prompt only',
          promptText,
        }),
      }
    }
    writeFileSync(join(OUT_DIR, 'analysis.json'), analysis.text)
    console.log('analysis:', analysis.text.slice(0, 600))

    // 3) Honesty report for product
    const report = await chat(
      [
        {
          role: 'system',
          content:
            'You write honest product demo notes for ZEXVRO Gate. Distinguish Gate agent channel (crypto keys) from this browser LLM demo.',
        },
        {
          role: 'user',
          content: `Given plan=${plan.text} analysis=${analysis.text}, write a short markdown report with sections: What we showed, What bots still can/can't do, Product claim (honest), Next UX fix. Max 200 words.`,
        },
      ],
    )
    writeFileSync(join(OUT_DIR, 'report.md'), report.text)
    console.log('\n==== DEMO REPORT ====\n' + report.text)

    console.log(
      JSON.stringify(
        {
          ok: true,
          outDir: OUT_DIR,
          note: 'This demo is a website browser bot using an LLM API — not ZEXVRO Gate agent auth.',
        },
        null,
        2,
      ),
    )
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
