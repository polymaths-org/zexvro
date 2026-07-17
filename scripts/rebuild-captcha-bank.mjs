/**
 * Rebuild services/agent-auth/captcha-assets from /tmp/zexvro-kaggle* downloads.
 * Usage: node scripts/rebuild-captcha-bank.mjs
 * Requires Pillow via python helper.
 */
import { spawnSync } from 'node:child_process'
const r = spawnSync('python3', ['scripts/rebuild_captcha_bank.py'], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url).pathname,
})
process.exit(r.status ?? 1)
