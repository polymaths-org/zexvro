/**
 * ZEXVRO Arcade — original canvas platformer engine (no third-party game lib).
 * Designed for Lakebed (Preact + canvas) and Morph Web2→Web3 demos.
 */

export type SkinId = 'default' | 'neon' | 'gold'

export type SkinPalette = {
  body: string
  accent: string
  glow: string
  eye: string
}

export const SKINS: Record<
  SkinId,
  { label: string; lockedWeb2: boolean; palette: SkinPalette }
> = {
  default: {
    label: 'Classic',
    lockedWeb2: false,
    palette: { body: '#22d3ee', accent: '#0891b2', glow: '#22d3ee55', eye: '#0f172a' },
  },
  neon: {
    label: 'Neon',
    lockedWeb2: true,
    palette: { body: '#a3e635', accent: '#65a30d', glow: '#a3e63566', eye: '#052e16' },
  },
  gold: {
    label: 'Gold',
    lockedWeb2: true,
    palette: { body: '#fbbf24', accent: '#d97706', glow: '#fbbf2466', eye: '#422006' },
  },
}

export type Rect = { x: number; y: number; w: number; h: number }

export type LevelSpec = {
  width: number
  height: number
  playerStart: { x: number; y: number }
  platforms: Rect[]
  coins: { x: number; y: number }[]
  spikes: Rect[]
  enemies: { x: number; y: number; left: number; right: number; speed: number }[]
  goal: Rect
}

/** Hand-authored level — readable for Morph to extend later. */
export const LEVEL_1: LevelSpec = {
  width: 3200,
  height: 480,
  playerStart: { x: 64, y: 320 },
  platforms: [
    { x: 0, y: 440, w: 3200, h: 40 }, // floor
    { x: 180, y: 360, w: 120, h: 18 },
    { x: 360, y: 300, w: 100, h: 18 },
    { x: 520, y: 240, w: 140, h: 18 },
    { x: 720, y: 320, w: 100, h: 18 },
    { x: 900, y: 280, w: 160, h: 18 },
    { x: 1120, y: 220, w: 100, h: 18 },
    { x: 1280, y: 340, w: 180, h: 18 },
    { x: 1520, y: 280, w: 120, h: 18 },
    { x: 1700, y: 200, w: 140, h: 18 },
    { x: 1920, y: 300, w: 200, h: 18 },
    { x: 2200, y: 240, w: 120, h: 18 },
    { x: 2400, y: 180, w: 100, h: 18 },
    { x: 2580, y: 300, w: 220, h: 18 },
    { x: 2860, y: 240, w: 160, h: 18 },
    // floating pads
    { x: 640, y: 160, w: 80, h: 16 },
    { x: 1480, y: 140, w: 80, h: 16 },
    { x: 2100, y: 120, w: 90, h: 16 },
  ],
  coins: [
    { x: 220, y: 320 },
    { x: 400, y: 260 },
    { x: 560, y: 200 },
    { x: 760, y: 280 },
    { x: 940, y: 240 },
    { x: 1160, y: 180 },
    { x: 1340, y: 300 },
    { x: 1560, y: 240 },
    { x: 1740, y: 160 },
    { x: 1980, y: 260 },
    { x: 2240, y: 200 },
    { x: 2440, y: 140 },
    { x: 2660, y: 260 },
    { x: 2920, y: 200 },
    { x: 660, y: 120 },
    { x: 1500, y: 100 },
    { x: 2120, y: 80 },
  ],
  spikes: [
    { x: 480, y: 424, w: 40, h: 16 },
    { x: 840, y: 424, w: 48, h: 16 },
    { x: 1400, y: 424, w: 56, h: 16 },
    { x: 1840, y: 424, w: 40, h: 16 },
    { x: 2340, y: 424, w: 48, h: 16 },
  ],
  enemies: [
    { x: 600, y: 400, left: 560, right: 700, speed: 70 },
    { x: 1000, y: 400, left: 940, right: 1100, speed: 90 },
    { x: 1600, y: 400, left: 1540, right: 1720, speed: 80 },
    { x: 2000, y: 400, left: 1940, right: 2140, speed: 100 },
    { x: 2500, y: 400, left: 2440, right: 2680, speed: 85 },
  ],
  goal: { x: 3040, y: 160, w: 40, h: 80 },
}

