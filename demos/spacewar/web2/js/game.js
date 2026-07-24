// ─── Config ───────────────────────────────────────────────────────────────
const W = 960
const H = 540
const TILE = 40
const GRAVITY = 0.55
const FRICTION = 0.82
const MAX_FALL = 14

// Web2 product baseline — Morph can re-add ZEXVRO adapters later.
const SAVE_KEY = 'edgerun_web2_v1'
const CLAIMED_PACKS_KEY = 'edgerun_claimed_packs_v1'
const CURRENCY = 'TERA'
const CURRENCY_NAME = 'tera-coin'
const STARTING_TERA = 120

// ─── State ─────────────────────────────────────────────────────────────────
const keys = {}
let paused = false
let gameOver = false
let won = false
let camX = 0
let particles = []
let floatingTexts = []
let enemies = []
let pickups = []
let projectiles = []
let animT = 0

const player = {
  x: 80,
  y: 200,
  w: 28,
  h: 36,
  vx: 0,
  vy: 0,
  onGround: false,
  facing: 1,
  hp: 100,
  maxHp: 100,
  tera: 0,
  invuln: 0,
  shootCd: 0,
  doubleJumps: 0,
  maxDoubleJumps: 0,
  dashCd: 0,
  dashing: 0,
  speed: 4.2,
  jumpPower: 11.5,
  damage: 25,
  hasBlades: false,
  hasSandevistan: false,
  hasMantle: false,
  nftSkins: [],
  activeSkin: 'default',
  purchases: [],
  buyerAddress: '',
}

// ─── Level (tile map) ──────────────────────────────────────────────────────
// 0 empty, 1 solid, 2 platform, 3 spike, 4 spawn, 5 exit, 6 tera, 7 health
const LEVEL = [
  // ground row and platforms — cyberpunk Night City rooftops
  // width ~ 80 tiles
]
const MAP_W = 90
const MAP_H = 14

function buildLevel() {
  const map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0))

  // floor with gaps
  for (let x = 0; x < MAP_W; x++) {
    if ((x >= 18 && x <= 20) || (x >= 38 && x <= 40) || (x >= 58 && x <= 61)) continue
    map[MAP_H - 1][x] = 1
    if (x % 7 !== 3) map[MAP_H - 2][x] = 1
  }

  // platforms
  const plats = [
    [3, 10, 6], [10, 8, 4], [16, 6, 3], [22, 9, 5], [28, 7, 4],
    [33, 5, 3], [42, 10, 6], [48, 7, 4], [52, 5, 3], [55, 8, 3],
    [63, 9, 5], [70, 6, 4], [76, 8, 6], [82, 5, 4],
  ]
  for (const [px, py, plen] of plats) {
    for (let i = 0; i < plen; i++) {
      if (px + i < MAP_W) map[py][px + i] = 2
    }
  }

  // spikes in gaps
  for (let x of [19, 39, 59, 60]) {
    map[MAP_H - 1][x] = 3
  }

  // buildings decoration bases
  for (let x = 0; x < 8; x++) {
    map[MAP_H - 3][x] = 1
  }
  for (let x = 85; x < 90; x++) {
    map[MAP_H - 3][x] = 1
    map[MAP_H - 4][x] = 1
  }

  map[MAP_H - 4][2] = 4 // spawn marker
  map[MAP_H - 5][87] = 5 // exit

  return map
}

const map = buildLevel()

// ─── Entities ──────────────────────────────────────────────────────────────
function spawnEntities() {
  enemies = [
    { x: 12 * TILE, y: 8 * TILE, w: 30, h: 30, vx: -1.2, type: 'drone', hp: 40, maxHp: 40, patrol: [10 * TILE, 16 * TILE] },
    { x: 25 * TILE, y: 9 * TILE, w: 32, h: 34, vx: 1, type: 'gonk', hp: 60, maxHp: 60, patrol: [22 * TILE, 30 * TILE] },
    { x: 35 * TILE, y: 5 * TILE, w: 28, h: 28, vx: -1.5, type: 'drone', hp: 40, maxHp: 40, patrol: [33 * TILE, 40 * TILE] },
    { x: 45 * TILE, y: 10 * TILE, w: 32, h: 34, vx: 1.1, type: 'gonk', hp: 80, maxHp: 80, patrol: [42 * TILE, 52 * TILE] },
    { x: 56 * TILE, y: 8 * TILE, w: 30, h: 30, vx: -1.3, type: 'drone', hp: 50, maxHp: 50, patrol: [55 * TILE, 62 * TILE] },
    { x: 68 * TILE, y: 9 * TILE, w: 36, h: 36, vx: 0.9, type: 'maxtac', hp: 120, maxHp: 120, patrol: [64 * TILE, 74 * TILE] },
    { x: 78 * TILE, y: 8 * TILE, w: 30, h: 30, vx: -1.4, type: 'drone', hp: 45, maxHp: 45, patrol: [76 * TILE, 84 * TILE] },
  ]

  // World pickups are health only — TERA comes from kills, gigs, and free caches
  pickups = [
    { x: 17 * TILE, y: 5 * TILE, type: 'health', value: 30, taken: false },
    { x: 34 * TILE, y: 4 * TILE, type: 'health', value: 25, taken: false },
    { x: 54 * TILE, y: 4 * TILE, type: 'health', value: 40, taken: false },
    { x: 72 * TILE, y: 5 * TILE, type: 'health', value: 35, taken: false },
  ]
}

