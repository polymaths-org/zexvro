// Tests for the asset helpers: no image bytes may remain inline after the
// migration transform, and only allowlisted hosts validate.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDataUrls,
  isAllowedAssetUrl,
  replaceDataUrlsWithRefs,
  storagePathForLabAsset,
  validateAssetRef,
} from './assets.ts';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('assets', () => {
  it('accepts only allowlisted hosts and 64-hex hashes', () => {
    const hash = 'a'.repeat(64);
    assert.equal(validateAssetRef('https://firebasestorage.googleapis.com/v0/b/x/o/y', hash).ok, true);
    assert.equal(validateAssetRef('https://evil.example.com/y.png', hash).ok, false);
    assert.equal(validateAssetRef('https://labs.zexvro.in/brand/logo.png', 'zz').ok, false);
    assert.equal(isAllowedAssetUrl('not a url'), false);
  });

  it('builds content-hashed storage paths', () => {
    const p = storagePathForLabAsset('lab_solidity_101', 'banner', 'ab'.repeat(32), 'image/png');
    assert.ok(p.startsWith('labs/lab_solidity_101/banner-'));
    assert.ok(p.endsWith('.png'));
  });

  it('extracts inline data URLs and replaces them with refs', async () => {
    const doc = {
      id: 'lab_1',
      bannerUrl: TINY_PNG,
      credential: { badge: { backgroundImage: TINY_PNG } },
      title: 'plain',
    };
    const found = extractDataUrls(doc);
    assert.equal(found.length, 2);
    assert.ok((doc.bannerUrl as string).startsWith('data:'));
    const replaced = await replaceDataUrlsWithRefs(doc, async (asset, hash) => ({
      url: `https://firebasestorage.googleapis.com/v0/b/b/o/${asset.mime === 'image/png' ? 'x.png' : 'x'}`,
      sha256: hash,
    }));
    assert.deepEqual(replaced, ['$.bannerUrl', '$.credential.badge.backgroundImage']);
    assert.ok(typeof doc.bannerUrl === 'object');
    assert.match((doc.bannerUrl as unknown as { sha256: string }).sha256, /^[0-9a-f]{64}$/);
  });
});
