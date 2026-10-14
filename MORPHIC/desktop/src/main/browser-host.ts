import { BrowserWindow, session as electronSession, WebContentsView, type Rectangle } from 'electron'
import type { BrowserAction, PageSnapshot } from '@shared/core'

/**
 * Morph's built-in browser: a real web view embedded in the window beside the chat. The person can browse
 * in it themselves; Morph drives it during a browsing task while they watch. Page reading and actions run in
 * an isolated script world, so the website's own scripts can't tamper with what Morph sees or does.
 */

export interface BrowserState {
  open: boolean
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  /** Morph is driving right now (vs. the person). */
  driving: boolean
  /** A still picture of the page, shown while an in-app window (Settings, a dialog) covers the area. */
  still?: string
}

const PARTITION = 'persist:morph-browser'
const WORLD = 1717
const LOAD_TIMEOUT = 20_000

/** Reads the page: numbered interactive elements plus visible text. Runs in the isolated world. */
const SNAPSHOT = `(() => {
  document.querySelectorAll('[data-morph-id]').forEach((e) => e.removeAttribute('data-morph-id'))
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=checkbox], [role=tab], [role=menuitem], [role=option], [onclick], [contenteditable=true]'
  const visible = (el) => {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el)
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > -100 && r.top < innerHeight + 1500
  }
  const clean = (t) => (t || '').replace(/\\s+/g, ' ').trim().slice(0, 80)
  const labelOf = (el) => clean(el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].innerText) || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt') || el.innerText || el.getAttribute('name') || (el.tagName === 'INPUT' && /submit|button/.test(el.type) ? el.value : ''))
  const out = []; let n = 0
  for (const el of document.querySelectorAll(sel)) {
    if (n >= 120) break
    if (!visible(el)) continue
    const id = ++n; el.setAttribute('data-morph-id', String(id))
    const tag = el.tagName.toLowerCase(); const type = (el.getAttribute('type') || '').toLowerCase()
    const hints = ((el.getAttribute('autocomplete') || '') + ' ' + (el.name || '') + ' ' + (el.id || '')).toLowerCase()
    const sensitive = type === 'password' || /cc-|one-time-code|otp|\\bpin\\b|cvv|card.?num|password/.test(hints)
    const field = tag === 'input' || tag === 'textarea' || tag === 'select'
    out.push({
      id, tag,
      role: el.getAttribute('role') || (tag === 'a' ? 'link' : tag === 'input' ? (type || 'text') + ' box' : tag === 'textarea' ? 'text box' : tag),
      label: labelOf(el),
      value: field ? (sensitive ? (el.value ? '(filled)' : '') : String(el.value).slice(0, 60)) : undefined,
      sensitive: sensitive || undefined,
      submit: (type === 'submit' || (tag === 'button' && el.type === 'submit' && !!el.form)) || undefined,
      href: tag === 'a' ? String(el.href).slice(0, 120) : undefined,
      options: tag === 'select' ? Array.from(el.options).slice(0, 15).map((o) => clean(o.text)) : undefined
    })
  }
  const text = (document.body ? document.body.innerText : '').replace(/[ \\t]+/g, ' ').replace(/\\n\\s*\\n+/g, '\\n').slice(0, 3500)
  return { url: location.href, title: document.title, text, elements: out }
})()`

