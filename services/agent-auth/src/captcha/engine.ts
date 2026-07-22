/**
 * Self-hosted CAPTCHA engine: issue, verify, asset serve.
 * Answers never leave the server.
 */

import { randomInt } from 'node:crypto'
import { randomId, secretsEqual, sha256Hex } from '../crypto.js'
import {
  newAssetId,
  pickLabels,
  randomCaptchaText,
  randomLabel,
  imageForLabel,
  bankBackedLabels,
  labelPhotoCount,
  svgRotateObject,
  svgSliderTrack,
  svgTextChallenge,
  type AssetLabel,
} from './assets.js'
import {
  CAPTCHA_TYPES,
  DEFAULT_CAPTCHA_TYPES,
  type CaptchaAnswerInput,
  type CaptchaPublicPayload,
  type CaptchaState,
  type CaptchaType,
} from './types.js'

const CAPTCHA_TTL_MS = 120_000 // align closer to challenge TTL
const MAX_ATTEMPTS = 5 // tighter lockout (re-issue also budgeted in service)
/** Soft types never client-forceable in production path; demo QA uses server flag. */
export const CLIENT_FORCEABLE_TYPES: CaptchaType[] = [
  'image_select',
  'image_grid',
  'odd_one_out',
  'pair_match',
  'label_pick',
  'count_objects',
  'majority_select',
  'photo_rotate',
]

function normalizeText(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '')
}

/** Default UX hero set — keep advanced types available via preferredType. */
export const HERO_CAPTCHA_TYPES: CaptchaType[] = [
  'image_select',
  'odd_one_out',
  'pair_match',
  'label_pick',
  'count_objects',
  'photo_rotate',
  'majority_select',
  'text_distorted',
  'rotate',
  'slider_align',
]

function pickType(allowed?: CaptchaType[]): CaptchaType {
  const pool = allowed?.length ? allowed : HERO_CAPTCHA_TYPES
  // Photo-first human multi-type mix (verified bank).
  if (!allowed?.length) {
    const weighted: CaptchaType[] = [
      'image_select', 'image_select', 'image_select',
      'odd_one_out', 'odd_one_out',
      'pair_match', 'pair_match',
      'label_pick', 'label_pick',
      'count_objects', 'count_objects',
      'photo_rotate',
      'majority_select', 'majority_select',
          'text_distorted',
      'rotate',
      // slider kept rare — no longer free-solvable via SVG
      'slider_align',
    ]
    return weighted[randomInt(weighted.length)]!
  }
  return pool[randomInt(pool.length)]!
}

function publicFromState(state: CaptchaState): CaptchaPublicPayload {
  return {
    captchaId: state.captchaId,
    type: state.type,
    prompt: state.public.prompt,
    expiresIn: Math.max(0, Math.floor((state.expiresAt - Date.now()) / 1000)),
    ui: state.public.ui,
  }
}

