import { useEffect, useId, useState, type ReactNode } from 'react'
import { Bell, Brain, Check, History, Play, RotateCcw, ShieldCheck, Trash2, Wifi, WifiOff } from 'lucide-react'
import { ANSWER_LENGTHS, LANGUAGES, TONES, type AnswerLength, type LanguageCode, type Personality, type Soul } from '@shared/core'
import { useSettings } from '@/settings'
import { useSessions } from '@/chat/sessions'
import { core } from '@/lib/core'
import { listVoices, speak } from '@/speech'
import { Choice } from '@/components/Choice'
import { ModePicker, PalettePicker, ReadAloudPicker, TextSizePicker } from '@/components/Pickers'
import type { View } from '@/shell/view'
import { AdvancedSettings } from './AdvancedSettings'

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 font-display text-[1.2rem] font-semibold">{title}</legend>
      {hint && <p className="-mt-1 text-[1rem] text-fg-muted">{hint}</p>}
      {children}
    </fieldset>
  )
}

/** Two big choices for on/off settings, so the meaning is always written out. */
function YesNo({ name, value, yes, no, onChange }: { name: string; value: boolean; yes: string; no: string; onChange: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Choice name={name} value="yes" checked={value} onSelect={() => onChange(true)} className="min-h-14 items-center justify-center px-3 pt-2">
        <span className="text-center text-[1rem] font-bold">{yes}</span>
      </Choice>
      <Choice name={name} value="no" checked={!value} onSelect={() => onChange(false)} className="min-h-14 items-center justify-center px-3 pt-2">
        <span className="text-center text-[1rem] font-bold">{no}</span>
      </Choice>
    </div>
  )
}

// ── You ─────────────────────────────────────────────────────────────────────────────────────

export function YouSection() {
  const { settings, update } = useSettings()
  const [name, setName] = useState(settings.name)
  const [saved, setSaved] = useState(false)
  const changed = name.trim() !== settings.name
  return (
    <Section title="Your name" hint="Morph uses it when talking to you.">
      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          update({ name: name.trim() })
          setSaved(true)
        }}
      >
        <label htmlFor="settings-name" className="sr-only">
          Your first name
        </label>
        <input
          id="settings-name"
          className="field min-h-14 flex-1 text-[1.1rem]"
          value={name}
          maxLength={40}
          autoComplete="given-name"
          placeholder="For example, Asha"
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
        />
        <button type="submit" className="btn btn-quiet shrink-0" disabled={!changed && !saved}>
          {saved && !changed ? (
            <>
              <Check aria-hidden="true" />
              Saved
            </>
          ) : (
            'Save name'
          )}
        </button>
      </form>
    </Section>
  )
}

// ── Reading & voice ─────────────────────────────────────────────────────────────────────────

const RATE_WORD = (r: number) => (r < 0.8 ? 'Slow' : r < 0.9 ? 'A little slow' : r <= 1.05 ? 'Normal' : r <= 1.2 ? 'A little fast' : 'Fast')

function VoiceSettings() {
  const { settings, update } = useSettings()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null)
  const rateId = useId()
  useEffect(() => {
    listVoices().then(setVoices)
  }, [])
  if (voices && voices.length === 0) {
    return <p className="text-[1rem] text-fg-muted">This computer doesn't have any voices installed yet, so Morph can't speak right now.</p>
  }
  const fill = ((settings.voiceRate - 0.6) / 0.8) * 100
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="settings-voice" className="text-[1rem] font-bold">
          Voice
        </label>
        <select id="settings-voice" className="field text-[1.05rem]" value={settings.voice} onChange={(e) => update({ voice: e.target.value })}>
          <option value="">The computer's usual voice</option>
          {(voices ?? []).map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <label htmlFor={rateId} className="text-[1rem] font-bold">
            Speaking speed
          </label>
          <span className="text-[0.95rem] text-fg-muted">{RATE_WORD(settings.voiceRate)}</span>
        </div>
        <input
          id={rateId}
          type="range"
          className="range"
          min={0.6}
          max={1.4}
          step={0.05}
          value={settings.voiceRate}
          aria-valuetext={RATE_WORD(settings.voiceRate)}
          style={{ ['--fill' as string]: `${fill}%` }}
          onChange={(e) => update({ voiceRate: Number(e.target.value) })}
        />
      </div>
      <button type="button" className="btn btn-quiet self-start" onClick={() => speak(`Hello${settings.name ? ` ${settings.name}` : ''}. This is how I sound.`)}>
        <Play aria-hidden="true" />
        Hear my voice
      </button>
    </div>
  )
}

