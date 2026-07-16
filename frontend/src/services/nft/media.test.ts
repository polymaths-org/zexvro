import { describe, expect, it } from 'vitest';
import {
  NFT_MEDIA_MAX_BYTES,
  normalizeNftImageFile,
  resolveNftImageMime,
} from './media';

describe('resolveNftImageMime', () => {
  it('accepts canonical browser mimes', () => {
    expect(resolveNftImageMime({ name: 'cover.bin', type: 'image/png' })).toBe('image/png');
    expect(resolveNftImageMime({ name: 'cover.bin', type: 'image/jpeg' })).toBe('image/jpeg');
    expect(resolveNftImageMime({ name: 'cover.bin', type: 'image/webp' })).toBe('image/webp');
    expect(resolveNftImageMime({ name: 'cover.bin', type: 'image/svg+xml' })).toBe('image/svg+xml');
  });

  it('normalizes jpeg aliases', () => {
    expect(resolveNftImageMime({ name: 'cover.bin', type: 'image/jpg' })).toBe('image/jpeg');
    expect(resolveNftImageMime({ name: 'cover.bin', type: 'image/pjpeg' })).toBe('image/jpeg');
  });

  it('falls back to filename extension when type is empty or generic', () => {
    expect(resolveNftImageMime({ name: 'hero.PNG', type: '' })).toBe('image/png');
    expect(resolveNftImageMime({ name: 'hero.JPG', type: '' })).toBe('image/jpeg');
    expect(resolveNftImageMime({ name: 'hero.jpeg', type: '' })).toBe('image/jpeg');
    expect(resolveNftImageMime({ name: 'hero.webp', type: '' })).toBe('image/webp');
    expect(resolveNftImageMime({ name: 'hero.svg', type: '' })).toBe('image/svg+xml');
    expect(resolveNftImageMime({ name: 'hero.png', type: 'application/octet-stream' })).toBe(
      'image/png',
    );
  });

  it('rejects unsupported types without a known extension', () => {
    expect(resolveNftImageMime({ name: 'hero.gif', type: 'image/gif' })).toBeNull();
    expect(resolveNftImageMime({ name: 'hero', type: '' })).toBeNull();
  });
});

describe('normalizeNftImageFile', () => {
  it('rewrites empty mime from extension so multipart uploads stay typed', () => {
    const raw = new File([new Uint8Array([1, 2, 3])], 'cover.png', { type: '' });
    const normalized = normalizeNftImageFile(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.type).toBe('image/png');
    expect(normalized?.name).toBe('cover.png');
  });

  it('returns the same file when already canonical', () => {
    const raw = new File([new Uint8Array([1])], 'cover.webp', { type: 'image/webp' });
    expect(normalizeNftImageFile(raw)).toBe(raw);
  });

  it('rejects oversized handling is left to callers via NFT_MEDIA_MAX_BYTES', () => {
    expect(NFT_MEDIA_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});
