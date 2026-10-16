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
import { findTool, hostOf, TOOLS, type ToolContext, type ToolResult } from './tools'
import { BROWSER_STEP_TOOL, buildStepPrompt, judge, MAX_STEPS, parseStep, type BrowserHost } from './browser-task'
import { newId } from './store'
import type { Workspace } from './workspace'

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
  workspace?: Workspace
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
  private browserTask: { controller: AbortController; done: Promise<void> } | null = null
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

  private toolContext(sessionId: string, signal?: AbortSignal): ToolContext {
    const { memory, reminders, activity, connectors, browser } = this.deps
    return {
      sessionId,
      memory,
      reminders,
      activity,
      connectors,
      workspace: this.deps.workspace,
      signal,
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
    let superseded = false
    try {
      const tools = availableTools(TOOLS, this.deps.settings(), this.deps.connectors.ready().length > 0, !!this.deps.workspace).map((t) => ({
        name: t.name,
        description: t.usage,
        parameters: t.schema
      }))
      const observations: string[] = toolResult ? [toolResult] : []
      const completedActions: ActionRecord[] = []
      reply = { id: newId(), role: 'morph', text: '', at: Date.now() }
      for (let round = 0; round < 6; round++) {
        if (controller.signal.aborted) throw new Error('stopped')
        const browserPage = this.deps.settings().browser ? await this.deps.browser.snapshot().catch(() => null) : null
        const { prompt, recalled } = this.turnPrompt(session, observations.join('\n\n'), browserPage)
        const raw = await this.deps.model.complete(prompt, controller.signal, tools)
        const applied = await this.applyReply(session.id, raw, controller.signal)
        reply = applied.message
        launch = applied.launch
        completedActions.push(...(reply.actions ?? []))
        if (completedActions.length) reply.actions = [...completedActions]
        this.noteUse(recalled, reply.text)
        if (!applied.observations.length || reply.approval || launch) break
        observations.push(...applied.observations)
        if (round === 5) reply.text = 'I reached the tool-step limit. This task is unfinished; the recorded results are preserved for the next turn.'
      }
    } catch {
      reply = { id: newId(), role: 'morph', text: '', at: Date.now(), ...(controller.signal.aborted ? { stopped: true } : { failed: true }) }
    } finally {
      superseded = this.inflight.get(session.id) !== controller
      if (this.inflight.get(session.id) === controller) this.inflight.delete(session.id)
    }

    if (superseded) return null
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

  private turnPrompt(session: Session, toolResult?: string, browserPage?: PageSnapshot | null): { prompt: string; recalled: Recalled } {
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
      toolResult,
      browserPage,
      workspaceRoot: this.deps.workspace?.root
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
  private async applyReply(sessionId: string, raw: string, signal?: AbortSignal): Promise<{ message: Message; launch?: Launch; observations: string[] }> {
    const { text, actions: requested } = parseReply(raw)
    const ctx = this.toolContext(sessionId, signal)
    const message: Message = { id: newId(), role: 'morph', text, at: Date.now() }
    const actions: ActionRecord[] = []
    const observations: string[] = []
    let changedReminders = false
    let changedMemory = false
    let launch: Launch | undefined
    const settings = this.deps.settings()
    const allowed = new Set(availableTools(TOOLS, settings, this.deps.connectors.ready().length > 0, !!this.deps.workspace).map(t => t.name))

    for (const request of requested.slice(0, 6)) {
      if (signal?.aborted) throw new Error('stopped')
      const tool = findTool(request.tool)
      if (!tool || !allowed.has(tool.name)) {
        actions.push({ tool: request.tool, summary: 'That tool is unavailable in the current configuration.', status: 'failed' })
        observations.push(`${request.tool}: unavailable. Use only the currently advertised tools.`)
        continue
      }
      const args = tool.validate(request.args, ctx)
      if (typeof args === 'string') {
        actions.push({ tool: tool.name, summary: `Could not use ${tool.name}: ${args}`, status: 'failed' })
        observations.push(`${tool.name}: invalid arguments (${args}). Correct them using the tool schema or explain what is missing.`)
        continue
      }
      if (tool.name === 'start_browsing') {
        if (!settings.browser || message.task || message.approval) continue
        const { goal, url } = args as unknown as Launch
        if (!settings.askBeforeBrowsing) {
          message.task = newTask(goal, this.deps.sessions.get(sessionId)?.messages.filter(m => m.role === 'you').at(-1)?.text)
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
      try {
        const result = await tool.run(args, ctx)
        if (result.action) actions.push(result.action)
        if (result.plan && !message.plan) message.plan = result.plan
        if (result.followUp) observations.push(result.followUp)
      } catch (error) {
        const note = error instanceof Error ? error.message.slice(0, 300) : 'Tool failed'
        actions.push({ tool: tool.name, summary: note, status: 'failed' })
        observations.push(`${tool.name} failed: ${note}. Inspect or correct the request; do not claim success.`)
      }
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
    return { message, launch, observations }
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
      message.task = newTask(goal, session.messages.filter(m => m.role === 'you').at(-1)?.text)
      this.deps.sessions.save(session)
      void this.runTask(sessionId, message.id, url)
      return session
    } else {
      message.approval.status = 'allowed'
      let result: ToolResult
      try {
        result = await tool.run(pending.args as never, this.toolContext(sessionId))
      } catch (error) {
        const note = error instanceof Error ? error.message.slice(0, 300) : 'Tool failed'
        result = { action: { tool: tool.name, summary: note, status: 'failed' }, followUp: `${tool.name} failed after review: ${note}. Read current state and repair the request; do not claim success.` }
      }
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
    const previous = this.browserTask
    previous?.controller.abort()
    const controller = new AbortController()
    const done = (async () => {
      await previous?.done
      if (!controller.signal.aborted) await this.runBrowserTask(sessionId, messageId, startUrl, controller)
    })()
    this.browserTask = { controller, done }
    await done
    if (this.browserTask?.controller === controller) this.browserTask = null
  }

  private async runBrowserTask(sessionId: string, messageId: string, startUrl: string, controller: AbortController) {
    const { browser, model, settings, activity, routines } = this.deps
    this.inflight.get(sessionId)?.abort()
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
    let nativeSteps = true
    let feedback = ''
    let lastAttempt = ''
    let repeated = 0
    let unresolvedFailure = false
    const seenStates = new Map<string, number>()
    const goal = this.deps.sessions.get(sessionId)?.messages.find(isTask)?.task?.goal ?? ''
    // A routine learned from a similar task: a guide for the model, so it needs fewer guesses.
    const routine = settings().memory ? (routines?.find(goal, hostOf(startUrl) || undefined) ?? null) : null

    browser.driving(true)
    try {
      page = await browser.snapshot()
      const request = this.deps.sessions.get(sessionId)?.messages.find(isTask)?.task?.request || ''
      // A same-page follow-up must preserve DOM state, selections and forms.
      if (startUrl && (page?.url !== startUrl || /\b(reload|refresh|start over)\b/i.test(request))) {
        task((t) => (t.say = `Opening ${hostOf(startUrl)}…`))
        const opened = await browser.open(startUrl)
        step(opened.ok ? `Opened ${hostOf(opened.url) || hostOf(startUrl)}` : `Couldn't open ${hostOf(startUrl)}`, opened.ok ? 'done' : 'failed')
      }
      for (let n = 0; n < MAX_STEPS; n++) {
        if (signal.aborted) throw new Error('stopped')
        if (n > 0 || !page || (startUrl && page.url !== startUrl)) page = await browser.snapshot()
        task((t) => {
          t.url = page?.url
          if (page) {
            const notices = t.notices ??= []
            for (const text of page.notices || []) if (!notices.some(n => n.url === page!.url && n.text === text)) notices.push({ url: page.url, text })
            if (notices.length > 12) notices.splice(0, notices.length - 12)
            t.checkpoint = { url: page.url, title: page.title, text: page.text.slice(0, 1600), at: Date.now() }
            const observations = t.observations ??= []
            const prior = observations.find(o => o.url === page!.url)
            const evidence = { url: page.url, title: page.title, text: page.text.slice(0, 2200) }
            if (prior) Object.assign(prior, evidence)
            else observations.push(evidence)
            if (observations.length > 8) observations.shift()
          }
        })
        const current = this.deps.sessions.get(sessionId)?.messages.find(isTask)?.task
        if (!current) return
        let raw: string
        try {
          raw = await model.complete(buildStepPrompt(current, page, settings().name, new Date(), routine, feedback), signal, nativeSteps ? [BROWSER_STEP_TOOL] : [])
        } catch (error) {
          if (signal.aborted) throw error
          if (/no text or tool calls|empty tool|\(200\)/i.test(error instanceof Error ? error.message : '')) nativeSteps = false
          feedback = `The model request failed: ${error instanceof Error ? error.message.slice(0, 180) : 'unknown error'}. No action ran. Retry the same observation.`
          step(feedback, 'failed')
          if (++badReplies >= 3) return finish('paused', 'The service could not return a usable next step. The task is unfinished; the browser state is preserved.')
          continue
        }
        const reply = parseStep(raw)
        if (!reply) {
          feedback = 'Invalid step response. Call browser_step with actions using existing ids, done with an observed result, or handoff. An empty object is not a step. No action ran.'
          if (++badReplies >= 3) return finish('paused', 'I could not choose a valid next step. The task is unfinished and the page is preserved.')
          continue
        }
        badReplies = 0
        feedback = ''
        if (reply.actions.length) {
          const stateKey = JSON.stringify([page?.url, page?.viewport, page?.formFingerprint, page?.observation, page?.text, page?.elements.map(e => [e.role, e.label, e.context, e.value, e.disabled]), reply.actions.map(a => 'id' in a ? { ...a, id: page?.elements.find(e => e.id === a.id)?.label } : a)])
          const visits = (seenStates.get(stateKey) || 0) + 1
          seenStates.set(stateKey, visits)
          if (visits >= 3) return finish('paused', 'I returned to the same observed state and action repeatedly. This task is unfinished; I paused the cycle instead of continuing.')
        }
        const attempt = JSON.stringify([page?.url, page?.viewport, page?.formFingerprint, page?.text, page?.elements, reply.actions])
        repeated = reply.actions.length && attempt === lastAttempt ? repeated + 1 : 0
        lastAttempt = attempt
        if (repeated === 1 && reply.actions.length === 1 && reply.actions[0].do === 'click') {
          feedback = 'The previous identical click already ran, but this observation is unchanged. Do not click it again. Read the current controls/status (including newly revealed review or receipt), choose a different next action, finish only with evidence, or hand off the blocker.'
          step('Repeated click withheld; requested a new decision', 'skipped')
          continue
        }
        if (repeated >= 2) return finish('paused', 'The same action is making no progress. I paused this unfinished task instead of repeating it.')
        if (reply.say) task((t) => (t.say = reply.say))
        if (reply.blocked) return finish('blocked', reply.blocked)
        if (reply.handoff) {
          if (!(await ask(reply.handoff.text, undefined, 'handoff'))) return finish('stopped', 'You declined or stopped the handoff. This task is unfinished; no further action ran.')
          step('You did a step yourself')
          continue
        }
        for (const action of reply.actions) {
          if (signal.aborted) throw new Error('stopped')
          const verdict = judge(action, page, approved)
          if (verdict.kind === 'refuse') {
            unresolvedFailure = true
            step(verdict.reason, 'skipped')
            feedback = `${verdict.reason} No action ran. Choose an element from the new snapshot.`
            break
          }
          if (verdict.kind === 'handoff') {
            if (!(await ask(verdict.text, undefined, 'handoff'))) return finish('stopped', 'You declined or stopped the private-input handoff. This task is unfinished; no further action ran.')
            step('You typed something private yourself')
            break
          }
          const effectKey = verdict.kind === 'ask' && action.do === 'click'
            ? JSON.stringify([page?.url, page?.elements.find(e => e.id === action.id)?.label, page?.formFingerprint || page?.elements.filter(e => e.value !== undefined).map(e => [e.label, e.value])])
            : undefined
          if (effectKey && current.dispatchedEffects?.includes(effectKey)) {
            feedback = 'This consequential action with these form values was already dispatched. Do not submit it again. Inspect the receipt/status and finish if verified; otherwise hand off the uncertain outcome.'
            step('Prevented a duplicate consequential action', 'skipped')
            break
          }
          if (verdict.kind === 'ask') {
            const reviewedState = JSON.stringify([page?.url, page?.elements, page?.formFingerprint])
            if (!(await ask(verdict.summary, verdict.warning))) {
              return finish('stopped', `Okay, I didn't ${verdict.summary.charAt(0).toLowerCase()}${verdict.summary.slice(1)}. I've stopped here, and nothing else was done.`)
            }
            if (verdict.approveDomain) approved.add(verdict.approveDomain)
            else {
              const fresh = await browser.snapshot()
              if (JSON.stringify([fresh?.url, fresh?.elements, fresh?.formFingerprint]) !== reviewedState) {
                page = fresh
                unresolvedFailure = true
                feedback = 'The page or form changed while review was pending. Nothing ran. Inspect the fresh page and request review again for the current state.'
                step('Review expired because the page or form changed', 'skipped')
                break
              }
              page = fresh
            }
          }
          let ok = true
          let note: string | undefined
          let navigated = false
          if (action.do === 'go') {
            const opened = await browser.open(action.url)
            ok = opened.ok
            if (ok) approved.add(hostOf(opened.url))
          } else {
            ;({ ok, note, navigated = false } = await browser.act({ ...action, ...(verdict.kind === 'ask' ? { reviewed: true } : {}), ...(page?.revision !== undefined ? { snapshotId: page.revision } : {}) }))
          }
          const describe = verdict.kind === 'allow' ? verdict.describe : verdict.summary.replace(/^Press/, 'Pressed').replace(/^Open/, 'Opened')
          step(ok ? describe : `${describe}: ${note ?? "that didn't work"}`, ok ? 'done' : 'failed')
          if (effectKey && ok) task(t => { (t.dispatchedEffects ??= []).push(effectKey) })
          unresolvedFailure = !ok
          if (!ok) feedback = `${note || 'Action failed'}. Read the fresh snapshot and choose a different valid step; do not claim success.`
          if (verdict.kind === 'ask') activity.add({ kind: 'website', summary: `${describe} (you said OK)`, sessionId })
          // Read a fresh observation after each state-changing action; only independent typing can batch.
          if (action.do !== 'type' || navigated || !ok) break
        }
        if (reply.done && !reply.actions.length) {
          if (unresolvedFailure) {
            feedback = 'The last action was refused or failed. The task cannot be complete on that basis. Recover using current page evidence or hand off as unfinished.'
            continue
          }
          activity.add({ kind: 'website', summary: `Browsing task: ${current.goal}`, sessionId })
          const steps = this.deps.sessions.get(sessionId)?.messages.find(isTask)?.task?.steps ?? current.steps
          const site = hostOf(startUrl) || hostOf(page?.url ?? '')
          if (settings().memory && routines?.learn(current.goal, site, steps)) this.deps.emit({ type: 'memory.changed' })
          return finish('done', reply.result || 'All done.')
        }
      }
      finish('paused', 'The step budget was reached. This task is unfinished; the current page and checkpoint are preserved for a follow-up.')
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

function newTask(goal: string, request?: string): Task {
  return { id: newId(), goal, request: request?.slice(0, 4000), status: 'running', say: 'Getting started…', steps: [] }
}