export function ReadingSection() {
  return (
    <>
      <Section title="Text size">
        <TextSizePicker name="settings-text-size" compact />
      </Section>
      <Section title="Read out loud" hint="Morph can say its answers out loud, as well as showing them.">
        <ReadAloudPicker name="settings-read-aloud" />
      </Section>
      <Section title="Morph's voice">
        <VoiceSettings />
      </Section>
    </>
  )
}

// ── Morph's answers ─────────────────────────────────────────────────────────────────────────

const LENGTH_LABEL: Record<AnswerLength, string> = { short: 'Short', normal: 'Normal', detailed: 'More detail' }

const TONE_EXAMPLE: Record<Personality['tone'], string> = {
  warm: '“Of course. Let’s do it together.”',
  cheerful: '“Lovely! Let’s get that sorted.”',
  calm: '“Okay. One step at a time.”',
  respectful: '“Certainly. Here is how.”'
}

/** What Morph calls the person. Saved on its own button, like the name. */
function CallMe() {
  const { settings, update } = useSettings()
  const [value, setValue] = useState(settings.personality.callMe)
  const [saved, setSaved] = useState(false)
  const changed = value.trim() !== settings.personality.callMe
  return (
    <form
      className="flex gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        update({ personality: { ...settings.personality, callMe: value.trim() } })
        setSaved(true)
      }}
    >
      <label htmlFor="settings-callme" className="sr-only">
        What Morph calls you
      </label>
      <input
        id="settings-callme"
        className="field min-h-14 flex-1 text-[1.1rem]"
        value={value}
        maxLength={30}
        placeholder={settings.name ? `For example, ${settings.name}` : 'For example, Aunty'}
        onChange={(e) => {
          setValue(e.target.value)
          setSaved(false)
        }}
      />
      <button type="submit" className="btn btn-quiet shrink-0" disabled={!changed && !saved}>
        {saved && !changed ? (
          <>
            <Check aria-hidden="true" />
            Saved
          </>
        ) : (
          'Save'
        )}
      </button>
    </form>
  )
}

export function AnswersSection() {
  const { settings, update } = useSettings()
  return (
    <>
      <Section title="Language" hint="The language Morph answers in.">
        <label htmlFor="settings-language" className="sr-only">
          Reply language
        </label>
        <select id="settings-language" className="field text-[1.05rem]" value={settings.language} onChange={(e) => update({ language: e.target.value as LanguageCode })}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </Section>
      <Section title="How long should answers be?">
        <div className="grid grid-cols-3 gap-3">
          {ANSWER_LENGTHS.map((length) => (
            <Choice
              key={length}
              name="settings-length"
              value={length}
              checked={settings.answerLength === length}
              onSelect={() => update({ answerLength: length })}
              className="min-h-14 items-center justify-center px-2 pt-2"
            >
              <span className="text-center text-[1rem] font-bold">{LENGTH_LABEL[length]}</span>
            </Choice>
          ))}
        </div>
      </Section>
      <Section title="How Morph talks to you">
        <div className="grid grid-cols-1 gap-3 min-[34rem]:grid-cols-2">
          {TONES.map((tone) => (
            <Choice
              key={tone.id}
              name="settings-tone"
              value={tone.id}
              checked={settings.personality.tone === tone.id}
              onSelect={() => update({ personality: { ...settings.personality, tone: tone.id } })}
              className="min-h-16 flex-col items-start justify-center gap-0.5 px-4 pt-2"
            >
              <span className="text-[1rem] font-bold">{tone.label}</span>
              <span className="text-[0.95rem] text-fg-muted">{TONE_EXAMPLE[tone.id]}</span>
            </Choice>
          ))}
        </div>
      </Section>
      <Section title="A little humour?">
        <YesNo
          name="settings-humour"
          value={settings.personality.humour}
          yes="Yes, now and then"
          no="No, keep it plain"
          onChange={(humour) => update({ personality: { ...settings.personality, humour } })}
        />
      </Section>
      <Section title="What should Morph call you?" hint="Leave it empty and Morph uses your name.">
        <CallMe />
      </Section>
    </>
  )
}