// ─── Shop catalog ──────────────────────────────────────────────────────────
const SHOP = [
  {
    id: 'stim',
    name: 'Trauma Stim',
    desc: 'Restore 40 HP instantly',
    icon: '💉',
    price: 50,
    type: 'consumable',
    effect: () => {
      player.hp = Math.min(player.maxHp, player.hp + 40)
      toast('+40 HP', true)
    },
  },
  {
    id: 'blades',
    name: 'Mantis Blades',
    desc: '+15 damage, melee slash range',
    icon: '⚔️',
    price: 200,
    type: 'gear',
    ownedKey: 'hasBlades',
    effect: () => {
      player.hasBlades = true
      player.damage += 15
      toast('MANTIS BLADES EQUIPPED', true)
    },
  },
  {
    id: 'sande',
    name: 'Sandevistan Mk.I',
    desc: 'Double jump + dash (Shift)',
    icon: '⚡',
    price: 350,
    type: 'cyberware',
    ownedKey: 'hasSandevistan',
    effect: () => {
      player.hasSandevistan = true
      player.maxDoubleJumps = 1
      toast('SANDEVISTAN ONLINE', true)
    },
  },
  {
    id: 'mantle',
    name: 'Optical Camo',
    desc: 'Max HP +30, minor damage resist',
    icon: '🛡️',
    price: 250,
    type: 'cyberware',
    ownedKey: 'hasMantle',
    effect: () => {
      player.hasMantle = true
      player.maxHp += 30
      player.hp += 30
      toast('OPTICAL CAMO INSTALLED', true)
    },
  },
  {
    id: 'speed',
    name: 'Kerenzikov Boost',
    desc: 'Move speed +20%',
    icon: '👟',
    price: 150,
    type: 'gear',
    once: true,
    effect: () => {
      player.speed *= 1.2
      toast('SPEED BOOSTED', true)
    },
  },
  {
    id: 'skin_legend',
    name: 'Edgerunner Suit',
    desc: 'Legendary runner paint job',
    icon: '🧬',
    price: 400,
    type: 'cosmetic',
    unlock: 'legendary_runner',
  },
  {
    id: 'skin_blade',
    name: 'Chrome Blade Skin',
    desc: 'Flashy blade look + blades if missing',
    icon: '💎',
    price: 500,
    type: 'cosmetic',
    unlock: 'chrome_blade',
  },
]

// In-game TERA packs (Web2: free claim once each)
const TOPUP_PACKS = [
  {
    id: 'pack_starter',
    name: 'Starter Cache',
    desc: '100 tera-coin — claim once',
    icon: '🪙',
    tera: 100,
    badge: 'FREE',
  },
  {
    id: 'pack_runner',
    name: 'Runner Cache',
    desc: '350 TERA — claim once',
    icon: '💠',
    tera: 350,
    badge: 'FREE',
  },
  {
    id: 'pack_legend',
    name: 'Legend Cache',
    desc: '1000 TERA — claim once',
    icon: '👑',
    tera: 1000,
    badge: 'FREE',
  },
]

// ─── Save / load ───────────────────────────────────────────────────────────
function readClaimedPacks() {
  try {
    const raw = localStorage.getItem(CLAIMED_PACKS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeClaimedPacks(list) {
  localStorage.setItem(CLAIMED_PACKS_KEY, JSON.stringify(list))
}

function saveGame() {
  const data = {
    tera: player.tera,
    hasBlades: player.hasBlades,
    hasSandevistan: player.hasSandevistan,
    hasMantle: player.hasMantle,
    maxHp: player.maxHp,
    damage: player.damage,
    speed: player.speed,
    maxDoubleJumps: player.maxDoubleJumps,
    nftSkins: player.nftSkins,
    activeSkin: player.activeSkin,
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  sessionStorage.setItem(SAVE_KEY, JSON.stringify(data))
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || sessionStorage.getItem(SAVE_KEY)
    if (!raw) {
      player.tera = STARTING_TERA
      return
    }
    const d = JSON.parse(raw)
    player.tera = typeof d.tera === 'number' ? d.tera : STARTING_TERA
    player.hasBlades = !!d.hasBlades
    player.hasSandevistan = !!d.hasSandevistan
    player.hasMantle = !!d.hasMantle
    player.maxHp = d.maxHp ?? 100
    player.damage = d.damage ?? 25
    player.speed = d.speed ?? 4.2
    player.maxDoubleJumps = d.maxDoubleJumps ?? 0
    player.nftSkins = Array.isArray(d.nftSkins) ? d.nftSkins : []
    player.activeSkin = d.activeSkin || 'default'
  } catch (_) {
    player.tera = STARTING_TERA
  }
}

function formatTera(n) {
  return `${n} ${CURRENCY}`
}

function creditTera(amount, reason) {
  player.tera += amount
  saveGame()
  if (reason) toast(`+${amount} ${CURRENCY} · ${reason}`, true)
}

function applyCosmeticUnlock(unlock) {
  if (!player.nftSkins.includes(unlock)) player.nftSkins.push(unlock)
  player.activeSkin = unlock
  if (unlock === 'chrome_blade' && !player.hasBlades) {
    player.hasBlades = true
    player.damage += 15
  }
  if (unlock === 'legendary_runner') {
    player.maxHp = Math.max(player.maxHp, 120)
    player.hp = Math.min(player.maxHp, player.hp + 20)
  }
  saveGame()
}

// ─── Canvas ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
canvas.width = W
canvas.height = H

// ─── Input ─────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  keys[e.code] = true
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault()
  }
  if (e.code === 'KeyM' && !gameOver && !won) toggleMarket()
  if (e.code === 'KeyT' && !gameOver) toggleTopup()
  if (e.code === 'Escape') {
    closeAllOverlays()
    if (!gameOver && !won) paused = false
  }
  if (e.code === 'KeyR' && (gameOver || won)) restart()
})
window.addEventListener('keyup', (e) => {
  keys[e.code] = false
})

