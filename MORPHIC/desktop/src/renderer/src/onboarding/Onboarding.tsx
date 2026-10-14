import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion, useReducedMotionConfig } from 'motion/react'
import { ArrowLeft, ArrowRight, CreditCard, FileCheck, KeyRound, Send } from 'lucide-react'
import { useSettings } from '@/settings'
import { hasVoices, speak, stopSpeaking } from '@/speech'
import { useTextReveal } from '@/lib/useTextReveal'
import { TitleBar } from '@/components/TitleBar'
import { PeekingMorph } from '@/components/PeekingMorph'
import { AutoHeight } from '@/components/AutoHeight'
import { ModePicker, PalettePicker, ReadAloudPicker, TextSizePicker } from '@/components/Pickers'
import { useMascotSize } from '@/components/useViewportHeight'

const STEPS = ['welcome', 'name', 'size', 'look', 'voice', 'safety', 'ready'] as const
type Step = (typeof STEPS)[number]
/** Only these count as "Step n of 5"; welcome and ready aren't questions. */
const QUESTIONS: Step[] = ['name', 'size', 'look', 'voice', 'safety']

const ASKS_FIRST = [
  { icon: Send, label: 'Sending a message or email' },
  { icon: CreditCard, label: 'Paying for anything' },
  { icon: FileCheck, label: 'Sending in a form' },
  { icon: KeyRound, label: 'Typing a password or code' }
]

interface StepView {
  title: string
  body: string
  content?: ReactNode
  primary: string
  onPrimary: () => void
}

