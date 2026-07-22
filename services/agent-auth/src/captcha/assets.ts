/**
 * CAPTCHA assets: prefer local photo bank (captcha-assets/), fall back to SVG icons.
 */

import { createHash, randomBytes, randomInt } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LABELS = [
  'motorcycle',
  'boat',
  'bridge',
  'bus',
  'car',
  'cat',
  'crosswalk',
  'dog',
  'mountain',
  'palm',
  'stop_sign',
  'traffic_light',
] as const

export type AssetLabel = (typeof LABELS)[number]

const LABEL_COLORS: Record<AssetLabel, string> = {
  traffic_light: '#f59e0b',
  crosswalk: '#64748b',
  bus: '#ef4444',
  car: '#3b82f6',
  bridge: '#a855f7',
  palm: '#14b8a6',
  mountain: '#78716c',
  boat: '#0ea5e9',
  cat: '#eab308',
  dog: '#d946ef',
  stop_sign: '#ef4444',
  motorcycle: '#94a3b8',
}

const EXT_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

function assetsRoot(): string {
  // services/agent-auth/src/captcha -> services/agent-auth/captcha-assets
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, '..', '..', 'captcha-assets')
}

let bankCache: Map<AssetLabel, string[]> | null = null

export function invalidatePhotoBankCache() {
  bankCache = null
}

function loadBank(): Map<AssetLabel, string[]> {
  if (bankCache) return bankCache
  const map = new Map<AssetLabel, string[]>()
  const root = assetsRoot()
  // Verified-only bank is the sole photo source of truth.
  const verifiedManifest = join(root, 'verified', 'manifest.json')
  const fileRoot = join(root, 'verified')
  const manifestPath = existsSync(verifiedManifest)
    ? verifiedManifest
    : join(fileRoot, 'manifest.json')
  if (existsSync(manifestPath)) {
    try {
      const man = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, string[]>
      for (const label of LABELS) {
        const files = (man[label] || [])
          .map((f) => join(fileRoot, label, f))
          .filter((p) => existsSync(p))
        if (files.length) map.set(label, files)
      }
    } catch {
      /* fall through to scan */
    }
  }
  // Scan verified label dirs only — never load unverified root copies.
  if (map.size === 0 && existsSync(fileRoot)) {
    for (const label of LABELS) {
      const dir = join(fileRoot, label)
      if (!existsSync(dir)) continue
      const files = readdirSync(dir)
        .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))
        .map((f) => join(dir, f))
      if (files.length) map.set(label, files)
    }
  }
  bankCache = map
  return map
}

export function photoBankStats(): { labels: number; files: number; root: string } {
  const bank = loadBank()
  let files = 0
  for (const v of bank.values()) files += v.length
  return { labels: bank.size, files, root: assetsRoot() }
}

/** Labels that have enough real photos (never invent SVG tiles for image challenges). */
const MIN_BANK_PHOTOS = 4

export function bankBackedLabels(minPhotos = MIN_BANK_PHOTOS): AssetLabel[] {
  const bank = loadBank()
  return LABELS.filter((l) => (bank.get(l)?.length ?? 0) >= minPhotos)
}

export function labelPhotoCount(label: AssetLabel): number {
  return loadBank().get(label)?.length ?? 0
}

export function pickLabels(n: number, exclude?: AssetLabel[]): AssetLabel[] {
  const pool = bankBackedLabels().filter((l) => !exclude?.includes(l))
  const out: AssetLabel[] = []
  const used = new Set<number>()
  while (out.length < n && used.size < pool.length) {
    const i = randomInt(pool.length)
    if (used.has(i)) continue
    used.add(i)
    out.push(pool[i]!)
  }
  return out
}