// ── Look ────────────────────────────────────────────────────────────────────────────────────

export function LookSection() {
  const { settings, update } = useSettings()
  return (
    <>
      <Section title="Theme">
        <PalettePicker name="settings-palette" />
      </Section>
      <Section title="Light or dark">
        <ModePicker name="settings-theme" />
      </Section>
      <Section title="Opening animation" hint="A short welcome from Morph each time it starts.">
        <YesNo name="settings-intro" value={settings.introAnimation} yes="Play it" no="Skip it" onChange={(introAnimation) => update({ introAnimation })} />
      </Section>
    </>
  )
}

// ── Memory & privacy ────────────────────────────────────────────────────────────────────────

export function MemorySection({ go, onClearConversations }: { go: (view: View) => void; onClearConversations: () => void }) {
  const { settings, update } = useSettings()
  const { summaries } = useSessions()
  return (
    <>
      <Section title="Memory" hint="Morph can remember things about you to help better next time. Passwords, codes and bank details are never kept.">
        <YesNo name="settings-memory" value={settings.memory} yes="Yes, remember things" no="No, don't remember" onChange={(memory) => update({ memory })} />
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-quiet" onClick={() => go('memory')}>
            <Brain aria-hidden="true" />
            See what I remember
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => go('activity')}>
            <History aria-hidden="true" />
            See what Morph has done
          </button>
        </div>
      </Section>
      <Section title="Conversations">
        <p className="text-[1rem] text-fg-muted">
          {summaries.length === 0
            ? 'You have no saved conversations.'
            : `You have ${summaries.length} saved ${summaries.length === 1 ? 'conversation' : 'conversations'} on this computer.`}
        </p>
        <button type="button" className="btn btn-quiet self-start" disabled={summaries.length === 0} onClick={onClearConversations}>
          <Trash2 aria-hidden="true" />
          Delete all conversations
        </button>
      </Section>
    </>
  )
}

// ── Reminders ───────────────────────────────────────────────────────────────────────────────

export function RemindersSection({ go }: { go: (view: View) => void }) {
  const { settings, update } = useSettings()
  return (
    <Section title="Reminder pop-ups" hint="A reminder always shows inside Morph. Morph can also show it as a pop-up on your computer, even when Morph is behind other windows.">
      <YesNo name="settings-notifications" value={settings.notifications} yes="Yes, show pop-ups" no="No pop-ups" onChange={(notifications) => update({ notifications })} />
      <button type="button" className="btn btn-quiet self-start" onClick={() => go('reminders')}>
        <Bell aria-hidden="true" />
        Open my reminders
      </button>
    </Section>
  )
}

// ── Advanced ────────────────────────────────────────────────────────────────────────────────

function ServiceAddress() {
  const { settings, update } = useSettings()
  const [value, setValue] = useState(settings.serviceUrl)
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'down'>('idle')
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setState('checking')
        await update({ serviceUrl: value })
        const { online } = await core('status').catch(() => ({ online: false }))
        setState(online ? 'ok' : 'down')
      }}
    >
      <label htmlFor="settings-service" className="text-[1rem] font-bold">
        Morph service address
      </label>
      <input id="settings-service" className="field font-mono text-[1rem]" value={value} placeholder="Leave empty to use the usual one" onChange={(e) => setValue(e.target.value)} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-quiet">
          <Wifi aria-hidden="true" />
          Save and check
        </button>
        <span role="status" className="flex items-center gap-2 text-[1rem]">
          {state === 'checking' && 'Checking…'}
          {state === 'ok' && (
            <>
              <Check aria-hidden="true" className="size-5 text-morph" /> Morph is ready
            </>
          )}
          {state === 'down' && (
            <>
              <WifiOff aria-hidden="true" className="size-5 text-ask" /> Morph can't reach that address
            </>
          )}
        </span>
      </div>
    </form>
  )
}

