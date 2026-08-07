// Seed the INTO the Midnight SPPU lab's interactive prompt builder:
//   1. Flips the page-3 "Prompt to Use" element to type=prompt-builder
//      (its `description` already holds the full prompt template).
//   2. Uploads the curated project ideas from the Google-Sheets CSV into the
//      `lab_ideas` collection, tagged with the SPPU lab id.
//
//   node scripts/seed-lab-ideas.mjs [--service-account path.json]
//
// Idempotent: existing ideas are left untouched (matched by title); only missing
// ones are added. Re-running won't duplicate.

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

const SPPU_LAB_ID = 'lab_1785956173426';
const SPPU_PAGE_INDEX = 2; // 0-based: page 3
const SPPU_ELEMENT_INDEX = 5; // the "Prompt to Use" code element holding the template
const SPPU_BROKEN_INDEX = 4; // a duplicate "Prompt :" heading wrongly converted earlier — revert to heading
const CSV_PATH = path.join(root, 'Project Idea list - SPPU - Sheet1.csv');

const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = sa;

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
async function token() {
  const assertion = await signJwt();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`OAuth failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}
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
async function api(reqPath, init = {}) {
  const t = await token();
  const res = await fetch(`${base}/${reqPath}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firestore ${reqPath} failed (${res.status}): ${body.slice(0, 400)}`);
  }
  return res.json();
}
function valToPrim(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map((x) => valToPrim(x));
  if ('mapValue' in v) {
    const m = {};
    for (const [mk, mv] of Object.entries(v.mapValue.fields || {})) m[mk] = valToPrim(mv);
    return m;
  }
  return null;
}
function docToObj(doc) {
  const o = { id: doc.name.split('/').pop() };
  for (const [k, v] of Object.entries(doc.fields || {})) o[k] = valToPrim(v);
  return o;
}

// Parse a CSV line honoring double-quoted fields (commas/quotes inside values).
function parseLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; continue; }
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = parseLine(lines[0]);
  const titleIdx = head.indexOf('Project Title');
  const descIdx = head.indexOf('Project Description');
  return lines.slice(1)
    .map((l) => {
      const f = parseLine(l);
      return { title: (f[titleIdx] || '').trim(), description: (f[descIdx] || '').trim() };
    })
    .filter((r) => r.title);
}

async function main() {
  console.log(`Seeding project "${projectId}"`);

  // 1) Update the SPPU lab's page-3 element to prompt-builder.
  let lab = null;
  try {
    lab = await api(`labs/${encodeURIComponent(SPPU_LAB_ID)}`);
  } catch {
    lab = null;
  }
  if (!lab?.fields) {
    const q = {
      structuredQuery: {
        from: [{ collectionId: 'labs' }],
        where: { fieldFilter: { field: { fieldPath: 'title' }, op: 'EQUAL', value: { stringValue: 'INTO the Midnight — SPPU' } } },
        limit: 5,
      },
    };
    const t = await token();
    const res = await fetch(`${base}:runQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(q),
    });
    const data = await res.json();
    const doc = (data || []).find((r) => r.document);
    if (doc?.document) lab = doc.document;
  }
  if (lab?.name) {
    const obj = docToObj(lab);
    const id = lab.name.split('/').pop();
    const pages = Array.isArray(obj.pages) ? obj.pages : [];
    const page = pages[SPPU_PAGE_INDEX];
    if (page?.elements) {
      console.log('  debug: page 3 has', page.elements.length, 'elements');
      page.elements.forEach((e, i) => {
        console.log(`    [${i}] type=${e.type} title=${JSON.stringify(e.title)} descLen=${(e.description || '').length} holdsPlaceholder=${(e.description || '').includes('___STUDENT_PROJECT_DETAILS___')}`);
      });
    }
    const elem = page?.elements?.[SPPU_ELEMENT_INDEX];
    if (!page || !elem) {
      console.error(`Page ${SPPU_PAGE_INDEX + 1} or element ${SPPU_ELEMENT_INDEX} not found — not modifying the lab.`);
    } else {
      const beforeType = elem.type;
      const holds = (elem.description || '').includes('___STUDENT_PROJECT_DETAILS___');
      if (!holds) {
        console.error(`Element ${SPPU_ELEMENT_INDEX} does not hold the prompt template (descLen=${(elem.description || '').length}). NOT converting to avoid clobbering the wrong element.`);
      } else {
        elem.type = 'prompt-builder';
        if (!elem.title) elem.title = 'Build Your Custom Project Prompt';
        // Revert the element we wrongly converted in a previous run.
        const broken = page.elements?.[SPPU_BROKEN_INDEX];
        if (broken && broken.type === 'prompt-builder') broken.type = 'heading';
        pages[SPPU_PAGE_INDEX] = { ...page, elements: page.elements };
        obj.pages = pages;
        const { id: _id, ...fields } = obj;
        await api(`labs/${id}`, { method: 'PATCH', body: JSON.stringify({ fields: objToFields(fields) }) });
        console.log(`  ✔ Lab ${id}: element ${SPPU_ELEMENT_INDEX} on page ${SPPU_PAGE_INDEX + 1} type "${beforeType}" -> "prompt-builder"`);
      }
    }
  } else {
    console.error('Could not locate the SPPU lab. Skipping the element update (ideas will still seed).');
  }

  // 2) Seed ideas from CSV.
  const ideas = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
  console.log(`  Parsed ${ideas.length} ideas from CSV`);
  let existing = [];
  try {
    const data = await api('lab_ideas');
    existing = (data?.documents || []).map(docToObj);
  } catch (e) {
    console.log(`  (lab_ideas collection read failed: ${e.message})`);
  }
  const existingTitles = new Set(existing.map((i) => i.title));
  let added = 0;
  for (const idea of ideas) {
    if (existingTitles.has(idea.title)) continue;
    const id = `idea_${SPPU_LAB_ID}_${Date.now()}_${added}`;
    await api(`lab_ideas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: objToFields({ labId: SPPU_LAB_ID, title: idea.title, description: idea.description }) }),
    });
    added++;
    if (added % 10 === 0) console.log(`  ...${added} ideas written`);
  }
  console.log(`  Added ${added} new ideas (kept ${existing.length} existing)`);
  console.log('\nDone.');
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});