export function randomLabel(): AssetLabel {
  const pool = bankBackedLabels()
  if (pool.length === 0) {
    throw new Error('captcha_photo_bank_empty: no labels with enough real photos')
  }
  return pool[randomInt(pool.length)]!
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const ICON_PATHS: Record<AssetLabel, string> = {
  traffic_light: `<rect x="35" y="5" width="30" height="70" rx="6"/><circle cx="50" cy="22" r="7" fill="#ef4444"/><circle cx="50" cy="40" r="7" fill="#fbbf24"/><circle cx="50" cy="58" r="7" fill="#22c55e"/><rect x="45" y="75" width="10" height="20"/>`,
  crosswalk: `<rect x="10" y="40" width="80" height="12"/><rect x="10" y="20" width="12" height="50"/><rect x="28" y="20" width="12" height="50"/><rect x="46" y="20" width="12" height="50"/><rect x="64" y="20" width="12" height="50"/>`,
  bus: `<rect x="15" y="25" width="70" height="40" rx="8"/><rect x="22" y="32" width="16" height="12" fill="#0f172a"/><rect x="42" y="32" width="16" height="12" fill="#0f172a"/><circle cx="30" cy="70" r="8"/><circle cx="70" cy="70" r="8"/>`,
  car: `<path d="M15 55 L25 35 H75 L85 55 Z"/><rect x="12" y="55" width="76" height="18" rx="4"/><circle cx="30" cy="75" r="8"/><circle cx="70" cy="75" r="8"/>`,
  bridge: `<path d="M10 70 Q50 20 90 70" fill="none" stroke-width="4"/><rect x="10" y="70" width="80" height="8"/><line x1="30" y1="70" x2="30" y2="50"/><line x1="50" y1="70" x2="50" y2="35"/><line x1="70" y1="70" x2="70" y2="50"/>`,
  palm: `<path d="M50 80 V35"/><path d="M50 40 Q20 20 25 45"/><path d="M50 40 Q80 20 75 45"/><path d="M50 45 Q30 55 35 70"/><path d="M50 45 Q70 55 65 70" fill="none"/>`,
  mountain: `<path d="M10 80 L35 30 L55 55 L70 25 L90 80 Z"/>`,
  boat: `<path d="M20 55 L80 55 L70 75 L30 75 Z"/><path d="M50 55 V25 L70 55" fill="none"/>`,
  cat: `<circle cx="50" cy="55" r="22"/><path d="M32 40 L28 20 L42 35"/><path d="M68 40 L72 20 L58 35"/><circle cx="42" cy="52" r="3" fill="#0f172a"/><circle cx="58" cy="52" r="3" fill="#0f172a"/>`,
  dog: `<ellipse cx="50" cy="55" rx="28" ry="20"/><circle cx="72" cy="40" r="12"/><ellipse cx="28" cy="48" rx="8" ry="14"/><circle cx="76" cy="38" r="2" fill="#0f172a"/>`,
  stop_sign: `<polygon points="50,10 80,25 80,55 50,70 20,55 20,25" fill="#ef4444"/><text x="50" y="48" text-anchor="middle" font-size="14" fill="#fff" font-weight="700">STOP</text>`,
  motorcycle: `<circle cx="30" cy="70" r="14" fill="none"/><circle cx="75" cy="70" r="14" fill="none"/><path d="M30 70 L50 40 L75 70 M50 40 L65 40" fill="none"/>`,
}

/** Distinct icon per label — no readable label text (would leak answer). */
export function svgForLabel(label: AssetLabel, variant = 0): string {
  const c = LABEL_COLORS[label]
  const bg = variant % 2 === 0 ? '#0f172a' : '#1e293b'
  const icon = ICON_PATHS[label]
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="12" fill="${bg}"/>
  <g transform="translate(20,20) scale(0.8)" fill="${c}" stroke="${c}" stroke-width="2" fill-opacity="0.9">
    ${icon}
  </g>
</svg>`
}

export type CaptchaImageAsset = {
  contentType: string
  body: string
  encoding: 'utf8' | 'base64'
  /** Absolute path used (for uniqueness bookkeeping). */
  sourcePath?: string
}

/**
 * Pick a real photo for a label. Never falls back to SVG for image challenges.
 * Pass `usedPaths` to avoid repeating the same file in one challenge.
 */
export function imageForLabel(
  label: AssetLabel,
  _variant = 0,
  usedPaths?: Set<string>,
): CaptchaImageAsset {
  const bank = loadBank()
  const files = bank.get(label) ?? []
  const available = usedPaths ? files.filter((f) => !usedPaths.has(f)) : files
  const pool = available.length > 0 ? available : files
  if (pool.length === 0) {
    throw new Error(`captcha_missing_photos:${label}`)
  }
  const path = pool[randomInt(pool.length)]!
  usedPaths?.add(path)
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
  const mime = EXT_MIME[ext] || 'image/jpeg'
  const buf = readFileSync(path)
  return {
    contentType: mime,
    body: buf.toString('base64'),
    encoding: 'base64',
    sourcePath: path,
  }
}

/** SVG only for non-photo puzzles (rotate glyph etc.) — not for image_select tiles. */
export function imageForLabelOrSvg(
  label: AssetLabel,
  variant = 0,
): CaptchaImageAsset {
  try {
    return imageForLabel(label, variant)
  } catch {
    return {
      contentType: 'image/svg+xml',
      body: svgForLabel(label, variant),
      encoding: 'utf8',
    }
  }
}

export function svgTextChallenge(text: string): string {
  // 5x7 bitmap font — no <text> nodes containing the answer (bots cannot scrape glyphs as XML text).
  const FONT: Record<string, number[]> = {
    A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
    C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
    D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
    E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
    F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
    G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
    H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
    K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
    L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
    M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001, 0b10001, 0b10001],
    N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
    P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
    Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
    R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
    S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
    T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
    U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
    W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
    X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
    Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
    Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
    '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
    '3': [0b01110, 0b10001, 0b00001, 0b00110, 0b00001, 0b10001, 0b01110],
    '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
    '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
    '6': [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
    '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
    '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
    '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  }
  const chars = [...text.toUpperCase()]
  const cells: string[] = []
  chars.forEach((ch, i) => {
    const glyph = FONT[ch] || FONT['A']!
    const ox = 18 + i * 40 + randomInt(-2, 3)
    const oy = 18 + randomInt(-3, 4)
    const fill = ['#e2e8f0', '#38bdf8', '#a78bfa', '#fbbf24'][i % 4]
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if ((glyph[row]! >> (4 - col)) & 1) {
          const x = ox + col * 5
          const y = oy + row * 5
          cells.push(`<rect x="${x}" y="${y}" width="4" height="4" rx="0.5" fill="${fill}"/>`)
        }
      }
    }
  })
  const noise = Array.from({ length: 16 }, () => {
    const x1 = randomInt(0, 220)
    const y1 = randomInt(0, 80)
    const x2 = randomInt(0, 220)
    const y2 = randomInt(0, 80)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1e293b" stroke-width="1"/>`
  }).join('\n')
  // Decoy <text> with wrong chars (misleading scrapers)
  const decoys = Array.from({ length: 6 }, (_, i) => {
    const ch = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]
    return `<text x="${-999}" y="${-999 - i}" font-size="0" opacity="0">${esc(ch)}</text>`
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="80" viewBox="0 0 220 80">
  <rect width="220" height="80" rx="8" fill="#020617"/>
  ${noise}
  ${cells.join('\n')}
  ${decoys}
</svg>`
}

export function svgRotateObject(degrees: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <rect width="160" height="160" rx="16" fill="#0f172a"/>
  <g transform="rotate(${degrees} 80 80)">
    <polygon points="80,28 120,120 40,120" fill="#38bdf8"/>
    <rect x="72" y="100" width="16" height="28" fill="#fbbf24"/>
    <text x="80" y="95" text-anchor="middle" font-size="14" fill="#0f172a" font-weight="700">UP</text>
  </g>
</svg>`
}

