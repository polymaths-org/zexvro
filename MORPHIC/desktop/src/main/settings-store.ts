import { app } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '@shared/settings'

const file = () => join(app.getPath('userData'), 'settings.json')

let current: Settings | null = null

export function loadSettings(): Settings {
  if (current) return current
  try {
    current = sanitizeSettings(JSON.parse(readFileSync(file(), 'utf8')))
  } catch {
    current = { ...DEFAULT_SETTINGS }
  }
  return current
}

export function saveSettings(patch: unknown): Settings {
  current = sanitizeSettings(patch, loadSettings())
  // Write-then-rename so a crash mid-write never leaves a half-written settings file.
  const tmp = `${file()}.tmp`
  writeFileSync(tmp, JSON.stringify(current, null, 2))
  renameSync(tmp, file())
  return current
}
