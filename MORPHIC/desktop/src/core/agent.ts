import { MEMORY_CATEGORIES, type ActionRecord, type Approval, type CoreEvent, type CoreSettings, type MemoryCategory, type PageSnapshot, type Task } from '@shared/core'
import { titleFrom, UNTITLED, type Message, type Session } from '@shared/sessions'
import type { ActivityLog } from './activity'
import { findDate, tokenize, type Memory, type Recalled } from './memory'
import type { ModelClient } from './model'
import { availableTools, buildReflectionPrompt, buildTurnPrompt, KEEP_RECENT } from './prompt'
import { extractJson, parseReply } from './protocol'
import type { Reminders } from './reminders'
import type { Routines } from './routines'
import type { Sessions } from './sessions'
import type { Skills } from './skills'
import type { Connectors } from './connectors'
import { findTool, hostOf, TOOLS, type ToolContext } from './tools'
import { buildStepPrompt, judge, MAX_STEPS, parseStep, type BrowserHost } from './browser-task'
import { newId } from './store'

const TEXT_MAX = 20_000
/** Memory work waits until the person has been quiet this long (VROAI handles one request at a time). */
export const REFLECT_AFTER_MS = 45_000
const REFLECT_MIN_NEW = 2

interface PendingApproval {
  args: Record<string, unknown>
}

export interface AgentDeps {
  sessions: Sessions
  memory: Memory
  reminders: Reminders
  activity: ActivityLog
  skills: Skills
  model: ModelClient
  /** Learned browsing routines (optional: headless tests may leave it out). */
  routines?: Routines
  /** Morph's soul text (soul.md). */
  soul: () => string
  settings: () => CoreSettings
  emit: (event: CoreEvent) => void
  browser: BrowserHost
  connectors: Connectors
  reflectAfterMs?: number
}

interface Launch {
  goal: string
  url: string
}

export function formatWhen(ms: number, now = Date.now()): string {
  const date = new Date(ms)
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000)
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
  if (days === 0) return `today, ${time}`
  if (days === 1) return `tomorrow, ${time}`
  if (days > 1 && days < 7) return `${new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date)}, ${time}`
  return `${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' }).format(date)}, ${time}`
}

/**
 * Did the reply draw on this memory? True when it repeats the memory's distinctive words (names,
 * places, medicines), ignoring the person's own name. Used to rank useful memories higher later.
 */
export function usedIn(reply: string, note: { text: string }, name = ''): boolean {
  const ignore = new Set(tokenize(name))
  const words = new Set(tokenize(reply))
  const key = tokenize(note.text).filter((t) => t.length >= 4 && !ignore.has(t))
  const hits = new Set(key.filter((t) => words.has(t))).size
  return hits >= Math.min(2, key.length) && hits > 0
}

const isCategory = (v: unknown): v is MemoryCategory => MEMORY_CATEGORIES.some((c) => c.id === v)

/** When a reflected fact should be forgotten ("until": "YYYY-MM-DD" → the end of that day). */
function untilTime(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [y, m, d] = value.split('-').map(Number)
  const end = new Date(y, m - 1, d, 23, 59, 59).getTime()
  return end > Date.now() ? end : undefined
}

export class Agent {
  private inflight = new Map<string, AbortController>()
  /** Conversations deleted mid-answer: their late answer must not bring them back. */
  private discarded = new Set<string>()
  /** Arguments for review cards awaiting the person's OK (never shown to the model again). */
  private approvals = new Map<string, PendingApproval>()
  /** Browsing tasks waiting on the person (an OK, or "Continue" after they typed something themselves). */
  private taskWaits = new Map<string, (allow: boolean) => void>()
  private reflectTimer: ReturnType<typeof setTimeout> | null = null
  private reflecting: AbortController | null = null

  constructor(private deps: AgentDeps) {}

  private toolContext(sessionId: string): ToolContext {
    const { memory, reminders, activity, connectors, browser } = this.deps
    return {
      sessionId,
      memory,
      reminders,
      activity,
      connectors,
      memoryEnabled: this.deps.settings().memory,
      formatWhen: (ms) => formatWhen(ms),
      openInBrowser: async (url) => (await browser.open(url)).ok
    }
  }

