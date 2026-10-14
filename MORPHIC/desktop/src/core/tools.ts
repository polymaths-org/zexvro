import type { ActionRecord, MemoryCategory, Plan, Repeat, Tier } from '@shared/core'
import { MEMORY_CATEGORIES, REPEATS } from '@shared/core'
import type { ActivityLog } from './activity'
import type { Memory } from './memory'
import { looksSensitive } from './memory'
import type { Reminders } from './reminders'
import type { Connectors } from './connectors'
import { parseLocal } from './reminders'

/**
 * Morph's tools and the Sentinel: every tool declares a tier in code. "auto" tools run straight
 * away; "ask" tools only produce a review card, and run when the person presses the button.
 * The model can't change a tier, and anything it asks for is validated before it runs.
 */

export interface ToolContext {
  sessionId: string
  memory: Memory
  reminders: Reminders
  activity: ActivityLog
  memoryEnabled: boolean
  /** Opens a page in Morph's own browser (never the person's default browser). */
  openInBrowser: (url: string) => Promise<boolean>
  formatWhen: (ms: number) => string
  connectors: Connectors
}

export interface ToolResult {
  action?: ActionRecord
  plan?: Plan
  /** Text Morph should read and then answer with (e.g. what a connector returned). */
  followUp?: string
}

export interface Preview {
  summary: string
  warning?: string
}

