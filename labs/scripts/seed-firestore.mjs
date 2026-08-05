// Seed the Firestore backend (labs-zexvro) with the real lab catalog + badge
// roster. Runs locally with Node 18+ (uses fetch + WebCrypto). Reads the
// service-account JSON and writes through the Firestore REST API exactly like
// functions/_shared.ts does at runtime.
//
//   node scripts/seed-firestore.mjs [--service-account path.json] [--wipe]
//
// --wipe  clears existing docs in the seeded collections first (idempotent re-seed).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const saArg = args.find((a) => a.startsWith('--service-account'));
const serviceAccountPath = saArg
  ? saArg.split('=')[1] || args[args.indexOf(saArg) + 1]
  : path.join(root, 'labs-zexvro-firebase-adminsdk-fbsvc-40d0bc5017.json');
const wipe = args.includes('--wipe');

const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = sa;

// ---------------------------------------------------------------------------
// Firestore auth (same as src/backend/store.ts)
// ---------------------------------------------------------------------------
function b64urlEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8(pem) {
  const cleaned = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(cleaned);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function signJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`;
}

async function getAccessToken() {
  const assertion = await signJwt();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`Firestore OAuth failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Firestore REST helpers
// ---------------------------------------------------------------------------
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  const t = typeof v;
  if (t === 'string') return { stringValue: v };
  if (t === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (t === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (t === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toValue(val);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function objToFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toValue(v);
  return fields;
}

async function api(token, reqPath, init = {}) {
  const res = await fetch(`${base}/${reqPath}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firestore ${reqPath} failed (${res.status}): ${body.slice(0, 400)}`);
  }
  return res.json();
}

async function writeDoc(token, collection, id, obj) {
  const { id: _id, ...fields } = obj;
  // PATCH = upsert (creates or replaces). POST ?documentId= only creates and
  // 409s if the doc already exists, so re-seeding is idempotent.
  await api(token, `${collection}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: objToFields(fields) }),
  });
}

async function deleteCollection(token, collection) {
  const data = await api(token, collection);
  const docs = data?.documents || [];
  for (const doc of docs) {
    const name = decodeURIComponent(doc.name.split('/').pop());
    await api(token, `${collection}/${name}`, { method: 'DELETE' });
    console.log(`  wiped ${collection}/${name}`);
  }
  return docs.length;
}

// ---------------------------------------------------------------------------
// Load the seed data straight from the app's own mock catalog so the backend
// matches what the UI was designed around. Run with tsx (dev dep) so the
// TypeScript module is loaded natively:
//   npx tsx scripts/seed-firestore.mjs
// ---------------------------------------------------------------------------
import { sampleLabs, sampleBadges } from '../src/data/mockData.ts';

async function main() {
  console.log(`Seeding Firestore project "${projectId}" (wipe=${wipe})`);
  const token = await getAccessToken();
  console.log('  OAuth token obtained');

  if (wipe) {
    console.log('  wiping labs...');
    await deleteCollection(token, 'labs');
    console.log('  wiping badges...');
    await deleteCollection(token, 'badges');
  }

  let count = 0;
  for (const lab of sampleLabs) {
    const doc = { ...lab };
    if (!doc.slug) doc.slug = lab.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await writeDoc(token, 'labs', lab.id, doc);
    count++;
    console.log(`  lab ${lab.id} (${lab.title})`);
  }

  for (const badge of sampleBadges) {
    await writeDoc(token, 'badges', badge.id, badge);
    count++;
    console.log(`  badge ${badge.id} (${badge.name})`);
  }

  console.log(`\nDone: ${count} docs written.`);
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