function buildImageSelectLike(
  type: 'image_select' | 'image_grid',
): Omit<CaptchaState, 'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'> {
  // Hard rule: always exact 3×3 = 9 tiles (no scroll in professional modal).
  // Only labels with enough real photos; never SVG fallbacks for tiles.
  const GRID = 9
  const eligible = bankBackedLabels(6).filter((l) => labelPhotoCount(l) >= 6)
  if (eligible.length < 2) {
    throw new Error('captcha_photo_bank_insufficient')
  }
  // Prefer targets with enough unique photos for correct tiles + reference
  const rich = eligible.filter((l) => labelPhotoCount(l) >= 4)
  const targetPool = rich.length ? rich : eligible
  const target = targetPool[randomInt(targetPool.length)]!

  // correctCount limited by available unique photos minus 1 reserved for reference
  const maxCorrect = Math.min(4, Math.max(2, labelPhotoCount(target) - 1))
  const correctCount = randomInt(2, maxCorrect + 1) // 2..maxCorrect
  const distractorCount = GRID - correctCount
  const distractorPool = eligible.filter((l) => l !== target)
  const distractors = pickLabels(Math.min(distractorCount, distractorPool.length), [target])
  if (distractors.length === 0) {
    throw new Error('captcha_need_distractors')
  }

  const tiles: { id: string; label: AssetLabel }[] = []
  for (let i = 0; i < correctCount; i++) {
    tiles.push({ id: newAssetId('t'), label: target })
  }
  let d = 0
  while (tiles.length < GRID) {
    tiles.push({ id: newAssetId('t'), label: distractors[d % distractors.length]! })
    d++
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!]
  }
  const correctTileIds = tiles.filter((x) => x.label === target).map((x) => x.id)

  // Unique photos per challenge; reference image is a known-good example of target
  const usedPaths = new Set<string>()
  const reference = imageForLabel(target, 0, usedPaths)
  const assets: CaptchaState['assets'] = {
    reference: {
      contentType: reference.contentType,
      body: reference.body,
      encoding: reference.encoding,
    },
  }
  for (const tile of tiles) {
    const img = imageForLabel(tile.label, 0, usedPaths)
    assets[tile.id] = {
      contentType: img.contentType,
      body: img.body,
      encoding: img.encoding,
    }
  }

  // Do not put class name in prompt — reference image only (reduces CV shortcut + label leak)
  const prompt = 'Select all squares that match the example'
  return {
    type,
    secret: { type, correctTileIds },
    public: {
      captchaId: '',
      type,
      prompt,
      expiresIn: CAPTCHA_TTL_MS / 1000,
      ui: {
        tiles: tiles.map((x) => ({ id: x.id, assetPath: x.id })),
        multi: true,
        columns: 3,
        rows: 3,
        cellCount: GRID,
        /** Known-good example of the target class (not part of the grid). */
        referenceAssetPath: 'reference',
        // referenceLabel intentionally omitted (class name leak)
      },
    },
    assets,
  }
}

function buildText(): Omit<
  CaptchaState,
  'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'
> {
  const text = randomCaptchaText(5)
  const assetId = 'main'
  return {
    type: 'text_distorted',
    secret: { type: 'text_distorted', text },
    public: {
      captchaId: '',
      type: 'text_distorted',
      prompt: 'Type the characters you see',
      expiresIn: CAPTCHA_TTL_MS / 1000,
      ui: { assetPath: assetId, input: 'text', caseInsensitive: true },
    },
    assets: {
      [assetId]: {
        contentType: 'image/svg+xml',
        body: svgTextChallenge(text),
        encoding: 'utf8',
      },
    },
  }
}

function buildRotate(): Omit<
  CaptchaState,
  'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'
> {
  const initial = [45, 90, 135, 180, 225, 270, 315][randomInt(7)]!
  const assetId = 'main'
  return {
    type: 'rotate',
    secret: { type: 'rotate', targetDegrees: 0, tolerance: 20, initialDegrees: initial },
    public: {
      captchaId: '',
      type: 'rotate',
      prompt: 'Rotate the object until it is upright',
      expiresIn: CAPTCHA_TTL_MS / 1000,
      ui: {
        assetPath: assetId,
        // SECURITY: do not expose initialDegrees (free-solve). Asset is pre-rotated server-side.
        step: 15,
        input: 'degrees',
      },
    },
    assets: {
      [assetId]: {
        contentType: 'image/svg+xml',
        body: svgRotateObject(initial),
        encoding: 'utf8',
      },
    },
  }
}

function buildSlider(): Omit<
  CaptchaState,
  'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'
> {
  const targetOffset = randomInt(40, 200)
  const { track, piece } = svgSliderTrack(targetOffset)
  return {
    type: 'slider_align',
    secret: { type: 'slider_align', targetOffset, tolerance: 12 },
    public: {
      captchaId: '',
      type: 'slider_align',
      prompt: 'Slide the piece to the dashed slot',
      expiresIn: CAPTCHA_TTL_MS / 1000,
      ui: {
        trackPath: 'track',
        piecePath: 'piece',
        max: 240,
        input: 'offset',
      },
    },
    assets: {
      track: { contentType: 'image/svg+xml', body: track, encoding: 'utf8' },
      piece: { contentType: 'image/svg+xml', body: piece, encoding: 'utf8' },
    },
  }
}


function buildOddOneOut(): Omit<
  CaptchaState,
  'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'
