/**
 * Types shared by MORPHIC Core (the harness process), the Electron host, and the UI.
 * Core speaks JSON-RPC: requests/responses plus events (core → host) and host requests (core → host, answered).
 */
import type { Session, SessionSummary } from './sessions'

// ── Settings Core needs (the host pushes these on start and whenever they change) ─────────────

export const ANSWER_LENGTHS = ['short', 'normal', 'detailed'] as const
export type AnswerLength = (typeof ANSWER_LENGTHS)[number]

/** Reply languages Morph can use. "auto" = answer in whatever language the person writes. */
export const LANGUAGES = [
  { code: 'auto', label: 'Same as I write' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'ur', label: 'اردو (Urdu)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'fr', label: 'Français (French)' }
] as const
export type LanguageCode = (typeof LANGUAGES)[number]['code']

export interface CoreSettings {
  name: string
  language: LanguageCode
  answerLength: AnswerLength
  /** Whether Morph may learn and use memories. */
  memory: boolean
  /** VROAI address; empty = the built-in default. */
  serviceUrl: string
  /** Personality choices from Settings, layered on top of the soul. */
  personality: Personality
  /** Whether Morph may use its built-in browser at all. */
  browser: boolean
  /** Ask before Morph starts a browsing task (off by default: important steps inside a task still ask). */
  askBeforeBrowsing: boolean
}

// ── Actions, plans and approvals attached to Morph's messages ───────────────────────────────

/** Safety tiers. "auto" runs straight away; "ask" waits for the person's OK on a review card. */
export type Tier = 'auto' | 'ask'

export interface ActionRecord {
  tool: string
  /** Extra text kept with the action (e.g. what a connector tool returned). */
  detail?: string
  /** Plain-English line shown under the message, e.g. "Reminder set for today, 8:00 pm". */
  summary: string
  status: 'done' | 'failed' | 'waiting' | 'declined'
}

export interface PlanStep {
  text: string
  done: boolean
}

export interface Plan {
  title: string
  steps: PlanStep[]
}

export interface Approval {
  id: string
  /** confirm: "Yes, go ahead / No, thanks". handoff: the person does something themselves, then "Continue". */
  kind?: 'confirm' | 'handoff'
  tool: string
  /** What will happen, in plain words ("Open the website sbi.co.in"). */
  summary: string
  /** Extra caution shown on the card, e.g. an unusual web address. */
  warning?: string
  status: 'pending' | 'allowed' | 'declined'
}

// ── Browser tasks (Morph using its built-in browser, step by step, while the person watches) ──

export interface TaskStep {
  text: string
  status: 'done' | 'failed' | 'skipped'
}

export interface Task {
  id: string
  goal: string
  status: 'running' | 'waiting' | 'done' | 'stopped' | 'failed'
  /** What Morph is doing right now, in one calm sentence. */
  say: string
  steps: TaskStep[]
  url?: string
  /** The outcome, in plain words, once finished. */
  result?: string
}

export interface PageElement {
  id: number
  tag: string
  role: string
  label: string
  value?: string
  /** Password, one-time code, card or PIN fields: Morph never types into these. */
  sensitive?: boolean
  /** A form's submit button. */
  submit?: boolean
  href?: string
  options?: string[]
}

export interface PageSnapshot {
  url: string
  title: string
  text: string
  elements: PageElement[]
}

export type BrowserAction =
  | { do: 'go'; url: string }
  | { do: 'click'; id: number }
  | { do: 'type'; id: number; text: string }
  | { do: 'select'; id: number; option: string }
  | { do: 'scroll'; dir: 'up' | 'down' }
  | { do: 'back' }

// ── Connectors (MCP: the open standard for connecting outside tools) ─────────────────────────

export interface ConnectorConfig {
  id: string
  name: string
  /** program: a program on this computer (stdio). web: a web address (Streamable HTTP). */
  kind: 'program' | 'web'
  command?: string
  args?: string[]
  url?: string
  enabled: boolean
}

export interface ConnectorTool {
  name: string
  description: string
  params: string[]
}

export interface ConnectorStatus extends ConnectorConfig {
  state: 'off' | 'connecting' | 'ready' | 'error'
  error?: string
  tools: ConnectorTool[]
}

export type NewConnector = Pick<ConnectorConfig, 'name' | 'kind' | 'command' | 'args' | 'url'>

// ── Memory ──────────────────────────────────────────────────────────────────────────────────

/** told = the person asked Morph to remember; learned = Morph noticed; added = typed on the memory page. */
export type MemorySource = 'told' | 'learned' | 'added'

/** What a memory is about. Used for grouping on the memory page and for recall. */
export const MEMORY_CATEGORIES = [
  { id: 'people', label: 'People' },
  { id: 'health', label: 'Health and routines' },
  { id: 'preferences', label: 'Likes and preferences' },
  { id: 'places', label: 'Places' },
  { id: 'dates', label: 'Important dates' },
  { id: 'tech', label: 'Phone and computer' },
  { id: 'other', label: 'Other' }
] as const
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]['id']

