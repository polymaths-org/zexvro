import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

/** Write-then-rename so a crash mid-write never leaves a half-written file. */
export function writeJson(file: string, value: unknown) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 1))
  renameSync(tmp, file)
}

export function appendJsonl(file: string, value: unknown) {
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify(value)}\n`)
}

export function readJsonl<T>(file: string): T[] {
  try {
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as T]
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

export const newId = () => crypto.randomUUID()