> {
  // 3×3 grid: 8 same-class tiles + 1 odd class
  const main = randomLabel()
  const oddPick = pickLabels(1, [main])
  if (!oddPick[0]) throw new Error('captcha_need_odd_label')
  const odd = oddPick[0]
  const oddIndex = randomInt(0, 9)
  const tiles: { id: string; label: AssetLabel }[] = []
  let correctId = ''
  for (let i = 0; i < 9; i++) {
    const label = i === oddIndex ? odd : main
    const id = newAssetId('t')
    tiles.push({ id, label })
    if (i === oddIndex) correctId = id
  }
  const usedPaths = new Set<string>()
  const assets: CaptchaState['assets'] = {}
  for (const tile of tiles) {
    const img = imageForLabel(tile.label, 0, usedPaths)
    assets[tile.id] = { contentType: img.contentType, body: img.body, encoding: img.encoding }
  }
  return {
    type: 'odd_one_out',
    secret: { type: 'odd_one_out', correctTileId: correctId },
    public: {
      captchaId: '',
      type: 'odd_one_out',
      prompt: 'Select the square that does not belong',
      expiresIn: CAPTCHA_TTL_MS / 1000,
      ui: {
        tiles: tiles.map((x) => ({ id: x.id, assetPath: x.id })),
        multi: false,
        columns: 3,
        rows: 3,
        cellCount: 9,
      },
    },
    assets,
  }
}

function buildPairMatch(): Omit<
  CaptchaState,
  'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'
> {
  // 3×3 but only 6 tiles shown in 2 rows of 3? Spec wants 3x3 — use 3 pairs + 3 distractors? 
  // Simpler: 6 tiles (3 pairs) in 2x3 with no scroll, or 3x2.
  const labels = pickLabels(3)
  const tiles: { id: string; label: AssetLabel }[] = []
  const pairs: Record<string, string> = {}
  for (const label of labels) {
    const a = newAssetId('t')
    const b = newAssetId('t')
    tiles.push({ id: a, label }, { id: b, label })
    pairs[a] = b
    pairs[b] = a
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!]
  }
  const usedPaths = new Set<string>()
  const assets: CaptchaState['assets'] = {}
  for (const tile of tiles) {
    const img = imageForLabel(tile.label, 0, usedPaths)
    assets[tile.id] = { contentType: img.contentType, body: img.body, encoding: img.encoding }
  }
  return {
    type: 'pair_match',
    secret: { type: 'pair_match', pairs },
    public: {
      captchaId: '',
      type: 'pair_match',
      prompt: 'Select two matching squares',
      expiresIn: CAPTCHA_TTL_MS / 1000,
      ui: {
        tiles: tiles.map((x) => ({ id: x.id, assetPath: x.id })),
        multi: true,
        maxSelect: 2,
        columns: 3,
        rows: 2,
        cellCount: 6,
      },
    },
    assets,
  }
}


function buildLabelPick(): Omit<
  CaptchaState,
  'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'
> {
  // Show one verified photo; user picks the correct class label from 4 options.
  const correct = randomLabel()
  const distractors = pickLabels(3, [correct])
  if (distractors.length < 3) throw new Error('captcha_need_labels')
  const options = [correct, ...distractors]
  for (let i = options.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[options[i], options[j]] = [options[j]!, options[i]!]
  }
  const used = new Set<string>()
  const photo = imageForLabel(correct, 0, used)
  return {
    type: 'label_pick',
    secret: { type: 'label_pick', correctLabel: correct },
    public: {
      captchaId: '',
      type: 'label_pick',
      prompt: 'What is shown in this image?',
      expiresIn: CAPTCHA_TTL_MS / 1000,
      ui: {
        assetPath: 'main',
        input: 'choice',
        options: options.map((l) => ({
          id: l,
          label: l.replaceAll('_', ' '),
        })),
      },
    },
    assets: {
      main: { contentType: photo.contentType, body: photo.body, encoding: photo.encoding },
    },
  }
}

/**
 * Count how many tiles match a target class in a 3×3 verified photo grid.
 * Uses a reference example so the user knows the class.
 */
function buildCountObjects(): Omit<
  CaptchaState,
  'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'