// mobile
function bindCtrl(id, code) {
  const el = document.getElementById(id)
  if (!el) return
  const down = (e) => { e.preventDefault(); keys[code] = true }
  const up = (e) => { e.preventDefault(); keys[code] = false }
  el.addEventListener('touchstart', down, { passive: false })
  el.addEventListener('touchend', up, { passive: false })
  el.addEventListener('mousedown', down)
  el.addEventListener('mouseup', up)
  el.addEventListener('mouseleave', up)
}
bindCtrl('btn-left', 'ArrowLeft')
bindCtrl('btn-right', 'ArrowRight')
bindCtrl('btn-jump', 'Space')
bindCtrl('btn-shoot', 'KeyX')
bindCtrl('btn-dash', 'ShiftLeft')

// ─── Collision helpers ─────────────────────────────────────────────────────
function tileAt(px, py) {
  const tx = Math.floor(px / TILE)
  const ty = Math.floor(py / TILE)
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 1
  return map[ty][tx]
}

function isSolid(t) {
  return t === 1 || t === 2
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function moveEntity(ent, solidCheck = true) {
  ent.x += ent.vx
  if (solidCheck) {
    // horizontal
    if (ent.vx > 0) {
      if (isSolid(tileAt(ent.x + ent.w, ent.y + 2)) || isSolid(tileAt(ent.x + ent.w, ent.y + ent.h - 2))) {
        ent.x = Math.floor((ent.x + ent.w) / TILE) * TILE - ent.w - 0.01
        ent.vx = 0
      }
    } else if (ent.vx < 0) {
      if (isSolid(tileAt(ent.x, ent.y + 2)) || isSolid(tileAt(ent.x, ent.y + ent.h - 2))) {
        ent.x = Math.floor(ent.x / TILE + 1) * TILE + 0.01
        ent.vx = 0
      }
    }
  }

  ent.y += ent.vy
  ent.onGround = false
  if (solidCheck) {
    if (ent.vy > 0) {
      if (isSolid(tileAt(ent.x + 2, ent.y + ent.h)) || isSolid(tileAt(ent.x + ent.w - 2, ent.y + ent.h))) {
        ent.y = Math.floor((ent.y + ent.h) / TILE) * TILE - ent.h - 0.01
        ent.vy = 0
        ent.onGround = true
      }
    } else if (ent.vy < 0) {
      if (isSolid(tileAt(ent.x + 2, ent.y)) || isSolid(tileAt(ent.x + ent.w - 2, ent.y))) {
        ent.y = Math.floor(ent.y / TILE + 1) * TILE + 0.01
        ent.vy = 0
      }
    }
  }
}

// ─── FX ────────────────────────────────────────────────────────────────────
function spawnParticles(x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6 - 1,
      life: 30 + Math.random() * 20,
      color,
      size: 2 + Math.random() * 3,
    })
  }
}

function floatText(x, y, text, color = '#f9f002') {
  floatingTexts.push({ x, y, text, color, life: 50, vy: -1 })
}

function toast(msg, success = false) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.className = success ? 'show success' : 'show'
  clearTimeout(toast._t)
  toast._t = setTimeout(() => { el.className = '' }, 2400)
}