  async send(id: string, text: string): Promise<Session | null> {
    const question = text.trim().slice(0, TEXT_MAX)
    if (!question) return null
    const session = this.deps.sessions.get(id) ?? this.deps.sessions.create(id)
    session.messages.push({ id: newId(), role: 'you', text: question, at: Date.now() })
    if (session.title === UNTITLED) session.title = titleFrom(question)
    session.updatedAt = Date.now()
    // Save the question first, so it survives a crash or Stop.
    this.deps.sessions.save(session)
    return this.answer(session)
  }

  async retry(id: string): Promise<Session | null> {
    const session = this.deps.sessions.get(id)
    if (!session) return null
    const last = session.messages.at(-1)
    if (last?.role === 'morph' && (last.failed || last.stopped)) {
      session.messages.pop()
      // Persist now: answer() re-reads the saved conversation before adding the new reply.
      this.deps.sessions.save(session)
    }
    if (session.messages.at(-1)?.role !== 'you') return session
    return this.answer(session)
  }

  stop(id: string) {
    this.inflight.get(id)?.abort()
  }

  forgetSession(id: string) {
    if (this.inflight.has(id)) this.discarded.add(id)
    this.inflight.get(id)?.abort()
    this.deps.memory.removeEpisode(id)
  }

  forgetAllSessions() {
    for (const [id, controller] of this.inflight) {
      this.discarded.add(id)
      controller.abort()
    }
  }

  private async answer(session: Session, toolResult?: string): Promise<Session | null> {
    this.cancelReflection()
    this.inflight.get(session.id)?.abort()
    const controller = new AbortController()
    this.inflight.set(session.id, controller)
    this.deps.emit({ type: 'chat.progress', sessionId: session.id, phase: 'thinking' })

    let reply: Message
    let launch: Launch | undefined
    try {
      const tools = availableTools(TOOLS, this.deps.settings(), this.deps.connectors.ready().length > 0).map((t) => ({
        name: t.name,
        description: t.usage,
        parameters: t.schema
      }))
      const { prompt, recalled } = this.turnPrompt(session, toolResult)
      const raw = await this.deps.model.complete(prompt, controller.signal, tools)
      ;({ message: reply, launch } = await this.applyReply(session.id, raw))
      this.noteUse(recalled, reply.text)
    } catch {
      reply = { id: newId(), role: 'morph', text: '', at: Date.now(), ...(controller.signal.aborted ? { stopped: true } : { failed: true }) }
    } finally {
      if (this.inflight.get(session.id) === controller) this.inflight.delete(session.id)
    }

    this.deps.emit({ type: 'chat.progress', sessionId: session.id, phase: 'done' })
    if (this.discarded.delete(session.id)) return null
    // Re-read: the person may have ticked a checklist step or approved something while we waited.
    const latest = this.deps.sessions.get(session.id) ?? session
    latest.messages.push(reply)
    latest.updatedAt = Date.now()
    this.deps.sessions.save(latest)
    if (launch) void this.runTask(latest.id, reply.id, launch.url)
    else this.scheduleReflection(latest.id)
    return latest
  }

  private turnPrompt(session: Session, toolResult?: string): { prompt: string; recalled: Recalled } {
    const { memory, reminders, skills, settings } = this.deps
    const s = settings()
    const recentAsks = session.messages
      .filter((m) => m.role === 'you')
      .slice(-2)
      .map((m) => m.text)
      .join(' ')
    const recalled: Recalled = s.memory ? memory.recall(recentAsks) : { pinned: [], relevant: [], upcoming: [] }
    // Nothing matches (e.g. "hello"): Morph still knows the most important basics.
    if (s.memory && !recalled.relevant.length) recalled.relevant = memory.recent()
    const prompt = buildTurnPrompt({
      session,
      settings: s,
      soul: this.deps.soul(),
      profile: memory.profile,
      recalled,
      episodes: s.memory ? memory.recallEpisodes(recentAsks, session.id) : [],
      routines: s.memory && s.browser ? this.deps.routines?.list() : [],
      reminders: reminders.list(),
      skills: skills.match(session.messages.at(-1)?.text ?? ''),
      tools: TOOLS,
      now: new Date(),
      formatWhen: (ms) => formatWhen(ms),
      connectorTools: this.deps.connectors.ready(),
      toolResult
    })
    return { prompt, recalled }
  }

