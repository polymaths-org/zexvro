import { existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
process.chdir(root)
// Runtime variables reach Core without compiling credentials into the app bundle.
if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const userData = resolve(process.env.MORPHIC_USER_DATA || '.dev-profile')
mkdirSync(userData, { recursive: true, mode: 0o700 })
console.log(`Morph development profile: ${userData}`)

const child = spawn(process.execPath, ['node_modules/electron-vite/bin/electron-vite.js', 'dev', '--watch'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, MORPHIC_USER_DATA: userData }
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0)
})
