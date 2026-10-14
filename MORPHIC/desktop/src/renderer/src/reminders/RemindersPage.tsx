import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, Plus, Repeat as RepeatIcon, Trash2 } from 'lucide-react'
import { REPEATS, type Repeat } from '@shared/core'
import { Choice } from '@/components/Choice'
import { Page, Panel } from '@/components/Page'
import { formatDue, repeatLabel, useReminders } from './reminders'

const pad = (n: number) => String(n).padStart(2, '0')
const dateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const REPEAT_CHOICES: Record<Repeat, string> = { once: 'Just once', daily: 'Every day', weekly: 'Every week' }

function AddReminder() {
  const { add } = useReminders()
  // Default: the next round hour, so the form is already sensible.
  const start = new Date(Date.now() + 3_600_000)
  start.setMinutes(0, 0, 0)
  const [text, setText] = useState('')
  const [date, setDate] = useState(dateValue(start))
  const [time, setTime] = useState(timeValue(start))
  const [repeat, setRepeat] = useState<Repeat>('once')
  const [problem, setProblem] = useState('')
  const [added, setAdded] = useState('')

  return (
    <Panel title="Add a reminder">
      <form
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault()
          setAdded('')
          const [y, m, d] = date.split('-').map(Number)
          const [h, mi] = time.split(':').map(Number)
          const due = new Date(y, m - 1, d, h, mi).getTime()
          if (!text.trim()) return setProblem('Please write what the reminder is for.')
          if (!Number.isFinite(due) || due < Date.now() - 60_000) return setProblem('Please pick a time that is still to come.')
          setProblem('')
          if (await add(text, due, repeat)) {
            setAdded(`Reminder added for ${formatDue(due).toLowerCase()}.`)
            setText('')
          } else setProblem("That reminder couldn't be added. Please check the date and time.")
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="reminder-text" className="text-[1rem] font-bold">
            What should I remind you about?
          </label>
          <input id="reminder-text" className="field" value={text} maxLength={200} placeholder="For example, take my tablets" onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="reminder-date" className="text-[1rem] font-bold">
              Day
            </label>
            <input id="reminder-date" type="date" className="field" value={date} min={dateValue(new Date())} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="reminder-time" className="text-[1rem] font-bold">
              Time
            </label>
            <input id="reminder-time" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-[1rem] font-bold">How often?</legend>
          <div className="grid grid-cols-3 gap-3">
            {REPEATS.map((r) => (
              <Choice key={r} name="reminder-repeat" value={r} checked={repeat === r} onSelect={() => setRepeat(r)} className="min-h-14 items-center justify-center px-2 pt-2">
                <span className="text-center text-[1rem] font-bold">{REPEAT_CHOICES[r]}</span>
              </Choice>
            ))}
          </div>
        </fieldset>
        {problem && <p className="text-[1rem] font-bold text-ask">{problem}</p>}
        <div role="status">{added && <p className="text-[1rem] font-bold text-morph">{added}</p>}</div>
        <button type="submit" className="btn btn-primary self-start">
          <Plus aria-hidden="true" />
          Add reminder
        </button>
      </form>
    </Panel>
  )
}

export function RemindersPage() {
  const { reminders, remove } = useReminders()
  return (
    <Page title="Reminders" intro="I'll tell you when it's time, even if Morph is in the background. You can also just ask me: “Remind me to…”.">
      <Panel title="Coming up">
        {reminders.length === 0 ? (
          <p className="text-[1.05rem] text-fg-muted">No reminders yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {reminders.map((r) => (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="flex items-center gap-4 rounded-2xl border border-[var(--field-border)] bg-[var(--field)] p-4"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--selected)]">
                    <Bell aria-hidden="true" className="size-6 text-morph" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[1.1rem] font-bold">{r.text}</span>
                    <span className="flex items-center gap-2 text-[1rem] text-fg-muted">
                      {formatDue(r.due)}
                      {r.repeat !== 'once' && (
                        <>
                          <RepeatIcon aria-hidden="true" className="size-4" />
                          {repeatLabel(r.repeat)}
                        </>
                      )}
                    </span>
                  </div>
                  <button type="button" className="btn btn-quiet min-h-12 shrink-0 px-4" aria-label={`Delete reminder: ${r.text}`} onClick={() => remove(r.id)}>
                    <Trash2 aria-hidden="true" />
                    Delete
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Panel>
      <AddReminder />
    </Page>
  )
}
