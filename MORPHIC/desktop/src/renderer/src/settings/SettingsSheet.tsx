import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, Info, MessageSquareText, Palette, Plug, ShieldCheck, SlidersHorizontal, Type, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSettings } from '@/settings'
import { useSessions } from '@/chat/sessions'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useAnimatedDialog } from '@/components/useAnimatedDialog'
import type { View } from '@/shell/view'
import { AboutSection, AdvancedSection, AnswersSection, LookSection, MemorySection, ReadingSection, RemindersSection, YouSection } from './sections'
import { ConnectorsSection } from './connectors'

type Category = 'you' | 'reading' | 'answers' | 'look' | 'connectors' | 'memory' | 'reminders' | 'advanced' | 'about'

const CATEGORIES: { id: Category; label: string; icon: LucideIcon }[] = [
  { id: 'you', label: 'You', icon: UserRound },
  { id: 'reading', label: 'Reading & voice', icon: Type },
  { id: 'answers', label: "Morph's answers", icon: MessageSquareText },
  { id: 'look', label: 'Look', icon: Palette },
  { id: 'connectors', label: 'Connectors', icon: Plug },
  { id: 'memory', label: 'Memory & privacy', icon: ShieldCheck },
  { id: 'reminders', label: 'Reminders', icon: Bell },
  { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal },
  { id: 'about', label: 'About & help', icon: Info }
]

// Reopening Settings returns to the section the person was last in.
let lastCategory: Category = 'you'

export function SettingsSheet({ onClose, onNavigate }: { onClose: () => void; onNavigate: (view: View) => void }) {
  const { update } = useSettings()
  const { clearAll } = useSessions()
  const [category, setCategory] = useState<Category>(lastCategory)
  const [confirmClear, setConfirmClear] = useState(false)
  // Some actions (going to a page, restarting setup) happen after the sheet has slid away.
  const afterClose = useRef<(() => void) | null>(null)
  const { closing, close, finish, dialogProps } = useAnimatedDialog(() => {
    onClose()
    afterClose.current?.()
  })
  const closeThen = (action: () => void) => {
    afterClose.current = action
    close()
  }
  const go = (view: View) => closeThen(() => onNavigate(view))
  const pick = (c: Category) => {
    lastCategory = c
    setCategory(c)
  }
  const label = CATEGORIES.find((c) => c.id === category)!.label

  return (
    <>
      <dialog
        {...dialogProps}
        className="sheet"
        aria-labelledby="settings-title"
        onClick={(e) => {
          // A click on the dimmed area outside the panel lands on the dialog element itself.
          if (e.target === e.currentTarget) close()
        }}
      >
        <motion.div
          className="glass glass-strong flex h-full flex-col overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={closing ? { opacity: 0, scale: 0.97, y: 8 } : { opacity: 1, scale: 1, y: 0 }}
          transition={closing ? { duration: 0.18, ease: 'easeIn' } : { type: 'spring', stiffness: 340, damping: 30 }}
          onAnimationComplete={finish}
        >
          <div className="flex items-center justify-between gap-4 border-b border-[var(--glass-border)] px-8 py-5">
            <h2 id="settings-title" className="text-[1.9rem] font-semibold">
              Settings
            </h2>
            <button type="button" className="btn btn-primary min-h-12 px-6" onClick={close}>
              Done
            </button>
          </div>

          <div className="flex min-h-0 flex-1">
            <nav aria-label="Settings sections" className="flex w-[14rem] shrink-0 flex-col gap-1 overflow-y-auto border-r border-[var(--glass-border)] p-3">
              {CATEGORIES.map(({ id, label: text, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-current={category === id ? 'page' : undefined}
                  className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-[1rem] font-bold transition-colors hover:bg-[var(--selected)] ${
                    category === id ? 'bg-[var(--selected)] shadow-[inset_3px_0_0_var(--morph)]' : 'text-fg-muted'
                  }`}
                  onClick={() => pick(id)}
                >
                  <Icon aria-hidden="true" className="size-5.5 shrink-0 text-morph" />
                  {text}
                </button>
              ))}
            </nav>

            <div className="min-w-0 flex-1 overflow-y-auto px-8 py-7">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={category}
                  className="flex flex-col gap-9"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                >
                  <h3 className="sr-only">{label}</h3>
                  {category === 'you' && <YouSection />}
                  {category === 'reading' && <ReadingSection />}
                  {category === 'answers' && <AnswersSection />}
                  {category === 'look' && <LookSection />}
                  {category === 'connectors' && <ConnectorsSection />}
                  {category === 'memory' && <MemorySection go={go} onClearConversations={() => setConfirmClear(true)} />}
                  {category === 'reminders' && <RemindersSection go={go} />}
                  {category === 'advanced' && <AdvancedSection />}
                  {category === 'about' && <AboutSection onRestartSetup={() => closeThen(() => update({ onboarded: false }))} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </dialog>

      {/* A sibling, not a child: a dialog nested in another would pass its close events up to the sheet. */}
      {confirmClear && (
        <ConfirmDialog
          title="Delete all conversations?"
          body="All your conversations will be removed from this computer. This can't be undone."
          confirmLabel="Delete all"
          cancelLabel="Keep them"
          onConfirm={clearAll}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </>
  )
}