// ─── Player update ─────────────────────────────────────────────────────────
function updatePlayer() {
  if (player.invuln > 0) player.invuln--
  if (player.shootCd > 0) player.shootCd--
  if (player.dashCd > 0) player.dashCd--
  if (player.dashing > 0) player.dashing--

  const left = keys['ArrowLeft'] || keys['KeyA']
  const right = keys['ArrowRight'] || keys['KeyD']
  const jump = keys['Space'] || keys['ArrowUp'] || keys['KeyW']
  const shoot = keys['KeyX'] || keys['KeyZ']
  const dash = keys['ShiftLeft'] || keys['ShiftRight']

  if (player.dashing > 0) {
    player.vx = player.facing * player.speed * 2.8
    player.vy = 0
  } else {
    if (left) {
      player.vx = -player.speed
      player.facing = -1
    } else if (right) {
      player.vx = player.speed
      player.facing = 1
    } else {
      player.vx *= FRICTION
      if (Math.abs(player.vx) < 0.1) player.vx = 0
    }

    player.vy += GRAVITY
    if (player.vy > MAX_FALL) player.vy = MAX_FALL

    if (jump && !keys._jumpHeld) {
      if (player.onGround) {
        player.vy = -player.jumpPower
        player.doubleJumps = player.maxDoubleJumps
        spawnParticles(player.x + player.w / 2, player.y + player.h, '#05d9e8', 4)
      } else if (player.doubleJumps > 0) {
        player.vy = -player.jumpPower * 0.9
        player.doubleJumps--
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#d300c5', 10)
      }
    }
    keys._jumpHeld = jump

    if (dash && player.hasSandevistan && player.dashCd <= 0 && player.dashing <= 0) {
      player.dashing = 10
      player.dashCd = 45
      player.invuln = Math.max(player.invuln, 12)
      spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#f9f002', 12)
    }
  }

  moveEntity(player)

  // spikes
  const feet = tileAt(player.x + player.w / 2, player.y + player.h + 1)
  if (feet === 3) hurtPlayer(25)

  // fall death
  if (player.y > MAP_H * TILE + 100) {
    hurtPlayer(999)
  }

  // exit
  const head = tileAt(player.x + player.w / 2, player.y + player.h / 2)
  if (head === 5 || tileAt(player.x + player.w / 2, player.y) === 5) {
    winLevel()
  }

  // shoot
  if (shoot && player.shootCd <= 0) {
    player.shootCd = player.hasBlades ? 12 : 18
    const dmg = player.damage
    projectiles.push({
      x: player.x + (player.facing > 0 ? player.w : -12),
      y: player.y + player.h / 2 - 4,
      w: player.hasBlades ? 28 : 14,
      h: player.hasBlades ? 10 : 6,
      vx: player.facing * (player.hasBlades ? 10 : 9),
      life: player.hasBlades ? 12 : 40,
      dmg,
      fromPlayer: true,
      blade: player.hasBlades,
    })
  }

  // pickups (health only — TERA is top-up / kill scrap)
  for (const p of pickups) {
    if (p.taken) continue
    if (rectsOverlap(player, { x: p.x, y: p.y, w: 24, h: 24 })) {
      p.taken = true
      if (p.type === 'health') {
        player.hp = Math.min(player.maxHp, player.hp + p.value)
        floatText(p.x, p.y, `+${p.value}HP`, '#ff2a6d')
        spawnParticles(p.x + 12, p.y + 12, '#ff2a6d', 6)
      }
    }
  }

  // camera
  camX = player.x - W * 0.35
  camX = Math.max(0, Math.min(camX, MAP_W * TILE - W))
}

function hurtPlayer(amount) {
  if (player.invuln > 0) return
  let dmg = amount
  if (player.hasMantle) dmg = Math.floor(dmg * 0.75)
  player.hp -= dmg
  player.invuln = 50
  player.vx = -player.facing * 4
  player.vy = -5
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff2a6d', 14)
  if (player.hp <= 0) {
    player.hp = 0
    gameOver = true
    document.getElementById('overlay-gameover').classList.add('open')
  }
}

function winLevel() {
  if (won) return
  won = true
  const bonus = 75
  player.tera += bonus
  saveGame()
  document.getElementById('win-tera').textContent = formatTera(player.tera)
  document.getElementById('overlay-win').classList.add('open')
  toast(`+${bonus} ${CURRENCY} gig payout`, true)
}

// ─── Enemies ───────────────────────────────────────────────────────────────
function updateEnemies() {
  for (const e of enemies) {
    if (e.hp <= 0) continue
    e.x += e.vx
    if (e.x < e.patrol[0] || e.x > e.patrol[1]) e.vx *= -1

    // gravity-ish keep on platforms
    e.vy = (e.vy || 0) + GRAVITY
    e.y += e.vy
    if (isSolid(tileAt(e.x + e.w / 2, e.y + e.h))) {
      e.y = Math.floor((e.y + e.h) / TILE) * TILE - e.h - 0.01
      e.vy = 0
    }

    // hit player
    if (player.invuln <= 0 && rectsOverlap(player, e)) {
      const dmg = e.type === 'maxtac' ? 30 : e.type === 'gonk' ? 20 : 15
      hurtPlayer(dmg)
    }
  }
}

