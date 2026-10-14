import { AnimatePresence, motion } from 'motion/react'
import { Bell, Brain, PanelLeftClose, PanelLeftOpen, Plus, Settings as SettingsIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSettings } from '@/settings'
import { MorphMark } from '@/components/MorphMark'
import { useSessions } from '@/chat/sessions'
import { formatWhen, groupByDay } from '@/chat/when'
import { useReminders } from '@/reminders/reminders'
import { useView, type View } from './view'

function RailButton({ icon: Icon, label, onClick, active = false }: { icon: LucideIcon; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      className={`flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl py-2.5 text-center text-[0.75rem] leading-tight font-bold hover:bg-[var(--selected)] hover:text-fg ${
        active ? 'bg-[var(--selected)] text-fg' : 'text-fg-muted'
      }`}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="size-6" />
      {label}
    </button>
  )
}

/** Big labelled links to the Reminders and Memory pages. */
function NavItem({ icon: Icon, label, view, badge }: { icon: LucideIcon; label: string; view: View; badge?: number }) {
  const { view: current, setView } = useView()
  const active = current === view
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-[1rem] font-bold transition-colors hover:bg-[var(--selected)] ${
        active ? 'bg-[var(--selected)] shadow-[inset_3px_0_0_var(--morph)]' : ''
      }`}
      onClick={() => setView(view)}
    >
      <Icon aria-hidden="true" className="size-5.5 shrink-0 text-morph" />
      <span className="flex-1">{label}</span>
      {!!badge && <span className="rounded-full bg-[var(--selected)] px-2 text-[0.85rem] text-fg-muted">{badge}</span>}
    </button>
  )
}

function OnlineStatus() {
  const { online } = useSessions()
  if (online === null) return null
  return (
    <p className="flex items-center gap-2.5 px-2 text-[0.9rem] text-fg-muted">
      <span aria-hidden="true" className={`size-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-[var(--ask)]'}`} />
      {online ? 'Morph is ready' : "Morph can't connect"}
    </p>
  )
}

export function Sidebar({ onOpenSettings, compact = false }: { onOpenSettings: () => void; compact?: boolean }) {
  const { settings, update } = useSettings()
  const { summaries, current, thinking, open, goHome } = useSessions()
  const { reminders } = useReminders()
  const { view, setView } = useView()
  const expanded = settings.sidebarOpen && !compact
  const anyThinking = thinking.size > 0
  const startNew = () => {
    goHome()
    setView('chat')
  }

  return (
    <aside
      aria-label="Conversations"
      className="glass relative z-20 m-2 mr-0 flex shrink-0 flex-col overflow-hidden rounded-[1.5rem] transition-[width] duration-300 ease-out"
      style={{ width: expanded ? 'min(18rem, 34vw)' : '5.5rem' }}
    >
      {/* Top strip doubles as the window's drag handle; macOS traffic lights sit over its left edge. */}
      <div
        className={`titlebar flex h-14 shrink-0 items-center gap-2.5 ${
          expanded ? 'px-4 in-data-[platform=darwin]:pl-20' : 'justify-center'
        }`}
      >
        {expanded ? (
          <>
            <MorphMark size={28} thinking={anyThinking} />
            <span className="wordmark select-none text-fg-muted">MORPH</span>
          </>
        ) : (
          // Collapsed: Morph keeps watch at the top of the strip (on macOS the window buttons live here, so it moves just below).
          <MorphMark size={40} thinking={anyThinking} className="in-data-[platform=darwin]:hidden" />
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
      {expanded ? (
        <motion.div
          key="list"
          className="flex min-h-0 flex-1 flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.1 } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          <div className="px-3">
            <button type="button" className="btn btn-primary w-full" onClick={startNew}>
              <Plus aria-hidden="true" />
              New conversation
            </button>
          </div>

          <nav aria-label="Pages" className="mt-4 flex flex-col gap-1 px-3">
            <NavItem icon={Bell} label="Reminders" view="reminders" badge={reminders.length} />
            <NavItem icon={Brain} label="What I remember" view="memory" />
          </nav>

          <nav aria-label="Your conversations" className="mt-4 flex-1 overflow-y-auto border-t border-[var(--glass-border)] px-3 pt-4 pb-3">
            {summaries.length === 0 ? (
              <p className="px-2 text-[0.95rem] text-fg-muted">Your conversations with Morph will show up here.</p>
            ) : (
              groupByDay(summaries).map((group) => (
                <section key={group.label} className="mb-4">
                  <h2 className="mb-1.5 px-2 text-[0.85rem] font-bold tracking-wide text-fg-muted">{group.label}</h2>
                  <ul className="flex flex-col gap-1">
                    <AnimatePresence initial={false}>
                      {group.items.map((item) => {
                        const active = view === 'chat' && current?.id === item.id
                        const busy = thinking.has(item.id)
                        return (
                          <motion.li
                            key={item.id}
                            layout
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                          >
                            <button
                              type="button"
                              aria-current={active ? 'page' : undefined}
                              className={`flex min-h-14 w-full cursor-pointer flex-col justify-center rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--selected)] ${
                                active ? 'bg-[var(--selected)] shadow-[inset_3px_0_0_var(--morph)]' : ''
                              }`}
                              onClick={() => {
                                open(item.id)
                                setView('chat')
                              }}
                            >
                              <span className="line-clamp-1 text-[1rem] font-bold">{item.title}</span>
                              <span className="flex items-center gap-2 text-[0.85rem] text-fg-muted">
                                {busy ? (
                                  <>
                                    <span className="pixel-loader scale-75" aria-hidden="true">
                                      <span />
                                      <span />
                                      <span />
                                    </span>
                                    Morph is answering
                                  </>
                                ) : (
                                  formatWhen(item.updatedAt)
                                )}
                              </span>
                            </button>
                          </motion.li>
                        )
                      })}
                    </AnimatePresence>
                  </ul>
                </section>
              ))
            )}
          </nav>

          <div className="flex flex-col gap-2 border-t border-[var(--glass-border)] p-3">
            <OnlineStatus />
            <button type="button" className="btn btn-quiet min-h-12 w-full justify-start px-4" onClick={onOpenSettings}>
              <SettingsIcon aria-hidden="true" />
              Settings
            </button>
            <button type="button" className="btn btn-quiet min-h-12 w-full justify-start border-transparent px-4" onClick={() => update({ sidebarOpen: false })}>
              <PanelLeftClose aria-hidden="true" />
              Hide this list
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="rail"
          className="flex flex-1 flex-col items-center gap-1 px-2 pt-1 pb-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.1 } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          <MorphMark size={40} thinking={anyThinking} className="mb-2 hidden in-data-[platform=darwin]:block" />
          <RailButton icon={Plus} label="New" onClick={startNew} />
          <RailButton icon={Bell} label="Reminders" active={view === 'reminders'} onClick={() => setView('reminders')} />
          <RailButton icon={Brain} label="Memory" active={view === 'memory'} onClick={() => setView('memory')} />
          <div className="mt-auto flex w-full flex-col gap-1">
            <RailButton icon={SettingsIcon} label="Settings" onClick={onOpenSettings} />
            {!compact && <RailButton icon={PanelLeftOpen} label="Show list" onClick={() => update({ sidebarOpen: true })} />}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </aside>
  )
}
