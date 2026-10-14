import type { BrowserAction, PageElement, PageSnapshot, Routine, Task } from '@shared/core'
import { looksSensitive } from './memory'
import { extractJson } from './protocol'
import { addressWarning, hostOf } from './tools'

/**
 * Browsing tasks: Morph uses its built-in browser step by step while the person watches (after Meta's Muse,
 * but with the Sentinel in charge). Each step: look at the page → ask the model for the next actions →
 * check every action → do it in the browser. One model call per step; up to six actions per step.
 * A routine learned from an earlier, similar task (routines.ts) is given as a guide when there is one.
 */

export const MAX_STEPS = 15
const MAX_ACTIONS_PER_STEP = 6

/** Things only the host (the desktop app) can do with its browser. */
export interface BrowserHost {
  open(url: string): Promise<{ ok: boolean; url: string; title: string }>
  snapshot(): Promise<PageSnapshot | null>
  act(action: BrowserAction): Promise<{ ok: boolean; note?: string; navigated?: boolean }>
  driving(on: boolean): void
}

export interface StepReply {
  say: string
  actions: BrowserAction[]
  done: boolean
  result: string
  /** The person must do something themselves (e.g. type a password), then press Continue. */
  handoff?: { text: string; id?: number }
}

// ── Reading the model's step reply ──────────────────────────────────────────────────────────

function toAction(raw: unknown): BrowserAction | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  const id = Number(a.id)
  switch (a.do) {
    case 'go':
      return typeof a.url === 'string' ? { do: 'go', url: a.url } : null
    case 'click':
      return Number.isInteger(id) ? { do: 'click', id } : null
    case 'type':
      return Number.isInteger(id) && typeof a.text === 'string' ? { do: 'type', id, text: a.text.slice(0, 500) } : null
    case 'select':
      return Number.isInteger(id) && typeof a.option === 'string' ? { do: 'select', id, option: a.option.slice(0, 200) } : null
    case 'scroll':
      return { do: 'scroll', dir: a.dir === 'up' ? 'up' : 'down' }
    case 'back':
      return { do: 'back' }
    default:
      return null
  }
}

export function parseStep(raw: string): StepReply | null {
  const json = extractJson<Record<string, unknown>>(raw)
  if (!json) return null
  const say = typeof json.say === 'string' ? json.say.trim().slice(0, 200) : ''
  const actions = (Array.isArray(json.actions) ? json.actions : []).map(toAction).filter((a): a is BrowserAction => a !== null).slice(0, MAX_ACTIONS_PER_STEP)
  const done = json.done === true
  const result = typeof json.result === 'string' ? json.result.trim().slice(0, 2000) : ''
  const handoff =
    typeof json.handoff === 'string' && json.handoff.trim()
      ? { text: json.handoff.trim().slice(0, 300), id: Number.isInteger(Number(json.id)) ? Number(json.id) : undefined }
      : undefined
  return { say, actions, done, result, handoff }
}

// ── The Sentinel for browsing ───────────────────────────────────────────────────────────────

/**
 * Buttons whose press changes something in the real world (money, bookings, messages, deleting):
 * always asked first. Everyday buttons (sign in, accept cookies, next, search) are not, so Morph doesn't nag.
 */
const CONSEQUENTIAL = /\b(submit|send|pay|payment|purchase|buy|order|book|reserve|confirm|delete|remove|cancel (my|the|this)|transfer|donate|subscribe|place order|checkout|check out|proceed to pay|make payment)\b/i
/** Submit buttons that only look things up or move along are fine without asking. */
const HARMLESS = /\b(search|find|go|next|continue|show|filter|sort|view|more|load|sign ?in|log ?in|accept|agree|ok|close|got it)\b/i

export function isConsequential(el: PageElement): boolean {
  const label = el.label.toLowerCase()
  if (CONSEQUENTIAL.test(label)) return true
  if (el.submit && !HARMLESS.test(label)) return true
  return false
}

export type Verdict =
  | { kind: 'allow'; describe: string }
  | { kind: 'ask'; summary: string; warning?: string; approveDomain?: string }
  | { kind: 'handoff'; text: string }
  | { kind: 'refuse'; reason: string }

const quote = (s: string) => `“${s.length > 50 ? `${s.slice(0, 48)}…` : s}”`