function updateProjectiles() {
  for (const p of projectiles) {
    p.x += p.vx
    p.life--
    if (p.fromPlayer) {
      for (const e of enemies) {
        if (e.hp <= 0) continue
        if (rectsOverlap(p, e)) {
          e.hp -= p.dmg
          p.life = 0
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#f9f002', 8)
          floatText(e.x, e.y, `-${p.dmg}`, '#f9f002')
          if (e.hp <= 0) {
            const reward = e.type === 'maxtac' ? 25 : e.type === 'gonk' ? 15 : 10
            player.tera += reward
            floatText(e.x, e.y - 16, `+${reward} ${CURRENCY}`, '#00ff9d')
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#d300c5', 16)
            saveGame()
          }
          break
        }
      }
    }
  }
  projectiles = projectiles.filter((p) => p.life > 0)
}

function updateFX() {
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.1
    p.life--
  }
  particles = particles.filter((p) => p.life > 0)

  for (const t of floatingTexts) {
    t.y += t.vy
    t.life--
  }
  floatingTexts = floatingTexts.filter((t) => t.life > 0)
}

// ─── Draw ──────────────────────────────────────────────────────────────────
function drawBackground() {
  // night sky gradient
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0a0618')
  g.addColorStop(0.5, '#120820')
  g.addColorStop(1, '#1a0a28')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // distant city silhouettes (parallax)
  const para = camX * 0.15
  ctx.fillStyle = '#0e0a1c'
  for (let i = 0; i < 20; i++) {
    const bx = ((i * 120 - para) % (W + 200)) - 50
    const bh = 80 + (i * 37) % 160
    ctx.fillRect(bx, H - bh - 40, 40 + (i % 3) * 20, bh)
  }

  // neon signs far
  const para2 = camX * 0.3
  for (let i = 0; i < 12; i++) {
    const bx = ((i * 180 - para2) % (W + 300)) - 80
    const bh = 100 + (i * 53) % 180
    ctx.fillStyle = '#151028'
    ctx.fillRect(bx, H - bh - 20, 50 + (i % 4) * 15, bh)
    // neon window
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,42,109,0.35)' : 'rgba(5,217,232,0.3)'
    ctx.fillRect(bx + 8, H - bh + 10, 12, 8)
    ctx.fillRect(bx + 28, H - bh + 30, 12, 8)
    if (i % 3 === 0) {
      ctx.fillStyle = 'rgba(249,240,2,0.4)'
      ctx.font = '10px Orbitron'
      ctx.fillText('NIGHT', bx + 4, H - bh + 4)
    }
  }

  // moon / orb
  ctx.beginPath()
  ctx.arc(W - 100 - camX * 0.05, 70, 28, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 100, 180, 0.15)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(W - 100 - camX * 0.05, 70, 18, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 180, 220, 0.25)'
  ctx.fill()
}

function drawMap() {
  const startX = Math.floor(camX / TILE)
  const endX = Math.min(MAP_W, startX + Math.ceil(W / TILE) + 2)

  for (let y = 0; y < MAP_H; y++) {
    for (let x = startX; x < endX; x++) {
      const t = map[y][x]
      if (!t) continue
      const sx = x * TILE - camX
      const sy = y * TILE

      if (t === 1) {
        // solid building tile
        ctx.fillStyle = '#1a1530'
        ctx.fillRect(sx, sy, TILE, TILE)
        ctx.fillStyle = '#252045'
        ctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4)
        // neon edge
        ctx.strokeStyle = 'rgba(5,217,232,0.25)'
        ctx.lineWidth = 1
        ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1)
        // circuit lines
        ctx.strokeStyle = 'rgba(211,0,197,0.3)'
        ctx.beginPath()
        ctx.moveTo(sx + 6, sy + TILE / 2)
        ctx.lineTo(sx + TILE - 6, sy + TILE / 2)
        ctx.stroke()
      } else if (t === 2) {
        // platform
        ctx.fillStyle = '#2a1840'
        ctx.fillRect(sx, sy, TILE, 12)
        ctx.fillStyle = '#ff2a6d'
        ctx.fillRect(sx, sy, TILE, 3)
        ctx.fillStyle = 'rgba(5,217,232,0.5)'
        ctx.fillRect(sx + 4, sy + 5, TILE - 8, 2)
      } else if (t === 3) {
        // spikes
        ctx.fillStyle = '#ff2a6d'
        for (let i = 0; i < 4; i++) {
          ctx.beginPath()
          ctx.moveTo(sx + i * 10, sy + TILE)
          ctx.lineTo(sx + i * 10 + 5, sy + TILE - 18)
          ctx.lineTo(sx + i * 10 + 10, sy + TILE)
          ctx.fill()
        }
      } else if (t === 5) {
        // exit portal
        const pulse = 0.5 + Math.sin(animT * 0.1) * 0.3
        ctx.fillStyle = `rgba(0,255,157,${pulse})`
        ctx.beginPath()
        ctx.ellipse(sx + TILE / 2, sy + TILE / 2, 16, 22, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#00ff9d'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = '#00ff9d'
        ctx.font = '9px Orbitron'
        ctx.fillText('EXIT', sx + 6, sy - 4)
      }
    }
  }
}

