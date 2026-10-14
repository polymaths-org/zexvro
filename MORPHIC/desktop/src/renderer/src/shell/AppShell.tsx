import { useEffect, useState } from 'react'
import { AnimatePresence, LayoutGroup } from 'motion/react'
import { useSessions } from '@/chat/sessions'
import { Conversation } from '@/chat/Conversation'
import { Home } from '@/home/Home'
import { SettingsSheet } from '@/settings/SettingsSheet'
import { RemindersPage } from '@/reminders/RemindersPage'
import { DueBanner } from '@/reminders/DueBanner'
import { MemoryPage } from '@/memory/MemoryPage'
import { ActivityPage } from '@/memory/ActivityPage'
import { Sidebar } from './Sidebar'
import { ConversationHeader } from './ConversationHeader'
import { useView } from './view'
import { BrowserStage } from '@/browser/BrowserPanel'
import { ChatSide } from '@/browser/ChatSide'
import { useBrowser } from '@/browser/browser'

export function AppShell() {
  const { current, goHome, thinking } = useSessions()
  const { view, setView } = useView()
  const browserState = useBrowser()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chatWide, setChatWide] = useState(false)
  // Browser mode: the browser takes the middle in 16:9, the chat moves to a rounded panel on the right,
  // and the sidebar shrinks to its slim strip.
  const browserMode = browserState.open && view === 'chat'
  const busy = current ? thinking.has(current.id) : false

  // Ctrl/⌘+N: new conversation. Ctrl/⌘+,: Settings. (Listed in Settings → Keyboard shortcuts.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        goHome()
        setView('chat')
      } else if (e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [goHome, setView])

  return (
    <div className="relative z-10 flex h-screen">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} compact={browserMode} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Drag strip; on Windows/Linux the native window buttons sit over its right end. */}
        <header className="titlebar flex h-14 shrink-0 items-center gap-3 pr-[calc(100vw-env(titlebar-area-x,0px)-env(titlebar-area-width,100vw)+1rem)] pl-6">
          {view === 'chat' && current && <ConversationHeader key={current.id} />}
        </header>
        {browserMode ? (
          <div className="flex min-h-0 flex-1 gap-3 pr-2 pb-2">
            <AnimatePresence>
              <BrowserStage key="browser" />
            </AnimatePresence>
            <ChatSide wide={chatWide} onToggleWide={() => setChatWide((w) => !w)} thinking={busy}>
              {/* The banner lives in the chat panel here: the native browser view would cover the middle. */}
              <div className="relative h-full">
                <LayoutGroup>{current ? <Conversation /> : <Home />}</LayoutGroup>
                <DueBanner />
              </div>
            </ChatSide>
          </div>
        ) : (
          <main className="relative min-h-0 flex-1">
            {/* Home and Conversation share layout ids, so Morph and the ask box glide between them. */}
            {view === 'chat' && <LayoutGroup>{current ? <Conversation /> : <Home />}</LayoutGroup>}
            {view === 'reminders' && <RemindersPage />}
            {view === 'memory' && <MemoryPage />}
            {view === 'activity' && <ActivityPage />}
            <DueBanner />
          </main>
        )}
      </div>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} onNavigate={setView} />}
    </div>
  )
}
