import type { Settings } from '../shared/settings'
import type { Session, SessionSummary } from '../shared/sessions'
import type { CoreEvent, CoreMethod, CoreParams, CoreResult, PageSnapshot } from '../shared/core'
import type { BrowserState } from '../main/browser-host'

export interface MorphicApi {
  platform: string
  /** Calls MORPHIC Core directly (memory, reminders, approvals, activity…). */
  core: <M extends CoreMethod>(method: M, ...params: CoreParams<M>) => Promise<Awaited<CoreResult<M>>>
  onCoreEvent: (listener: (event: CoreEvent) => void) => () => void
  settings: {
    get: () => Promise<Settings>
    set: (patch: Partial<Settings>) => Promise<Settings>
  }
  sessions: {
    list: () => Promise<SessionSummary[]>
    get: (id: string) => Promise<Session | null>
    rename: (id: string, title: string) => Promise<Session | null>
    delete: (id: string) => Promise<void>
    /** Deletes every saved conversation. */
    clear: () => Promise<void>
  }
  chat: {
    /** Adds the question to the conversation (creating it if new) and resolves with Morph's answer included. */
    send: (id: string, text: string) => Promise<Session | null>
    retry: (id: string) => Promise<Session | null>
    stop: (id: string) => Promise<void>
  }
  copy: (text: string) => Promise<void>
  /** Whether Morph's AI service can be reached right now. */
  online: () => Promise<boolean>
  /** Morph's built-in browser (a native view the main process places over the panel's placeholder). */
  browser: {
    setBounds: (rect: { x: number; y: number; width: number; height: number } | null) => void
    /** An in-app window (Settings, a dialog) is covering the browser: hide the native view meanwhile. */
    overlay: (on: boolean) => void
    show: () => void
    close: () => void
    navigate: (url: string) => void
    back: () => void
    forward: () => void
    reload: () => void
    snapshot: () => Promise<PageSnapshot | null>
    clearData: () => Promise<void>
    onState: (listener: (state: BrowserState) => void) => () => void
  }
  /** Tells the window which colours to use for its native buttons and background. */
  setWindowColors: (background: string, symbols: string) => void
}

declare global {
  interface Window {
    morphic: MorphicApi
  }
}
