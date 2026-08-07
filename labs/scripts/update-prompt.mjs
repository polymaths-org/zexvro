// Update the "Prompt to Use" element's description with the latest prompt
// template from prompt.md. The frontend replaces ___STUDENT_PROJECT_DETAILS___
// at runtime, so the stored text must keep that placeholder.
//
//   node scripts/update-prompt.mjs [--service-account path.json]
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
const SPPU_ELEMENT_INDEX = 5; // the "Prompt to Use" element
const PROMPT_PATH = path.join(root, 'prompt.md');

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
  const claims = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64urlEncode(JSON.stringify(claims))}`;
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
  if (!v && v !== '' && v !== 0) return { nullValue: null };
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

async function main() {
  const template = fs.readFileSync(PROMPT_PATH, 'utf8').trim();
  if (!template.includes('___STUDENT_PROJECT_DETAILS___')) {
    throw new Error('prompt.md does not contain the ___STUDENT_PROJECT_DETAILS___ placeholder — aborting.');
  }
  console.log(`Reading template (${template.length} chars) from ${PROMPT_PATH}`);

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
  if (!lab?.name) throw new Error('Could not locate the SPPU lab.');

  const obj = docToObj(lab);
  const id = lab.name.split('/').pop();
  const pages = Array.isArray(obj.pages) ? obj.pages : [];
  const page = pages[SPPU_PAGE_INDEX];
  const elem = page?.elements?.[SPPU_ELEMENT_INDEX];
  if (!page || !elem) throw new Error(`Element ${SPPU_ELEMENT_INDEX} on page ${SPPU_PAGE_INDEX + 1} not found.`);

  const beforeLen = (elem.description || '').length;
  elem.description = template;
  pages[SPPU_PAGE_INDEX] = { ...page, elements: page.elements };
  obj.pages = pages;
  const { id: _id, ...fields } = obj;
  await api(`labs/${id}`, { method: 'PATCH', body: JSON.stringify({ fields: objToFields(fields) }) });
  console.log(`  ✔ Updated element ${SPPU_ELEMENT_INDEX} on page ${SPPU_PAGE_INDEX + 1}:`);
  console.log(`      descLen ${beforeLen} -> ${template.length}`);
  console.log(`      type=${elem.type}`);

  // Verify by reading back.
  const check = await api(`labs/${encodeURIComponent(id)}`);
  const checkObj = docToObj(check);
  const checkElem = checkObj.pages?.[SPPU_PAGE_INDEX]?.elements?.[SPPU_ELEMENT_INDEX];
  console.log(`  ✔ Verified read-back descLen=${(checkElem?.description || '').length} placeholder=${(checkElem?.description || '').includes('___STUDENT_PROJECT_DETAILS___')}`);
}

main().catch((e) => {
  console.error('Update failed:', e.message);
  process.exit(1);
});