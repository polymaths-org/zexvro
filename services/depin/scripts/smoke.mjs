#!/usr/bin/env node
/**
 * Local De-pin readiness smoke (no paid settle).
 *
 * Usage:
 *   DEPIN_URL=http://127.0.0.1:4102 node services/depin/scripts/smoke.mjs
 *   npm --prefix services/depin run smoke
 *
 * Expects gateway health + status + an unpaid 402 on the first configured provider route.
 */
const base = (process.env.DEPIN_URL || 'http://127.0.0.1:4102').replace(/\/$/, '')

function fail(message) {
  console.error(`[depin-smoke] FAIL: ${message}`)
  process.exit(1)
}

function ok(message) {
  console.log(`[depin-smoke] OK: ${message}`)
}

async function getJson(path) {
  const response = await fetch(`${base}${path}`, {
    headers: { accept: 'application/json' },
  })
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = undefined
  }
  return { response, body, text }
}

const health = await getJson('/health')
if (health.response.status !== 200 || health.body?.service !== 'depin') {
  fail(`/health expected 200 depin, got ${String(health.response.status)} ${health.text}`)
}
ok('health')

const status = await getJson('/status')
if (status.response.status !== 200 || status.body?.service !== 'depin') {
  fail(`/status expected 200 depin, got ${String(status.response.status)} ${status.text}`)
}

const providers = status.body?.providers
if (!Array.isArray(providers) || providers.length === 0) {
  fail('/status has no providers')
}

const caps = status.body?.capabilities || {}
ok(
  `status · ${providers.length} route(s) · scheme=${String(caps.scheme)} · ` +
    `stateBackend=${String(status.body?.stateBackend)} · multiInstanceSafe=${String(status.body?.multiInstanceSafe)} · ` +
    `settleReady=${String(caps.settleReady)} · configSource=${String(status.body?.configSource?.type)}:${String(status.body?.configSource?.detail)}`,
)

if (caps.settleReady === false) {
  console.warn(
    '[depin-smoke] WARN: settleReady=false (set OZ_API_KEY for OpenZeppelin Channels settle)',
  )
}
if (status.body?.multiInstanceSafe === false) {
  console.warn(
    '[depin-smoke] WARN: multiInstanceSafe=false (use DEPIN_STATE_BACKEND=file for multi-process hosts)',
  )
}

const provider = providers[0]
const probePath = provider.route
const probe = await fetch(`${base}${probePath}`, {
  method: provider.method || 'GET',
  headers: { accept: 'application/json' },
})

if (probe.status !== 402) {
  fail(
    `unpaid ${provider.method} ${probePath} expected HTTP 402, got ${String(probe.status)}`,
  )
}

const paymentRequired = probe.headers.get('PAYMENT-REQUIRED')
if (!paymentRequired) {
  fail('402 response missing PAYMENT-REQUIRED header')
}

ok(`unpaid probe ${provider.method} ${probePath} → 402 + PAYMENT-REQUIRED`)
console.log('[depin-smoke] all checks passed')
