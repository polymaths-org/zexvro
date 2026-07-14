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
const pinataSmoke =
  env.NFT_SMOKE_PINATA === '1' ||
  env.NFT_SMOKE_PINATA === 'true' ||
  env.NFT_SMOKE_PINATA === 'yes';

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
    if (caps.storageMode === 'pinata' && !caps.pinningConfigured) {
      notes.push(
        'storageMode=pinata but pinningConfigured=false — set PINATA_JWT (server-side only).',
      );
    }
    if (pinataSmoke && caps.storageMode !== 'pinata') {
      notes.push(
        `NFT_SMOKE_PINATA requested but health storageMode=${caps.storageMode}. Set NFT_STORAGE_MODE=pinata for real IPFS smoke.`,
      );
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
  if (pinataSmoke) {
    notes.push('NFT_SMOKE_PINATA requires NFT_SMOKE_ACCESS_TOKEN for POST /v1/media.');
  }
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

  if (pinataSmoke) {
    try {
      // 1x1 PNG
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );
      const form = new FormData();
      form.set(
        'file',
        new Blob([png], { type: 'image/png' }),
        'nft-smoke-pinata.png',
      );
      const upload = await fetch(`${base}/v1/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const uploadBody = await upload.json().catch(() => undefined);
      if (!upload.ok) {
        fail(
          'POST /v1/media (pinata smoke)',
          `status=${upload.status} body=${JSON.stringify(uploadBody)}`,
        );
        if (uploadBody?.error?.code === 'pinning_not_configured') {
          notes.push('PINATA_JWT missing on the API process. Set it in root .env and restart.');
        }
      } else {
        const uri = uploadBody?.asset?.uri;
        if (typeof uri === 'string' && uri.startsWith('ipfs://')) {
          ok(`POST /v1/media → ${uri}`);
          notes.push(
            `Pinata smoke CID recorded for memory (not the JWT): ${uri.replace('ipfs://', '')}`,
          );
        } else if (typeof uri === 'string' && uri.startsWith('http')) {
          fail(
            'POST /v1/media (pinata smoke)',
            `expected ipfs:// URI in pinata mode, got ${uri}`,
          );
        } else {
          fail(
            'POST /v1/media (pinata smoke)',
            `unexpected body=${JSON.stringify(uploadBody)}`,
          );
        }
      }
    } catch (error) {
      fail(
        'POST /v1/media (pinata smoke)',
        error instanceof Error ? error.message : String(error),
      );
    }
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
console.log('');
console.log('Pinata smoke (optional, real JWT local only):');
console.log('  NFT_STORAGE_MODE=pinata PINATA_JWT=... in root .env, restart API');
console.log(
  '  NFT_SMOKE_ACCESS_TOKEN=... NFT_SMOKE_PINATA=1 npm run nft:smoke',
);

if (failures.length > 0) {
  console.error(`\nSmoke failed (${failures.length}).`);
  process.exit(1);
}

console.log('\nSmoke harness passed (API health path).');
process.exit(0);
