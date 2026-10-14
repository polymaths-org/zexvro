import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { titleFrom, type Message, type Session, type SessionSummary } from '@shared/sessions'
import { useSettings } from '@/settings'
import { speak } from '@/speech'
import { useCoreEvent } from '@/lib/core'

interface SessionsValue {
  summaries: SessionSummary[]
  /** The open conversation; null means the home screen. */
  current: Session | null
  /** Conversations waiting for Morph's answer. */
  thinking: ReadonlySet<string>
  /** Whether Morph's AI service is reachable (null until the first check). */
  online: boolean | null
  open: (id: string) => Promise<void>
  goHome: () => void
  send: (text: string) => Promise<void>
  retry: () => Promise<void>
  stop: () => void
  rename: (title: string) => Promise<void>
  remove: () => Promise<void>
  clearAll: () => Promise<void>
  /** The person answered a review card ("Open it" / "No thanks"). */
  approve: (approvalId: string, allow: boolean) => Promise<void>
  togglePlanStep: (messageId: string, step: number) => Promise<void>
}

const SessionsContext = createContext<SessionsValue | null>(null)

const ONLINE_CHECK_MS = 30_000

export function SessionsProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const [summaries, setSummaries] = useState<SessionSummary[]>([])
  const [current, setCurrent] = useState<Session | null>(null)
  const [thinking, setThinking] = useState<ReadonlySet<string>>(new Set())
  const [online, setOnline] = useState<boolean | null>(null)
  const readAloud = useRef(settings.readAloud)
  readAloud.current = settings.readAloud

  const refresh = useCallback(async () => setSummaries(await window.morphic.sessions.list()), [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const check = () => window.morphic.online().then(setOnline)
    check()
    const timer = setInterval(check, ONLINE_CHECK_MS)
    addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      removeEventListener('focus', check)
    }
  }, [])

  // The backdrop light brightens while Morph is thinking (see ShaderBackdrop).
  useEffect(() => {
    document.documentElement.dataset.morph = thinking.size > 0 ? 'thinking' : 'idle'
  }, [thinking])

  // Live updates from Core: browsing tasks change their message step by step.
  useCoreEvent('session.updated', ({ session }) => {
    setCurrent((open) => (open?.id === session.id ? session : open))
    void refresh()
  })
  // A task keeps the conversation busy (Stop instead of Ask) until it finishes.
  useCoreEvent('chat.progress', ({ sessionId, phase }) => markThinking(sessionId, phase === 'thinking'))

  const markThinking = (id: string, on: boolean) =>
    setThinking((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  /** Shows Morph's answer if that conversation is still open, and reads it out if the person asked for that. */
  const settle = useCallback(
    async (id: string, result: Session | null) => {
      markThinking(id, false)
      if (result) {
        setCurrent((open) => (open?.id === id ? result : open))
        const last = result.messages.at(-1)
        if (readAloud.current && last?.role === 'morph' && last.text) speak(last.text)
      }
      await refresh()
    },
    [refresh]
  )

  const open = useCallback(async (id: string) => setCurrent(await window.morphic.sessions.get(id)), [])
  const goHome = useCallback(() => setCurrent(null), [])

  const send = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question) return
      const now = Date.now()
      const id = current?.id ?? crypto.randomUUID()
      const mine: Message = { id: crypto.randomUUID(), role: 'you', text: question, at: now }
      // Show the question straight away; the saved conversation replaces this when Morph answers.
      setCurrent((open) =>
        open?.id === id
          ? { ...open, updatedAt: now, messages: [...open.messages, mine] }
          : { id, title: titleFrom(question), createdAt: now, updatedAt: now, messages: [mine] }
      )
      markThinking(id, true)
      const result = window.morphic.chat.send(id, question)
      refresh()
      await settle(id, await result)
    },
    [current?.id, refresh, settle]
  )

  const retry = useCallback(async () => {
    if (!current) return
    const { id } = current
    setCurrent((open) => {
      if (!open || open.id !== id) return open
      const last = open.messages.at(-1)
      return last?.role === 'morph' && (last.failed || last.stopped) ? { ...open, messages: open.messages.slice(0, -1) } : open
    })
    markThinking(id, true)
    await settle(id, await window.morphic.chat.retry(id))
  }, [current, settle])

  const stop = useCallback(() => {
    if (current) window.morphic.chat.stop(current.id)
  }, [current])

  const rename = useCallback(
    async (title: string) => {
      if (!current) return
      const result = await window.morphic.sessions.rename(current.id, title)
      if (result) setCurrent((open) => (open?.id === result.id ? { ...open, title: result.title } : open))
      await refresh()
    },
    [current, refresh]
  )

  const remove = useCallback(async () => {
    if (!current) return
    await window.morphic.sessions.delete(current.id)
    setCurrent(null)
    await refresh()
  }, [current, refresh])

  const clearAll = useCallback(async () => {
    await window.morphic.sessions.clear()
    setThinking(new Set())
    setCurrent(null)
    await refresh()
  }, [refresh])

  /** Applies a conversation Core sent back, if it's still the one on screen. */
  const show = (session: Session | null) => {
    if (session) setCurrent((open) => (open?.id === session.id ? session : open))
  }

  const approve = useCallback(
    async (approvalId: string, allow: boolean) => {
      if (current) show(await window.morphic.core('chat.approve', current.id, approvalId, allow))
    },
    [current]
  )

  const togglePlanStep = useCallback(
    async (messageId: string, step: number) => {
      if (!current) return
      // Tick straight away; Core's saved copy follows.
      setCurrent((open) => {
        if (!open) return open
        return {
          ...open,
          messages: open.messages.map((m) =>
            m.id === messageId && m.plan ? { ...m, plan: { ...m.plan, steps: m.plan.steps.map((st, i) => (i === step ? { ...st, done: !st.done } : st)) } } : m
          )
        }
      })
      await window.morphic.core('chat.togglePlanStep', current.id, messageId, step)
    },
    [current]
  )

  return (
    <SessionsContext.Provider
      value={{ summaries, current, thinking, online, open, goHome, send, retry, stop, rename, remove, clearAll, approve, togglePlanStep }}
    >
      {children}
    </SessionsContext.Provider>
  )
}

export function useSessions() {
  const ctx = useContext(SessionsContext)
  if (!ctx) throw new Error('useSessions must be used inside SessionsProvider')
  return ctx
}