function drawPlayer() {
  const sx = player.x - camX
  const sy = player.y
  const blink = player.invuln > 0 && Math.floor(player.invuln / 3) % 2 === 0
  if (blink) return

  const skin = player.activeSkin
  let body = '#05d9e8'
  let accent = '#ff2a6d'
  let hair = '#f9f002'

  if (skin === 'legendary_runner') {
    body = '#d300c5'
    accent = '#f9f002'
    hair = '#ff2a6d'
  } else if (skin === 'chrome_blade') {
    body = '#c0c8d8'
    accent = '#05d9e8'
    hair = '#ffffff'
  }

  // dash trail
  if (player.dashing > 0) {
    ctx.globalAlpha = 0.4
    ctx.fillStyle = '#f9f002'
    ctx.fillRect(sx - player.facing * 16, sy + 4, player.w, player.h - 8)
    ctx.globalAlpha = 1
  }

  // body
  ctx.fillStyle = body
  ctx.fillRect(sx + 4, sy + 10, player.w - 8, 18)
  // head
  ctx.fillStyle = '#e8c4a8'
  ctx.fillRect(sx + 6, sy + 2, player.w - 12, 12)
  // hair
  ctx.fillStyle = hair
  ctx.fillRect(sx + 5, sy, player.w - 10, 5)
  // jacket accent
  ctx.fillStyle = accent
  ctx.fillRect(sx + 4, sy + 12, 4, 14)
  ctx.fillRect(sx + player.w - 8, sy + 12, 4, 14)
  // legs
  const legOff = player.onGround && Math.abs(player.vx) > 0.5 ? Math.sin(animT * 0.4) * 3 : 0
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(sx + 6, sy + 28, 7, 8 + legOff)
  ctx.fillRect(sx + 15, sy + 28, 7, 8 - legOff)
  // visor
  ctx.fillStyle = accent
  ctx.fillRect(sx + 8, sy + 6, player.w - 16, 3)

  // blades
  if (player.hasBlades) {
    ctx.fillStyle = '#e0e8f0'
    const bx = player.facing > 0 ? sx + player.w - 2 : sx - 18
    ctx.fillRect(bx, sy + 16, 18, 3)
    ctx.fillStyle = '#05d9e8'
    ctx.fillRect(bx + (player.facing > 0 ? 12 : 0), sy + 15, 6, 5)
  }

  // facing indicator
  ctx.fillStyle = body
  if (player.facing > 0) {
    ctx.fillRect(sx + player.w - 6, sy + 8, 3, 2)
  } else {
    ctx.fillRect(sx + 3, sy + 8, 3, 2)
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.hp <= 0) continue
    const sx = e.x - camX
    const sy = e.y

    if (e.type === 'drone') {
      ctx.fillStyle = '#3a2060'
      ctx.fillRect(sx, sy + 8, e.w, e.h - 12)
      ctx.fillStyle = '#ff2a6d'
      ctx.beginPath()
      ctx.arc(sx + e.w / 2, sy + e.h / 2, 6, 0, Math.PI * 2)
      ctx.fill()
      // rotors
      ctx.strokeStyle = '#05d9e8'
      ctx.lineWidth = 2
      const spin = Math.sin(animT * 0.5) * 8
      ctx.beginPath()
      ctx.moveTo(sx - 4, sy + 6 + spin * 0.2)
      ctx.lineTo(sx + e.w + 4, sy + 6 - spin * 0.2)
      ctx.stroke()
    } else if (e.type === 'gonk') {
      ctx.fillStyle = '#4a3020'
      ctx.fillRect(sx + 2, sy + 6, e.w - 4, e.h - 6)
      ctx.fillStyle = '#c08040'
      ctx.fillRect(sx + 6, sy, e.w - 12, 12)
      ctx.fillStyle = '#ff2a6d'
      ctx.fillRect(sx + 8, sy + 4, 4, 3)
      ctx.fillRect(sx + e.w - 12, sy + 4, 4, 3)
    } else if (e.type === 'maxtac') {
      ctx.fillStyle = '#1a2030'
      ctx.fillRect(sx, sy + 4, e.w, e.h - 4)
      ctx.fillStyle = '#05d9e8'
      ctx.fillRect(sx + 4, sy, e.w - 8, 10)
      ctx.fillStyle = '#ff2a6d'
      ctx.fillRect(sx + 2, sy + 14, e.w - 4, 4)
      ctx.fillStyle = '#f9f002'
      ctx.font = '8px Orbitron'
      ctx.fillText('MAX', sx + 6, sy + 28)
    }

    // hp bar
    if (e.hp < e.maxHp) {
      ctx.fillStyle = '#300'
      ctx.fillRect(sx, sy - 8, e.w, 4)
      ctx.fillStyle = '#ff2a6d'
      ctx.fillRect(sx, sy - 8, e.w * (e.hp / e.maxHp), 4)
    }
  }
}

