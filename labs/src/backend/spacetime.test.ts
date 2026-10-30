// Tests for the SpacetimeDB backend seam: option codec plus catalog read
// and enroll write through the shipped SpacetimeStore with HTTP fixtures
// shaped like the live Maincloud API.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SpacetimeStore, decodeOption, encodeOption } from './spacetime.ts';

const SUMMARY_ROW = [
  'lab_solidity_101',
  'solidity-fundamentals',
  'Solidity Fundamentals',
  'Write and deploy a Solidity contract.',
  'Smart Contracts',
  'Introductory',
  40,
  350,
  7,
  2,
  true,
  true,
  [0, 'https://labs.zexvro.in/brand/logo.png'],
  [1, []],
  '2026-09-09',
];

const CONTENT_ROW = [
  'lab_solidity_101',
  '# Overview',
  JSON.stringify({ tasks: [{ id: 't1' }], pages: [], author: 'ZEXVRO Labs Team' }),
  [1, []],
  [1, []],
  '2026-09-09',
];

function sqlResponse(rows: unknown[][]) {
  return { ok: true, status: 200, json: async () => [{ rows }] } as unknown as Response;
}

describe('option codec', () => {
  it('decodes some/none cells', () => {
    assert.equal(decodeOption([0, 'https://x/y.png']), 'https://x/y.png');
    assert.equal(decodeOption([1, []]), undefined);
    assert.equal(decodeOption('plain'), 'plain');
  });

  it('encodes some/none args', () => {
    assert.deepEqual(encodeOption('a'), { some: 'a' });
    assert.deepEqual(encodeOption(undefined), { none: {} });
    assert.deepEqual(encodeOption(null), { none: {} });
  });
});

describe('SpacetimeStore', () => {
  const calls: Array<{ url: string; body: string }> = [];
  beforeEach(() => {
    calls.length = 0;
    (globalThis as Record<string, unknown>).fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body || '') });
      if (String(url).endsWith('/sql')) {
        if (String(init?.body || '').includes('lab_content')) return sqlResponse([CONTENT_ROW]);
        return sqlResponse([SUMMARY_ROW]);
      }
      return { ok: true, status: 200, text: async () => '' } as unknown as Response;
    }) as typeof fetch;
  });

  it('lists catalog labs with banner refs and hydrated content', async () => {
    const store = new SpacetimeStore({gatewayToken:'fixture-token', url: 'https://test.invalid', db: 'labs-beta' });
    const labs = await store.listLabs();
    assert.equal(labs.length, 1);
    assert.equal(labs[0].id, 'lab_solidity_101');
    assert.equal(labs[0].bannerUrl, 'https://labs.zexvro.in/brand/logo.png');
    assert.equal(labs[0].tasks.length, 1);
    assert.ok(!JSON.stringify(labs[0]).includes('data:image'));
  });

  it('enrolls via the enroll_lab reducer', async () => {
    const store = new SpacetimeStore({gatewayToken:'fixture-token', url: 'https://test.invalid', db: 'labs-beta' });
    await store.updateLab('lab_solidity_101', { enrolledCount: 8 });
    const wrote = calls.find((c) => c.url.endsWith('/call/upsert_lab_summary'));
    assert.ok(wrote, 'expected an upsert_lab_summary reducer call');
  });

  it('saves progress through the save_progress reducer', async () => {
    const store = new SpacetimeStore({gatewayToken:'fixture-token', url: 'https://test.invalid', db: 'labs-beta' });
    await store.saveProgress('u1', 'lab_solidity_101', {
      labId: 'lab_solidity_101',
      startedAt: '2026-09-09',
      currentTaskIndex: 1,
      completedTaskIds: ['t1'],
      scorePercent: 50,
      terminalLogs: [],
      isCompleted: false,
    });
    const wrote = calls.find((c) => c.url.endsWith('/call/save_progress'));
    assert.ok(wrote, 'expected a save_progress reducer call');
    const body = JSON.parse(wrote!.body);
    assert.deepEqual(JSON.parse(body.completed_task_ids_json), ['t1']);
  });
});
