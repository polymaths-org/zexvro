import {
  LANGUAGES,
  MEMORY_CATEGORIES,
  type ConnectorStatus,
  type ConnectorTool,
  type CoreSettings,
  type MemoryNote,
  type MemoryProfile,
  type Reminder,
  type Routine
} from '@shared/core'
import type { Message, Session } from '@shared/sessions'
import type { Recalled } from './memory'
import type { Skill } from './skills'
import { identity } from './soul'
import type { Tool } from './tools'

/**
 * Prompt assembly. VROAI only accepts one prompt string (no system role, no message list), so
 * everything is written into it, most important first:
 *   rules → soul → personality → answer style → time → memory → reminders → skills → tools → conversation.
 * (Models with a system role get everything before "Conversation so far" as the system message; see model.ts.)
 */

const LENGTH: Record<CoreSettings['answerLength'], string> = {
  short: 'Keep answers short: two to four sentences unless they ask for more.',
  normal: 'Keep answers clear and reasonably short.',
  detailed: 'Give fuller explanations when useful, still in plain words.'
}

/** Recent messages kept word for word; anything older is covered by the conversation summary. */
export const KEEP_RECENT = 10
const HISTORY_CHARS = 9_000

export interface TurnContext {
  session: Session
  settings: CoreSettings
  /** Morph's soul (soul.md); the fixed rules and the personality are added around it. */
  soul: string
  profile: MemoryProfile
  /** Pinned, relevant and upcoming memories for this turn (memory.recall). */
  recalled: Recalled
  episodes: { summary: string }[]
  /** Browsing routines Morph has learned (most used first). */
  routines?: Routine[]
  reminders: Reminder[]
  skills: Skill[]
  tools: Tool<never>[]
  now: Date
  formatWhen: (ms: number) => string
  /** Connected apps (MCP) and their tools. */
  connectorTools?: { connector: ConnectorStatus; tools: ConnectorTool[] }[]
  /** Something Morph just got back from a tool, to answer with. */
  toolResult?: string
}

/** The tools Morph may use right now (memory, browser and connectors can each be switched off or absent). */
export function availableTools(all: Tool<never>[], settings: CoreSettings, hasConnectors: boolean): Tool<never>[] {
  return all.filter(
    (t) =>
      (settings.memory || (t.name !== 'remember' && t.name !== 'forget')) &&
      (settings.browser || (t.name !== 'start_browsing' && t.name !== 'open_website')) &&
      (hasConnectors || t.name !== 'use_connector')
  )
}

function languageLine(code: CoreSettings['language']) {
  if (code === 'auto') return 'Reply in the same language the person writes in.'
  const label = LANGUAGES.find((l) => l.code === code)?.label ?? code
  return `Always reply in ${label}, even if the person writes in another language.`
}

function messageLine(m: Message): string {
  const who = m.role === 'you' ? 'Person' : 'Morph'
  const did = m.actions?.filter((a) => a.status === 'done').map((a) => a.summary) ?? []
  const plan = m.plan ? ` [Showed a checklist "${m.plan.title}": ${m.plan.steps.map((s) => s.text).join('; ')}]` : ''
  const extra = did.length ? ` [Did: ${did.join('; ')}]` : ''
  return `${who}: ${m.text.trim()}${plan}${extra}`
}

/** The conversation, newest messages word for word, older ones via the stored summary. */
export function historyLines(session: Session): string[] {
  const start = session.summary ? (session.summarizedUpTo ?? 0) : 0
  const usable = session.messages.slice(start).filter((m) => !m.failed && !m.stopped && m.text.trim())
  const lines: string[] = []
  let chars = 0
  for (const m of usable.reverse()) {
    const line = messageLine(m)
    if (chars + line.length > HISTORY_CHARS && lines.length > 0) break
    lines.unshift(line)
    chars += line.length
  }
  if (session.summary) lines.unshift(`(Earlier in this conversation: ${session.summary})`)
  return lines
}

const inDays = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`)

/** What Morph remembers, as prompt sections. Empty when memory is off or there is nothing yet. */
export function memorySections(profile: MemoryProfile, recalled: Recalled, episodes: { summary: string }[], routines: Routine[] = []): string[] {
  const parts: string[] = []
  const known: string[] = []
  if (profile.about.trim()) known.push(`About them (they wrote this): ${profile.about.trim()}`)
  for (const n of recalled.pinned) known.push(`- ${n.text} (always keep in mind)`)
  for (const n of recalled.relevant) known.push(`- ${n.text}`)
  if (known.length) parts.push(`What you remember about them (use it naturally, don't list it back):\n${known.join('\n')}`)
  if (recalled.upcoming.length) {
    parts.push(
      `Coming up soon (mention it kindly if it fits, once):\n${recalled.upcoming
        .slice(0, 4)
        .map(({ note, inDays: n }) => `- ${inDays(n)}: ${note.text}`)
        .join('\n')}`
    )
  }
  if (episodes.length) parts.push(`Earlier conversations that may be relevant:\n${episodes.map((e) => `- ${e.summary}`).join('\n')}`)
  if (routines.length) {
    parts.push(`Things you have done for them on websites before (you can do them again with start_browsing):\n${routines.slice(0, 5).map((r) => `- ${r.goal} (${r.site})`).join('\n')}`)
  }
  return parts
}

