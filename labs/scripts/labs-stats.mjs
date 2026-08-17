// Pull SPPU session statistics from Firestore and print them as JSON.
//   node scripts/labs-stats.mjs [--service-account path.json]
//
// Counts the live collections used by the platform:
//   users, labs, submissions, certificates, progress, badges, lab_ideas
// Output is meant to be pasted into STATS.md (post-session wrap-up).

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

async function fetchAll(collectionId) {
  // Fetch a collection with pagination (Firestore default page size 300).
  const out = [];
  let pageToken = '';
  for (;;) {
    const t = await token();
    let url = `${base}/${collectionId}?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) {
      // Collection may not exist yet.
      if (res.status === 404) return [];
      throw new Error(`${collectionId} fetch failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    }
    const data = await res.json();
    out.push(...(data.documents || []).map(docToObj));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return out;
}

async function main() {
  const users = await fetchAll('users');
  const labs = await fetchAll('labs');
  const submissions = await fetchAll('submissions');
  const certificates = await fetchAll('certificates');
  const badges = await fetchAll('badges');
  const labIdeas = await fetchAll('lab_ideas');

  // Enrollment: the lab docs store `enrolledCount` (learners who enrolled) and
  // `completions` — this is exactly what the Labs page shows.
  const labEnrolledTotal = labs.reduce((n, l) => n + (Number(l.enrolledCount) || 0), 0);
  const labCompletionsTotal = labs.reduce((n, l) => n + (Number(l.completions) || 0), 0);

  const completedLabs = labs.filter((l) => l.status === 'closed');
  const published = labs.filter((l) => l.status === 'published' || l.isPublished === true);
  const drafts = labs.filter((l) => l.status === 'draft' || (l.status !== 'published' && l.status !== 'closed' && !l.isPublished));

  const subByStatus = { pending: 0, for_review: 0, passed: 0, rejected: 0 };
  for (const s of submissions) subByStatus[s.status] = (subByStatus[s.status] || 0) + 1;
  const subPassed = subByStatus.passed;
  const passRate = submissions.length ? Math.round((subPassed / submissions.length) * 100) : 0;

  const started = users.filter((u) => Array.isArray(u.startedLabIds) && u.startedLabIds.length);
  const completed = users.filter((u) => Array.isArray(u.completedLabIds) && u.completedLabIds.length);
  const totalXp = users.reduce((sum, u) => sum + (Number(u.xp) || 0), 0);

  // Engagement is stored in activity records (submissions + certificates) for
  // this build, not on the flat user fields.
  const submitters = new Set(submissions.map((s) => s.userId));
  const certHolders = new Set(certificates.map((c) => c.studentId).filter(Boolean));
  const avgScore = submissions.length
    ? Math.round(submissions.reduce((s, x) => s + (Number(x.score) || 0), 0) / submissions.length)
    : 0;

  const ideaTaken = labIdeas.filter((i) => i.takenBy);

  const stats = {
    generatedAt: new Date().toISOString(),
    usersTotal: users.length,
    enrolledUsers: labEnrolledTotal, // lab.enrolledCount (shown on Labs page)
    enrolledLabsTotal: labCompletionsTotal, // lab.completions
    activeLearners: submitters.size, // users with ≥1 submission
    completionsTotal: certHolders.size, // learners with an issued certificate
    totalXp,
    labsTotal: labs.length,
    labsPublished: published.length,
    labsDraft: drafts.length,
    submissionsTotal: submissions.length,
    submissionsPassed: subPassed,
    submissionsForReview: subByStatus.for_review,
    submissionsRejected: subByStatus.rejected,
    passRatePct: passRate,
    avgScore,
    certificatesIssued: certificates.length,
    badgesTotal: badges.length,
    projectIdeasTotal: labIdeas.length,
    projectIdeasTaken: ideaTaken.length,
  };

  process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
}

main().catch((e) => {
  console.error('Stats failed:', e.message);
  process.exit(1);
});