import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Reminder, Repeat } from '@shared/core'
import { core, useCoreEvent } from '@/lib/core'
import { useSettings } from '@/settings'
import { speak } from '@/speech'

interface RemindersValue {
  reminders: Reminder[]
  /** Reminders that have gone off and are waiting for "Done" or "Remind me later". */
  due: Reminder[]
  add: (text: string, due: number, repeat: Repeat) => Promise<boolean>
  remove: (id: string) => Promise<void>
  snooze: (id: string, minutes: number) => Promise<void>
  done: (id: string) => Promise<void>
}

const RemindersContext = createContext<RemindersValue | null>(null)

export function RemindersProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [due, setDue] = useState<Reminder[]>([])

  const refresh = useCallback(async () => setReminders(await core('reminders.list')), [])
  useEffect(() => {
    refresh()
  }, [refresh])

  useCoreEvent('reminders.changed', refresh)
  useCoreEvent('reminder.due', ({ reminder }) => {
    setDue((list) => [...list.filter((r) => r.id !== reminder.id), reminder])
    if (settings.readAloud) speak(`Reminder: ${reminder.text}`)
  })

  const dismiss = (id: string) => setDue((list) => list.filter((r) => r.id !== id))

  const value: RemindersValue = {
    reminders,
    due,
    add: async (text, at, repeat) => {
      const created = await core('reminders.add', text, at, repeat)
      await refresh()
      return created !== null
    },
    remove: async (id) => {
      dismiss(id)
      await core('reminders.delete', id)
    },
    snooze: async (id, minutes) => {
      dismiss(id)
      await core('reminders.snooze', id, minutes)
    },
    done: async (id) => {
      dismiss(id)
      await core('reminders.done', id)
    }
  }

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>
}

export function useReminders() {
  const ctx = useContext(RemindersContext)
  if (!ctx) throw new Error('useReminders must be used inside RemindersProvider')
  return ctx
}

const REPEAT_WORDS: Record<Repeat, string> = { once: '', daily: 'Every day', weekly: 'Every week' }
export const repeatLabel = (repeat: Repeat) => REPEAT_WORDS[repeat]

/** "Today, 8:00 pm", "Tomorrow, 9:30 am", "Friday, 6:00 pm", "12 November, 10:00 am" */
export function formatDue(ms: number, now = Date.now()): string {
  const day = (t: number) => {
    const d = new Date(t)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const days = Math.round((day(ms) - day(now)) / 86_400_000)
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(ms)
  if (days === 0) return `Today, ${time}`
  if (days === 1) return `Tomorrow, ${time}`
  if (days === -1) return `Yesterday, ${time}`
  if (days > 1 && days < 7) return `${new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(ms)}, ${time}`
  return `${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' }).format(ms)}, ${time}`
}
