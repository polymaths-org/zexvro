/// <reference lib="dom" />
// DOM lib above: page.evaluate callbacks run inside the app window.
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const appDir = join(__dirname, '..')
const shots = process.env.MORPHIC_SHOTS ?? join(appDir, 'test-results', 'shots')

export const shot = (page: Page, name: string) => page.screenshot({ path: join(shots, `${name}.png`) })

/** A fresh app profile. The opening animation is off unless a test turns it on. */
export function profile(settings?: object) {
  const dir = mkdtempSync(join(tmpdir(), 'morphic-e2e-'))
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ introAnimation: false, ...settings }))
  return dir
}

export async function launch(userData: string, vroaiUrl: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [appDir],
    env: { ...process.env, MORPHIC_USER_DATA: userData, VROAI_URL: vroaiUrl, MORPHIC_PROVIDER: 'vroai', MORPHIC_E2E: '1' }
  })
  return { app, page: await app.firstWindow() }
}

/** A stand-in VROAI with the same contract: POST {prompt} → {success, response}; GET → 405. */
export class FakeVroai {
  prompts: string[] = []
  /** Replies used in order (one per request); when empty, `reply` is used. */
  queue: string[] = []
  reply = 'Hello! I can help with that.'
  delayMs = 500
  fail = false
  private server: Server | null = null

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' }).end('{"error":"Only POST requests allowed"}')
        return
      }
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        const { prompt } = JSON.parse(body || '{}')
        this.prompts.push(prompt)
        setTimeout(() => {
          if (res.destroyed) return
          if (this.fail) {
            res.writeHead(500, { 'Content-Type': 'application/json' }).end('{"error":"boom"}')
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true, prompt, response: this.queue.shift() ?? this.reply, model: 'test' }))
          }
        }, this.delayMs)
      })
    })
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${(this.server!.address() as AddressInfo).port}`
  }

  stop() {
    this.server?.closeAllConnections()
    this.server?.close()
  }
}

/** A tiny train-booking website for browsing tests: search form → results → booking confirmation. */
export class TestSite {
  bookings: string[] = []
  private server: Server | null = null

  async start(): Promise<string> {
    const page = (body: string) => `<!doctype html><html><head><title>Rail Desk</title><style>body{font:18px system-ui;padding:24px}input,button{font:inherit;margin:6px 0;display:block;padding:8px}</style></head><body>${body}</body></html>`
    this.server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://x')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      if (url.pathname === '/results') {
        res.end(page(`<h1>Trains from ${url.searchParams.get('from')} to ${url.searchParams.get('to')}</h1><p>08:05 Deccan Express, seats available</p><form method="post" action="/book"><button type="submit">Book now</button></form>`))
      } else if (url.pathname === '/book' && req.method === 'POST') {
        this.bookings.push('08:05')
        res.end(page('<h1>Booked!</h1><p>Your ticket number is ZX123.</p>'))
      } else {
        res.end(page('<h1>Book a train</h1><form action="/results"><label>From <input name="from"></label><label>To <input name="to"></label><button type="submit">Search</button></form>'))
      }
    })
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${(this.server!.address() as AddressInfo).port}`
  }

  stop() {
    this.server?.closeAllConnections()
    this.server?.close()
  }
}