export function buildTurnPrompt(ctx: TurnContext): string {
  const { settings, now } = ctx
  const parts: string[] = [identity(ctx.soul, settings.personality, settings.name), `${LENGTH[settings.answerLength]} ${languageLine(settings.language)}`]

  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${time}`
  parts.push(`Right now it is ${today}, ${time} local time (${iso}).`)

  if (settings.memory) parts.push(...memorySections(ctx.profile, ctx.recalled, ctx.episodes, ctx.routines))

  parts.push(
    ctx.reminders.length
      ? `Their reminders:\n${ctx.reminders
          .slice(0, 20)
          .map((r) => `- [id ${r.id}] ${r.text}, ${ctx.formatWhen(r.due)}${r.repeat === 'once' ? '' : `, repeats ${r.repeat}`}`)
          .join('\n')}`
      : 'They have no reminders set.'
  )

  for (const skill of ctx.skills) parts.push(`How to handle this kind of request (${skill.description}):\n${skill.body}`)

  const connected = ctx.connectorTools ?? []
  const tools = availableTools(ctx.tools, settings, connected.length > 0)
  if (!settings.browser) parts.push('Your browser is switched off, so you cannot use websites for them right now. Offer to explain or guide them step by step instead.')
  parts.push(
    `Things you can do. To do one, add a line at the very end of your reply in exactly this form:
<<action {"tool": "NAME", "args": {...}}>>
You may add several action lines. Only these tools exist:
${tools.map((t) => `- ${t.usage}`).join('\n')}
In your reply, tell the person in plain words what you did (for example "I've set a reminder for 8 in the evening").`
  )
  if (connected.length) {
    parts.push(
      `Their connected apps and tools (for use_connector):\n${connected
        .map(({ connector, tools: list }) => list.map((t) => `- ${connector.name}: ${t.name}(${t.params.join(', ')})${t.description ? `: ${t.description}` : ''}`).join('\n'))
        .join('\n')}`
    )
  }
  if (ctx.toolResult) {
    parts.push(`You just used a tool after the person said yes. Here is what it returned. Answer their request with it, in plain words (don't paste it all back):\n${ctx.toolResult}`)
  }

  parts.push(`Conversation so far:\n${historyLines(ctx.session).join('\n\n')}\n\nMorph:`)
  return parts.join('\n\n')
}

/**
 * Memory reflection (runs while the app is idle): Mem0-style add / update / remove of lasting facts,
 * each with a category and importance, plus a refreshed conversation summary (used for compaction and
 * for recalling past conversations). The reply is checked in code before anything is stored.
 */
export function buildReflectionPrompt(session: Session, fromIndex: number, related: MemoryNote[], name: string, now = new Date()): string {
  const fresh = session.messages.slice(fromIndex).filter((m) => !m.failed && !m.stopped && m.text.trim())
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `You maintain the long-term memory of a helper app for ${name || 'one person'}. Today is ${today}. Read the new part of a conversation and reply with ONLY a JSON object, no other text:
{"add": [{"text": "...", "category": "...", "importance": 2}], "update": [{"id": "...", "text": "..."}], "remove": ["id"], "summary": "..."}

Rules:
- "add": short, lasting facts about the person that will help in future conversations. Write each as a full sentence about them, e.g. "Asha's grandson is called Rohan."
  - "category": one of ${MEMORY_CATEGORIES.map((c) => c.id).join(', ')}.
  - "importance": 3 for things that matter a lot (allergies, medicines, close family), 2 for useful facts, 1 for small details.
  - For birthdays and other dates add "date": "MM-DD" (every year) or "YYYY-MM-DD" (once).
  - For facts that will stop being true soon ("her son is visiting next week"), add "until": "YYYY-MM-DD".
- Do NOT include passwords, codes, PINs, bank, card or ID numbers, full addresses, or one-off small talk. If nothing lasting was said, use [].
- "update": if a new fact changes one of the known facts below, give its id and the corrected sentence instead of adding a new one.
- "remove": ids of known facts the conversation shows are no longer true. Leave it empty when unsure.
- "summary": one or two sentences summarising the WHOLE conversation so far (including the earlier summary if given), so it can be recalled later.

Known facts:
${related.length ? related.map((n) => `- [${n.id}] (${n.category}) ${n.text}`).join('\n') : '(none)'}

${session.summary ? `Earlier summary: ${session.summary}\n\n` : ''}New part of the conversation:
${fresh.map(messageLine).join('\n')}`
}