export interface Tool<A = Record<string, unknown>> {
  name: string
  tier: Tier
  /** One line for the prompt: the JSON args and when to use it. */
  usage: string
  /** JSON Schema of the arguments, for models with native tool calling. */
  schema: Record<string, unknown>
  /** Returns the cleaned arguments, or an error message. */
  validate: (args: Record<string, unknown>, ctx: ToolContext) => A | string
  /** For "ask" tools: what the review card says. */
  preview?: (args: A) => Preview
  run: (args: A, ctx: ToolContext) => Promise<ToolResult> | ToolResult
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

const setReminder: Tool<{ text: string; due: number; repeat: Repeat }> = {
  name: 'set_reminder',
  tier: 'auto',
  usage:
    'set_reminder: {"text": "...", "when": "YYYY-MM-DD HH:MM", "repeat": "once" | "daily" | "weekly"}: set a reminder at a local date and time.',
  schema: { type: 'object', properties: { text: { type: 'string' }, when: { type: 'string', description: 'Local time, YYYY-MM-DD HH:MM' }, repeat: { type: 'string', enum: ['once', 'daily', 'weekly'] } }, required: ['text', 'when'] },
  validate(args) {
    const text = str(args.text, 200)
    const due = parseLocal(str(args.when, 40))
    const repeat = REPEATS.includes(args.repeat as Repeat) ? (args.repeat as Repeat) : 'once'
    if (!text) return 'missing text'
    if (due === null) return 'unreadable time'
    if (due < Date.now() - 60_000) return 'time is in the past'
    return { text, due, repeat }
  },
  run({ text, due, repeat }, ctx) {
    const reminder = ctx.reminders.add(text, due, repeat)
    if (!reminder) return { action: { tool: 'set_reminder', summary: `Couldn't set the reminder "${text}"`, status: 'failed' } }
    const when = `${ctx.formatWhen(due)}${repeat === 'daily' ? ', every day' : repeat === 'weekly' ? ', every week' : ''}`
    ctx.activity.add({ kind: 'reminder', summary: `Set a reminder: ${text} (${when})`, sessionId: ctx.sessionId })
    return { action: { tool: 'set_reminder', summary: `Reminder set: ${text}, ${when}`, status: 'done' } }
  }
}

const cancelReminder: Tool<{ id: string; text: string }> = {
  name: 'cancel_reminder',
  tier: 'auto',
  usage: 'cancel_reminder: {"id": "..."}: remove one of the reminders listed above (use its id).',
  schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  validate(args, ctx) {
    const id = str(args.id, 60)
    const reminder = ctx.reminders.get(id)
    return reminder ? { id, text: reminder.text } : 'no such reminder'
  },
  run({ id, text }, ctx) {
    ctx.reminders.delete(id)
    ctx.activity.add({ kind: 'reminder', summary: `Removed a reminder: ${text}`, sessionId: ctx.sessionId })
    return { action: { tool: 'cancel_reminder', summary: `Reminder removed: ${text}`, status: 'done' } }
  }
}

const remember: Tool<{ fact: string; category?: MemoryCategory; importance: 1 | 2 | 3; date?: string; until?: number }> = {
  name: 'remember',
  tier: 'auto',
  usage: `remember: {"fact": "...", "category": "${MEMORY_CATEGORIES.map((c) => c.id).join('" | "')}", "important": true | false, "date": "MM-DD", "until": "YYYY-MM-DD"}: remember something about the person when they ask you to, or when it will clearly help later (family names, routines, preferences). Only "fact" is needed. "important" for things like allergies, medicines or close family; "date" for birthdays and anniversaries; "until" for things that will stop being true. Never passwords, codes, PINs, bank or card details.`,
  schema: {
    type: 'object',
    properties: {
      fact: { type: 'string' },
      category: { type: 'string', enum: MEMORY_CATEGORIES.map((c) => c.id) },
      important: { type: 'boolean' },
      date: { type: 'string', description: 'For birthdays and anniversaries: MM-DD' },
      until: { type: 'string', description: 'For short-lived facts: YYYY-MM-DD' }
    },
    required: ['fact']
  },
  validate(args, ctx) {
    const fact = str(args.fact, 300)
    if (!ctx.memoryEnabled) return 'memory is switched off'
    if (!fact) return 'missing fact'
    if (looksSensitive(fact)) return 'sensitive'
    const category = MEMORY_CATEGORIES.some((c) => c.id === args.category) ? (args.category as MemoryCategory) : undefined
    const date = /^(\d{4}-)?\d{2}-\d{2}$/.test(str(args.date, 10)) ? str(args.date, 10) : undefined
    const until = /^\d{4}-\d{2}-\d{2}$/.test(str(args.until, 10)) ? parseLocal(`${str(args.until, 10)} 23:59`) ?? undefined : undefined
    return { fact, category, importance: args.important === true ? 3 : 2, date, until }
  },
  run({ fact, category, importance, date, until }, ctx) {
    const note = ctx.memory.add(fact, 'told', { sessionId: ctx.sessionId, category, importance, date, expiresAt: until })
    if (!note) return {}
    ctx.activity.add({ kind: 'memory', summary: `Remembered: ${note.text}`, sessionId: ctx.sessionId })
    return { action: { tool: 'remember', summary: `I'll remember: ${note.text}`, status: 'done' } }
  }
}

const forget: Tool<{ about: string }> = {
  name: 'forget',
  tier: 'auto',
  usage: 'forget: {"about": "..."}: forget things you remember, when the person asks.',
  schema: { type: 'object', properties: { about: { type: 'string' } }, required: ['about'] },
  validate(args) {
    const about = str(args.about, 200)
    return about ? { about } : 'missing topic'
  },
  run({ about }, ctx) {
    const removed = ctx.memory.forgetMatching(about)
    const summary = removed.length ? `Forgot ${removed.length === 1 ? `"${removed[0].text}"` : `${removed.length} things about ${about}`}` : `Nothing to forget about ${about}`
    if (removed.length) ctx.activity.add({ kind: 'memory', summary, sessionId: ctx.sessionId })
    return { action: { tool: 'forget', summary, status: removed.length ? 'done' : 'failed' } }
  }
}

const showPlan: Tool<Plan> = {
  name: 'show_plan',
  tier: 'auto',
  usage:
    'show_plan: {"title": "...", "steps": ["...", "..."]}: show steps as a checklist the person can tick off (max 8 short steps). If you use it, do not also list the steps in your reply.',
  schema: { type: 'object', properties: { title: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } } }, required: ['title', 'steps'] },
  validate(args) {
    const title = str(args.title, 80) || 'Steps'
    const steps = Array.isArray(args.steps) ? args.steps.map((s) => str(s, 200)).filter(Boolean).slice(0, 8) : []
    return steps.length ? { title, steps: steps.map((text) => ({ text, done: false })) } : 'no steps'
  },
  run(plan) {
    return { plan }
  }
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Web addresses that deserve a second look before opening. */
export function addressWarning(url: URL): string | undefined {
  const host = url.hostname
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return 'This address is a number, not a normal website name. Be careful.'
  if (host.split('.').some((part) => part.startsWith('xn--'))) return 'This address uses unusual letters that can imitate a real website. Be careful.'
  if (host.split('.').length > 4) return 'This address is unusually long. Check it is the website you expect.'
  return undefined
}

