import { motion } from 'motion/react'
import { AlertTriangle, Bell, Brain, Check, CircleSlash, ExternalLink, Eye, Globe, Hand, ListChecks, Square, X } from 'lucide-react'
import type { ActionRecord, Approval, Plan, Task } from '@shared/core'
import { MorphMark } from '@/components/MorphMark'

const ICONS: Record<string, typeof Bell> = {
  set_reminder: Bell,
  cancel_reminder: Bell,
  remember: Brain,
  forget: Brain,
  open_website: ExternalLink
}

/** One line per thing Morph did alongside its answer ("Reminder set: …"), with a clear status. */
export function ActionList({ actions }: { actions: ActionRecord[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {actions.map((a, i) => {
        const Icon = ICONS[a.tool] ?? Check
        const ok = a.status === 'done'
        return (
          <li
            key={i}
            className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[0.98rem] ${
              ok ? 'border-[var(--field-border)] bg-[var(--selected)]' : 'border-[var(--ask)] text-fg'
            }`}
          >
            <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${ok ? 'text-morph' : 'text-ask'}`} />
            <span className="flex-1">{a.summary}</span>
            {ok ? <Check aria-label="Done" className="mt-0.5 size-5 shrink-0 text-morph" /> : <CircleSlash aria-label="Not done" className="mt-0.5 size-5 shrink-0 text-ask" />}
          </li>
        )
      })}
    </ul>
  )
}

/** Step-by-step help as a checklist the person ticks off as they go. */
export function PlanCard({ plan, onToggle }: { plan: Plan; onToggle: (step: number) => void }) {
  const done = plan.steps.filter((s) => s.done).length
  return (
    <section aria-label={plan.title} className="mt-3 rounded-2xl border border-[var(--field-border)] bg-[var(--field)] p-4">
      <header className="mb-3 flex items-center gap-2.5">
        <ListChecks aria-hidden="true" className="size-5 text-morph" />
        <h3 className="flex-1 font-display text-[1.05rem] font-semibold">{plan.title}</h3>
        <span className="text-[0.9rem] font-bold text-fg-muted">
          {done} of {plan.steps.length} done
        </span>
      </header>
      <ol className="flex flex-col gap-2">
        {plan.steps.map((step, i) => (
          <li key={i}>
            <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-[var(--selected)]">
              <input type="checkbox" className="peer sr-only" checked={step.done} onChange={() => onToggle(i)} />
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border-2 border-[var(--field-border)] peer-checked:border-[var(--morph)] peer-checked:bg-[var(--morph)] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]"
              >
                {step.done && <Check className="size-4.5 text-[var(--action-fg)]" strokeWidth={3} />}
              </span>
              <span className="flex-1 pt-0.5 text-[1.05rem]">
                <span className="mr-1.5 font-bold text-fg-muted">{i + 1}.</span>
                <span className={step.done ? 'text-fg-muted line-through decoration-2' : ''}>{step.text}</span>
              </span>
            </label>
          </li>
        ))}
      </ol>
      {done === plan.steps.length && <p className="mt-3 px-2 text-[1rem] font-bold text-morph">All done. Well done!</p>}
    </section>
  )
}

/** The Sentinel's review card: nothing happens until the person presses the button. */
export function ApprovalCard({ approval, onAnswer }: { approval: Approval; onAnswer: (allow: boolean) => void }) {
  const pending = approval.status === 'pending'
  const handoff = approval.kind === 'handoff'
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Morph needs your OK"
      className={`mt-3 rounded-2xl border-2 p-4 ${pending ? 'border-[var(--morph)] bg-[var(--selected)]' : 'border-[var(--field-border)]'}`}
    >
      <p className="flex items-center gap-2 text-[0.9rem] font-bold text-fg-muted">
        {handoff && <Hand aria-hidden="true" className="size-4.5 text-morph" />}
        {pending ? (handoff ? 'Your turn' : 'Morph needs your OK') : approval.status === 'allowed' ? (handoff ? 'You did it' : 'You said yes') : handoff ? 'Stopped' : 'You said no'}
      </p>
      <p className="mt-1 text-[1.1rem] font-bold">{approval.summary}</p>
      {approval.warning && (
        <p className="mt-2 flex items-start gap-2 text-[1rem] text-ask">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          {approval.warning}
        </p>
      )}
      {pending && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => onAnswer(true)}>
            <Check aria-hidden="true" />
            {handoff ? "Done, carry on" : 'Yes, go ahead'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => onAnswer(false)}>
            <X aria-hidden="true" />
            {handoff ? 'Stop' : 'No, thanks'}
          </button>
        </div>
      )}
    </motion.section>
  )
}

const TASK_STATUS: Record<Task['status'], string> = {
  running: 'Working on it',
  waiting: 'Waiting for you',
  done: 'Finished',
  stopped: 'Stopped',
  failed: "Couldn't finish"
}

/** A browsing task, live: what Morph is doing now, every step so far, and the outcome. */
export function TaskCard({ task, onWatch, onStop }: { task: Task; onWatch: () => void; onStop: () => void }) {
  const active = task.status === 'running' || task.status === 'waiting'
  const steps = task.steps.slice(-8)
  const hidden = task.steps.length - steps.length
  return (
    <section aria-label="Browsing task" className={`mt-3 rounded-2xl border-2 p-4 ${active ? 'border-[var(--morph)]' : 'border-[var(--field-border)]'} bg-[var(--field)]`}>
      <header className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--selected)]">
          {active ? <MorphMark size={28} thinking={task.status === 'running'} /> : <Globe aria-hidden="true" className="size-5 text-morph" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[0.85rem] font-bold text-fg-muted">{TASK_STATUS[task.status]}</span>
          <h3 className="font-display text-[1.05rem] leading-snug font-semibold">{task.goal}</h3>
        </div>
      </header>

      {active && task.say && (
        <p role="status" className="mt-3 flex items-center gap-3 rounded-xl bg-[var(--selected)] px-3.5 py-2.5 text-[1rem]">
          {task.status === 'running' && (
            <span className="pixel-loader" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          )}
          {task.say}
        </p>
      )}

      {steps.length > 0 && (
        <ol className="mt-3 flex flex-col gap-1.5" aria-label="What Morph has done">
          {hidden > 0 && <li className="pl-8 text-[0.9rem] text-fg-muted">…and {hidden} earlier {hidden === 1 ? 'step' : 'steps'}</li>}
          {steps.map((s, i) => (
            <motion.li key={hidden + i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2.5 text-[0.98rem]">
              {s.status === 'done' ? (
                <Check aria-label="Done" className="mt-0.5 size-5 shrink-0 text-morph" />
              ) : (
                <CircleSlash aria-label="Not done" className="mt-0.5 size-5 shrink-0 text-ask" />
              )}
              <span className={s.status === 'done' ? '' : 'text-fg-muted'}>{s.text}</span>
            </motion.li>
          ))}
        </ol>
      )}

      {task.result && <p className="mt-3 rounded-xl border border-[var(--field-border)] px-3.5 py-3 text-[1.05rem] font-bold">{task.result}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-quiet min-h-11 px-4 text-[0.95rem]" onClick={onWatch}>
          <Eye aria-hidden="true" />
          {active ? 'Watch Morph' : 'Show the browser'}
        </button>
        {active && (
          <button type="button" className="btn btn-quiet min-h-11 px-4 text-[0.95rem]" onClick={onStop}>
            <Square aria-hidden="true" />
            Stop
          </button>
        )}
      </div>
    </section>
  )
}
