import { useEffect, useRef, useState } from 'react'
import { FileText, ListOrdered, PenLine, ShieldCheck, WifiOff } from 'lucide-react'
import { useSettings } from '@/settings'
import { PeekingMorph } from '@/components/PeekingMorph'
import { useMascotSize } from '@/components/useViewportHeight'
import { useSessions } from '@/chat/sessions'
import { Composer } from '@/chat/Composer'
import { useTextReveal } from '@/lib/useTextReveal'

// Only things Morph can actually do today (talk, explain, guide); no promises about email or forms yet.
const STARTERS = [
  {
    icon: FileText,
    title: 'Explain a letter or bill',
    detail: "Paste in the words and I'll tell you what it means.",
    prompt: 'Please explain this letter to me in simple words:\n'
  },
  {
    icon: ShieldCheck,
    title: 'Check for scams',
    detail: 'Ask me if a message, call or website seems safe.',
    prompt: 'Is this message safe, or is it a scam?\n'
  },
  {
    icon: ListOrdered,
    title: 'Step-by-step help',
    detail: "Ask how to do something and I'll guide you one step at a time.",
    prompt: 'Show me step by step how to '
  },
  {
    icon: PenLine,
    title: 'Write a message',
    detail: "Tell me what you want to say and I'll help you write it.",
    prompt: 'Help me write a message to '
  }
]

function greeting(name: string) {
  const hour = new Date().getHours()
  const part = hour < 5 ? 'Hello' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${part}, ${name}.` : `${part}.`
}

/** The greeting rises in word by word each time you come back home. */
function Greeting({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useTextReveal(ref, { style: 'rise' })
  return (
    <h1 ref={ref} className="text-center text-[2.5rem] font-semibold">
      {text}
    </h1>
  )
}

export function Home() {
  const { settings } = useSettings()
  const { send, online } = useSessions()
  const mascot = useMascotSize(150, 96, 0.16)
  const [draft, setDraft] = useState('')
  const [lookAt, setLookAt] = useState<HTMLElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const startWith = (prompt: string) => {
    setDraft(prompt)
    const input = inputRef.current
    if (!input) return
    input.focus()
    requestAnimationFrame(() => input.setSelectionRange(prompt.length, prompt.length))
  }

  return (
    <div className="@container flex h-full flex-col overflow-y-auto px-6">
      <div className="mx-auto my-auto flex w-full max-w-[52rem] flex-col items-center py-5">
        <Greeting key={greeting(settings.name)} text={greeting(settings.name)} />
        <p className="mt-2 text-[1.15rem] text-fg-muted">{today}</p>

        <div className="mt-4">
          <PeekingMorph layoutId="dock-morph" size={mascot} lookAt={lookAt} />
        </div>
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={() => {
            if (!draft.trim()) return inputRef.current?.focus()
            send(draft)
            setDraft('')
          }}
          onStop={() => {}}
          busy={false}
          inputRef={inputRef}
          onFocusChange={setLookAt}
        />

        {online === false && (
          <p role="status" className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-[var(--field-border)] bg-[var(--field)] px-5 py-4 text-[1.05rem]">
            <WifiOff aria-hidden="true" className="size-6 shrink-0 text-ask" />
            Morph can't connect right now. Check that this computer is connected to the internet.
          </p>
        )}

        <h2 className="mt-10 self-start text-[1.1rem] font-medium text-fg-muted">Or start with one of these</h2>
        <ul className="mt-4 grid w-full grid-cols-2 gap-4 @min-[46rem]:grid-cols-4">
          {STARTERS.map(({ icon: Icon, title, detail, prompt }) => (
            <li key={title}>
              <button
                type="button"
                className="glass flex h-full w-full cursor-pointer flex-col items-start gap-3 rounded-[1.5rem] p-5 text-left transition-colors hover:border-[var(--morph)]"
                onClick={() => startWith(prompt)}
                onMouseEnter={(e) => setLookAt(e.currentTarget)}
                onMouseLeave={() => setLookAt(document.activeElement === inputRef.current ? inputRef.current : null)}
              >
                <span className="grid size-12 place-items-center rounded-full bg-[var(--selected)]">
                  <Icon aria-hidden="true" className="size-6 text-morph" />
                </span>
                <span className="font-display text-[1.15rem] leading-tight font-semibold">{title}</span>
                <span className="text-[0.95rem] leading-snug text-fg-muted">{detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