/** Morph's soul: who Morph is and how it speaks, as plain text. The safety rules are separate and fixed. */
function SoulEditor() {
  const [soul, setSoul] = useState<Soul | null>(null)
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'saved' | 'reset'>('idle')
  useEffect(() => {
    void core('soul.get').then((s) => {
      setSoul(s)
      setText(s.text)
    })
  }, [])
  if (!soul) return null
  const changed = text !== soul.text
  const apply = (next: Soul, done: 'saved' | 'reset') => {
    setSoul(next)
    setText(next.text)
    setState(done)
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        apply(await core('soul.set', text), 'saved')
      }}
    >
      <label htmlFor="settings-soul" className="text-[1rem] font-bold">
        Who Morph is, in Morph's own words
      </label>
      <textarea
        id="settings-soul"
        className="field min-h-64 font-mono text-[0.95rem] leading-relaxed"
        value={text}
        maxLength={6000}
        spellCheck
        onChange={(e) => {
          setText(e.target.value)
          setState('idle')
        }}
      />
      <p className="flex items-start gap-2 text-[0.95rem] text-fg-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-morph" />
        Morph's safety rules always come first, whatever is written here. Morph will still never ask for passwords or codes, and will still warn you about scams.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-quiet" disabled={!changed}>
          <Check aria-hidden="true" />
          Save
        </button>
        <button type="button" className="btn btn-quiet" disabled={!soul.customised && !changed} onClick={async () => apply(await core('soul.reset'), 'reset')}>
          <RotateCcw aria-hidden="true" />
          Go back to the original
        </button>
        <span role="status" className="text-[1rem] text-fg-muted">
          {state === 'saved' && !changed && 'Saved. Morph will use this from the next answer.'}
          {state === 'reset' && !changed && 'Back to the original.'}
        </span>
      </div>
    </form>
  )
}

export function AdvancedSection() {
  const { settings, update } = useSettings()
  return (
    <>
      <Section title="Look and feel">
        <AdvancedSettings />
      </Section>
      <Section title="Morph's soul" hint="This is the description Morph reads before every answer: its character, how it speaks and what it cares about. Change it if you'd like Morph to behave a little differently.">
        <SoulEditor />
      </Section>
      {window.morphic.platform !== 'linux' && (
        <Section title="Start Morph with the computer">
          <YesNo name="settings-login" value={settings.openAtLogin} yes="Yes, start Morph" no="No" onChange={(openAtLogin) => update({ openAtLogin })} />
        </Section>
      )}
      <Section title="Connection" hint="Only change this if someone setting up Morph for you asked you to.">
        <ServiceAddress />
      </Section>
    </>
  )
}

// ── About & help ────────────────────────────────────────────────────────────────────────────

const MOD = window.morphic.platform === 'darwin' ? '⌘' : 'Ctrl'
const SHORTCUTS = [
  { keys: [MOD, 'N'], label: 'Start a new conversation' },
  { keys: [MOD, ','], label: 'Open Settings' },
  { keys: ['Enter'], label: 'Send your message' },
  { keys: ['Shift', 'Enter'], label: 'Start a new line' },
  { keys: ['Esc'], label: 'Close a window like this one' }
]

export function AboutSection({ onRestartSetup }: { onRestartSetup: () => void }) {
  return (
    <>
      <Section title="Keyboard shortcuts">
        <ul className="flex flex-col gap-2.5">
          {SHORTCUTS.map(({ keys, label }) => (
            <li key={label} className="flex items-center justify-between gap-4 text-[1rem]">
              <span>{label}</span>
              <span className="flex shrink-0 gap-1.5">
                {keys.map((k) => (
                  <kbd key={k} className="rounded-lg border border-[var(--field-border)] bg-[var(--field)] px-2.5 py-0.5 font-sans text-[0.9rem] font-bold">
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Set up again" hint="Go through the first-time questions again, like your name and text size.">
        <button type="button" className="btn btn-quiet self-start" onClick={onRestartSetup}>
          <RotateCcw aria-hidden="true" />
          Start setup again
        </button>
      </Section>
      <p className="text-[0.95rem] text-fg-muted">Morph {__APP_VERSION__} · by ZEXVRO</p>
    </>
  )
}
