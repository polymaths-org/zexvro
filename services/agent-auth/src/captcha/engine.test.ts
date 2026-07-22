import { describe, expect, it } from 'vitest'
import { issueCaptcha, verifyCaptchaAnswer, CAPTCHA_TYPES } from './engine.js'

describe('captcha engine', () => {
  it('exports all captcha types', () => {
    expect(CAPTCHA_TYPES).toHaveLength(12)
  })

  it('issues each type without leaking secret fields in public payload', () => {
    for (const type of CAPTCHA_TYPES) {
      const state = issueCaptcha({ preferredType: type })
      // Photo bank shortfall may fall back to text — still must not leak secrets.
      expect(state.status).toBe('pending')
      const pub = state.public
      const json = JSON.stringify(pub)
      expect(json).not.toMatch(/correctTileIds|secret|correctLabel/)
      if (state.type === 'text_distorted') {
        expect(json).not.toContain((state.secret as { text: string }).text)
      }
    }
  })

  it('text_distorted accepts correct answer case-insensitively', () => {
    const state = issueCaptcha({ preferredType: 'text_distorted' })
    const text = (state.secret as { text: string }).text
    const bad = verifyCaptchaAnswer(state, { value: 'XXXXX' })
    expect(bad.ok).toBe(false)
    const good = verifyCaptchaAnswer(state, { value: text.toLowerCase() })
    expect(good.ok).toBe(true)
    expect(good.state.status).toBe('solved')
  })

  it('image_select requires near-exact set of tiles', () => {
    const state = issueCaptcha({ preferredType: 'image_select' })
    if (state.type !== 'image_select') return
    const correct = (state.secret as { correctTileIds: string[] }).correctTileIds
    const fail = verifyCaptchaAnswer(state, { value: [] })
    expect(fail.ok).toBe(false)
    const ok = verifyCaptchaAnswer(state, { value: correct })
    expect(ok.ok).toBe(true)
  })


  it('slider_align allows tight tolerance', () => {
    const state = issueCaptcha({ preferredType: 'slider_align' })
    const target = (state.secret as { targetOffset: number }).targetOffset
    expect(verifyCaptchaAnswer(state, { value: target + 5 }).ok).toBe(true)
    const s2 = issueCaptcha({ preferredType: 'slider_align' })
    const t2 = (s2.secret as { targetOffset: number }).targetOffset
    expect(verifyCaptchaAnswer(s2, { value: t2 + 40 }).ok).toBe(false)
  })

  it('locks after max attempts', () => {
    const state = issueCaptcha({ preferredType: 'text_distorted' })
    for (let i = 0; i < 5; i++) {
      verifyCaptchaAnswer(state, { value: 'WRONG' })
    }
    const locked = verifyCaptchaAnswer(state, { value: 'WRONG' })
    expect(locked.ok).toBe(false)
    if (!locked.ok) expect(locked.error_code).toBe('captcha_locked')
  })



  it('odd_one_out accepts the unique tile', () => {
    const state = issueCaptcha({ preferredType: 'odd_one_out' })
    if (state.type !== 'odd_one_out') return
    const id = (state.secret as { correctTileId: string }).correctTileId
    expect(verifyCaptchaAnswer(state, { value: 'wrong' }).ok).toBe(false)
    expect(verifyCaptchaAnswer(state, { value: id }).ok).toBe(true)
  })

  it('pair_match accepts a correct pair', () => {
    const state = issueCaptcha({ preferredType: 'pair_match' })
    if (state.type !== 'pair_match') return // needs photo bank labels
    const pairs = (state.secret as { pairs: Record<string, string> }).pairs
    const a = Object.keys(pairs)[0]
    if (!a || !pairs[a]) return // empty bank → empty pairs
    const b = pairs[a]
    expect(verifyCaptchaAnswer(state, { value: [a, 'nope'] }).ok).toBe(false)
    expect(verifyCaptchaAnswer(state, { value: [a, b] }).ok).toBe(true)
  })

  it('image_select includes a reference example and only photo assets', () => {
    const state = issueCaptcha({ preferredType: 'image_select' })
    if (state.type !== 'image_select') return // bank fallback
    expect(state.public.ui.referenceAssetPath).toBe('reference')
    expect(state.assets.reference?.contentType).toMatch(/image\//)
    expect(state.assets.reference?.contentType).not.toMatch(/svg/)
    for (const tile of state.public.ui.tiles as { id: string }[]) {
      const a = state.assets[tile.id]
      expect(a?.contentType).toMatch(/image\//)
      expect(a?.contentType).not.toMatch(/svg/)
    }
  })

  it('label_pick accepts correct class label', () => {
    const state = issueCaptcha({ preferredType: 'label_pick' })
    if (state.type !== 'label_pick') return
    const correct = (state.secret as { correctLabel: string }).correctLabel
    expect(verifyCaptchaAnswer(state, { value: 'not_a_label' }).ok).toBe(false)
    expect(verifyCaptchaAnswer(state, { value: correct }).ok).toBe(true)
  })

  it('count_objects accepts exact count (and off-by-one for larger counts)', () => {
    const state = issueCaptcha({ preferredType: 'count_objects' })
    if (state.type !== 'count_objects') return
    const count = (state.secret as { count: number }).count
    expect(verifyCaptchaAnswer(state, { value: count + 3 }).ok).toBe(false)
    const s2 = issueCaptcha({ preferredType: 'count_objects' })
    if (s2.type !== 'count_objects') return
    const c2 = (s2.secret as { count: number }).count
    expect(verifyCaptchaAnswer(s2, { value: c2 }).ok).toBe(true)
  })

  it('photo_rotate accepts upright within tolerance', () => {
    const state = issueCaptcha({ preferredType: 'photo_rotate' })
    if (state.type !== 'photo_rotate') return
    const initial = Number((state.secret as { initialDegrees: number }).initialDegrees ?? 0)
    // public ui must not leak initialDegrees
    expect(state.public.ui.initialDegrees).toBeUndefined()
    const degrees = (360 - (initial % 360)) % 360
    expect(verifyCaptchaAnswer(state, { value: { degrees } }).ok).toBe(true)
  })

  it('binary_pick accepts the matching photo', () => {
    const state = issueCaptcha({ preferredType: 'binary_pick' })
    if (state.type !== 'binary_pick') return
    const id = (state.secret as { correctTileId: string }).correctTileId
    expect(verifyCaptchaAnswer(state, { value: 'wrong' }).ok).toBe(false)
    expect(verifyCaptchaAnswer(state, { value: id }).ok).toBe(true)
  })

  it('majority_select accepts majority class tiles', () => {
    const state = issueCaptcha({ preferredType: 'majority_select' })
    if (state.type !== 'majority_select') return
    const correct = (state.secret as { correctTileIds: string[] }).correctTileIds
    expect(verifyCaptchaAnswer(state, { value: [] }).ok).toBe(false)
    expect(verifyCaptchaAnswer(state, { value: correct }).ok).toBe(true)
  })

  it('rotate rejects free-solves without secret initial', () => {
    const state = issueCaptcha({ preferredType: 'rotate' })
    if (state.type !== 'rotate') return
    expect(state.public.ui.initialDegrees).toBeUndefined()
    const initial = Number((state.secret as { initialDegrees: number }).initialDegrees ?? 0)
    // Old attacks
    expect(verifyCaptchaAnswer(state, { value: { displayDegrees: 0 } }).ok).toBe(false)
    // degrees=0 is only correct if already upright (initial 0) — rare
    if (initial !== 0) {
      expect(verifyCaptchaAnswer(state, { value: 0 }).ok).toBe(false)
    }
    // Public UI must not expose initialDegrees for attackers to invert without the secret
    expect(state.public.ui.initialDegrees).toBeUndefined()
    const degrees = (360 - (initial % 360)) % 360
    expect(verifyCaptchaAnswer(state, { value: { degrees } }).ok).toBe(true)
  })

  it('image_select requires exact tile set (no half-correct)', () => {
    const state = issueCaptcha({ preferredType: 'image_select' })
    if (state.type !== 'image_select') return
    const correct = (state.secret as { correctTileIds: string[] }).correctTileIds
    if (correct.length < 2) return
    const almost = correct.slice(0, -1)
    expect(verifyCaptchaAnswer(state, { value: almost }).ok).toBe(false)
    expect(verifyCaptchaAnswer(state, { value: correct }).ok).toBe(true)
  })

  it('text SVG does not embed answer as scrapeable full string in single text node', () => {
    const state = issueCaptcha({ preferredType: 'text_distorted' })
    const text = (state.secret as { text: string }).text
    const svg = state.assets.main?.body || ''
    // Bitmap font: secret must not appear as contiguous text content
    expect(svg).not.toContain(`>${text}<`)
    expect(svg).not.toContain(`>${text.toLowerCase()}<`)
  })

  it('slider track SVG does not encode secret target offset', () => {
    const state = issueCaptcha({ preferredType: 'slider_align' })
    const target = (state.secret as { targetOffset: number }).targetOffset
    const track = state.assets.track?.body || ''
    // Must not paint secret slot at 12+target (old free-solve)
    expect(track).not.toContain(`x="${12 + target}"`)
    expect(track).not.toMatch(/stroke-dasharray/)
  })

  it('image_select public prompt does not leak class name', () => {
    const state = issueCaptcha({ preferredType: 'image_select' })
    if (state.type !== 'image_select') return
    const json = JSON.stringify(state.public)
    expect(json).not.toMatch(/\(motorcycle\)|\(boat\)|\(car\)|referenceLabel/)
    expect(state.public.prompt).toBe('Select all squares that match the example')
  })

})