export interface MemoryNote {
  id: string
  text: string
  source: MemorySource
  category: MemoryCategory
  /** 1 = small detail, 2 = useful, 3 = important (e.g. allergies, close family). */
  importance: 1 | 2 | 3
  /** "Always remember": included in every conversation, never tidied away. */
  pinned: boolean
  createdAt: number
  updatedAt: number
  /** For short-lived facts ("visiting next week"): forgotten after this time. */
  expiresAt?: number
  /** For important dates: "MM-DD" (every year) or "YYYY-MM-DD" (once). */
  date?: string
  /** How often the memory was used in an answer, and when last. */
  uses: number
  lastUsedAt?: number
  sessionId?: string
}

/** Morph's identity and voice (soul.md), plus personality choices made in Settings. */
export interface Soul {
  /** The editable soul text (markdown). */
  text: string
  /** True when it differs from the built-in soul. */
  customised: boolean
}

export const TONES = [
  { id: 'warm', label: 'Warm and gentle' },
  { id: 'cheerful', label: 'Cheerful' },
  { id: 'calm', label: 'Calm and quiet' },
  { id: 'respectful', label: 'Polite and formal' }
] as const
export type Tone = (typeof TONES)[number]['id']

export interface Personality {
  tone: Tone
  /** Light humour now and then. */
  humour: boolean
  /** How Morph addresses the person, e.g. "Asha", "Ma'am", "Uncle". Empty = their name. */
  callMe: string
}

/** A browsing routine Morph learned from a task that went well (re-used next time: faster, fewer AI calls). */
export interface Routine {
  id: string
  goal: string
  site: string
  steps: string[]
  uses: number
  createdAt: number
  updatedAt: number
}

export interface MemoryProfile {
  /** Short "About you" block that is always in Morph's mind (size-limited). */
  about: string
  updatedAt: number
}

export const PROFILE_MAX = 1200
export const NOTE_MAX = 300

// ── Reminders ───────────────────────────────────────────────────────────────────────────────

export const REPEATS = ['once', 'daily', 'weekly'] as const
export type Repeat = (typeof REPEATS)[number]

export interface Reminder {
  id: string
  text: string
  /** Next time it is due (ms since epoch). */
  due: number
  repeat: Repeat
  createdAt: number
  /** Set when a one-off reminder has fired and been dismissed. */
  doneAt?: number
}

// ── Activity log ────────────────────────────────────────────────────────────────────────────

export interface Activity {
  id: string
  at: number
  /** e.g. "Set a reminder: Take your tablets, today 8:00 pm" */
  summary: string
  kind: 'reminder' | 'memory' | 'website' | 'plan' | 'system'
  sessionId?: string
}

// ── RPC surface ─────────────────────────────────────────────────────────────────────────────

export interface CoreMethods {
  configure: (settings: Partial<CoreSettings>) => void
  status: () => { online: boolean }

  'sessions.list': () => SessionSummary[]
  'sessions.get': (id: string) => Session | null
  'sessions.rename': (id: string, title: string) => Session | null
  'sessions.delete': (id: string) => void
  'sessions.clear': () => void