  /** Counts the memories the answer actually drew on. */
  private noteUse(recalled: Recalled, reply: string) {
    const name = this.deps.settings().name
    const notes = [...recalled.pinned, ...recalled.relevant, ...recalled.upcoming.map((u) => u.note)]
    this.deps.memory.markUsed([...new Set(notes.filter((n) => usedIn(reply, n, name)).map((n) => n.id))])
  }

  /** Runs the reply's actions through the Sentinel and turns it into Morph's message. */
  private async applyReply(sessionId: string, raw: string): Promise<{ message: Message; launch?: Launch }> {
    const { text, actions: requested } = parseReply(raw)
    const ctx = this.toolContext(sessionId)
    const message: Message = { id: newId(), role: 'morph', text, at: Date.now() }
    const actions: ActionRecord[] = []
    let changedReminders = false
    let changedMemory = false
    let launch: Launch | undefined
    const settings = this.deps.settings()

    for (const request of requested.slice(0, 6)) {
      const tool = findTool(request.tool)
      if (!tool) continue
      const args = tool.validate(request.args, ctx)
      if (typeof args === 'string') {
        if (tool.name === 'set_reminder') actions.push({ tool: tool.name, summary: "I couldn't set that reminder. Please tell me the day and time again.", status: 'failed' })
        continue
      }
      if (tool.name === 'start_browsing') {
        if (!settings.browser || message.task || message.approval) continue
        const { goal, url } = args as unknown as Launch
        if (!settings.askBeforeBrowsing) {
          message.task = newTask(goal)
          launch = { goal, url }
          continue
        }
      }
      if (tool.tier === 'ask') {
        // Only one review card per answer, and it never runs until the person says so.
        if (message.approval) continue
        const preview = tool.preview?.(args) ?? { summary: tool.name }
        const approval: Approval = { id: newId(), tool: tool.name, summary: preview.summary, warning: preview.warning, status: 'pending' }
        this.approvals.set(approval.id, { args })
        message.approval = approval
        continue
      }
      const result = await tool.run(args, ctx)
      if (result.action) actions.push(result.action)
      if (result.plan && !message.plan) message.plan = result.plan
      changedReminders ||= tool.name.includes('reminder')
      changedMemory ||= tool.name === 'remember' || tool.name === 'forget'
    }

    if (actions.length) message.actions = actions
    if (!message.text) {
      message.text = message.task
        ? "I'm on it. You can watch me in my browser."
        : message.plan
          ? 'Here are the steps:'
          : actions.length
            ? 'Done.'
            : message.approval
              ? 'Shall I do this?'
              : '…'
    }
    if (changedReminders) this.deps.emit({ type: 'reminders.changed' })
    if (changedMemory) this.deps.emit({ type: 'memory.changed' })
    return { message, launch }
  }