export function svgSliderTrack(targetOffset: number): { track: string; piece: string } {
  // SECURITY: never paint the secret target position. UI shows a plain track;
  // the client moves a piece and submits offset; server checks against secret.
  void targetOffset
  // Fixed decoy ticks — not secret targets (do not encode secret offset).
  const decoys = [28, 96, 164, 220]
    .map(
      (x) =>
        `<rect x="${x}" y="20" width="6" height="20" rx="2" fill="#1e293b" opacity="0.5"/>`,
    )
    .join('')
  const track = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="60" viewBox="0 0 280 60">
  <rect width="280" height="60" rx="10" fill="#0f172a"/>
  <rect x="12" y="22" width="256" height="16" rx="8" fill="#1e293b"/>
  ${decoys}
  <text x="140" y="14" text-anchor="middle" font-size="10" fill="#64748b">Slide to the center of the track feel</text>
</svg>`
  const piece = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="24" viewBox="0 0 28 24">
  <rect width="28" height="24" rx="6" fill="#38bdf8"/>
</svg>`
  return { track, piece }
}


export function randomCaptchaText(len = 4): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += alphabet[randomInt(alphabet.length)]
  return s
}

export function randomDigits(len = 5): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String(randomInt(0, 10))
  return s
}

export function assetToken(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('base64url').slice(0, 24)
}

export function newAssetId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString('hex')}`
}
