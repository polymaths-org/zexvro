import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Copy, RotateCcw, Volume2 } from 'lucide-react'
import type { Message } from '@shared/sessions'
import { speak } from '@/speech'
import { useTextReveal } from '@/lib/useTextReveal'
import { MorphMark } from '@/components/MorphMark'
import { useSessions } from './sessions'
import { Composer } from './Composer'
import { MessageText } from './MessageText'
import { formatWhen } from './when'
import { ActionList, ApprovalCard, PlanCard, TaskCard } from './MessageExtras'
import { browser } from '@/browser/browser'

const FAILED = "I couldn't answer just now. Please check that this computer is connected to the internet, then try again."
const SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const
const AVATAR = 34

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      className="btn btn-quiet min-h-11 px-4 text-[0.95rem]"
      onClick={async () => {
        await window.morphic.copy(text)
        setCopied(true)
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

/** Morph's side of the conversation: a small Morph beside a glass bubble, labelled "Morph · time". */
function MorphRow({ label, avatar, children }: { label: string; avatar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex max-w-[92%] gap-3 self-start @max-[30rem]:max-w-full">
      {/* In a narrow column the little Morph steps aside to leave room for the words. */}
      <div className="shrink-0 pt-6 @max-[30rem]:hidden">{avatar}</div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[0.85rem] font-bold text-fg-muted">{label}</span>
        {children}
      </div>
    </div>
  )
}

/** Shown while Morph works. It shares a layoutId with the answer, so the bubble grows into the reply. */
/** Calm, friendly lines while Morph works: never "taking longer than usual", nothing that sounds like trouble. */
const CALM = [
  'Having a little think…',
  'Reading your message carefully…',
  'Putting the pieces together…',
  'Finding the simplest way to say it…',
  'Making sure I get this right…',
  'Nearly there…',
  'Good answers take a moment…',
  'Just tidying up my words…'
]

function PendingReply({ index }: { index: number }) {
  const [line, setLine] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setLine((n) => n + 1), 4500)
    return () => clearInterval(timer)
  }, [])
  const note = CALM[line % CALM.length]
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="self-start">
      <MorphRow label="Morph" avatar={<MorphMark size={AVATAR} thinking />}>
        <motion.div
          layoutId={`reply-${index}`}
          transition={SPRING}
          role="status"
          className="glass bubble flex items-center gap-3 rounded-[1.25rem] rounded-tl-md px-5 py-4 text-[1.05rem] text-fg-muted"
        >
          <span className="pixel-loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={note} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              {note}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      </MorphRow>
    </motion.div>
  )
}

function Answer({ message, reveal }: { message: Message; reveal: boolean }) {
  const textRef = useRef<HTMLDivElement>(null)
  useTextReveal(textRef, { style: 'settle', delay: 0.18, enabled: reveal })
  return (
    <div ref={textRef}>
      <MessageText text={message.text} />
    </div>
  )
}

interface BubbleProps {
  message: Message
  index: number
  isNew: boolean
  onRetry: () => void
  onApprove: (approvalId: string, allow: boolean) => void
  onToggleStep: (messageId: string, step: number) => void
  onStop: () => void
}