  /** The person pressed a button on a review card. */
  async approve(sessionId: string, approvalId: string, allow: boolean): Promise<Session | null> {
    // A browsing task is waiting on this answer: hand it over and let the task carry on.
    const waiting = this.taskWaits.get(approvalId)
    if (waiting) {
      this.taskWaits.delete(approvalId)
      this.updateMessage(sessionId, (m) => m.approval?.id === approvalId, (m) => {
        m.approval!.status = allow ? 'allowed' : 'declined'
        if (m.task) m.task.status = 'running'
      })
      waiting(allow)
      return this.deps.sessions.get(sessionId)
    }
    const session = this.deps.sessions.get(sessionId)
    const message = session?.messages.find((m) => m.approval?.id === approvalId)
    if (!session || !message?.approval || message.approval.status !== 'pending') return session ?? null
    const pending = this.approvals.get(approvalId)
    this.approvals.delete(approvalId)
    const tool = findTool(message.approval.tool)
    if (!allow || !pending || !tool) {
      // After a restart the arguments are gone, so an old card can only be declined.
      message.approval.status = 'declined'
      message.actions = [...(message.actions ?? []), { tool: message.approval.tool, summary: allow ? 'This request expired. Please ask me again.' : "Okay, I won't.", status: 'declined' }]
    } else if (tool.name === 'start_browsing') {
      message.approval.status = 'allowed'
      const { goal, url } = pending.args as unknown as Launch
      message.task = newTask(goal)
      this.deps.sessions.save(session)
      void this.runTask(sessionId, message.id, url)
      return session
    } else {
      message.approval.status = 'allowed'
      const result = await tool.run(pending.args as never, this.toolContext(sessionId))
      if (result.action) message.actions = [...(message.actions ?? []), result.action]
      if (result.followUp) {
        // Morph reads what came back and answers with it, in a new message.
        this.deps.sessions.save(session)
        const followUp = result.followUp
        void this.answer(session, followUp).then((s) => s && this.deps.emit({ type: 'session.updated', session: s }))
        return session
      }
    }
    this.deps.sessions.save(session)
    return session
  }

  // ── Browsing tasks ─────────────────────────────────────────────────────────────────────────

  /** Applies a change to one message, saves, and tells the UI (so the task card updates live). */
  private updateMessage(sessionId: string, match: (m: Message) => boolean, change: (m: Message) => void) {
    const session = this.deps.sessions.get(sessionId)
    const message = session?.messages.find(match)
    if (!session || !message) return
    change(message)
    session.updatedAt = Date.now()
    this.deps.sessions.save(session)
    this.deps.emit({ type: 'session.updated', session })
  }

  /** Pauses the task until the person answers a card (or the task is stopped). */
  private waitForPerson(sessionId: string, messageId: string, approval: Approval, signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return Promise.resolve(false)
    this.updateMessage(sessionId, (m) => m.id === messageId, (m) => {
      m.approval = approval
      if (m.task) m.task.status = 'waiting'
    })
    return new Promise((resolve) => {
      this.taskWaits.set(approval.id, resolve)
      signal.addEventListener(
        'abort',
        () => {
          this.taskWaits.delete(approval.id)
          resolve(false)
        },
        { once: true }
      )
    })
  }