> {
  const GRID = 9
  const eligible = bankBackedLabels(6).filter((l) => labelPhotoCount(l) >= 6)
  if (eligible.length < 2) throw new Error('captcha_photo_bank_insufficient')
  const target = eligible[randomInt(eligible.length)]!
  const maxCorrect = Math.min(5, Math.max(2, labelPhotoCount(target) - 1))
  const correctCount = randomInt(2, maxCorrect + 1)
  const distractorPool = eligible.filter((l) => l !== target)
  const distractors = pickLabels(Math.min(GRID - correctCount, distractorPool.length), [target])
  if (distractors.length === 0) throw new Error('captcha_need_distractors')

  const tiles: { id: string; label: AssetLabel }[] = []
  for (let i = 0; i < correctCount; i++) tiles.push({ id: newAssetId('t'), label: target })
  let d = 0
  while (tiles.length < GRID) {
    tiles.push({ id: newAssetId('t'), label: distractors[d % distractors.length]! })
    d++
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!]
  }

  const usedPaths = new Set<string>()
  const reference = imageForLabel(target, 0, usedPaths)
  const assets: CaptchaState['assets'] = {
    reference: {
      contentType: reference.contentType,
      body: reference.body,
      encoding: reference.encoding,
    },
  }
  for (const tile of tiles) {
    const img = imageForLabel(tile.label, 0, usedPaths)
    assets[tile.id] = { contentType: img.contentType, body: img.body, encoding: img.encoding }
  }

  return {
    type: 'count_objects',
    secret: { type: 'count_objects', count: correctCount },
    public: {
      captchaId: '',
      type: 'count_objects',
      prompt: 'How many squares match the example?',
      expiresIn: CAPTCHA_TTL_MS / 1000,
      ui: {
        tiles: tiles.map((x) => ({ id: x.id, assetPath: x.id })),
        columns: 3,
        rows: 3,
        cellCount: GRID,
        input: 'number',
        referenceAssetPath: 'reference',
        // referenceLabel intentionally omitted (class name leak)
        min: 0,
        max: GRID,
      },
    },
    assets,
  }
}

/**
 * Real photo rotated away from upright; user rotates until upright (lenient tolerance).
 */
function buildPhotoRotate(): Omit<
  CaptchaState,
  'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'
