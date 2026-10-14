import { BrowserWindow, Notification, shell, utilityProcess, type UtilityProcess } from 'electron'
import { join } from 'node:path'
import type { BrowserAction, CoreEvent, CoreSettings } from '@shared/core'
import type { BrowserHost } from './browser-host'
import { Peer, type Transport } from '@shared/rpc'

/**
 * Runs MORPHIC Core as an Electron utility process (a separate Node process, so a crash or a slow
 * model call never freezes the window) and relays between it and the UI. Core asks the host for
 * the few things only a desktop app can do: open a website, show a notification.
 */
export class CoreHost {
  private proc: UtilityProcess | null = null
  private peer: Peer | null = null
  private listeners = new Set<(message: unknown) => void>()
  private restarts = 0
  private settings: Partial<CoreSettings> = {}
  notificationsEnabled = true

  constructor(
    private dataDir: string,
    private window: () => BrowserWindow | null,
    private browser: BrowserHost
  ) {}

  start() {
    const proc = utilityProcess.fork(join(__dirname, 'core.js'), ['--data', this.dataDir], { serviceName: 'MORPHIC Core' })
    this.proc = proc
    this.listeners.clear()
    const transport: Transport = {
      send: (m) => proc.postMessage(m),
      onMessage: (cb) => this.listeners.add(cb)
    }
    proc.on('message', (m) => this.listeners.forEach((cb) => cb(m)))
    const peer = new Peer(transport)
    this.peer = peer

    peer.handle('host.openExternal', async (url: string) => {
      // Core only asks after the person pressed "Open it" on a review card; still, only web links.
      try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
        if (process.env.MORPHIC_E2E) return true
        await shell.openExternal(parsed.toString())
        return true
      } catch {
        return false
      }
    })

    // Core's browsing tasks drive the built-in browser through these.
    peer.handle('browser.open', (url: string) => this.browser.open(url))
    peer.handle('browser.snapshot', () => this.browser.snapshot())
    peer.handle('browser.act', (action: BrowserAction) => this.browser.act(action))
    peer.handle('browser.driving', (on: boolean) => this.browser.driving(on === true))

    peer.onEvent((event) => this.onEvent(event as CoreEvent))
    if (Object.keys(this.settings).length) void peer.request('configure', this.settings)

    proc.on('exit', () => {
      peer.failAll('Morph restarted')
      if (this.proc !== proc) return
      this.proc = null
      // Restart with backoff; the conversation files are safe on disk.
      const delay = Math.min(30_000, 500 * 2 ** this.restarts++)
      setTimeout(() => this.start(), delay).unref?.()
    })
  }

  stop() {
    const proc = this.proc
    this.proc = null
    proc?.kill()
  }

  configure(settings: Partial<CoreSettings>) {
    this.settings = { ...this.settings, ...settings }
    void this.peer?.request('configure', settings).catch(() => {})
  }

  call(method: string, params: unknown[]) {
    if (!this.peer) return Promise.reject(new Error('Morph is starting'))
    return this.peer.request(method, ...params)
  }

  private onEvent(event: CoreEvent) {
    this.restarts = 0
    const win = this.window()
    if (event.type === 'reminder.due' && this.notificationsEnabled && Notification.isSupported()) {
      const notice = new Notification({ title: 'Reminder from Morph', body: event.reminder.text, silent: false })
      notice.on('click', () => {
        if (!win) return
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      })
      notice.show()
    }
    win?.webContents.send('core:event', event)
  }
}
