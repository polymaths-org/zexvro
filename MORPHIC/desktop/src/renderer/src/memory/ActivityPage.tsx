import { useCallback, useEffect, useState } from 'react'
import { Bell, Brain, ExternalLink, ListChecks, Settings } from 'lucide-react'
import type { Activity } from '@shared/core'
import { core, useCoreEvent } from '@/lib/core'
import { Page, Panel } from '@/components/Page'
import { formatWhen } from '@/chat/when'

const ICONS: Record<Activity['kind'], typeof Bell> = { reminder: Bell, memory: Brain, website: ExternalLink, plan: ListChecks, system: Settings }

/** Everything Morph has done, in plain words, newest first, so the person (or family) can always check. */
export function ActivityPage() {
  const [items, setItems] = useState<Activity[]>([])
  const refresh = useCallback(async () => setItems(await core('activity.list', 200)), [])
  useEffect(() => {
    refresh()
  }, [refresh])
  useCoreEvent('memory.changed', refresh)
  useCoreEvent('reminders.changed', refresh)

  return (
    <Page title="What Morph has done" intro="Every reminder Morph set, everything it remembered or forgot, and every website you let it open.">
      <Panel>
        {items.length === 0 ? (
          <p className="text-[1.05rem] text-fg-muted">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col">
            {items.map((item) => {
              const Icon = ICONS[item.kind] ?? Settings
              return (
                <li key={item.id} className="flex items-start gap-4 border-b border-[var(--field-border)] py-3.5 last:border-b-0">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--selected)]">
                    <Icon aria-hidden="true" className="size-5 text-morph" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[1.05rem]">{item.summary}</span>
                    <span className="text-[0.9rem] text-fg-muted">{formatWhen(item.at)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </Page>
  )
}
