/**
 * MORPHIC Core: Morph's harness process. It owns conversations, the agent turn, tools and the
 * Sentinel, memory, skills, reminders and the activity log. It uses only Node APIs (no Electron), so it runs:
 *   - inside the desktop app as an Electron utility process (Windows, macOS, Linux), or
 *   - headless anywhere Node ≥ 22 runs:  node out/main/core.js --stdio --data <dir>
 * Clients speak JSON-RPC (see shared/core.ts for the method list).
 */
import { mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { MEMORY_CATEGORIES, type CoreEvent, type CoreHandlers, type CoreSettings, type MemoryCategory, type PageSnapshot } from '@shared/core'
import { DEFAULT_PERSONALITY, sanitizePersonality } from '@shared/settings'
import { isSessionId } from '@shared/sessions'
import { Peer, type Transport } from '@shared/rpc'
import { ActivityLog } from './activity'
import { Agent } from './agent'
import { Memory } from './memory'
import { FallbackClient, OpenRouterClient, VroaiClient, type ModelClient } from './model'
import { Reminders } from './reminders'
import { Routines } from './routines'
import { SoulStore } from './soul'
import { Sessions } from './sessions'
import { Skills } from './skills'
import { Connectors } from './connectors'

const DEFAULT_URL = process.env.VROAI_URL ?? import.meta.env.MAIN_VITE_VROAI_URL ?? 'http://localhost:3000'

// Model provider (configuration only; never shown in the app). With an OpenRouter key and model set,
// OpenRouter answers and VROAI is the fallback; MORPHIC_PROVIDER=vroai forces VROAI (tests use this).
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? import.meta.env.MAIN_VITE_OPENROUTER_API_KEY ?? ''
const OPENROUTER_MODELS = (process.env.OPENROUTER_MODEL ?? import.meta.env.MAIN_VITE_OPENROUTER_MODEL ?? '')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)
const PROVIDER = process.env.MORPHIC_PROVIDER ?? (OPENROUTER_KEY && OPENROUTER_MODELS.length ? 'openrouter' : 'vroai')

const isCategory = (value: unknown): value is MemoryCategory => MEMORY_CATEGORIES.some((c) => c.id === value)

function argValue(flag: string) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

/** Electron utility process: messages arrive on process.parentPort. */
function parentPortTransport(): Transport | null {
  const port = (process as unknown as { parentPort?: { postMessage: (m: unknown) => void; on: (e: 'message', cb: (ev: { data: unknown }) => void) => void } }).parentPort
  if (!port) return null
  return { send: (m) => port.postMessage(m), onMessage: (cb) => port.on('message', (ev) => cb(ev.data)) }
}

/** Headless: one JSON message per line on stdin/stdout (logs go to stderr). */
function stdioTransport(): Transport {
  return {
    send: (m) => process.stdout.write(`${JSON.stringify(m)}\n`),
    onMessage: (cb) =>
      createInterface({ input: process.stdin }).on('line', (line) => {
        try {
          cb(JSON.parse(line))
        } catch {
          // Ignore lines that aren't JSON.
        }
      })
  }
}