export type GameSnapshot = {
  score: number
  coins: number
  lives: number
  won: boolean
  dead: boolean
  timeMs: number
}

type Enemy = {
  x: number
  y: number
  w: number
  h: number
  left: number
  right: number
  speed: number
  dir: number
  alive: boolean
}

type Coin = { x: number; y: number; r: number; taken: boolean }

export class PlatformerGame {
  readonly canvas: HTMLCanvasElement
  readonly level: LevelSpec
  private ctx: CanvasRenderingContext2D
  private keys = new Set<string>()
  private skin: SkinId = 'default'
  private raf = 0
  private last = 0
  private running = false

  private px = 0
  private py = 0
  private vx = 0
  private vy = 0
  private onGround = false
  private facing = 1
  private invuln = 0

  private camX = 0
  private enemies: Enemy[] = []
  private coins: Coin[] = []
  private score = 0
  private coinCount = 0
  private lives = 3
  private won = false
  private dead = false
  private timeMs = 0
  private anim = 0

  private onEnd?: (snap: GameSnapshot) => void

  constructor(canvas: HTMLCanvasElement, level: LevelSpec = LEVEL_1) {
    this.canvas = canvas
    this.level = level
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    this.ctx = ctx
    this.reset()
  }

  setSkin(skin: SkinId) {
    this.skin = skin
  }

  setOnEnd(cb: (snap: GameSnapshot) => void) {
    this.onEnd = cb
  }

  snapshot(): GameSnapshot {
    return {
      score: this.score,
      coins: this.coinCount,
      lives: this.lives,
      won: this.won,
      dead: this.dead,
      timeMs: this.timeMs,
    }
  }

  reset() {
    this.px = this.level.playerStart.x
    this.py = this.level.playerStart.y
    this.vx = 0
    this.vy = 0
    this.onGround = false
    this.facing = 1
    this.invuln = 0
    this.camX = 0
    this.score = 0
    this.coinCount = 0
    this.lives = 3
    this.won = false
    this.dead = false
    this.timeMs = 0
    this.anim = 0
    this.enemies = this.level.enemies.map((e) => ({
      x: e.x,
      y: e.y,
      w: 28,
      h: 28,
      left: e.left,
      right: e.right,
      speed: e.speed,
      dir: 1,
      alive: true,
    }))
    this.coins = this.level.coins.map((c) => ({ x: c.x, y: c.y, r: 8, taken: false }))
  }

