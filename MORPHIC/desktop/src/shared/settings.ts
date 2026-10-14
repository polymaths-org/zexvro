import { ANSWER_LENGTHS, LANGUAGES, TONES, type AnswerLength, type LanguageCode, type Personality, type Tone } from './core'

export const TEXT_SIZES = ['regular', 'large', 'extra-large'] as const
export const THEMES = ['system', 'light', 'dark'] as const
/** Colour themes. Each works in both light and dark; "contrast" swaps glass for solid, high-contrast surfaces. */
export const PALETTES = ['lavender', 'ocean', 'sunrise', 'forest', 'rose', 'snow', 'desert', 'contrast'] as const

export const BG_MOTIONS = ['still', 'slow', 'normal', 'lively'] as const
export const ANIMATIONS = ['full', 'reduced'] as const

export type TextSize = (typeof TEXT_SIZES)[number]
export type ThemeChoice = (typeof THEMES)[number]
export type Palette = (typeof PALETTES)[number]
export type BgMotion = (typeof BG_MOTIONS)[number]
export type Animations = (typeof ANIMATIONS)[number]

/** Look-and-feel fine tuning, under Settings → Advanced. */
export interface Advanced {
  /** Backdrop blur behind chat bubbles, px. */
  bubbleBlur: number
  /** Backdrop blur behind panels (sidebar, cards, ask box), px. */
  panelBlur: number
  /** How solid glass looks: 0 = clear glass, 90 = almost solid. */
  glassTint: number
  /** Background scene strength, percent (100 = as designed). */
  bgBrightness: number
  bgMotion: BgMotion
  animations: Animations
}

export const DEFAULT_ADVANCED: Advanced = {
  bubbleBlur: 20,
  panelBlur: 28,
  glassTint: 0,
  bgBrightness: 100,
  bgMotion: 'normal',
  animations: 'full'
}

/** Inclusive ranges for the numeric advanced settings (also used by the sliders). */
export const ADVANCED_RANGES = {
  bubbleBlur: [0, 40],
  panelBlur: [0, 40],
  glassTint: [0, 90],
  bgBrightness: [40, 160]
} as const

export interface Settings {
  onboarded: boolean
  name: string
  textSize: TextSize
  readAloud: boolean
  theme: ThemeChoice
  palette: Palette
  sidebarOpen: boolean
  advanced: Advanced
  /** Reading & voice */
  voice: string
  voiceRate: number
  language: LanguageCode
  answerLength: AnswerLength
  /** Memory & privacy */
  memory: boolean
  /** Reminders */
  notifications: boolean
  /** System */
  openAtLogin: boolean
  /** Morph's AI service address; empty = built-in default. */
  serviceUrl: string
  /** Connectors → built-in browser */
  browser: boolean
  askBeforeBrowsing: boolean
  /** Look → play the short opening animation when Morph starts */
  introAnimation: boolean
  /** Morph's answers → personality (layered on top of Morph's soul) */
  personality: Personality
}

export const DEFAULT_PERSONALITY: Personality = { tone: 'warm', humour: false, callMe: '' }

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  name: '',
  textSize: 'regular',
  readAloud: false,
  theme: 'system',
  palette: 'lavender',
  sidebarOpen: true,
  advanced: DEFAULT_ADVANCED,
  voice: '',
  voiceRate: 0.95,
  language: 'auto',
  answerLength: 'normal',
  memory: true,
  notifications: true,
  openAtLogin: false,
  serviceUrl: '',
  browser: true,
  askBeforeBrowsing: false,
  introAnimation: true,
  personality: DEFAULT_PERSONALITY
}

/** Root font size per text size; every size in the UI is in rem, so this scales the whole app. */
export const TEXT_SIZE_PX: Record<TextSize, number> = {
  regular: 18,
  large: 21,
  'extra-large': 24
}

const NAME_MAX = 40

/** Keeps only known keys with valid values; anything else falls back to the current value. */
export function sanitizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const next = { ...base }
  if (!input || typeof input !== 'object') return next
  const raw = input as Record<string, unknown>
  if (typeof raw.onboarded === 'boolean') next.onboarded = raw.onboarded
  if (typeof raw.name === 'string') next.name = raw.name.trim().slice(0, NAME_MAX)
  if (TEXT_SIZES.includes(raw.textSize as TextSize)) next.textSize = raw.textSize as TextSize
  if (typeof raw.readAloud === 'boolean') next.readAloud = raw.readAloud
  if (THEMES.includes(raw.theme as ThemeChoice)) next.theme = raw.theme as ThemeChoice
  if (PALETTES.includes(raw.palette as Palette)) next.palette = raw.palette as Palette
  if (typeof raw.sidebarOpen === 'boolean') next.sidebarOpen = raw.sidebarOpen
  next.advanced = sanitizeAdvanced(raw.advanced, base.advanced ?? DEFAULT_ADVANCED)
  if (typeof raw.voice === 'string') next.voice = raw.voice.slice(0, 200)
  if (typeof raw.voiceRate === 'number' && Number.isFinite(raw.voiceRate)) next.voiceRate = Math.min(1.4, Math.max(0.6, raw.voiceRate))
  if (LANGUAGES.some((l) => l.code === raw.language)) next.language = raw.language as LanguageCode
  if (ANSWER_LENGTHS.includes(raw.answerLength as AnswerLength)) next.answerLength = raw.answerLength as AnswerLength
  for (const key of ['memory', 'notifications', 'openAtLogin', 'browser', 'askBeforeBrowsing', 'introAnimation'] as const) {
    if (typeof raw[key] === 'boolean') next[key] = raw[key]
  }
  if (typeof raw.serviceUrl === 'string') next.serviceUrl = validServiceUrl(raw.serviceUrl)
  next.personality = sanitizePersonality(raw.personality, base.personality ?? DEFAULT_PERSONALITY)
  return next
}

export function sanitizePersonality(input: unknown, base: Personality = DEFAULT_PERSONALITY): Personality {
  const next = { ...DEFAULT_PERSONALITY, ...base }
  if (!input || typeof input !== 'object') return next
  const raw = input as Record<string, unknown>
  if (TONES.some((t) => t.id === raw.tone)) next.tone = raw.tone as Tone
  if (typeof raw.humour === 'boolean') next.humour = raw.humour
  if (typeof raw.callMe === 'string') next.callMe = raw.callMe.replace(/\s+/g, ' ').trim().slice(0, 30)
  return next
}

/** Only http(s) addresses are accepted; anything else falls back to the default (empty). */
export function validServiceUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString().replace(/\/$/, '') : ''
  } catch {
    return ''
  }
}

function sanitizeAdvanced(input: unknown, base: Advanced): Advanced {
  const next = { ...DEFAULT_ADVANCED, ...base }
  if (!input || typeof input !== 'object') return next
  const raw = input as Record<string, unknown>
  for (const key of Object.keys(ADVANCED_RANGES) as (keyof typeof ADVANCED_RANGES)[]) {
    const value = raw[key]
    const [min, max] = ADVANCED_RANGES[key]
    if (typeof value === 'number' && Number.isFinite(value)) next[key] = Math.round(Math.min(max, Math.max(min, value)))
  }
  if (BG_MOTIONS.includes(raw.bgMotion as BgMotion)) next.bgMotion = raw.bgMotion as BgMotion
  if (ANIMATIONS.includes(raw.animations as Animations)) next.animations = raw.animations as Animations
  return next
}
