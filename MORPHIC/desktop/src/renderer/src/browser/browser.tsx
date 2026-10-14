import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { BrowserState } from '../../../main/browser-host'

const CLOSED: BrowserState = { open: false, url: '', title: '', loading: false, canGoBack: false, canGoForward: false, driving: false }

const BrowserContext = createContext<BrowserState>(CLOSED)

/** Mirrors the main process's browser state (open, address, loading, whether Morph is driving). */
export function BrowserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BrowserState>(CLOSED)
  useEffect(() => window.morphic.browser.onState(setState), [])
  return <BrowserContext.Provider value={state}>{children}</BrowserContext.Provider>
}

export const useBrowser = () => useContext(BrowserContext)
export const browser = window.morphic.browser
