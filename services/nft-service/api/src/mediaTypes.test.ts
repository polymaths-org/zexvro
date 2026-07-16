import { describe, expect, it } from 'vitest'
import { resolveNftImageMime } from './mediaTypes.js'

describe('resolveNftImageMime', () => {
  it('accepts canonical mimes', () => {
    expect(resolveNftImageMime('image/png', 'x.bin')).toBe('image/png')
    expect(resolveNftImageMime('image/jpeg', 'x.bin')).toBe('image/jpeg')
    expect(resolveNftImageMime('image/webp', 'x.bin')).toBe('image/webp')
    expect(resolveNftImageMime('image/svg+xml', 'x.bin')).toBe('image/svg+xml')
  })

  it('normalizes jpeg aliases', () => {
    expect(resolveNftImageMime('image/jpg', 'x.bin')).toBe('image/jpeg')
    expect(resolveNftImageMime('image/pjpeg', 'x.bin')).toBe('image/jpeg')
  })

  it('falls back to extension when mimetype is empty or generic', () => {
    expect(resolveNftImageMime('', 'hero.PNG')).toBe('image/png')
    expect(resolveNftImageMime(undefined, 'hero.JPG')).toBe('image/jpeg')
    expect(resolveNftImageMime('application/octet-stream', 'hero.webp')).toBe(
      'image/webp',
    )
    expect(resolveNftImageMime('application/octet-stream', 'hero.bin')).toBeNull()
  })

  it('accepts svg and rejects gif', () => {
    expect(resolveNftImageMime('image/svg+xml', 'hero.svg')).toBe('image/svg+xml')
    expect(resolveNftImageMime('', 'hero.SVG')).toBe('image/svg+xml')
    expect(resolveNftImageMime('image/gif', 'hero.gif')).toBeNull()
  })
})