  /**
   * Runs a browsing task step by step. Every action is judged in code first (browser-task.ts): opening a
   * new website or pressing a "real-world" button needs an OK; private fields are handed to the person.
   */
  async runTask(sessionId: string, messageId: string, startUrl: string) {
    const { browser, model, settings, activity, routines } = this.deps
    this.inflight.get(sessionId)?.abort()
    const controller = new AbortController()
    const { signal } = controller
    this.inflight.set(sessionId, controller)
    this.deps.emit({ type: 'chat.progress', sessionId, phase: 'thinking' })
    const isTask = (m: Message) => m.id === messageId
    const task = (change: (t: Task) => void) => this.updateMessage(sessionId, isTask, (m) => m.task && change(m.task))
    const step = (text: string, status: Task['steps'][number]['status'] = 'done') => task((t) => t.steps.push({ text, status }))
    const finish = (status: Task['status'], result: string) =>
      this.updateMessage(sessionId, isTask, (m) => {
        if (m.approval?.status === 'pending') m.approval.status = 'declined'
        if (!m.task) return
        m.task.status = status
        m.task.result = result
        m.task.say = ''
      })
    const ask = (summary: string, warning?: string, kind: Approval['kind'] = 'confirm', toolName = 'browser') =>
      this.waitForPerson(sessionId, messageId, { id: newId(), kind, tool: toolName, summary, warning, status: 'pending' }, signal)
    // Saying yes to the task also says yes to the website it starts on.
    const approved = new Set<string>(startUrl ? [hostOf(startUrl)] : [])
    let page: PageSnapshot | null = null
    let badReplies = 0
    const goal = this.deps.sessions.get(sessionId)?.messages.find(isTask)?.task?.goal ?? ''
    // A routine learned from a similar task: a guide for the model, so it needs fewer guesses.
    const routine = settings().memory ? (routines?.find(goal, hostOf(startUrl) || undefined) ?? null) : null

    browser.driving(true)
    try {
      if (startUrl) {
        task((t) => (t.say = `Opening ${hostOf(startUrl)}…`))
        const opened = await browser.open(startUrl)
        step(opened.ok ? `Opened ${hostOf(opened.url) || hostOf(startUrl)}` : `Couldn't open ${hostOf(startUrl)}`, opened.ok ? 'done' : 'failed')
      }
      for (let n = 0; n < MAX_STEPS; n++) {
        if (signal.aborted) throw new Error('stopped')
        page = await browser.snapshot()
        task((t) => (t.url = page?.url))
        const current = this.deps.sessions.get(sessionId)?.messages.find(isTask)?.task
        if (!current) return
        const reply = parseStep(await model.complete(buildStepPrompt(current, page, settings().name, new Date(), routine), signal))
        if (!reply) {
          if (++badReplies >= 2) return finish('failed', "I got a bit muddled on this page, so I've stopped. You can carry on yourself, or ask me again.")
          continue
        }
        badReplies = 0
        if (reply.say) task((t) => (t.say = reply.say))
        if (reply.handoff) {
          if (!(await ask(reply.handoff.text, undefined, 'handoff'))) throw new Error('stopped')
          step('You did a step yourself')
          continue
        }
        for (const action of reply.actions) {
          if (signal.aborted) throw new Error('stopped')
          const verdict = judge(action, page, approved)
          if (verdict.kind === 'refuse') {
            step(verdict.reason, 'skipped')
            break
          }
          if (verdict.kind === 'handoff') {
            if (!(await ask(verdict.text, undefined, 'handoff'))) throw new Error('stopped')
            step('You typed something private yourself')
            break
          }
          if (verdict.kind === 'ask') {
            if (!(await ask(verdict.summary, verdict.warning))) {
              return finish('stopped', `Okay, I didn't ${verdict.summary.charAt(0).toLowerCase()}${verdict.summary.slice(1)}. I've stopped here, and nothing else was done.`)
            }
            if (verdict.approveDomain) approved.add(verdict.approveDomain)
          }
          let ok = true
          let note: string | undefined
          let navigated = false
          if (action.do === 'go') {
            const opened = await browser.open(action.url)
            ok = opened.ok
            if (ok) approved.add(hostOf(opened.url))
          } else {
            ;({ ok, note, navigated = false } = await browser.act(action))
          }
          const describe = verdict.kind === 'allow' ? verdict.describe : verdict.summary.replace(/^Press/, 'Pressed').replace(/^Open/, 'Opened')
          step(ok ? describe : `${describe}: ${note ?? "that didn't work"}`, ok ? 'done' : 'failed')
          if (verdict.kind === 'ask') activity.add({ kind: 'website', summary: `${describe} (you said OK)`, sessionId })
          // Only look again if the page actually changed; otherwise keep going (fill every box, then press).
          if (action.do === 'go' || action.do === 'back' || navigated || !ok) break
        }
        if (reply.done) {
          activity.add({ kind: 'website', summary: `Browsing task: ${current.goal}`, sessionId })
          const steps = this.deps.sessions.get(sessionId)?.messages.find(isTask)?.task?.steps ?? current.steps
          const site = hostOf(startUrl) || hostOf(page?.url ?? '')
          if (settings().memory && routines?.learn(current.goal, site, steps)) this.deps.emit({ type: 'memory.changed' })
          return finish('done', reply.result || 'All done.')
        }
      }
      finish('done', "I've taken quite a few steps, so I'll pause here. Tell me if you'd like me to carry on.")
    } catch {
      finish(signal.aborted ? 'stopped' : 'failed', signal.aborted ? 'You stopped me. Nothing else was done.' : "Something went wrong with the browser, so I've stopped.")
    } finally {
      browser.driving(false)
      if (this.inflight.get(sessionId) === controller) this.inflight.delete(sessionId)
      this.deps.emit({ type: 'chat.progress', sessionId, phase: 'done' })
      this.scheduleReflection(sessionId)
    }
  }

