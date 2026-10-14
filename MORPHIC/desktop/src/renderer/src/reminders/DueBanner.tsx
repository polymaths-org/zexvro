import { AnimatePresence, motion } from 'motion/react'
import { Bell, Check, Clock } from 'lucide-react'
import { MorphMark } from '@/components/MorphMark'
import { useReminders } from './reminders'

/** When a reminder goes off: a clear card at the top with "Done" and "Remind me in 10 minutes". */
export function DueBanner() {
  const { due, done, snooze } = useReminders()
  const first = due[0]
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-6">
      <AnimatePresence>
        {first && (
          <motion.section
            key={first.id}
            role="alert"
            aria-label="Reminder"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="glass glass-strong pointer-events-auto flex w-full max-w-[40rem] items-center gap-4 border-2 border-[var(--morph)] p-5"
          >
            <MorphMark size={52} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-2 text-[0.95rem] font-bold text-morph">
                <Bell aria-hidden="true" className="size-4.5" />
                Reminder{due.length > 1 ? ` (1 of ${due.length})` : ''}
              </span>
              <span className="text-[1.3rem] leading-snug font-bold">{first.text}</span>
              <div className="mt-2 flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary min-h-12" onClick={() => done(first.id)}>
                  <Check aria-hidden="true" />
                  Done
                </button>
                <button type="button" className="btn btn-quiet min-h-12" onClick={() => snooze(first.id, 10)}>
                  <Clock aria-hidden="true" />
                  Remind me in 10 minutes
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