function Bubble({ message, index, isNew, onRetry, onApprove, onToggleStep, onStop }: BubbleProps) {
  if (message.role === 'you') {
    return (
      <motion.div
        initial={isNew ? { opacity: 0, y: 16, scale: 0.98 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        style={{ transformOrigin: 'bottom right' }}
        className="flex max-w-[85%] flex-col items-end gap-1.5 self-end"
      >
        <span className="text-[0.85rem] font-bold text-fg-muted">You · {formatWhen(message.at)}</span>
        <div className="bubble rounded-[1.25rem] rounded-tr-md border border-[var(--field-border)] bg-[var(--selected)] px-5 py-3.5 text-[1.1rem]">
          <p className="whitespace-pre-line">{message.text}</p>
        </div>
      </motion.div>
    )
  }

  const problem = message.failed || message.stopped
  return (
    <MorphRow label={`Morph · ${formatWhen(message.at)}`} avatar={<MorphMark size={AVATAR} still />}>
      <motion.div
        layoutId={`reply-${index}`}
        initial={false}
        transition={SPRING}
        className="glass bubble rounded-[1.25rem] rounded-tl-md px-5 py-4 text-[1.1rem]"
      >
        {message.failed ? (
          <p>{FAILED}</p>
        ) : message.stopped ? (
          <p className="text-fg-muted">You stopped this answer.</p>
        ) : (
          <Answer message={message} reveal={isNew} />
        )}
        {message.task && <TaskCard task={message.task} onWatch={() => browser.show()} onStop={onStop} />}
        {message.plan && <PlanCard plan={message.plan} onToggle={(step) => onToggleStep(message.id, step)} />}
        {message.actions && message.actions.length > 0 && <ActionList actions={message.actions} />}
        {message.approval && <ApprovalCard approval={message.approval} onAnswer={(allow) => onApprove(message.approval!.id, allow)} />}
        <motion.div
          initial={isNew ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: isNew && !problem ? 0.6 : 0, duration: 0.3 }}
          className="mt-3 flex flex-wrap gap-2"
        >
          {problem ? (
            <button type="button" className="btn btn-primary min-h-11 px-4 text-[0.95rem]" onClick={onRetry}>
              <RotateCcw aria-hidden="true" />
              {message.failed ? 'Try again' : 'Ask again'}
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-quiet min-h-11 px-4 text-[0.95rem]" onClick={() => speak(message.text)}>
                <Volume2 aria-hidden="true" />
                Read out loud
              </button>
              <CopyButton text={message.text} />
            </>
          )}
        </motion.div>
      </motion.div>
    </MorphRow>
  )
}

export function Conversation() {
  const { current, thinking, send, retry, stop, approve, togglePlanStep } = useSessions()
  const [draft, setDraft] = useState('')
  const [lookAt, setLookAt] = useState<HTMLElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  // Messages already there when a conversation opens don't animate in; only new ones do.
  const settled = useRef({ id: '', count: 0 })
  if (current && settled.current.id !== current.id) settled.current = { id: current.id, count: current.messages.length }

  const busy = current ? thinking.has(current.id) : false
  const lastTask = current?.messages.at(-1)?.task
  const runningTask = lastTask?.status === 'running' || lastTask?.status === 'waiting'
  const count = current?.messages.length ?? 0

  useEffect(() => {
    const scroll = () => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    scroll()
    // Again once a growing answer bubble has settled.
    const t = setTimeout(scroll, 450)
    return () => clearTimeout(t)
  }, [count, busy, current?.id])

  useEffect(() => {
    inputRef.current?.focus()
  }, [current?.id])

  if (!current) return null

  const submit = () => {
    if (!draft.trim()) return
    send(draft)
    setDraft('')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="chat-scroll @container flex-1 overflow-y-auto px-6 @max-[34rem]:px-4">
        <div className="mx-auto flex max-w-[46rem] flex-col gap-6 pt-6 pb-8">
          {current.messages.map((message, i) => (
            <Bubble
              key={i}
              message={message}
              index={i}
              isNew={i >= settled.current.count}
              onRetry={retry}
              onApprove={approve}
              onToggleStep={togglePlanStep}
              onStop={stop}
            />
          ))}
          {/* A running browsing task shows its own live card instead of the thinking bubble. */}
          {busy && !runningTask && <PendingReply index={count} />}
          <div ref={endRef} />
        </div>
      </div>

      <div className="px-6 pt-1 pb-4">
        {/* Morph stands beside the ask box (never over the messages) and watches you type. In a narrow
            column (browser open on a small screen) it steps aside so the ask box keeps its room. */}
        <div className="@container mx-auto flex max-w-[46rem] items-end gap-3">
          <motion.div layoutId="dock-morph" transition={{ type: 'spring', stiffness: 260, damping: 32 }} className="hidden shrink-0 pb-2 @min-[30rem]:block">
            <MorphMark size={58} thinking={busy} lookAt={busy ? null : lookAt} />
          </motion.div>
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={submit}
            onStop={stop}
            busy={busy}
            inputRef={inputRef}
            placeholder="Ask anything…"
            onFocusChange={setLookAt}
          />
        </div>
        <p className="mt-2 text-center text-[0.85rem] text-fg-muted">Press Enter to send. Shift + Enter starts a new line.</p>
      </div>
    </div>
  )
}
