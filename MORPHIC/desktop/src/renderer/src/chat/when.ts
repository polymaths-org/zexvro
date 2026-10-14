import type { SessionSummary } from '@shared/sessions'

const DAY = 86_400_000

const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** "2:14 pm" today, "Yesterday", "Monday" this week, then "12 Oct". */
export function formatWhen(t: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY)
  if (days <= 0) return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(t)
  if (days === 1) return 'Yesterday'
  if (days < 7) return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(t)
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(t)
}

export function groupByDay(items: SessionSummary[], now = Date.now()) {
  const today = startOfDay(now)
  const groups: { label: string; items: SessionSummary[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] }
  ]
  for (const item of items) {
    const group = item.updatedAt >= today ? 0 : item.updatedAt >= today - DAY ? 1 : 2
    groups[group].items.push(item)
  }
  return groups.filter((g) => g.items.length > 0)
}
