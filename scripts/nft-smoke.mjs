#!/usr/bin/env node
/**
 * Signed-in NFT smoke harness (local).
 *
 * Checks health and optionally exercises authenticated NFT API routes when a
 * Cognito access token is provided. Never claims a full UI/browser E2E run.
 *
 * Usage:
 *   node scripts/nft-smoke.mjs
 *   NFT_SMOKE_ACCESS_TOKEN=... node scripts/nft-smoke.mjs
 *   NFT_API_BASE=http://127.0.0.1:4101 node scripts/nft-smoke.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  for (const raw of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

const fileEnv = {
  ...parseEnvFile(path.join(root, '.env')),
  ...parseEnvFile(path.join(root, '.env.local')),
};
const env = { ...fileEnv, ...process.env };
const base = (env.NFT_API_BASE || env.NFT_PUBLIC_BASE_URL || 'http://127.0.0.1:4101').replace(
  /\/$/,
  '',
);
const accessToken = env.NFT_SMOKE_ACCESS_TOKEN || env.COGNITO_ACCESS_TOKEN || '';
const workspaceId = env.NFT_SMOKE_WORKSPACE_ID || 'smoke-workspace';

const failures = [];
const notes = [];

async function request(pathname, init = {}) {
  const response = await fetch(`${base}${pathname}`, init);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => undefined)
    : await response.text().catch(() => undefined);
  return { response, body };
}

function ok(label) {
  console.log(`✓ ${label}`);
}

function fail(label, detail) {
  console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
  failures.push(label);
}

console.log(`[nft-smoke] base=${base}`);

try {
  const health = await request('/health');
  if (health.response.status !== 200 || health.body?.status !== 'ok') {
    fail(
      'GET /health',
      `status=${health.response.status} body=${JSON.stringify(health.body)}`,
    );
  } else {
    ok('GET /health');
    const caps = health.body.capabilities || {};
    console.log(
      `  storageMode=${caps.storageMode} stellarConfigured=${caps.stellarConfigured} pinningConfigured=${caps.pinningConfigured}`,
    );
    if (!caps.stellarConfigured) {
      notes.push('Stellar not configured — chain deploy/sale/checkout will return 503.');
    }
    if (!caps.pinningConfigured) {
      notes.push('Pinning not configured — media upload will fail until local/pinata mode is set.');
    }
  }
} catch (error) {
  fail('GET /health', error instanceof Error ? error.message : String(error));
  console.error(
    'NFT API is not reachable. Start it with `npm run dev` or `npm run dev:nft` from the repo root.',
  );
  process.exit(1);
}

if (!accessToken) {
  notes.push(
    'No NFT_SMOKE_ACCESS_TOKEN set. Authenticated collection routes were skipped. Sign in via Cognito in the browser and export the access token to exercise list/create.',
  );
} else {
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  try {
    const listed = await request(
      `/v1/collections?workspaceId=${encodeURIComponent(workspaceId)}`,
      { headers },
    );
    if (listed.response.status === 401 || listed.response.status === 403) {
      fail('GET /v1/collections (auth)', `status=${listed.response.status}`);
      notes.push('Access token rejected. Use a current Cognito access token, not an ID token.');
    } else if (!listed.response.ok) {
      fail(
        'GET /v1/collections',
        `status=${listed.response.status} body=${JSON.stringify(listed.body)}`,
      );
    } else {
      const count = Array.isArray(listed.body?.collections)
        ? listed.body.collections.length
        : 0;
      ok(`GET /v1/collections (${count} record(s) for workspace ${workspaceId})`);
    }
  } catch (error) {
    fail('GET /v1/collections', error instanceof Error ? error.message : String(error));
  }
}

console.log('');
if (notes.length > 0) {
  console.log('Notes:');
  for (const note of notes) console.log(`- ${note}`);
  console.log('');
}

console.log('Manual browser loop (still required for full product proof):');
console.log('1. cp .env.example .env && npm run dev');
console.log('2. Open http://127.0.0.1:3000/dashboard and sign in with Cognito');
console.log('3. Project → NFT → New collection → deploy');
console.log('4. Configure primary sale (sponsor auto-submit or wallet sign)');
console.log('5. Open public collection page → Prepare checkout → wallet sign/submit');

if (failures.length > 0) {
  console.error(`\nSmoke failed (${failures.length}).`);
  process.exit(1);
}

console.log('\nSmoke harness passed (API health path).');
process.exit(0);