/** Shows the person what Morph is about to do: a glowing outline and a label, then does it. */
const ACT = (action: BrowserAction) => `(async (a) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const old = document.getElementById('__morph_mark'); if (old) old.remove()
  if (a.do === 'scroll') { window.scrollBy({ top: (a.dir === 'up' ? -1 : 1) * innerHeight * 0.8, behavior: 'smooth' }); await sleep(300); return { ok: true } }
  if (a.do === 'back') { history.back(); return { ok: true } }
  const el = document.querySelector('[data-morph-id="' + a.id + '"]')
  if (!el) return { ok: false, note: 'that part of the page has changed' }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' }); await sleep(250)
  const r = el.getBoundingClientRect()
  const mark = document.createElement('div'); mark.id = '__morph_mark'
  mark.setAttribute('style', 'position:fixed;z-index:2147483647;pointer-events:none;left:' + (r.left - 6) + 'px;top:' + (r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px;border:3px solid #9c97ec;border-radius:12px;box-shadow:0 0 0 6px rgba(156,151,236,.25),0 0 24px rgba(156,151,236,.6);transition:opacity .3s;')
  const tag = document.createElement('div')
  tag.textContent = a.do === 'type' ? 'Morph is typing here' : a.do === 'select' ? 'Morph is choosing here' : 'Morph is pressing this'
  tag.setAttribute('style', 'position:absolute;left:-3px;top:-34px;padding:4px 10px;border-radius:999px;background:#2a2550;color:#fff;font:600 13px system-ui,sans-serif;white-space:nowrap;')
  mark.appendChild(tag); document.documentElement.appendChild(mark)
  await sleep(350)
  try {
    if (a.do === 'click') { el.focus && el.focus(); el.click() }
    else if (a.do === 'type') {
      el.focus()
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const set = Object.getOwnPropertyDescriptor(proto, 'value').set
      const text = String(a.text)
      // Type visibly, letter by letter, so the person can follow (short text only).
      if (text.length <= 30) { set.call(el, ''); for (const ch of text) { set.call(el, el.value + ch); el.dispatchEvent(new Event('input', { bubbles: true })); await sleep(18) } }
      else { set.call(el, text); el.dispatchEvent(new Event('input', { bubbles: true })) }
      el.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (a.do === 'select') {
      const want = String(a.option).toLowerCase()
      const opt = Array.from(el.options || []).find((o) => o.text.toLowerCase().includes(want) || o.value.toLowerCase() === want)
      if (!opt) return { ok: false, note: 'that choice is not in the list' }
      el.value = opt.value; el.dispatchEvent(new Event('change', { bubbles: true }))
    }
  } finally { setTimeout(() => { mark.style.opacity = '0'; setTimeout(() => mark.remove(), 300) }, 400) }
  return { ok: true }
})(${JSON.stringify(action)})`

const isWeb = (url: string) => /^https?:\/\//i.test(url)

export class BrowserHost {
  private view: WebContentsView | null = null
  private bounds: Rectangle | null = null
  private overlays = 0
  private state: BrowserState = { open: false, url: '', title: '', loading: false, canGoBack: false, canGoForward: false, driving: false }

  constructor(
    private window: () => BrowserWindow | null,
    private send: (state: BrowserState) => void
  ) {}

