import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { isSessionId, UNTITLED, type Session, type SessionSummary } from '@shared/sessions'
import { readJson, writeJson } from './store'

/** One JSON file per conversation in <data>/sessions. Ids are validated UUIDs, so they're safe file names. */
export class Sessions {
  private dir: string

  constructor(dataDir: string) {
    this.dir = join(dataDir, 'sessions')
    mkdirSync(this.dir, { recursive: true })
  }

  private file(id: string) {
    return join(this.dir, `${id}.json`)
  }

  create(id: string): Session {
    const now = Date.now()
    return { id, title: UNTITLED, createdAt: now, updatedAt: now, messages: [] }
  }

  get(id: string): Session | null {
    if (!isSessionId(id)) return null
    return readJson<Session | null>(this.file(id), null)
  }

  save(session: Session) {
    writeJson(this.file(session.id), session)
  }

  delete(id: string) {
    if (isSessionId(id)) rmSync(this.file(id), { force: true })
  }

  clear() {
    rmSync(this.dir, { recursive: true, force: true })
    mkdirSync(this.dir, { recursive: true })
  }

  list(): SessionSummary[] {
    const summaries: SessionSummary[] = []
    for (const name of readdirSync(this.dir)) {
      if (!name.endsWith('.json')) continue
      const session = this.get(name.slice(0, -'.json'.length))
      if (session) summaries.push({ id: session.id, title: session.title, updatedAt: session.updatedAt })
    }
    return summaries.sort((a, b) => b.updatedAt - a.updatedAt)
  }
}
