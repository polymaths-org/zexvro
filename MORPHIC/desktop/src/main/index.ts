import { app, BrowserWindow, clipboard, ipcMain, nativeTheme, session } from 'electron'
import { join } from 'node:path'
import { loadSettings, saveSettings } from './settings-store'
import { CORE_METHODS, type CoreMethod } from '@shared/core'
import type { Settings } from '@shared/settings'
import { CoreHost } from './core-host'
import { BrowserHost } from './browser-host'

// Lets e2e tests (and multiple dev profiles) run against a throwaway profile.
if (process.env.MORPHIC_USER_DATA) app.setPath('userData', process.env.MORPHIC_USER_DATA)

const TITLEBAR_HEIGHT = 56
const HEX = /^#[0-9a-f]{6}$/i

let win: BrowserWindow | null = null
let core: CoreHost | null = null
let browser: BrowserHost | null = null

const coreSettings = (s: Settings) => ({
  name: s.name,
  language: s.language,
  answerLength: s.answerLength,
  memory: s.memory,
  serviceUrl: s.serviceUrl,
  personality: s.personality,
  browser: s.browser,
  askBeforeBrowsing: s.askBeforeBrowsing
})

function applySystemSettings(s: Settings) {
  if (core) core.notificationsEnabled = s.notifications
  // Start at login is supported by the OS on Windows and macOS only.
  if (process.platform !== 'linux') app.setLoginItemSettings({ openAtLogin: s.openAtLogin })
}
// Until the renderer reports its theme colours, guess from the OS so the first frame isn't a white flash.
let chromeColors: { background: string; symbols: string } | null = null

function chrome() {
  if (chromeColors) return chromeColors
  return nativeTheme.shouldUseDarkColors
    ? { background: '#0B0A12', symbols: '#F4F3FF' }
    : { background: '#F5F4FB', symbols: '#17152B' }
}

function createWindow() {
  const isMac = process.platform === 'darwin'
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: 'Morph',
    backgroundColor: chrome().background,
    // Custom title bar, but keep the native minimise/maximise/close buttons people already know.
    titleBarStyle: 'hidden',
    ...(isMac
      ? { trafficLightPosition: { x: 20, y: 20 } }
      : {
          titleBarOverlay: {
            color: chrome().background,
            symbolColor: chrome().symbols,
            height: TITLEBAR_HEIGHT
          }
        }),
    ...(process.platform === 'linux' ? { icon: join(__dirname, '../../resources/icon.png') } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  })

  win.once('ready-to-show', () => win?.show())

  // The app window only ever shows Morph's own UI. Websites open in the built-in browser (browser-host.ts).
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win?.webContents.getURL()) event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function syncWindowChrome() {
  if (!win || process.platform === 'darwin') return
  win.setTitleBarOverlay({ color: chrome().background, symbolColor: chrome().symbols, height: TITLEBAR_HEIGHT })
  win.setBackgroundColor(chrome().background)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.whenReady().then(() => {
    nativeTheme.themeSource = loadSettings().theme
    nativeTheme.on('updated', syncWindowChrome)

    // No camera, mic, location, notifications etc. until a feature actually asks for them.
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))

    // The renderer owns the colour theme; it reports the resolved colours so the native window
    // buttons and the background behind the page match.
    ipcMain.on('window:chrome', (_event, colors: { background?: unknown; symbols?: unknown }) => {
      if (typeof colors?.background !== 'string' || typeof colors?.symbols !== 'string') return
      if (!HEX.test(colors.background) || !HEX.test(colors.symbols)) return
      chromeColors = { background: colors.background, symbols: colors.symbols }
      syncWindowChrome()
    })

    // MORPHIC Core runs in its own process; the UI may only call the methods on the allow-list.
    browser = new BrowserHost(
      () => win,
      (state) => win?.webContents.send('browser:state', state)
    )
    core = new CoreHost(app.getPath('userData'), () => win, browser)
    core.start()
    core.configure(coreSettings(loadSettings()))
    applySystemSettings(loadSettings())
    ipcMain.handle('core:call', (_event, method: unknown, params: unknown) => {
      if (!CORE_METHODS.includes(method as CoreMethod)) throw new Error('Not allowed')
      return core!.call(method as string, Array.isArray(params) ? params : [])
    })
    // The sandboxed renderer can't reach the clipboard directly; copying answers goes through here.
    ipcMain.handle('clipboard:write', (_e, text: unknown) => {
      if (typeof text === 'string') clipboard.writeText(text.slice(0, 20_000))
    })

    // The browser panel in the UI: where to draw the web view, and the person's own browsing.
    ipcMain.on('browser:bounds', (_e, rect: unknown) => {
      const r = rect as { x?: unknown; y?: unknown; width?: unknown; height?: unknown } | null
      browser?.setBounds(r && [r.x, r.y, r.width, r.height].every((v) => typeof v === 'number') ? (r as Electron.Rectangle) : null)
    })
    ipcMain.on('browser:overlay', (_e, on: unknown) => void browser?.setOverlay(on === true))
    ipcMain.on('browser:show', () => browser?.show())
    ipcMain.on('browser:close', () => browser?.close())
    ipcMain.on('browser:navigate', (_e, url: unknown) => typeof url === 'string' && browser?.navigate(url.slice(0, 2000)))
    ipcMain.on('browser:back', () => browser?.back())
    ipcMain.on('browser:forward', () => browser?.forward())
    ipcMain.on('browser:reload', () => browser?.reload())
    ipcMain.handle('browser:snapshot', () => browser?.snapshot() ?? null)
    ipcMain.handle('browser:clear-data', () => browser?.clearData())

    ipcMain.handle('settings:get', () => loadSettings())
    ipcMain.handle('settings:set', (_event, patch: unknown) => {
      const next = saveSettings(patch)
      nativeTheme.themeSource = next.theme
      core?.configure(coreSettings(next))
      applySystemSettings(next)
      return next
    })

    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => core?.stop())

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