> {
  const label = randomLabel()
  const initial = [45, 90, 135, 180, 225, 270, 315][randomInt(7)]!
  const photo = imageForLabel(label)
  // Bake secret initial rotation into the served asset so public ui cannot leak it.
  const dataUri = `data:${photo.contentType};base64,${photo.body}`
  const wrapped = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="240" height="240" viewBox="0 0 240 240">
  <rect width="240" height="240" rx="16" fill="#0a0a0b"/>
  <g transform="rotate(${initial} 120 120)">
    <image xlink:href="${dataUri}" href="${dataUri}" x="20" y="20" width="200" height="200" preserveAspectRatio="xMidYMid meet"/>
  </g>
</svg>`
  return {
    type: 'photo_rotate',
    secret: { type: 'photo_rotate', targetDegrees: 0, tolerance: 22, initialDegrees: initial },
    public: {
      captchaId: '',
      type: 'photo_rotate',
      prompt: 'Rotate the photo until it is upright',
      expiresIn: CAPTCHA_TTL_MS / 1000,
      ui: {
        assetPath: 'main',
        step: 15,
        input: 'degrees',
      },
    },
    assets: {
      main: { contentType: 'image/svg+xml', body: wrapped, encoding: 'utf8' },
    },
  }
}

function buildBinaryPick(): Omit<
  CaptchaState,
  'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'
> {
  const target = randomLabel()
  const otherPick = pickLabels(1, [target])
  if (!otherPick[0]) throw new Error('captcha_need_odd_label')
  const other = otherPick[0]
  const correctLeft = randomInt(2) === 0
  const leftLabel = correctLeft ? target : other
  const rightLabel = correctLeft ? other : target
  const leftId = newAssetId('t')
  const rightId = newAssetId('t')
  const correctTileId = correctLeft ? leftId : rightId

  const usedPaths = new Set<string>()
  const reference = imageForLabel(target, 0, usedPaths)
  const left = imageForLabel(leftLabel, 0, usedPaths)
  const right = imageForLabel(rightLabel, 0, usedPaths)

  return {
    type: 'binary_pick',
    secret: { type: 'binary_pick', correctTileId },
    public: {
      captchaId: '',
      type: 'binary_pick',
      prompt: 'Which photo matches the example?',
      expiresIn: CAPTCHA_TTL_MS / 1000,
      ui: {
        tiles: [
          { id: leftId, assetPath: leftId },
          { id: rightId, assetPath: rightId },
        ],
        multi: false,
        columns: 2,
        rows: 1,
        cellCount: 2,
        input: 'choice',
        referenceAssetPath: 'reference',
        // referenceLabel intentionally omitted (class name leak)
      },
    },
    assets: {
      reference: {
        contentType: reference.contentType,
        body: reference.body,
        encoding: reference.encoding,
      },
      [leftId]: { contentType: left.contentType, body: left.body, encoding: left.encoding },
      [rightId]: { contentType: right.contentType, body: right.body, encoding: right.encoding },
    },
  }
}

/**
 * Select the majority class in a 3×3 grid (5+ tiles of one verified class).
 * Soft scoring reuses image near-miss rules.
 */
function buildMajoritySelect(): Omit<
  CaptchaState,
  'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'
> {
  const GRID = 9
  const eligible = bankBackedLabels(6).filter((l) => labelPhotoCount(l) >= 6)
  if (eligible.length < 2) throw new Error('captcha_photo_bank_insufficient')
  const majority = eligible[randomInt(eligible.length)]!
  // 5 or 6 majority tiles so majority is clear but not trivial
  const majorityCount = randomInt(5, 7)
  const minorityCount = GRID - majorityCount
  const distractors = pickLabels(Math.min(minorityCount, eligible.length - 1), [majority])
  if (distractors.length === 0) throw new Error('captcha_need_distractors')

  const tiles: { id: string; label: AssetLabel }[] = []
  for (let i = 0; i < majorityCount; i++) tiles.push({ id: newAssetId('t'), label: majority })
  let d = 0
  while (tiles.length < GRID) {
    tiles.push({ id: newAssetId('t'), label: distractors[d % distractors.length]! })
    d++
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!]
  }
  const correctTileIds = tiles.filter((x) => x.label === majority).map((x) => x.id)

  const usedPaths = new Set<string>()
  const assets: CaptchaState['assets'] = {}
  for (const tile of tiles) {
    const img = imageForLabel(tile.label, 0, usedPaths)
    assets[tile.id] = { contentType: img.contentType, body: img.body, encoding: img.encoding }
  }

  return {
    type: 'majority_select',
    secret: { type: 'majority_select', correctTileIds },
    public: {
      captchaId: '',
      type: 'majority_select',
      prompt: 'Select every square that belongs to the most common type',
      expiresIn: CAPTCHA_TTL_MS / 1000,
      ui: {
        tiles: tiles.map((x) => ({ id: x.id, assetPath: x.id })),
        multi: true,
        columns: 3,
        rows: 3,
        cellCount: GRID,
      },
    },
    assets,
  }
}

export function issueCaptcha(opts?: {
  types?: CaptchaType[]
  preferredType?: CaptchaType
}): CaptchaState {
  const type =
    opts?.preferredType && (CAPTCHA_TYPES as readonly string[]).includes(opts.preferredType)
      ? opts.preferredType
      : pickType(opts?.types)

  let partial: Omit<
    CaptchaState,
    'captchaId' | 'status' | 'attempts' | 'maxAttempts' | 'expiresAt'
  >
  try {
    switch (type) {
      case 'image_select':
        partial = buildImageSelectLike('image_select')
        break
      case 'image_grid':
        partial = buildImageSelectLike('image_grid')
        break
      case 'text_distorted':
        partial = buildText()
        break
      case 'rotate':
        partial = buildRotate()
        break
      case 'slider_align':
        partial = buildSlider()
        break
      case 'odd_one_out':
        partial = buildOddOneOut()
        break
      case 'pair_match':
        partial = buildPairMatch()
        break
      case 'label_pick':
        partial = buildLabelPick()
        break
      case 'count_objects':
        partial = buildCountObjects()
        break
      case 'photo_rotate':
        partial = buildPhotoRotate()
        break
      case 'binary_pick':
        partial = buildBinaryPick()
        break
      case 'majority_select':
        partial = buildMajoritySelect()
        break
      default:
        partial = buildText()
    }
  } catch {
    // Photo bank shortfall — never ship empty/SVG grids; fall back to text.
    partial = buildText()
  }

  const captchaId = randomId('cap')
  return {
    captchaId,
    type: partial.type,
    status: 'pending',
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    expiresAt: Date.now() + CAPTCHA_TTL_MS,
    secret: partial.secret,
    public: { ...partial.public, captchaId },
    assets: partial.assets,
  }
}

export function getCaptchaPublic(state: CaptchaState): CaptchaPublicPayload {
  return publicFromState(state)
}

export function getCaptchaAsset(
  state: CaptchaState,
  assetPath: string,
): { contentType: string; body: Buffer } | null {
  const asset = state.assets[assetPath]
  if (!asset) return null
  if (state.expiresAt <= Date.now()) return null
  const body =
    asset.encoding === 'base64' ? Buffer.from(asset.body, 'base64') : Buffer.from(asset.body, 'utf8')
  return { contentType: asset.contentType, body }
}

function arraysEqualSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((x) => set.has(x))
}

/**
 * Lenient human scoring: allow missing/extra tiles as long as the bulk is right.
 * Pass if:
 *  - exact match, OR
 *  - at least 60% of correct tiles selected AND at most 1 false positive, OR
 *  - all correct tiles selected with at most 1 extra
 */
function imageSelectCloseEnough(selected: string[], correct: string[]): boolean {
  // Security-hardened: exact set match only (no half-correct / extra-tile free passes).
  // Human wiggle remains via MAX_ATTEMPTS, not fuzzy tile sets.
  return arraysEqualSet(selected, correct)
}

function circularDistance(a: number, b: number): number {
  const d = Math.abs((((a % 360) + 360) % 360) - (((b % 360) + 360) % 360))
  return Math.min(d, 360 - d)
}

export type CaptchaVerifyResult =
  | { ok: true; state: CaptchaState; attemptsRemaining: number; maxAttempts: number }
  | {
      ok: false
      state: CaptchaState
      error_code: string
      detail: string
      status: number
      attemptsRemaining?: number
      maxAttempts?: number
    }

export function verifyCaptchaAnswer(
  state: CaptchaState,
  input: CaptchaAnswerInput,
): CaptchaVerifyResult {
  if (state.status === 'solved') {
    return {
      ok: true,
      state,
      attemptsRemaining: Math.max(0, state.maxAttempts - state.attempts),
      maxAttempts: state.maxAttempts,
    }
  }
  if (state.status === 'failed' || state.attempts >= state.maxAttempts) {
    state.status = 'failed'
    return {
      ok: false,
      state,
      error_code: 'captcha_locked',
      detail: 'Too many attempts — open a fresh challenge',
      status: 429,
    }
  }
  if (state.expiresAt <= Date.now()) {
    state.status = 'expired'
    return {
      ok: false,
      state,
      error_code: 'captcha_expired',
      detail: 'Captcha expired; request a new one',
      status: 401,
    }
  }

  state.attempts += 1
  let correct = false
  const value = input.value

  switch (state.secret.type) {
    case 'image_select':
    case 'image_grid': {
      const ids = Array.isArray(value)
        ? value.map(String)
        : typeof value === 'object' &&
            value &&
            Array.isArray((value as { selected?: unknown }).selected)
          ? (value as { selected: unknown[] }).selected.map(String)
          : []
      correct = imageSelectCloseEnough(ids, state.secret.correctTileIds)
      break
    }
    case 'text_distorted': {
      const text =
        typeof value === 'string' ? value : String((value as { text?: string })?.text ?? '')
      // Exact match only after normalize (no edit-distance free pass for bots)
      correct = secretsEqual(normalizeText(text), normalizeText(state.secret.text))
      break
    }
    case 'rotate': {
      const degrees =
        typeof value === 'number'
          ? value
          : Number((value as { degrees?: number })?.degrees ?? NaN)
      if (!Number.isFinite(degrees)) {
        correct = false
        break
      }
      const initial = Number((state.secret as { initialDegrees?: number }).initialDegrees ?? 0)
      const displayAbs = (((initial + degrees) % 360) + 360) % 360
      correct = circularDistance(displayAbs, state.secret.targetDegrees) <= state.secret.tolerance
      break
    }
    case 'slider_align': {
      const offset =
        typeof value === 'number'
          ? value
          : Number((value as { offset?: number })?.offset ?? NaN)
      correct = Math.abs(offset - state.secret.targetOffset) <= state.secret.tolerance
      break
    }
    case 'odd_one_out': {
      const id =
        typeof value === 'string'
          ? value
          : Array.isArray(value)
            ? String(value[0] ?? '')
            : String((value as { selected?: string[] })?.selected?.[0] ?? (value as { id?: string })?.id ?? '')
      correct = id === state.secret.correctTileId
      break
    }
    case 'pair_match': {
      const ids = Array.isArray(value)
        ? value.map(String)
        : typeof value === 'object' &&
            value &&
            Array.isArray((value as { selected?: unknown }).selected)
          ? (value as { selected: unknown[] }).selected.map(String)
          : []
      correct =
        ids.length === 2 &&
        state.secret.pairs[ids[0]!] === ids[1] &&
        state.secret.pairs[ids[1]!] === ids[0]
      break
    }
    case 'label_pick': {
      const choice =
        typeof value === 'string'
          ? value
          : String((value as { id?: string; label?: string })?.id ?? (value as { label?: string })?.label ?? '')
      correct = choice === state.secret.correctLabel
      break
    }
    case 'count_objects': {
      const n =
        typeof value === 'number'
          ? value
          : Number((value as { answer?: number; count?: number })?.answer ?? (value as { count?: number })?.count ?? value)
      if (Number.isFinite(n)) {
        correct = n === state.secret.count
      }
      break
    }
    case 'photo_rotate': {
      const degrees =
        typeof value === 'number'
          ? value
          : Number((value as { degrees?: number })?.degrees ?? NaN)
      if (!Number.isFinite(degrees)) {
        correct = false
        break
      }
      const initial = Number((state.secret as { initialDegrees?: number }).initialDegrees ?? 0)
      const displayAbs = (((initial + degrees) % 360) + 360) % 360
      correct = circularDistance(displayAbs, state.secret.targetDegrees) <= state.secret.tolerance
      break
    }
    case 'binary_pick': {
      const id =
        typeof value === 'string'
          ? value
          : Array.isArray(value)
            ? String(value[0] ?? '')
            : String(
                (value as { selected?: string[] })?.selected?.[0] ??
                  (value as { id?: string })?.id ??
                  '',
              )
      correct = id === state.secret.correctTileId
      break
    }
    case 'majority_select': {
      const ids = Array.isArray(value)
        ? value.map(String)
        : typeof value === 'object' &&
            value &&
            Array.isArray((value as { selected?: unknown }).selected)
          ? (value as { selected: unknown[] }).selected.map(String)
          : []
      correct = imageSelectCloseEnough(ids, state.secret.correctTileIds)
      break
    }
    default:
      correct = false
  }

  if (correct) {
    state.status = 'solved'
    return {
      ok: true,
      state,
      attemptsRemaining: Math.max(0, state.maxAttempts - state.attempts),
      maxAttempts: state.maxAttempts,
    }
  }

  if (state.attempts >= state.maxAttempts) {
    state.status = 'failed'
    return {
      ok: false,
      state,
      error_code: 'captcha_locked',
      detail: 'Too many incorrect answers',
      status: 429,
    }
  }

  return {
    ok: false,
    state,
    error_code: 'captcha_incorrect',
    detail: `Not quite — ${Math.max(0, state.maxAttempts - state.attempts)} left`,
    status: 401,
    attemptsRemaining: Math.max(0, state.maxAttempts - state.attempts),
    maxAttempts: state.maxAttempts,
  }
}

export function captchaSecretFingerprint(state: CaptchaState): string {
  return sha256Hex(JSON.stringify(state.secret)).slice(0, 12)
}

export { CAPTCHA_TYPES, DEFAULT_CAPTCHA_TYPES }