  private ensureView(): WebContentsView {
    if (this.view) return this.view
    const ses = electronSession.fromPartition(PARTITION)
    // Websites get no camera, mic, location, notifications etc., and nothing is downloaded silently.
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    ses.on('will-download', (event) => event.preventDefault())
    const view = new WebContentsView({ webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false } })
    view.setBorderRadius(18)
    const wc = view.webContents
    // Pop-ups open in the same view; only web addresses are allowed.
    wc.setWindowOpenHandler(({ url }) => {
      if (isWeb(url)) void wc.loadURL(url)
      return { action: 'deny' }
    })
    wc.on('will-navigate', (event, url) => {
      if (!isWeb(url)) event.preventDefault()
    })
    const sync = () => this.update({})
    for (const e of ['did-navigate', 'did-navigate-in-page', 'page-title-updated', 'did-start-loading', 'did-stop-loading'] as const) wc.on(e as 'did-stop-loading', sync)
    this.window()?.contentView.addChildView(view)
    this.view = view
    return view
  }

  private update(patch: Partial<BrowserState>) {
    const wc = this.view?.webContents
    this.state = {
      ...this.state,
      ...(wc
        ? {
            url: wc.getURL(),
            title: wc.getTitle(),
            loading: wc.isLoading(),
            canGoBack: wc.navigationHistory.canGoBack(),
            canGoForward: wc.navigationHistory.canGoForward()
          }
        : {}),
      ...patch
    }
    this.layout()
    this.send(this.state)
  }

  /** The native view sits exactly over the panel's placeholder, and hides while in-app windows cover it. */
  private layout() {
    const view = this.view
    if (!view) return
    const visible = this.state.open && !!this.bounds && this.overlays === 0
    view.setVisible(visible)
    if (this.bounds) {
      const b = this.bounds
      view.setBounds({ x: Math.round(b.x), y: Math.round(b.y), width: Math.max(1, Math.round(b.width)), height: Math.max(1, Math.round(b.height)) })
    }
  }

  setBounds(rect: Rectangle | null) {
    this.bounds = rect
    this.layout()
  }

  async setOverlay(on: boolean) {
    this.overlays = Math.max(0, this.overlays + (on ? 1 : -1))
    if (on && this.overlays === 1 && this.view && this.state.open) {
      // Keep a picture in place so the panel isn't blank while a dialog is open.
      const image = await this.view.webContents.capturePage().catch(() => null)
      this.update({ still: image && !image.isEmpty() ? image.toDataURL() : undefined })
    } else this.update(this.overlays === 0 ? { still: undefined } : {})
  }

  show() {
    this.ensureView()
    this.update({ open: true })
  }

  close() {
    this.update({ open: false, driving: false })
  }

  /** Opens an address and waits for it to load (or gives up after a while). */
  async open(url: string): Promise<{ ok: boolean; url: string; title: string }> {
    if (!isWeb(url)) return { ok: false, url, title: '' }
    const view = this.ensureView()
    this.update({ open: true })
    try {
      await Promise.race([view.webContents.loadURL(url), new Promise((r) => setTimeout(r, LOAD_TIMEOUT))])
    } catch {
      // Load errors (e.g. a redirect aborting the first load) still leave a usable page in most cases.
    }
    this.update({})
    return { ok: isWeb(view.webContents.getURL()), url: view.webContents.getURL(), title: view.webContents.getTitle() }
  }

  async snapshot(): Promise<PageSnapshot | null> {
    const wc = this.view?.webContents
    if (!wc || !isWeb(wc.getURL())) return null
    try {
      return (await wc.executeJavaScriptInIsolatedWorld(WORLD, [{ code: SNAPSHOT }])) as PageSnapshot
    } catch {
      return null
    }
  }

  async act(action: BrowserAction): Promise<{ ok: boolean; note?: string; navigated?: boolean }> {
    const wc = this.view?.webContents
    if (!wc) return { ok: false, note: 'the browser is closed' }
    try {
      const before = wc.getURL()
      const result = (await wc.executeJavaScriptInIsolatedWorld(WORLD, [{ code: ACT(action) }], true)) as { ok: boolean; note?: string }
      // Give the page a moment to react (and to finish loading if the action navigated).
      await new Promise((r) => setTimeout(r, 200))
      const started = Date.now()
      while (wc.isLoading() && Date.now() - started < 6000) await new Promise((r) => setTimeout(r, 100))
      this.update({})
      return { ...(result ?? { ok: false }), navigated: wc.getURL() !== before }
    } catch {
      return { ok: false, note: "that didn't work on this page" }
    }
  }

  driving(on: boolean) {
    this.update({ driving: on })
  }

  navigate(url: string) {
    const target = isWeb(url) ? url : /^[\w-]+(\.[\w-]+)+/.test(url) ? `https://${url}` : `https://duckduckgo.com/?q=${encodeURIComponent(url)}`
    void this.open(target)
  }

  back() {
    this.view?.webContents.navigationHistory.goBack()
  }

  forward() {
    this.view?.webContents.navigationHistory.goForward()
  }

  reload() {
    this.view?.webContents.reload()
  }

  /** Signs Morph's browser out of every website (cookies, storage, cache). */
  async clearData() {
    await electronSession.fromPartition(PARTITION).clearStorageData()
    await electronSession.fromPartition(PARTITION).clearCache()
  }
}