/** Decides, in code, whether a browser action may run, needs the person's OK, or must be done by them. */
export function judge(action: BrowserAction, page: PageSnapshot | null, approvedDomains: Set<string>): Verdict {
  const site = page ? hostOf(page.url) : ''
  if (action.do === 'go') {
    let url: URL
    try {
      url = new URL(action.url)
    } catch {
      return { kind: 'refuse', reason: 'That is not a web address.' }
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { kind: 'refuse', reason: 'Only websites can be opened.' }
    const host = url.hostname.replace(/^www\./, '')
    // Opening websites is everyday browsing. Only addresses that look like tricks need a yes.
    const warning = addressWarning(url)
    if (!warning || approvedDomains.has(host)) return { kind: 'allow', describe: `Opened ${host}` }
    return { kind: 'ask', summary: `Open the website ${host}`, warning, approveDomain: host }
  }
  if (action.do === 'scroll') return { kind: 'allow', describe: `Scrolled ${action.dir}` }
  if (action.do === 'back') return { kind: 'allow', describe: 'Went back a page' }

  const el = page?.elements.find((e) => e.id === action.id)
  if (!el) return { kind: 'refuse', reason: 'That part of the page has changed.' }
  const name = el.label || el.role
  if (action.do === 'type') {
    if (el.sensitive) return { kind: 'handoff', text: `Please type this yourself in the highlighted box (${name}). I never type passwords, codes or card numbers. Then press Continue.` }
    if (looksSensitive(action.text)) return { kind: 'refuse', reason: "I won't type passwords, codes or bank details." }
    return { kind: 'allow', describe: `Typed ${quote(action.text)} into ${quote(name)}` }
  }
  if (action.do === 'select') return { kind: 'allow', describe: `Chose ${quote(action.option)} in ${quote(name)}` }
  // click
  if (isConsequential(el)) return { kind: 'ask', summary: `Press ${quote(name)}${site ? ` on ${site}` : ''}` }
  return { kind: 'allow', describe: `Pressed ${quote(name)}` }
}

// ── The prompt for one step ─────────────────────────────────────────────────────────────────

function describeElement(e: PageElement): string {
  const parts = [`[${e.id}] ${e.role}`, e.label ? `"${e.label}"` : '']
  if (e.value !== undefined) parts.push(`value="${e.value}"`)
  if (e.options?.length) parts.push(`options: ${e.options.join(' | ')}`)
  if (e.sensitive) parts.push('(private: never type here)')
  return parts.filter(Boolean).join(' ')
}

export function buildStepPrompt(task: Task, page: PageSnapshot | null, name: string, now: Date, routine?: Routine | null): string {
  const guide = routine
    ? `\nYou have done something like this before on ${routine.site} ("${routine.goal}"). These steps worked then; use them as a guide, but follow what is on the page now:\n${routine.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`
    : ''
  return `You are Morph, a calm, careful helper. You are using a web browser on behalf of ${name || 'the person'} to do this task:
"${task.goal}"
Right now it is ${now.toLocaleString('en-GB')}.

Reply with ONLY one JSON object, nothing else:
{"say": "one short, calm sentence telling the person what you are doing now", "actions": [ ... ], "done": false}

Actions (use the numbers of the elements on the page below):
{"do": "go", "url": "https://..."}            open a web address (only real, official websites)
{"do": "click", "id": 12}
{"do": "type", "id": 5, "text": "..."}
{"do": "select", "id": 7, "option": "..."}
{"do": "scroll", "dir": "down"}                or "up"
{"do": "back"}
Work quickly: give up to 6 actions in one reply when they are on the same page (for example, fill in every box and then press the button).
Never type passwords, codes, PINs, card or bank numbers. If one is needed, reply {"say": "...", "handoff": "what the person should do", "id": <box number>}.
The person will be asked before you press buttons like Book, Pay, Send or Submit. That is expected; just carry on.
When the task is finished, or you found what they wanted, reply {"done": true, "result": "what you did or found, in plain, friendly words"}.
If you are stuck or need them to decide something, reply {"done": true, "result": "explain simply what you need from them"}.
${guide}
Steps so far:
${task.steps.length ? task.steps.map((s, i) => `${i + 1}. ${s.text}${s.status === 'done' ? '' : ` (${s.status})`}`).join('\n') : '(none yet: start by opening a website)'}

${
  page
    ? `Current page: ${page.title || '(no title)'} | ${page.url}
Elements:
${page.elements.map(describeElement).join('\n') || '(none)'}

Text on the page (shortened):
${page.text.slice(0, 2200)}`
    : 'No page is open yet.'
}`
}
