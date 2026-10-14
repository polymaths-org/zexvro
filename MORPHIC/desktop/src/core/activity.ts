import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Activity } from '@shared/core'
import { appendJsonl, newId, readJsonl } from './store'

const KEEP = 2000

/** Plain-English record of everything Morph has done, so the person (or family) can always check. */
export class ActivityLog {
  private file: string

  constructor(dataDir: string) {
    this.file = join(dataDir, 'activity.jsonl')
  }

  add(entry: Omit<Activity, 'id' | 'at'>) {
    appendJsonl(this.file, { id: newId(), at: Date.now(), ...entry } satisfies Activity)
  }

  list(limit = 200): Activity[] {
    const all = readJsonl<Activity>(this.file)
    if (all.length > KEEP * 1.5) writeFileSync(this.file, all.slice(-KEEP).map((a) => JSON.stringify(a)).join('\n') + '\n')
    return all.slice(-limit).reverse()
  }

  clear() {
    writeFileSync(this.file, '')
  }
}
