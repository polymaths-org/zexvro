import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarHeart, Check, ChevronDown, History, PenLine, Pin, PinOff, Plus, Route, Search, Trash2, X } from 'lucide-react'
import { MEMORY_CATEGORIES, NOTE_MAX, PROFILE_MAX, type MemoryCategory, type MemoryNote, type MemorySource, type Routine } from '@shared/core'
import { core, useCoreEvent } from '@/lib/core'
import { useSettings } from '@/settings'
import { Choice } from '@/components/Choice'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Page, Panel } from '@/components/Page'
import { formatWhen } from '@/chat/when'
import { useView } from '@/shell/view'

const SOURCE: Record<MemorySource, string> = { told: 'You told me', learned: 'I picked this up', added: 'You added this' }

/** Days until a "MM-DD" (next time it comes round) or "YYYY-MM-DD" date. */
function daysUntil(date: string, now = Date.now()): number {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const p = date.split('-').map(Number)
  let target = p.length === 3 ? new Date(p[0], p[1] - 1, p[2]) : new Date(today.getFullYear(), p[0] - 1, p[1])
  if (p.length === 2 && target < today) target = new Date(today.getFullYear() + 1, p[0] - 1, p[1])
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/** "Every year on 20 October · in 6 days" */
function dateLine(date: string): string {
  const p = date.split('-').map(Number)
  const day = p.length === 3 ? new Date(p[0], p[1] - 1, p[2]) : new Date(2000, p[0] - 1, p[1])
  const words = new Intl.DateTimeFormat(undefined, p.length === 3 ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' }).format(day)
  const n = daysUntil(date)
  const soon = n === 0 ? ' · today' : n === 1 ? ' · tomorrow' : n > 1 && n <= 14 ? ` · in ${n} days` : ''
  return `${p.length === 3 ? 'On' : 'Every year on'} ${words}${soon}`
}

function MemorySwitch() {
  const { settings, update } = useSettings()
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-[1rem] font-bold">Should Morph remember things?</legend>
      <div className="grid grid-cols-2 gap-3">
        <Choice name="memory-on" value="on" checked={settings.memory} onSelect={() => update({ memory: true })} className="min-h-14 items-center justify-center px-3 pt-2">
          <span className="text-center text-[1rem] font-bold">Yes, remember things</span>
        </Choice>
        <Choice name="memory-on" value="off" checked={!settings.memory} onSelect={() => update({ memory: false })} className="min-h-14 items-center justify-center px-3 pt-2">
          <span className="text-center text-[1rem] font-bold">No, don't remember</span>
        </Choice>
      </div>
    </fieldset>
  )
}

function AboutYou() {
  const [about, setAbout] = useState('')
  const [saved, setSaved] = useState('')
  useEffect(() => {
    core('memory.profile').then((p) => {
      setAbout(p.about)
      setSaved(p.about)
    })
  }, [])
  const changed = about.trim() !== saved.trim()
  return (
    <Panel title="About you">
      <p className="text-[1rem] text-fg-muted">Morph always keeps this in mind. Write anything that helps, like who's in your family or what you find hard on the computer.</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const p = await core('memory.setProfile', about)
          setAbout(p.about)
          setSaved(p.about)
        }}
      >
        <label htmlFor="about-you" className="sr-only">
          About you
        </label>
        <textarea
          id="about-you"
          className="field min-h-32 resize-y py-3 text-[1.1rem]"
          value={about}
          maxLength={PROFILE_MAX}
          placeholder="For example: I live in Pune with my husband. My daughter Meera lives in London."
          onChange={(e) => setAbout(e.target.value)}
        />
        <button type="submit" className="btn btn-quiet self-start" disabled={!changed}>
          <Check aria-hidden="true" />
          {changed ? 'Save' : 'Saved'}
        </button>
      </form>
    </Panel>
  )
}