const openWebsite: Tool<{ url: string; host: string; why: string }> = {
  name: 'open_website',
  tier: 'auto',
  usage:
    'open_website: {"url": "https://...", "why": "..."}: show a website to the person in your own browser (just to look at it). To do something on a website, use start_browsing instead. Only real, official websites.',
  schema: { type: 'object', properties: { url: { type: 'string' }, why: { type: 'string' } }, required: ['url'] },
  validate(args) {
    try {
      const url = new URL(str(args.url, 500))
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'not a web address'
      return { url: url.toString(), host: url.hostname.replace(/^www\./, ''), why: str(args.why, 160) }
    } catch {
      return 'not a web address'
    }
  },
  preview({ url, host, why }) {
    return { summary: `Open the website ${host}${why ? `: ${why}` : ''}`, warning: addressWarning(new URL(url)) }
  },
  async run({ url, host }, ctx) {
    const opened = await ctx.openInBrowser(url)
    if (opened) ctx.activity.add({ kind: 'website', summary: `Opened ${host} in Morph's browser`, sessionId: ctx.sessionId })
    return { action: { tool: 'open_website', summary: opened ? `Opened ${host} in my browser` : `Couldn't open ${host}`, status: opened ? 'done' : 'failed' } }
  }
}

/** Starts a browsing task (the Agent runs it). Asks first unless the person turned that off. */
const startBrowsing: Tool<{ goal: string; url: string }> = {
  name: 'start_browsing',
  tier: 'ask',
  usage:
    'start_browsing: {"goal": "...", "url": "https://..."}: use your built-in web browser to do something on a website for them (look something up, fill in a form, check a booking). They watch while you work, and you ask before pressing anything important. Use this instead of saying you cannot browse.',
  schema: { type: 'object', properties: { goal: { type: 'string' }, url: { type: 'string', description: 'Website to start on' } }, required: ['goal'] },
  validate(args) {
    const goal = str(args.goal, 300)
    const url = str(args.url, 500)
    if (!goal) return 'missing goal'
    if (url) {
      try {
        const u = new URL(url)
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'not a web address'
      } catch {
        return 'not a web address'
      }
    }
    return { goal, url }
  },
  preview({ goal, url }) {
    const host = url ? hostOf(url) : ''
    return {
      summary: `Use my browser to ${goal.charAt(0).toLowerCase()}${goal.slice(1).replace(/\.$/, '')}${host ? ` (starting at ${host})` : ''}`,
      warning: url ? addressWarning(new URL(url)) : undefined
    }
  },
  run() {
    return {}
  }
}

/** A tool from a connected app (MCP). Always asks first; the result comes back to Morph to answer with. */
const useConnector: Tool<{ connectorId: string; connector: string; tool: string; args: Record<string, unknown> }> = {
  name: 'use_connector',
  tier: 'ask',
  usage:
    'use_connector: {"connector": "NAME", "tool": "TOOL", "args": {...}}: use a tool from one of their connected apps (listed below). They are asked first; then you get the result and answer with it.',
  schema: { type: 'object', properties: { connector: { type: 'string' }, tool: { type: 'string' }, args: { type: 'object' } }, required: ['connector', 'tool'] },
  validate(args, ctx) {
    const found = ctx.connectors.find(str(args.connector, 60), str(args.tool, 100))
    if (!found) return 'no such connector tool'
    const params = args.args && typeof args.args === 'object' && !Array.isArray(args.args) ? (args.args as Record<string, unknown>) : {}
    return { connectorId: found.connector.id, connector: found.connector.name, tool: found.tool.name, args: params }
  },
  preview({ connector, tool, args }) {
    const shown = Object.entries(args)
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`.slice(0, 80))
      .join(', ')
    return { summary: `Use “${tool}” from ${connector}${shown ? ` (${shown})` : ''}` }
  },
  async run({ connectorId, connector, tool, args }, ctx) {
    const { ok, text } = await ctx.connectors.call(connectorId, tool, args)
    ctx.activity.add({ kind: 'system', summary: `Used “${tool}” from ${connector} (you said OK)`, sessionId: ctx.sessionId })
    return {
      action: { tool: 'use_connector', summary: ok ? `Used “${tool}” from ${connector}` : `“${tool}” from ${connector} didn't work`, status: ok ? 'done' : 'failed', detail: text },
      followUp: `Result from “${tool}” (${connector})${ok ? '' : ' (it reported a problem)'}:
${text}`
    }
  }
}

export const TOOLS: Tool<never>[] = [setReminder, cancelReminder, remember, forget, showPlan, openWebsite, startBrowsing, useConnector] as unknown as Tool<never>[]

export function findTool(name: string): Tool<Record<string, unknown>> | undefined {
  return TOOLS.find((t) => t.name === name) as Tool<Record<string, unknown>> | undefined
}