/** Each step's title rises in word by word (GSAP SplitText). Mounted per step, so it replays on every step. */
function StepTitle({ text, focusRef, enabled }: { text: string; focusRef: RefObject<HTMLHeadingElement | null>; enabled: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useTextReveal(ref, { style: 'rise', delay: 0.08, enabled })
  return (
    <h1
      ref={(el) => {
        ref.current = el
        focusRef.current = el
      }}
      tabIndex={-1}
      className="text-[2.1rem] font-semibold outline-none"
    >
      {text}
    </h1>
  )
}

export function Onboarding() {
  const { settings, update } = useSettings()
  const mascot = useMascotSize(200, 108, 0.19)
  const reduced = useReducedMotionConfig() ?? false
  const [step, setStep] = useState<Step>('welcome')
  const [intro, setIntro] = useState(!reduced)
  const [awake, setAwake] = useState(reduced)
  const [name, setName] = useState(settings.name)
  const [voicesReady, setVoicesReady] = useState<boolean | null>(null)
  const [primaryEl, setPrimaryEl] = useState<HTMLButtonElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const firstRender = useRef(true)

  const index = STEPS.indexOf(step)
  const next = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)])
  const back = () => setStep(STEPS[Math.max(index - 1, 0)])

  useEffect(() => {
    hasVoices().then(setVoicesReady)
  }, [])

  const views: Record<Step, StepView> = {
    welcome: {
      title: "Hi, I'm Morph.",
      body: "Tell me what you need, and I'll do it on the computer for you. You stay in charge the whole time.",
      primary: "Let's get started",
      onPrimary: next
    },
    name: {
      title: 'What should I call you?',
      body: "I'll use your name when I talk to you.",
      content: (
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-[1rem] font-bold">
            Your first name
          </label>
          <input
            id="name"
            ref={nameRef}
            className="field"
            value={name}
            maxLength={40}
            autoComplete="given-name"
            placeholder="For example, Asha"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      ),
      primary: name.trim() ? 'Continue' : 'Skip for now',
      onPrimary: () => {
        update({ name: name.trim() })
        next()
      }
    },
    size: {
      title: 'Which size is easiest to read?',
      body: 'The screen changes as you pick. You can change it later in Settings.',
      content: (
        <fieldset>
          <legend className="sr-only">Text size</legend>
          <TextSizePicker name="text-size" />
        </fieldset>
      ),
      primary: 'Continue',
      onPrimary: next
    },
    look: {
      title: 'How would you like Morph to look?',
      body: 'Pick the colours you like. You can change them later in Settings.',
      content: (
        <div className="flex flex-col gap-5">
          <fieldset>
            <legend className="mb-2 text-[1rem] font-bold">Colours</legend>
            <PalettePicker name="onboarding-palette" columns={4} compact />
          </fieldset>
          <fieldset>
            <legend className="mb-3 text-[1rem] font-bold">Light or dark</legend>
            <ModePicker name="onboarding-theme" layout="row" />
          </fieldset>
        </div>
      ),
      primary: 'Continue',
      onPrimary: next
    },
    voice: {
      title: 'Should I read things out loud?',
      body: 'I can say my messages out loud, as well as showing them on screen.',
      content: (
        <div className="flex flex-col gap-3">
          <fieldset>
            <legend className="sr-only">Read out loud</legend>
            <ReadAloudPicker name="read-aloud" tall />
          </fieldset>
          {voicesReady === false && (
            <p className="text-[0.95rem] text-fg-muted">
              This computer doesn't have a voice installed yet, so I can't speak right now. I'll remember your
              choice for when it does.
            </p>
          )}
        </div>
      ),
      primary: 'Continue',
      onPrimary: next
    },
    safety: {
      title: "I'll always ask before anything important.",
      body: 'I can open websites and fill things in for you. But these things always need your OK first:',
      content: (
        <div className="flex flex-col gap-4">
          <ul className="grid grid-cols-2 gap-3">
            {ASKS_FIRST.map(({ icon: Icon, label }, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.08, type: 'spring', stiffness: 300, damping: 28 }}
                className="flex items-center gap-3 rounded-2xl border border-[var(--field-border)] bg-[var(--field)] p-4"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--selected)]">
                  <Icon aria-hidden="true" className="size-5.5 text-morph" />
                </span>
                <span className="text-[1rem] leading-snug font-bold">{label}</span>
              </motion.li>
            ))}
          </ul>
          <p className="text-[1.05rem]">You press the button. I never do these on my own.</p>
        </div>
      ),
      primary: 'I understand',
      onPrimary: next
    },
    ready: {
      title: settings.name ? `You're all set, ${settings.name}.` : "You're all set.",
      body: 'Whenever you need something, open Morph and tell me. I’ll take it from there.',
      primary: 'Start using Morph',
      onPrimary: () => {
        stopSpeaking()
        update({ onboarded: true })
      }
    }
  }
  const view = views[step]
  const question = QUESTIONS.indexOf(step)

  // Move focus to the new step (so keyboard and screen-reader users land on it) and read it out if asked.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const t = setTimeout(() => (step === 'name' ? nameRef.current : headingRef.current)?.focus(), 260)
    if (settings.readAloud) speak(`${view.title} ${view.body}`)
    return () => clearTimeout(t)
    // Only on step change: re-reading on every settings tweak would be noisy.
  }, [step])

  return (
    <div className="flex h-screen flex-col">
      <TitleBar />
      <main className="relative z-10 flex flex-1 flex-col overflow-y-auto px-6">
        <div className="my-auto flex flex-col items-center py-4">
          <PeekingMorph
            size={mascot}
            intro={intro}
            awake={awake}
            onIntroDone={() => {
              setIntro(false)
              setTimeout(() => setAwake(true), 280)
            }}
            lookAt={primaryEl}
            lookKey={`${step}-${settings.textSize}`}
          />

          <motion.section
            className="glass z-10 w-full max-w-[44rem]"
            initial={reduced ? false : { opacity: 0, y: 28 }}
            animate={intro ? { opacity: 0, y: 28 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: intro ? 0 : 0.2 }}
          >
            <AutoHeight>
              <AnimatePresence mode="wait" initial={false}>
                <motion.form
                  key={step}
                  className="flex flex-col gap-6 px-10 pt-9"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.16, ease: 'easeIn' } }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    view.onPrimary()
                  }}
                >
                  <div className="flex flex-col gap-3">
                    <StepTitle text={view.title} focusRef={headingRef} enabled={!intro} />
                    <p className="text-[1.2rem] text-fg-muted">{view.body}</p>
                  </div>

                  {view.content}

                  {/* Sticks to the bottom of the window when a step is taller than the screen,
                      so the button to press next is always in view. */}
                  <div className="sticky bottom-0 -mx-10 flex items-center gap-3 rounded-b-[1.75rem] border-t border-[var(--glass-border)] bg-[color-mix(in_oklab,var(--glass-solid)_78%,transparent)] px-10 py-5 backdrop-blur-xl">
                    {index > 0 && (
                      <button type="button" className="btn btn-quiet" onClick={back}>
                        <ArrowLeft aria-hidden="true" />
                        Back
                      </button>
                    )}
                    {question >= 0 && (
                      <p className="flex-1 text-center text-[0.95rem] font-bold text-fg-muted">
                        Step {question + 1} of {QUESTIONS.length}
                      </p>
                    )}
                    <button ref={setPrimaryEl} type="submit" className="btn btn-primary ml-auto">
                      {view.primary}
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </div>
                </motion.form>
              </AnimatePresence>
            </AutoHeight>
          </motion.section>
        </div>
      </main>
    </div>
  )
}