export function startCore(dataDir: string, transport: Transport) {
  mkdirSync(dataDir, { recursive: true })
  const peer = new Peer(transport)
  const emit = (event: CoreEvent) => peer.emit(event)

  let settings: CoreSettings = {
    name: '',
    language: 'auto',
    answerLength: 'normal',
    memory: true,
    serviceUrl: '',
    personality: DEFAULT_PERSONALITY,
    browser: true,
    askBeforeBrowsing: false
  }
  const vroai = new VroaiClient(() => settings.serviceUrl.trim() || DEFAULT_URL)
  const model: ModelClient =
    PROVIDER === 'openrouter'
      ? new FallbackClient([new OpenRouterClient(() => ({ key: OPENROUTER_KEY, models: OPENROUTER_MODELS })), vroai], (err) =>
          console.error('[core] primary model failed, falling back:', err instanceof Error ? err.message : err)
        )
      : vroai
  const sessions = new Sessions(dataDir)
  const memory = new Memory(dataDir)
  const soul = new SoulStore(dataDir)
  const routines = new Routines(dataDir)
  const activity = new ActivityLog(dataDir)
  const skills = new Skills(dataDir)
  const reminders = new Reminders(
    dataDir,
    (reminder) => emit({ type: 'reminder.due', reminder }),
    () => emit({ type: 'reminders.changed' })
  )
  const connectors = new Connectors(dataDir, () => emit({ type: 'connectors.changed' }))
  connectors.start()
  const agent = new Agent({
    connectors,
    sessions,
    memory,
    reminders,
    activity,
    skills,
    model,
    routines,
    soul: () => soul.get().text,
    settings: () => settings,
    emit,
    // The browser lives in the desktop app; headless Core has none, so these fail gently.
    browser: {
      open: (url) => peer.request<{ ok: boolean; url: string; title: string }>('browser.open', url).catch(() => ({ ok: false, url, title: '' })),
      snapshot: () => peer.request<PageSnapshot | null>('browser.snapshot').catch(() => null),
      act: (action) =>
        peer.request<{ ok: boolean; note?: string; navigated?: boolean }>('browser.act', action).catch(() => ({ ok: false, note: 'the browser is not available' })),
      driving: (on) => void peer.request('browser.driving', on).catch(() => {})
    }
  })

  const methods: CoreHandlers = {
    configure: (patch) => {
      settings = { ...settings, ...patch, personality: sanitizePersonality(patch?.personality, settings.personality) }
    },
    // Really checks the model service.
    status: async () => ({ online: await model.reachable() }),

    'sessions.list': () => sessions.list(),
    'sessions.get': (id) => sessions.get(id),
    'sessions.rename': (id, title) => {
      const session = sessions.get(id)
      if (!session || typeof title !== 'string') return null
      session.title = title.replace(/\s+/g, ' ').trim().slice(0, 80) || session.title
      sessions.save(session)
      return session
    },
    'sessions.delete': (id) => {
      if (!isSessionId(id)) return
      agent.forgetSession(id)
      sessions.delete(id)
    },
    'sessions.clear': () => {
      agent.forgetAllSessions()
      sessions.clear()
    },

    'chat.send': (id, text) => (isSessionId(id) && typeof text === 'string' ? agent.send(id, text) : null),
    'chat.retry': (id) => (isSessionId(id) ? agent.retry(id) : null),
    'chat.stop': (id) => agent.stop(id),
    'chat.approve': (sessionId, approvalId, allow) => agent.approve(sessionId, approvalId, allow === true),
    'chat.togglePlanStep': (sessionId, messageId, step) => agent.togglePlanStep(sessionId, messageId, Number(step)),

    'memory.list': (query) => memory.list(typeof query === 'string' ? query : undefined),
    'memory.add': (text, category) => {
      const note = typeof text === 'string' ? memory.add(text, 'added', { category: isCategory(category) ? category : undefined }) : null
      if (note) activity.add({ kind: 'memory', summary: `You added: ${note.text}` })
      return note
    },
    'memory.update': (id, text) => (typeof text === 'string' ? memory.update(id, text) : null),
    'memory.pin': (id, pinned) => memory.pin(id, pinned === true),
    'memory.delete': (id) => memory.delete(id),
    'memory.clear': () => {
      memory.clear()
      routines.clear()
      activity.add({ kind: 'memory', summary: 'Forgot everything (you asked)' })
      emit({ type: 'memory.changed' })
    },
    'memory.profile': () => memory.profile,
    'memory.setProfile': (about) => memory.setProfile(typeof about === 'string' ? about : ''),

    'soul.get': () => soul.get(),
    'soul.set': (text) => {
      const next = soul.set(typeof text === 'string' ? text : '')
      activity.add({ kind: 'system', summary: next.customised ? "Changed Morph's soul" : "Put Morph's soul back to how it started" })
      return next
    },
    'soul.reset': () => {
      activity.add({ kind: 'system', summary: "Put Morph's soul back to how it started" })
      return soul.reset()
    },

    'routines.list': () => routines.list(),
    'routines.delete': (id) => routines.delete(id),

    'reminders.list': () => reminders.list(),
    'reminders.add': (text, due, repeat) => {
      const reminder = typeof text === 'string' ? reminders.add(text, Number(due), repeat) : null
      if (reminder) activity.add({ kind: 'reminder', summary: `You set a reminder: ${reminder.text}` })
      return reminder
    },
    'reminders.delete': (id) => reminders.delete(id),
    'reminders.snooze': (id, minutes) => reminders.snooze(id, Number(minutes)),
    'reminders.done': (id) => reminders.done(id),

    'activity.list': (limit) => activity.list(typeof limit === 'number' ? limit : 200),

    'connectors.list': () => connectors.list(),
    'connectors.add': (connector) => {
      const added = connectors.add(connector)
      if (added) activity.add({ kind: 'system', summary: `Added the connector ${added.name}` })
      return added
    },
    'connectors.remove': (id) => connectors.remove(id),
    'connectors.setEnabled': (id, enabled) => connectors.setEnabled(id, enabled === true),
    'connectors.reconnect': (id) => connectors.connect(id)
  }

  for (const [name, fn] of Object.entries(methods)) peer.handle(name, fn as never)

  // Announce anything due (or missed while closed), then keep the schedule.
  reminders.tick()
  // Memory housekeeping (expired facts, past one-off dates, near-duplicates): now and twice a day.
  memory.tidy()
  setInterval(() => memory.tidy() && emit({ type: 'memory.changed' }), 12 * 60 * 60_000).unref?.()
  return { peer, agent, reminders }
}

// Entry point (skipped when imported by tests).
if (!process.env.VITEST) {
  const dataDir = argValue('--data') ?? process.env.MORPHIC_DATA ?? `${process.cwd()}/morphic-data`
  const transport = parentPortTransport() ?? stdioTransport()
  startCore(dataDir, transport)
}
