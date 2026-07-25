/**
 * Device-code login against ZEXVRO platform Lambda.
 * Flow matches dashboard CliActivation:
 *   POST /auth/device-code → user opens console → POST /auth/activate
 *   CLI polls POST /auth/token until authorized
 */
import { defaultApiBase, defaultFrontendUrl } from './paths.mjs'
import { saveSession } from './zexvro-store.mjs'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function httpJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, ok: res.ok, body }
}

/**
 * @param {{ apiBase?: string, openBrowser?: boolean, onStatus?: (s: string) => void }} [opts]
 */
export async function deviceLogin(opts = {}) {
  const apiBase = (opts.apiBase || defaultApiBase()).replace(/\/$/, '')
  const log = opts.onStatus || (() => {})

  log(`Requesting device code from ${apiBase}…`)
  const start = await httpJson(`${apiBase}/auth/device-code`, {
    method: 'POST',
    body: '{}',
  })
  if (!start.ok) {
    throw new Error(
      start.body?.error_description ||
        start.body?.error ||
        `device-code failed HTTP ${start.status}`,
    )
  }

  const {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete: verificationUriComplete,
    interval = 2,
    expires_in: expiresIn = 600,
  } = start.body

  if (!deviceCode || !userCode) {
    throw new Error('device-code response missing device_code or user_code')
  }

  // Prefer /dashboard?code= so production router hits CliActivation, not marketing intro.
  const baseFront = (verificationUri || defaultFrontendUrl()).replace(/\/$/, '')
  const openUrl =
    verificationUriComplete?.includes('/dashboard')
      ? verificationUriComplete
      : `${baseFront}/dashboard?code=${encodeURIComponent(userCode)}`

  console.log('')
  console.log('  ╔══════════════════════════════════════════════════╗')
  console.log('  ║  Morph · Link ZEXVRO account                     ║')
  console.log('  ╚══════════════════════════════════════════════════╝')
  console.log('')
  console.log(`  Code:  ${userCode}`)
  console.log(`  Open:  ${openUrl}`)
  console.log('')
  console.log('  1. Open the URL (log into console.zexvro.in if needed)')
  console.log('  2. Approve this CLI device')
  console.log('  3. Wait here — Morph will finish automatically')
  console.log('')

  if (opts.openBrowser !== false) {
    try {
      const { spawn } = await import('node:child_process')
      const platform = process.platform
      if (platform === 'darwin') spawn('open', [openUrl], { stdio: 'ignore', detached: true }).unref()
      else if (platform === 'win32')
        spawn('cmd', ['/c', 'start', '', openUrl], { stdio: 'ignore', detached: true }).unref()
      else spawn('xdg-open', [openUrl], { stdio: 'ignore', detached: true }).unref()
      log('Opened browser')
    } catch {
      log('Could not open browser — paste the URL manually')
    }
  }

  const deadline = Date.now() + expiresIn * 1000
  let wait = Math.max(2, Number(interval) || 2) * 1000

  while (Date.now() < deadline) {
    await sleep(wait)
    const poll = await httpJson(`${apiBase}/auth/token`, {
      method: 'POST',
      body: JSON.stringify({ device_code: deviceCode }),
    })

    const err = poll.body?.error
    if (poll.ok && poll.body?.access_token) {
      const session = saveSession({
        accessToken: poll.body.access_token,
        username: poll.body.username || '',
        tokenType: poll.body.token_type || 'Bearer',
        refreshToken: poll.body.refresh_token || '',
        idToken: poll.body.id_token || '',
        apiBase,
        authenticatedAt: Date.now(),
      })
      log(`Logged in as ${session.username || 'user'}`)
      return session
    }

    if (err === 'authorization_pending') {
      process.stdout.write('.')
      continue
    }
    if (err === 'slow_down') {
      wait += 2000
      continue
    }
    if (err === 'access_denied') {
      throw new Error('Authorization rejected in the browser')
    }
    if (err === 'expired_token') {
      throw new Error('Device code expired — run morph login again')
    }
    if (!poll.ok) {
      // Some APIs return 400 for pending
      if (err === 'authorization_pending' || poll.status === 400) {
        if (String(poll.body?.error_description || '').toLowerCase().includes('not approved')) {
          process.stdout.write('.')
          continue
        }
        if (err === 'authorization_pending') {
          process.stdout.write('.')
          continue
        }
      }
      throw new Error(
        poll.body?.error_description || poll.body?.error || `token poll failed HTTP ${poll.status}`,
      )
    }
  }

  throw new Error('Timed out waiting for approval — run morph login again')
}