function NoteRow({ note, onChanged }: { note: MemoryNote; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.text)
  if (editing) {
    return (
      <form
        className="flex flex-col gap-3 rounded-2xl border-2 border-[var(--morph)] p-4"
        onSubmit={async (e) => {
          e.preventDefault()
          await core('memory.update', note.id, text)
          setEditing(false)
          onChanged()
        }}
      >
        <label htmlFor={`note-${note.id}`} className="text-[0.95rem] font-bold">
          Change what I remember
        </label>
        <input id={`note-${note.id}`} className="field" autoFocus value={text} maxLength={NOTE_MAX} onChange={(e) => setText(e.target.value)} />
        <div className="flex gap-3">
          <button type="submit" className="btn btn-primary min-h-12">
            <Check aria-hidden="true" />
            Save
          </button>
          <button type="button" className="btn btn-quiet min-h-12" onClick={() => setEditing(false)}>
            <X aria-hidden="true" />
            Cancel
          </button>
        </div>
      </form>
    )
  }
  return (
    // Buttons sit beside the text when there's room, and together underneath when narrow.
    <div className={`@container rounded-2xl border bg-[var(--field)] p-4 ${note.pinned ? 'border-[var(--morph)]' : 'border-[var(--field-border)]'}`}>
      <div className="flex flex-col gap-3 @min-[42rem]:flex-row @min-[42rem]:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[1.08rem]">{note.text}</span>
          {note.date && (
            <span className="flex items-center gap-1.5 text-[0.95rem] font-bold text-morph">
              <CalendarHeart aria-hidden="true" className="size-4" />
              {dateLine(note.date)}
            </span>
          )}
          <span className="text-[0.9rem] text-fg-muted">
            {SOURCE[note.source]} · {formatWhen(note.updatedAt)}
            {note.importance === 3 ? ' · Important' : ''}
            {note.expiresAt ? ` · Until ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' }).format(note.expiresAt)}` : ''}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={note.pinned}
            className={`btn btn-quiet min-h-11 gap-1.5 px-2.5 text-[0.95rem] ${note.pinned ? 'text-morph' : ''}`}
            onClick={async () => {
              await core('memory.pin', note.id, !note.pinned)
              onChanged()
            }}
          >
            {note.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
            {note.pinned ? 'Unpin' : 'Always remember'}
          </button>
          <button type="button" className="btn btn-quiet min-h-11 gap-1.5 px-2.5 text-[0.95rem]" onClick={() => setEditing(true)}>
            <PenLine aria-hidden="true" />
            Change
          </button>
          <button
            type="button"
            className="btn btn-quiet min-h-11 gap-1.5 px-2.5 text-[0.95rem]"
            aria-label={`Forget: ${note.text}`}
            onClick={async () => {
              await core('memory.delete', note.id)
              onChanged()
            }}
          >
            <Trash2 aria-hidden="true" />
            Forget
          </button>
        </div>
      </div>
    </div>
  )
}

function NoteList({ notes, onChanged }: { notes: MemoryNote[]; onChanged: () => void }) {
  return (
    <ul className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {notes.map((note) => (
          <motion.li key={note.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}>
            <NoteRow note={note} onChanged={onChanged} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

/** Pinned first ("Always remember"), then one group per category, in a fixed order. */
function groupNotes(notes: MemoryNote[]): { id: string; label: string; notes: MemoryNote[] }[] {
  const groups = [{ id: 'pinned', label: 'Always remember', notes: notes.filter((n) => n.pinned) }]
  for (const c of MEMORY_CATEGORIES) groups.push({ id: c.id, label: c.label, notes: notes.filter((n) => !n.pinned && n.category === c.id) })
  return groups.filter((g) => g.notes.length > 0)
}

/** Browsing routines Morph learned from tasks that went well. */
function Routines() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const refresh = useCallback(async () => setRoutines(await core('routines.list')), [])
  useEffect(() => {
    refresh()
  }, [refresh])
  useCoreEvent('memory.changed', refresh)
  return (
    <Panel title="Things I've learned to do">
      <p className="text-[1rem] text-fg-muted">
        When I finish something on a website for you, I remember the steps that worked, so it's quicker next time. I never keep what you typed.
      </p>
      {routines.length === 0 ? (
        <p className="text-[1.05rem] text-fg-muted">Nothing yet. Ask me to look something up on a website, and I'll learn the way.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {routines.map((r) => (
            <li key={r.id} className="rounded-2xl border border-[var(--field-border)] bg-[var(--field)] p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Route aria-hidden="true" className="mt-1 size-5 shrink-0 text-morph" />
                <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                  <span className="text-[1.08rem] font-bold">{r.goal}</span>
                  <span className="text-[0.9rem] text-fg-muted">
                    On {r.site} · done {r.uses === 1 ? 'once' : `${r.uses} times`} · {formatWhen(r.updatedAt)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-quiet min-h-11 shrink-0 px-3.5 text-[0.95rem]"
                  aria-label={`Forget how to: ${r.goal}`}
                  onClick={async () => {
                    await core('routines.delete', r.id)
                    refresh()
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Forget
                </button>
              </div>
              <details className="group mt-2 pl-8">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[0.95rem] font-bold text-fg-muted">
                  <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
                  The steps
                </summary>
                <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-[1rem]">
                  {r.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function MemoryPage() {
  const { setView } = useView()
  const [notes, setNotes] = useState<MemoryNote[]>([])
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState('')
  const [category, setCategory] = useState<MemoryCategory | ''>('')
  const [problem, setProblem] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const refresh = useCallback(async () => setNotes(await core('memory.list', query)), [query])
  useEffect(() => {
    refresh()
  }, [refresh])
  useCoreEvent('memory.changed', refresh)

  return (
    <Page title="What I remember" intro="These are the things Morph remembers about you, and where each one came from. You can change or forget any of them.">
      <Panel>
        <MemorySwitch />
      </Panel>

      <AboutYou />

      <Panel title="Things I remember">
        <form
          className="flex flex-wrap gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!adding.trim()) return
            const note = await core('memory.add', adding, category || undefined)
            if (!note) return setProblem("I can't keep that. I never store passwords, codes, PINs, or bank or card numbers.")
            setProblem('')
            setAdding('')
            setCategory('')
            refresh()
          }}
        >
          <label htmlFor="memory-add" className="sr-only">
            Something for Morph to remember
          </label>
          <input
            id="memory-add"
            className="field basis-full"
            value={adding}
            maxLength={NOTE_MAX}
            placeholder="Add something, e.g. I prefer phone calls to messages"
            onChange={(e) => setAdding(e.target.value)}
          />
          <label htmlFor="memory-category" className="sr-only">
            What is it about?
          </label>
          <select id="memory-category" className="field min-w-[12rem] flex-1 text-[1rem]" value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory | '')}>
            <option value="">Let Morph sort it</option>
            {MEMORY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary shrink-0">
            <Plus aria-hidden="true" />
            Add
          </button>
        </form>
        {problem && <p className="text-[1rem] font-bold text-ask">{problem}</p>}

        <div className="relative">
          <label htmlFor="memory-search" className="sr-only">
            Search what I remember
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-muted" />
          <input id="memory-search" className="field pl-12" value={query} placeholder="Search" onChange={(e) => setQuery(e.target.value)} />
        </div>

        {notes.length === 0 ? (
          <p className="text-[1.05rem] text-fg-muted">{query ? 'Nothing matches that.' : "Nothing yet. Tell me things like “Remember that my grandson is called Rohan”, and I'll keep them here."}</p>
        ) : query.trim() ? (
          // Searching: best matches first, not grouped.
          <NoteList notes={notes} onChanged={refresh} />
        ) : (
          groupNotes(notes).map((group) => (
            <section key={group.id} aria-labelledby={`memory-group-${group.id}`} className="flex flex-col gap-3">
              <h3 id={`memory-group-${group.id}`} className="flex items-center gap-2 pt-2 text-[1.05rem] font-bold">
                {group.id === 'pinned' && <Pin aria-hidden="true" className="size-4 text-morph" />}
                {group.label}
                <span className="font-normal text-fg-muted">({group.notes.length})</span>
              </h3>
              <NoteList notes={group.notes} onChanged={refresh} />
            </section>
          ))
        )}
      </Panel>

      <Routines />

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-quiet" onClick={() => setView('activity')}>
          <History aria-hidden="true" />
          See what Morph has done
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setConfirmClear(true)}>
          <Trash2 aria-hidden="true" />
          Forget everything
        </button>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Forget everything?"
          body="Morph will forget everything it remembers about you, including “About you” and the things it learned to do on websites. Your conversations stay. This can't be undone."
          confirmLabel="Forget everything"
          cancelLabel="Keep it"
          onConfirm={async () => {
            await core('memory.clear')
            refresh()
          }}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </Page>
  )
}