function drawPickups() {
  for (const p of pickups) {
    if (p.taken) continue
    const sx = p.x - camX
    const sy = p.y + Math.sin(animT * 0.08 + p.x) * 3
    ctx.fillStyle = '#ff2a6d'
    ctx.fillRect(sx + 4, sy + 4, 16, 16)
    ctx.fillStyle = '#fff'
    ctx.font = '12px sans-serif'
    ctx.fillText('+', sx + 7, sy + 17)
  }
}

function drawProjectiles() {
  for (const p of projectiles) {
    const sx = p.x - camX
    if (p.blade) {
      ctx.fillStyle = '#e0e8f0'
      ctx.fillRect(sx, p.y, p.w, p.h)
      ctx.fillStyle = '#05d9e8'
      ctx.fillRect(sx, p.y, p.w, 2)
    } else {
      ctx.fillStyle = '#f9f002'
      ctx.shadowColor = '#f9f002'
      ctx.shadowBlur = 8
      ctx.fillRect(sx, p.y, p.w, p.h)
      ctx.shadowBlur = 0
    }
  }
}

function drawFX() {
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 20)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - camX, p.y, p.size, p.size)
  }
  ctx.globalAlpha = 1

  for (const t of floatingTexts) {
    ctx.globalAlpha = Math.min(1, t.life / 20)
    ctx.fillStyle = t.color
    ctx.font = 'bold 12px Orbitron'
    ctx.fillText(t.text, t.x - camX, t.y)
  }
  ctx.globalAlpha = 1
}

function drawHUD() {
  document.getElementById('stat-hp').textContent = `${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`
  document.getElementById('stat-tera').textContent = formatTera(player.tera)
  document.getElementById('stat-gear').textContent = [
    player.hasBlades ? 'BLADES' : null,
    player.hasSandevistan ? 'SANDE' : null,
    player.hasMantle ? 'CAMO' : null,
    player.nftSkins.length ? `SKIN×${player.nftSkins.length}` : null,
  ].filter(Boolean).join(' · ') || 'NONE'
}

function draw() {
  drawBackground()
  drawMap()
  drawPickups()
  drawEnemies()
  drawProjectiles()
  drawPlayer()
  drawFX()
  drawHUD()
}

// ─── Market UI ─────────────────────────────────────────────────────────────
function isOwned(item) {
  if (!item) return false
  if (item.ownedKey) return !!player[item.ownedKey]
  if (item.type === 'cosmetic' && item.unlock) return player.nftSkins.includes(item.unlock)
  if (item.once) return false
  return false
}

function renderMarket() {
  const bal = document.getElementById('market-tera')
  if (bal) bal.textContent = formatTera(player.tera)
  const grid = document.getElementById('shop-grid')
  if (!grid) return
  grid.innerHTML = ''

  for (const item of SHOP) {
    const owned = isOwned(item)
    const div = document.createElement('div')
    div.className = `shop-item${owned ? ' owned' : ''}`

    const buyLabel = owned ? 'OWNED' : 'BUY'
    const priceHtml = `<span class="price">${item.price} ${CURRENCY}</span>`

    div.innerHTML = `
      <div class="shop-icon">${item.icon}</div>
      <div class="shop-info">
        <h3>${item.name}</h3>
        <p>${item.desc}</p>
        <span class="tag" style="border-color:#00ff9d;color:#00ff9d">${CURRENCY_NAME}</span>
      </div>
      <div class="shop-buy">
        ${priceHtml}
        <button class="btn pink" data-id="${item.id}" ${owned ? 'disabled' : ''}>
          ${buyLabel}
        </button>
      </div>
    `
    grid.appendChild(div)
  }

  grid.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => buyItem(btn.dataset.id))
  })
}

function renderTopup() {
  const bal = document.getElementById('topup-tera')
  if (bal) bal.textContent = formatTera(player.tera)
  const grid = document.getElementById('topup-grid')
  if (!grid) return
  grid.innerHTML = ''
  const claimed = readClaimedPacks()

  for (const pack of TOPUP_PACKS) {
    const done = claimed.includes(pack.id)
    const div = document.createElement('div')
    div.className = 'shop-item topup'
    div.innerHTML = `
      <div class="shop-icon">${pack.icon}</div>
      <div class="shop-info">
        <h3>${pack.name}</h3>
        <p>${pack.desc}</p>
        <span class="tag" style="border-color:#00ff9d;color:#00ff9d">${pack.badge}</span>
      </div>
      <div class="shop-buy">
        <span class="topup-amount">+${pack.tera} ${CURRENCY}</span>
        <button class="btn yellow" data-pack="${pack.id}" ${done ? 'disabled' : ''}>${done ? 'CLAIMED' : 'CLAIM'}</button>
      </div>
    `
    grid.appendChild(div)
  }

  grid.querySelectorAll('button[data-pack]').forEach((btn) => {
    btn.addEventListener('click', () => buyTopupPack(btn.dataset.pack))
  })
}

