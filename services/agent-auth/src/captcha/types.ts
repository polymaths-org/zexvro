/** Self-hosted multi-type CAPTCHA for ZEXVRO Gate human channel. */

export const CAPTCHA_TYPES = [
  'image_select',
  'image_grid',
  'text_distorted',
  'rotate',
  'slider_align',
  'odd_one_out',
  'pair_match',
  'label_pick',
  'count_objects',
  'photo_rotate',
  'binary_pick',
  'majority_select',
] as const

export type CaptchaType = (typeof CAPTCHA_TYPES)[number]

export type CaptchaStatus = 'pending' | 'solved' | 'failed' | 'expired'

/** Server-only answer material (never sent to client). */
export type CaptchaSecret =
  | { type: 'image_select'; correctTileIds: string[] }
  | { type: 'image_grid'; correctTileIds: string[] }
  | { type: 'text_distorted'; text: string }
  | { type: 'rotate'; targetDegrees: number; tolerance: number; initialDegrees: number }
  | { type: 'slider_align'; targetOffset: number; tolerance: number }
  | { type: 'odd_one_out'; correctTileId: string }
  | { type: 'pair_match'; pairs: Record<string, string> }
  | { type: 'label_pick'; correctLabel: string }
  | { type: 'count_objects'; count: number }
  | { type: 'photo_rotate'; targetDegrees: number; tolerance: number; initialDegrees: number }
  | { type: 'binary_pick'; correctTileId: string }
  | { type: 'majority_select'; correctTileIds: string[] }

/** Public puzzle payload for the widget. */
export interface CaptchaPublicPayload {
  captchaId: string
  type: CaptchaType
  prompt: string
  expiresIn: number
  /** Type-specific public fields only. */
  ui: Record<string, unknown>
}

export interface CaptchaState {
  captchaId: string
  type: CaptchaType
  status: CaptchaStatus
  attempts: number
  maxAttempts: number
  expiresAt: number
  secret: CaptchaSecret
  public: CaptchaPublicPayload
  assets: Record<string, { contentType: string; body: string; encoding: 'utf8' | 'base64' }>
}

export interface CaptchaAnswerInput {
  value: unknown
}

export const DEFAULT_CAPTCHA_TYPES: CaptchaType[] = [...CAPTCHA_TYPES]
