import { join } from 'node:path'
import type { Reminder, Repeat } from '@shared/core'
import { newId, readJson, writeJson } from './store'

const PERIOD: Record<Exclude<Repeat, 'once'>, number> = { daily: 86_400_000, weekly: 7 * 86_400_000 }
const MAX_AHEAD = 366 * 86_400_000
/** Missed while the app was closed: still shown if within this window, otherwise quietly skipped. */
const MISSED_GRACE = 12 * 3_600_000
const MAX_TIMER = 2 ** 31 - 1

interface Stored extends Reminder {
  /** The due time we've already announced, so it isn't announced twice. */
  notifiedFor?: number
}

/** Reminders plus the scheduler that announces them (after OpenClaw's cron, but for people). */
export class Reminders {
  private file: string
  private items: Stored[]
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    dataDir: string,
    private onDue: (reminder: Reminder) => void,
    private onChange: () => void = () => {}
  ) {
    this.file = join(dataDir, 'reminders.json')
    this.items = readJson<Stored[]>(this.file, [])
  }

  private save() {
    writeJson(this.file, this.items)
    this.onChange()
    this.schedule()
  }

  list(): Reminder[] {
    return this.items.filter((r) => !r.doneAt).sort((a, b) => a.due - b.due)
  }

  get(id: string) {
    return this.items.find((r) => r.id === id) ?? null
  }

  add(text: string, due: number, repeat: Repeat): Reminder | null {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 200)
    const now = Date.now()
    if (!clean || !Number.isFinite(due) || due < now - 60_000 || due > now + MAX_AHEAD) return null
    const reminder: Stored = { id: newId(), text: clean, due, repeat, createdAt: now }
    this.items.push(reminder)
    this.save()
    return reminder
  }

  delete(id: string) {
    this.items = this.items.filter((r) => r.id !== id)
    this.save()
  }

  snooze(id: string, minutes: number): Reminder | null {
    const r = this.items.find((x) => x.id === id)
    if (!r) return null
    r.due = Date.now() + Math.max(1, Math.min(24 * 60, minutes)) * 60_000
    r.notifiedFor = undefined
    r.doneAt = undefined
    this.save()
    return r
  }

  /** "Done": one-off reminders are finished; repeating ones move to their next time. */
  done(id: string) {
    const r = this.items.find((x) => x.id === id)
    if (!r) return
    if (r.repeat === 'once') {
      this.items = this.items.filter((x) => x.id !== id)
    } else {
      r.due = nextOccurrence(r.due, r.repeat, Date.now())
      r.notifiedFor = undefined
    }
    this.save()
  }

  /** Announces anything due now (or missed recently), then sleeps until the next one. */
  tick(now = Date.now()) {
    let changed = false
    for (const r of this.items) {
      if (r.doneAt || r.due > now || r.notifiedFor === r.due) continue
      if (now - r.due <= MISSED_GRACE) this.onDue({ ...r })
      r.notifiedFor = r.due
      // Repeating reminders roll forward so tomorrow's still fires even if today's is never dismissed.
      if (r.repeat !== 'once') {
        r.due = nextOccurrence(r.due, r.repeat, now)
        r.notifiedFor = undefined
      }
      changed = true
    }
    if (changed) this.save()
    else this.schedule()
  }

  schedule() {
    if (this.timer) clearTimeout(this.timer)
    const next = this.items.filter((r) => !r.doneAt && r.notifiedFor !== r.due).reduce((min, r) => Math.min(min, r.due), Infinity)
    if (next === Infinity) return
    const wait = Math.min(MAX_TIMER, Math.max(0, next - Date.now()))
    this.timer = setTimeout(() => this.tick(), wait)
    this.timer.unref?.()
  }

  stop() {
    if (this.timer) clearTimeout(this.timer)
  }
}

export function nextOccurrence(due: number, repeat: Exclude<Repeat, 'once'>, now: number): number {
  const period = PERIOD[repeat]
  if (due > now) return due
  return due + Math.ceil((now - due + 1) / period) * period
}

/** Parses "YYYY-MM-DD HH:MM" (local time), the format Morph is told to use. */
export function parseLocal(when: string): number | null {
  const m = when.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number)
  const date = new Date(y, mo - 1, d, h, mi)
  return Number.isNaN(date.getTime()) || date.getMonth() !== mo - 1 ? null : date.getTime()
}
