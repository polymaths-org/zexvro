import { createContext, useContext, useState, type ReactNode } from 'react'

/** What the main area shows: the chat (home or a conversation) or one of the pages. */
export type View = 'chat' | 'reminders' | 'memory' | 'activity'

const ViewContext = createContext<{ view: View; setView: (view: View) => void } | null>(null)

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('chat')
  return <ViewContext.Provider value={{ view, setView }}>{children}</ViewContext.Provider>
}

export function useView() {
  const ctx = useContext(ViewContext)
  if (!ctx) throw new Error('useView must be used inside ViewProvider')
  return ctx
}