  'chat.send': (id: string, text: string) => Session | null
  'chat.retry': (id: string) => Session | null
  'chat.stop': (id: string) => void
  'chat.approve': (sessionId: string, approvalId: string, allow: boolean) => Session | null
  'chat.togglePlanStep': (sessionId: string, messageId: string, step: number) => Session | null

  'memory.list': (query?: string) => MemoryNote[]
  'memory.add': (text: string, category?: MemoryCategory) => MemoryNote | null
  'memory.update': (id: string, text: string) => MemoryNote | null
  'memory.pin': (id: string, pinned: boolean) => MemoryNote | null
  'memory.delete': (id: string) => void
  'memory.clear': () => void
  'memory.profile': () => MemoryProfile
  'memory.setProfile': (about: string) => MemoryProfile

  'soul.get': () => Soul
  'soul.set': (text: string) => Soul
  'soul.reset': () => Soul

  'routines.list': () => Routine[]
  'routines.delete': (id: string) => void

  'reminders.list': () => Reminder[]
  'reminders.add': (text: string, due: number, repeat: Repeat) => Reminder | null
  'reminders.delete': (id: string) => void
  'reminders.snooze': (id: string, minutes: number) => Reminder | null
  'reminders.done': (id: string) => void

  'activity.list': (limit?: number) => Activity[]

  'connectors.list': () => ConnectorStatus[]
  'connectors.add': (connector: NewConnector) => ConnectorStatus | null
  'connectors.remove': (id: string) => void
  'connectors.setEnabled': (id: string, enabled: boolean) => void
  'connectors.reconnect': (id: string) => void
}

/** Core's side: same methods, but handlers may be async. */
export type CoreHandlers = {
  [K in keyof CoreMethods]: (...args: Parameters<CoreMethods[K]>) => ReturnType<CoreMethods[K]> | Promise<ReturnType<CoreMethods[K]>>
}

export type CoreMethod = keyof CoreMethods
export type CoreParams<M extends CoreMethod> = Parameters<CoreMethods[M]>
export type CoreResult<M extends CoreMethod> = ReturnType<CoreMethods[M]>

/** Every method the UI may call. The host rejects anything else. */
export const CORE_METHODS: CoreMethod[] = [
  'configure',
  'status',
  'sessions.list',
  'sessions.get',
  'sessions.rename',
  'sessions.delete',
  'sessions.clear',
  'chat.send',
  'chat.retry',
  'chat.stop',
  'chat.approve',
  'chat.togglePlanStep',
  'memory.list',
  'memory.add',
  'memory.update',
  'memory.delete',
  'memory.clear',
  'memory.profile',
  'memory.setProfile',
  'memory.pin',
  'soul.get',
  'soul.set',
  'soul.reset',
  'routines.list',
  'routines.delete',
  'reminders.list',
  'reminders.add',
  'reminders.delete',
  'reminders.snooze',
  'reminders.done',
  'activity.list',
  'connectors.list',
  'connectors.add',
  'connectors.remove',
  'connectors.setEnabled',
  'connectors.reconnect'
]

/** Events Core pushes to the host (and on to the UI). */
export type CoreEvent =
  | { type: 'session.updated'; session: Session }
  | { type: 'chat.progress'; sessionId: string; phase: 'thinking' | 'done' }
  | { type: 'reminder.due'; reminder: Reminder }
  | { type: 'reminders.changed' }
  | { type: 'memory.changed' }
  | { type: 'connectors.changed' }

/** Things only the host can do (Core has no window). */
export interface HostRequests {
  'host.openExternal': (url: string) => boolean
  'browser.open': (url: string) => { ok: boolean; url: string; title: string }
  'browser.snapshot': () => PageSnapshot | null
  'browser.act': (action: BrowserAction) => { ok: boolean; note?: string; navigated?: boolean }
  /** Tells the window whether Morph is driving the browser right now (for the "Morph is using the browser" label). */
  'browser.driving': (driving: boolean) => void
}