  start() {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    const loop = (t: number) => {
      if (!this.running) return
      const dt = Math.min(0.033, (t - this.last) / 1000)
      this.last = t
      this.update(dt)
      this.draw()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  destroy() {
    this.stop()
    this.detachInput()
  }

  attachInput() {
    const down = (e: KeyboardEvent) => {
      this.keys.add(e.key.toLowerCase())
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase()) || e.code === 'Space') {
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => {
      this.keys.delete(e.key.toLowerCase())
    }
    window.addEventListener('keydown', down, { passive: false })
    window.addEventListener('keyup', up)
    ;(this as unknown as { _kd?: typeof down; _ku?: typeof up })._kd = down
    ;(this as unknown as { _kd?: typeof down; _ku?: typeof up })._ku = up
  }

  detachInput() {
    const self = this as unknown as { _kd?: (e: KeyboardEvent) => void; _ku?: (e: KeyboardEvent) => void }
    if (self._kd) window.removeEventListener('keydown', self._kd)
    if (self._ku) window.removeEventListener('keyup', self._ku)
  }

  /** Mobile / UI virtual buttons */
  press(key: string) {
    this.keys.add(key)
  }
  release(key: string) {
    this.keys.delete(key)
  }

  private left() {
    return this.keys.has('a') || this.keys.has('arrowleft')
  }
  private right() {
    return this.keys.has('d') || this.keys.has('arrowright')
  }
  private jump() {
    return this.keys.has('w') || this.keys.has('arrowup') || this.keys.has(' ') || this.keys.has('space')
  }

  private rectsOverlap(a: Rect, b: Rect) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  }

  private update(dt: number) {
    if (this.won || this.dead) return
    this.timeMs += dt * 1000
    this.anim += dt
    if (this.invuln > 0) this.invuln -= dt

    const accel = 1400
    const maxRun = 220
    const friction = 0.82
    const gravity = 1600
    const jumpV = -520

    if (this.left()) {
      this.vx -= accel * dt
      this.facing = -1
    } else if (this.right()) {
      this.vx += accel * dt
      this.facing = 1
    } else {
      this.vx *= friction
    }
    this.vx = Math.max(-maxRun, Math.min(maxRun, this.vx))

    if (this.jump() && this.onGround) {
      this.vy = jumpV
      this.onGround = false
    }

    this.vy += gravity * dt
    if (this.vy > 900) this.vy = 900

    // Horizontal move + collide
    this.px += this.vx * dt
    this.resolveX()

    // Vertical
    this.py += this.vy * dt
    this.onGround = false
    this.resolveY()

    // World bounds
    if (this.px < 0) this.px = 0
    if (this.px > this.level.width - 28) this.px = this.level.width - 28
    if (this.py > this.level.height + 80) this.hurt()

    // Coins
    const player: Rect = { x: this.px, y: this.py, w: 26, h: 34 }
    for (const c of this.coins) {
      if (c.taken) continue
      const cr = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 }
      if (this.rectsOverlap(player, cr)) {
        c.taken = true
        this.coinCount += 1
        this.score += 100
      }
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue
      e.x += e.dir * e.speed * dt
      if (e.x < e.left) {
        e.x = e.left
        e.dir = 1
      }
      if (e.x > e.right) {
        e.x = e.right
        e.dir = -1
      }
      const er = { x: e.x, y: e.y, w: e.w, h: e.h }
      if (!this.rectsOverlap(player, er) || this.invuln > 0) continue
      // stomp
      if (this.vy > 0 && this.py + 34 - e.y < 18) {
        e.alive = false
        this.vy = -320
        this.score += 250
      } else {
        this.hurt()
      }
    }

    // Spikes
    for (const s of this.level.spikes) {
      if (this.rectsOverlap(player, s) && this.invuln <= 0) this.hurt()
    }

    // Goal
    if (this.rectsOverlap(player, this.level.goal)) {
      this.won = true
      this.score += 1000 + Math.max(0, 5000 - Math.floor(this.timeMs / 10))
      this.onEnd?.(this.snapshot())
    }

    // Camera
    const viewW = this.canvas.width / (window.devicePixelRatio || 1)
    this.camX = this.px - viewW * 0.35
    this.camX = Math.max(0, Math.min(this.level.width - viewW, this.camX))
  }

  private hurt() {
    if (this.invuln > 0 || this.dead || this.won) return
    this.lives -= 1
    this.invuln = 1.4
    this.vy = -280
    this.vx = -this.facing * 160
    if (this.lives <= 0) {
      this.dead = true
      this.onEnd?.(this.snapshot())
    } else {
      // soft respawn nearby
      this.px = Math.max(32, this.px - 80)
      this.py = this.level.playerStart.y
    }
  }

  private resolveX() {
    const box: Rect = { x: this.px, y: this.py, w: 26, h: 34 }
    for (const p of this.level.platforms) {
      if (!this.rectsOverlap(box, p)) continue
      if (this.vx > 0) this.px = p.x - 26
      else if (this.vx < 0) this.px = p.x + p.w
      this.vx = 0
      box.x = this.px
    }
  }

  private resolveY() {
    const box: Rect = { x: this.px, y: this.py, w: 26, h: 34 }
    for (const p of this.level.platforms) {
      if (!this.rectsOverlap(box, p)) continue
      if (this.vy > 0) {
        this.py = p.y - 34
        this.vy = 0
        this.onGround = true
      } else if (this.vy < 0) {
        this.py = p.y + p.h
        this.vy = 0
      }
      box.y = this.py
    }
  }

