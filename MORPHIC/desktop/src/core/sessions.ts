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
    // Runtime promises and approval arguments do not survive restart. Never pretend they do.
    for (const name of readdirSync(this.dir)) {
      if (!name.endsWith('.json')) continue
      const session = this.get(name.slice(0, -5))
      if (!session) continue
      let changed = false
      for (const message of session.messages) {
        if (message.task && ['running', 'waiting'].includes(message.task.status)) {
          message.task.status = 'paused'
          message.task.result = 'Morph restarted during this task. It is unfinished; read the current page before continuing.'
          message.task.say = ''
          changed = true
        }
        if (message.approval?.status === 'pending') {
          message.approval.status = 'declined'
          message.actions = [...(message.actions || []), { tool: message.approval.tool, summary: 'This approval expired on restart. Ask again before doing it.', status: 'declined' }]
          changed = true
        }
      }
      if (changed) this.save(session)
    }
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