function buyItem(id) {
  const item = SHOP.find((s) => s.id === id)
  if (!item || isOwned(item)) return

  if (player.tera < item.price) {
    toast(`NOT ENOUGH ${CURRENCY} — claim a cache or earn kills`)
    return
  }

  player.tera -= item.price
  if (item.type === 'cosmetic') {
    applyCosmeticUnlock(item.unlock)
    toast(`UNLOCKED: ${item.name} (−${item.price} ${CURRENCY})`, true)
  } else {
    item.effect()
    toast(`PURCHASED: ${item.name} (−${item.price} ${CURRENCY})`, true)
  }
  saveGame()
  renderMarket()
}

function buyTopupPack(packId) {
  const pack = TOPUP_PACKS.find((p) => p.id === packId)
  if (!pack) return
  const claimed = readClaimedPacks()
  if (claimed.includes(pack.id)) {
    toast('Already claimed')
    return
  }
  claimed.push(pack.id)
  writeClaimedPacks(claimed)
  creditTera(pack.tera, pack.name)
  renderTopup()
  renderMarket()
}

function toggleMarket() {
  const market = document.getElementById('overlay-market')
  const willOpen = !market.classList.contains('open')
  document.getElementById('overlay-topup').classList.remove('open')
  document.getElementById('overlay-start').classList.remove('open')
  market.classList.toggle('open', willOpen)
  paused = willOpen || document.getElementById('overlay-topup').classList.contains('open')
  if (willOpen) renderMarket()
  else if (!gameOver && !won) paused = false
}

function toggleTopup() {
  const topup = document.getElementById('overlay-topup')
  const willOpen = !topup.classList.contains('open')
  document.getElementById('overlay-market').classList.remove('open')
  document.getElementById('overlay-start').classList.remove('open')
  document.getElementById('overlay-gameover').classList.remove('open')
  document.getElementById('overlay-win').classList.remove('open')
  topup.classList.toggle('open', willOpen)
  paused = willOpen
  if (willOpen) renderTopup()
  else if (!gameOver && !won) paused = false
}

function openTopupOnly() {
  document.getElementById('overlay-market').classList.remove('open')
  document.getElementById('overlay-start').classList.remove('open')
  document.getElementById('overlay-gameover').classList.remove('open')
  document.getElementById('overlay-win').classList.remove('open')
  document.getElementById('overlay-topup').classList.add('open')
  paused = true
  renderTopup()
}

function closeAllOverlays() {
  document.querySelectorAll('.overlay').forEach((o) => {
    if (o.id !== 'overlay-start' && o.id !== 'overlay-gameover' && o.id !== 'overlay-win') {
      o.classList.remove('open')
    }
  })
  if (!gameOver && !won) paused = false
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────
function resetLevel() {
  player.x = 80
  player.y = 200
  player.vx = 0
  player.vy = 0
  player.hp = player.maxHp
  player.invuln = 0
  player.doubleJumps = 0
  gameOver = false
  won = false
  camX = 0
  particles = []
  floatingTexts = []
  projectiles = []
  spawnEntities()
  document.getElementById('overlay-gameover').classList.remove('open')
  document.getElementById('overlay-win').classList.remove('open')
}

function restart() {
  resetLevel()
  paused = false
}

function startGame() {
  document.getElementById('overlay-start').classList.remove('open')
  paused = false
  resetLevel()
}

// wire buttons
document.getElementById('btn-start').addEventListener('click', startGame)
document.getElementById('btn-market').addEventListener('click', toggleMarket)
document.getElementById('btn-topup').addEventListener('click', toggleTopup)
document.getElementById('btn-close-market').addEventListener('click', () => {
  document.getElementById('overlay-market').classList.remove('open')
  if (!gameOver && !won) paused = false
})
document.getElementById('btn-close-topup').addEventListener('click', () => {
  document.getElementById('overlay-topup').classList.remove('open')
  if (!gameOver && !won) paused = false
})
document.getElementById('btn-market-topup').addEventListener('click', () => {
  document.getElementById('overlay-market').classList.remove('open')
  openTopupOnly()
})
document.getElementById('btn-retry').addEventListener('click', restart)
document.getElementById('btn-go-topup').addEventListener('click', openTopupOnly)
document.getElementById('btn-win-retry').addEventListener('click', restart)
document.getElementById('btn-win-market').addEventListener('click', () => {
  document.getElementById('overlay-win').classList.remove('open')
  won = false
  toggleMarket()
})
document.getElementById('btn-win-topup').addEventListener('click', () => {
  document.getElementById('overlay-win').classList.remove('open')
  won = false
  openTopupOnly()
})

// ─── Loop ──────────────────────────────────────────────────────────────────
function loop() {
  animT++
  if (!paused && !gameOver && !won) {
    updatePlayer()
    updateEnemies()
    updateProjectiles()
    updateFX()
  } else {
    updateFX()
  }
  draw()
  requestAnimationFrame(loop)
}

// boot
loadGame()
spawnEntities()
paused = true
loop()
