#!/usr/bin/env node
/**
 * Local demo checklist for ZEXVRO Gate.
 * Prints the story, verifies Gate is up, optional agent path.
 *
 *   npm run dev:agent-auth   # terminal 1
 *   npm run gate:demo        # terminal 2
 *   npm run gate:demo -- --agent
 */
const base = (process.env.AGENT_AUTH_API_URL || 'http://127.0.0.1:4103').replace(/\/$/, '')
const runAgent = process.argv.includes('--agent') || process.env.GATE_DEMO_AGENT === '1'

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}

async function main() {
  section('ZEXVRO Gate — local demo')
  console.log(`Gate base: ${base}`)
  console.log(`
Story (say this out loud):
  1. Developer protects their site with Gate (siteKey + secret).
  2. Humans solve captcha → human capability → checkout.
  3. Agents register Ed25519 keys → PoP → agent APIs (no captcha UI).
  4. Class integrity: wrong channel is rejected.
`)

  section('1) Health')
  let health
  try {
    const res = await fetch(`${base}/health`)
    health = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    console.log('OK', health)
  } catch (e) {
    console.error(`FAIL — start Gate first: npm run dev:agent-auth`)
    console.error(String(e.message || e))
    process.exit(1)
  }

  section('2) Demo keys')
  try {
    const res = await fetch(`${base}/v1/admin/demo-keys`)
    const keys = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(keys))
    console.log({
      siteKey: keys.siteKey,
      secretKey: keys.secretKey ? `${String(keys.secretKey).slice(0, 8)}…` : null,
      allowedOrigins: keys.allowedOrigins,
      projectId: keys.projectId,
    })
  } catch (e) {
    console.error('demo-keys failed:', e.message || e)
  }

  section('3) Open these in a browser')
  console.log(`  Merchant dual-channel:  ${base}/demo/site`)
  console.log(`  Human captcha playground: ${base}/demo/captcha`)
  console.log(`  Dashboard (optional):     npm run dev:frontend-gate → http://localhost:3000`)

  section('4) Terminal demos')
  console.log('  npm run gate:agent-site-demo     # autonomous agent path (product agent demo)')
  console.log('  npm run agent-auth:smoke         # human + agent + PoP matrix')
  console.log('  npm run gate:protect-demo checkout.submit')
  console.log('  # optional human-channel bot QA (env keys, not agent channel):')
  console.log('  # export CODEXIN_API_BASE=… CODEXIN_API_KEY=… CODEXIN_MODEL=grok-4.5')
  console.log('  # npm run gate:captcha-llm-demo')

  section('5) Docs')
  console.log('  docs/agent_auth_local_demo.md     # full walkthrough for another person')
  console.log('  docs/agent_auth_quickstart.md')
  console.log('  docs/agent_auth_DEVELOPER_GUIDE.md')
  console.log('  docs/agent_auth_captcha.md')

  if (runAgent) {
    section('6) Running agent site demo')
    const { spawn } = await import('node:child_process')
    const child = spawn(process.execPath, ['scripts/gate-agent-site-demo.mjs'], {
      stdio: 'inherit',
      env: process.env,
      cwd: new URL('..', import.meta.url).pathname,
    })
    const code = await new Promise((resolve) => child.on('exit', resolve))
    if (code !== 0) process.exit(code || 1)
  } else {
    section('Next')
    console.log('  Open /demo/site for human captcha checkout, then:')
    console.log('  npm run gate:demo -- --agent')
  }

  console.log('\nLocal demo ready. Do not deploy AWS until the owner approves.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