  private draw() {
    const ctx = this.ctx
    const dpr = window.devicePixelRatio || 1
    const w = this.canvas.width / dpr
    const h = this.canvas.height / dpr
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Sky
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#070b14')
    grad.addColorStop(0.55, '#0c1222')
    grad.addColorStop(1, '#111827')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // Parallax stars
    ctx.fillStyle = '#94a3b844'
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137 + this.camX * 0.15) % w)
      const sy = (i * 53) % (h * 0.55)
      ctx.fillRect(sx, sy, 2, 2)
    }

    ctx.translate(-this.camX, 0)

    // Platforms
    for (const p of this.level.platforms) {
      const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h)
      g.addColorStop(0, '#1e293b')
      g.addColorStop(1, '#0f172a')
      ctx.fillStyle = g
      ctx.fillRect(p.x, p.y, p.w, p.h)
      ctx.fillStyle = '#22d3ee33'
      ctx.fillRect(p.x, p.y, p.w, 3)
    }

    // Spikes
    for (const s of this.level.spikes) {
      ctx.fillStyle = '#f43f5e'
      const n = Math.max(1, Math.floor(s.w / 10))
      for (let i = 0; i < n; i++) {
        const x0 = s.x + (i * s.w) / n
        const x1 = s.x + ((i + 0.5) * s.w) / n
        const x2 = s.x + ((i + 1) * s.w) / n
        ctx.beginPath()
        ctx.moveTo(x0, s.y + s.h)
        ctx.lineTo(x1, s.y)
        ctx.lineTo(x2, s.y + s.h)
        ctx.fill()
      }
    }

    // Goal flag
    const g = this.level.goal
    ctx.fillStyle = '#64748b'
    ctx.fillRect(g.x + 8, g.y, 4, g.h)
    ctx.fillStyle = '#a3e635'
    ctx.beginPath()
    ctx.moveTo(g.x + 12, g.y + 4)
    ctx.lineTo(g.x + 40, g.y + 16)
    ctx.lineTo(g.x + 12, g.y + 28)
    ctx.fill()

    // Coins
    for (const c of this.coins) {
      if (c.taken) continue
      const bob = Math.sin(this.anim * 6 + c.x * 0.05) * 3
      ctx.beginPath()
      ctx.fillStyle = '#fbbf24'
      ctx.arc(c.x, c.y + bob, c.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fde68a'
      ctx.beginPath()
      ctx.arc(c.x - 2, c.y + bob - 2, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue
      ctx.fillStyle = '#e11d48'
      roundRect(ctx, e.x, e.y, e.w, e.h, 6)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillRect(e.x + 6, e.y + 8, 5, 5)
      ctx.fillRect(e.x + 16, e.y + 8, 5, 5)
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(e.x + 8, e.y + 10, 2, 2)
      ctx.fillRect(e.x + 18, e.y + 10, 2, 2)
    }

    // Player
    const pal = SKINS[this.skin].palette
    const blink = this.invuln > 0 && Math.floor(this.anim * 20) % 2 === 0
    if (!blink) {
      ctx.shadowColor = pal.glow
      ctx.shadowBlur = 16
      ctx.fillStyle = pal.body
      roundRect(ctx, this.px, this.py, 26, 34, 8)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = pal.accent
      ctx.fillRect(this.px + 4, this.py + 22, 18, 6)
      ctx.fillStyle = pal.eye
      const ex = this.facing > 0 ? this.px + 14 : this.px + 6
      ctx.fillRect(ex, this.py + 10, 5, 5)
    }

    ctx.restore()

    // HUD (screen space)
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '600 14px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(`SCORE ${this.score}`, 16, 28)
    ctx.fillText(`COINS ${this.coinCount}`, 16, 48)
    ctx.fillText(`LIVES ${this.lives}`, 16, 68)

    if (this.won) {
      overlay(ctx, w, h, 'LEVEL CLEAR', `Score ${this.score} · Submit to leaderboard`, '#a3e635')
    } else if (this.dead) {
      overlay(ctx, w, h, 'GAME OVER', 'Press Restart to try again', '#f43f5e')
    }
    ctx.restore()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function overlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  sub: string,
  color: string,
) {
  ctx.fillStyle = '#020617cc'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = color
  ctx.font = '700 36px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(title, w / 2, h / 2 - 8)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 14px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(sub, w / 2, h / 2 + 24)
  ctx.textAlign = 'left'
}