  togglePlanStep(sessionId: string, messageId: string, step: number): Session | null {
    const session = this.deps.sessions.get(sessionId)
    const plan = session?.messages.find((m) => m.id === messageId)?.plan
    if (!session || !plan || !plan.steps[step]) return session ?? null
    plan.steps[step].done = !plan.steps[step].done
    this.deps.sessions.save(session)
    return session
  }

  // ── Memory reflection: Letta-style "sleep-time" work, only while the person is idle ────────────

  scheduleReflection(sessionId: string) {
    this.cancelReflection()
    if (!this.deps.settings().memory) return
    this.reflectTimer = setTimeout(() => void this.reflect(sessionId), this.deps.reflectAfterMs ?? REFLECT_AFTER_MS)
    this.reflectTimer.unref?.()
  }

  private cancelReflection() {
    if (this.reflectTimer) clearTimeout(this.reflectTimer)
    this.reflectTimer = null
    this.reflecting?.abort()
    this.reflecting = null
  }

  async reflect(sessionId: string): Promise<boolean> {
    const { sessions, memory, model, settings } = this.deps
    const session = sessions.get(sessionId)
    if (!session || !settings().memory || this.inflight.size > 0) return false
    const from = session.reflectedUpTo ?? 0
    const fresh = session.messages.slice(from).filter((m) => !m.failed && !m.stopped)
    if (fresh.filter((m) => m.role === 'you').length < REFLECT_MIN_NEW && !(from === 0 && fresh.length >= 2)) return false

    const controller = new AbortController()
    this.reflecting = controller
    try {
      const recalled = memory.recall(fresh.map((m) => m.text).join(' '), 12)
      const related = [...recalled.pinned, ...recalled.relevant]
      const raw = await model.complete(buildReflectionPrompt(session, from, related, settings().name), controller.signal)
      const result = extractJson<{ add?: unknown; update?: unknown; remove?: unknown; summary?: unknown }>(raw)
      if (!result) return false
      let changed = false
      for (const fact of Array.isArray(result.add) ? result.add : []) {
        // Older or smaller models may send plain sentences; both shapes are accepted.
        const f = (typeof fact === 'string' ? { text: fact } : (fact ?? {})) as Record<string, unknown>
        if (typeof f.text !== 'string') continue
        const note = memory.add(f.text, 'learned', {
          sessionId,
          category: isCategory(f.category) ? f.category : undefined,
          importance: Number(f.importance),
          date: typeof f.date === 'string' ? f.date : findDate(f.text),
          expiresAt: untilTime(f.until)
        })
        if (note) changed = true
      }
      for (const u of Array.isArray(result.update) ? result.update : []) {
        const { id, text } = (u ?? {}) as { id?: unknown; text?: unknown }
        if (typeof id === 'string' && typeof text === 'string' && memory.update(id, text)) changed = true
      }
      // Only facts Morph learned by itself can be dropped this way; pinned and told facts stay.
      for (const id of Array.isArray(result.remove) ? result.remove : []) {
        const note = memory.notes.find((n) => n.id === id)
        if (note && note.source === 'learned' && !note.pinned) {
          memory.delete(note.id)
          changed = true
        }
      }
      if (changed) memory.tidy()
      // Re-read before writing: a new message may have arrived during the call.
      const latest = sessions.get(sessionId)
      if (!latest) return false
      if (typeof result.summary === 'string' && result.summary.trim()) {
        memory.setEpisode(sessionId, result.summary)
        // Compaction: older messages are now covered by the summary.
        if (latest.messages.length > KEEP_RECENT * 2) {
          latest.summary = result.summary.trim().slice(0, 1200)
          latest.summarizedUpTo = latest.messages.length - KEEP_RECENT
        }
      }
      latest.reflectedUpTo = session.messages.length
      sessions.save(latest)
      if (changed) this.deps.emit({ type: 'memory.changed' })
      return true
    } catch {
      return false
    } finally {
      if (this.reflecting === controller) this.reflecting = null
    }
  }
}

function newTask(goal: string): Task {
  return { id: newId(), goal, status: 'running', say: 'Getting started…', steps: [] }
}
