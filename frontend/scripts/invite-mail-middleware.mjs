/**
 * Vite middleware for workspace invites + Brevo mail + membership index.
 *
 * POST /api/invite/send   — persist invite by token + email via Brevo
 * GET  /api/invite/:token — public preview (any browser / invitee)
 * POST /api/invite/accept — mark accepted + membership index for invitee
 * POST /api/invite/revoke — mark revoked
 * GET  /api/me/workspaces — owned stubs from memberships for current email
 *
 * Store: <repo>/.data/workspace-invites.json
 *   { invites: { [token]: Invite }, memberships: { [email]: Membership[] } }
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const dataDir = path.join(repoRoot, '.data');
const storePath = path.join(dataDir, 'workspace-invites.json');

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatExpiry(ms) {
  if (!ms) return '';
  try {
    return new Date(Number(ms)).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return String(ms);
  }
}

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function loadStore() {
  try {
    if (!existsSync(storePath)) return { invites: {}, memberships: {}, workspaceMembers: {} };
    const raw = JSON.parse(readFileSync(storePath, 'utf8'));
    const store = {
      invites: raw.invites && typeof raw.invites === 'object' ? raw.invites : {},
      memberships: raw.memberships && typeof raw.memberships === 'object' ? raw.memberships : {},
      // workspaceId → accepted/active members (so owner can poll full roster)
      workspaceMembers:
        raw.workspaceMembers && typeof raw.workspaceMembers === 'object' ? raw.workspaceMembers : {},
    };
    // Backfill memberships + workspace roster from accepted invites
    let dirty = false;
    for (const rec of Object.values(store.invites)) {
      if ((rec.status || '') !== 'accepted' || !rec.workspaceId || !rec.email) continue;
      const email = normEmail(rec.email);
      const list = store.memberships[email] || [];
      if (!list.some((m) => m.workspaceId === rec.workspaceId)) {
        upsertMembership(store, rec, rec.acceptedBy || email);
        dirty = true;
      }
      if (upsertWorkspaceMember(store, rec, rec.acceptedBy || email)) dirty = true;
    }
    if (dirty) saveStore(store);
    return store;
  } catch {
    return { invites: {}, memberships: {}, workspaceMembers: {} };
  }
}

function saveStore(store) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    storePath,
    JSON.stringify(
      {
        invites: store.invites || {},
        memberships: store.memberships || {},
        workspaceMembers: store.workspaceMembers || {},
      },
      null,
      2,
    ),
    'utf8',
  );
}

/** Prefer Cognito username over email local-part for display name. */
function displayNameFrom(rec, principalId, email) {
  const username = String(
    rec.username || rec.acceptedUsername || principalId || rec.acceptedBy || '',
  ).trim();
  if (username && !username.includes('@') && !username.startsWith('member_')) {
    return username;
  }
  return String(email || '').split('@')[0] || 'Member';
}

/** Index accepted members by workspace so the owner UI can list everyone. */
function upsertWorkspaceMember(store, rec, principalId) {
  const wid = rec.workspaceId;
  if (!wid) return false;
  if (!store.workspaceMembers) store.workspaceMembers = {};
  const email = normEmail(rec.email);
  if (!email) return false;
  const list = Array.isArray(store.workspaceMembers[wid]) ? store.workspaceMembers[wid] : [];
  const pid = principalId || rec.acceptedBy || rec.username || email;
  const next = {
    id: pid,
    email,
    name: displayNameFrom(rec, pid, email),
    role: rec.role || 'Viewer',
    status: 'active',
    joinedAt: rec.acceptedAt || Date.now(),
    principalId: pid,
    principalType: rec.role === 'Agent' ? 'serviceAccount' : 'user',
    inviteId: rec.id || rec.inviteId,
    roleBoundAt: rec.acceptedAt || Date.now(),
    username: rec.username || rec.acceptedUsername || (String(pid).includes('@') ? '' : pid),
  };
  const filtered = list.filter((m) => normEmail(m.email) !== email);
  // Also seed owner from snapshot if present
  const seeded = [];
  for (const m of rec.memberSnapshot || []) {
    if (!m) continue;
    const em = normEmail(m.email);
    if (!em || em === email) continue;
    if (filtered.some((x) => normEmail(x.email) === em)) continue;
    seeded.push({
      id: m.id || m.principalId || em,
      email: em,
      name: m.name || em.split('@')[0],
      role: m.role || 'Viewer',
      status: m.status === 'invited' || m.status === 'pending' ? m.status : 'active',
      joinedAt: m.joinedAt || Date.now(),
      principalId: m.principalId || m.id || em,
      principalType: m.principalType || 'user',
    });
  }
  store.workspaceMembers[wid] = mergeMemberRows([...filtered, ...seeded, next]);
  return true;
}

function publicInvite(rec) {
  if (!rec) return null;
  let status = rec.status || 'pending';
  if (status === 'pending' && rec.expiresAt && Number(rec.expiresAt) < Date.now()) {
    status = 'expired';
  }
  return {
    id: rec.id || rec.inviteId,
    workspaceId: rec.workspaceId,
    workspaceName: rec.workspaceName,
    email: rec.email,
    role: rec.role,
    status,
    expiresAt: rec.expiresAt,
    invitedBy: rec.invitedBy || rec.inviterName || '',
  };
}

/** Record invitee membership so GET /api/me/workspaces can list shared workspaces. */
function upsertMembership(store, rec, principalId) {
  const email = normEmail(rec.email);
  if (!email) return null;
  if (!store.memberships) store.memberships = {};
  const list = Array.isArray(store.memberships[email]) ? store.memberships[email] : [];
  const pid = principalId || rec.username || rec.acceptedBy || email;
  const next = {
    workspaceId: rec.workspaceId,
    workspaceName: rec.workspaceName || 'Workspace',
    role: rec.role || 'Viewer',
    email,
    principalId: pid,
    username: rec.username || (String(pid).includes('@') ? '' : pid),
    name: displayNameFrom(rec, pid, email),
    status: 'active',
    inviteId: rec.id || rec.inviteId,
    joinedAt: rec.acceptedAt || Date.now(),
    invitedBy: rec.invitedBy || rec.inviterName || '',
  };
  const nameKey = String(next.workspaceName || '').trim().toLowerCase();
  // One membership per workspace name (drop smoke/test + duplicate ids)
  store.memberships[email] = [
    ...list.filter(
      (m) =>
        m.workspaceId !== rec.workspaceId
        && String(m.workspaceName || '').trim().toLowerCase() !== nameKey
        // drop obvious smoke/test stubs
        && !/^ws_(smoke|e2e|shared_)/i.test(String(m.workspaceId || '')),
    ),
    next,
  ].filter((m) => !/^ws_(smoke|e2e_test|shared_)/i.test(String(m.workspaceId || '')) || m.workspaceId === next.workspaceId);
  // Prefer real ids over smoke when re-saving
  if (/^ws_(smoke|e2e|shared_)/i.test(String(next.workspaceId || ''))) {
    const better = list.find(
      (m) =>
        String(m.workspaceName || '').trim().toLowerCase() === nameKey
        && !/^ws_(smoke|e2e|shared_)/i.test(String(m.workspaceId || '')),
    );
    if (better) {
      store.memberships[email] = [
        ...list.filter((m) => String(m.workspaceName || '').trim().toLowerCase() !== nameKey),
        better,
      ];
      return better;
    }
  }
  return next;
}

function collapseMemberships(list) {
  const byName = new Map();
  for (const m of list || []) {
    if (/^ws_(smoke|e2e|shared_)/i.test(String(m.workspaceId || ''))) continue;
    const key = String(m.workspaceName || m.workspaceId || '').trim().toLowerCase();
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || (Number(m.joinedAt) || 0) >= (Number(prev.joinedAt) || 0)) {
      byName.set(key, m);
    }
  }
  // if only smoke left, keep newest smoke
  if (byName.size === 0) {
    for (const m of list || []) {
      const key = String(m.workspaceName || m.workspaceId || '').trim().toLowerCase();
      const prev = byName.get(key);
      if (!prev || (Number(m.joinedAt) || 0) >= (Number(prev.joinedAt) || 0)) byName.set(key, m);
    }
  }
  return Array.from(byName.values());
}

function mergeMemberRows(rows) {
  const byKey = new Map();
  for (const m of rows || []) {
    if (!m) continue;
    const key = normEmail(m.email) || String(m.id || m.principalId || '').toLowerCase();
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...m });
      continue;
    }
    // Prefer active + richer fields
    const prevScore = (prev.status === 'active' ? 2 : 0) + (prev.email ? 1 : 0);
    const nextScore = (m.status === 'active' ? 2 : 0) + (m.email ? 1 : 0);
    byKey.set(key, nextScore >= prevScore ? { ...prev, ...m } : { ...m, ...prev });
  }
  return Array.from(byKey.values());
}

/** Full team roster for shared workspace stubs (owner + invitee + snapshot). */
function workspaceFromInvite(rec, membership) {
  const email = normEmail(rec?.email || membership?.email);
  const role = membership?.role || rec?.role || 'Viewer';
  const principalId = membership?.principalId || rec?.acceptedBy || email;
  const now = membership?.joinedAt || rec?.acceptedAt || Date.now();
  const ownerEmail = normEmail(rec.ownerEmail || rec.invitedByEmail || '');
  const inviterLabel = rec.invitedBy || rec.inviterName || ownerEmail || 'Owner';
  const ownerId = rec.ownerId || ownerEmail || 'remote-owner';

  const ownerRow = {
    id: ownerId,
    email: ownerEmail || (String(inviterLabel).includes('@') ? normEmail(inviterLabel) : ''),
    name: ownerEmail
      ? ownerEmail.split('@')[0]
      : String(inviterLabel).includes('@')
        ? String(inviterLabel).split('@')[0]
        : String(inviterLabel || 'Owner'),
    role: 'Owner',
    status: 'active',
    joinedAt: rec.createdAt || now,
    principalType: 'user',
    principalId: ownerId,
  };

  const inviteeRow = {
    id: principalId,
    email,
    name: displayNameFrom(rec, principalId, email),
    role,
    status: 'active',
    joinedAt: now,
    principalType: role === 'Agent' ? 'serviceAccount' : 'user',
    principalId,
    username: rec.username || (String(principalId).includes('@') ? '' : principalId),
    roleBoundAt: now,
    inviteId: rec.id || rec.inviteId,
  };

  const snapshot = Array.isArray(rec.memberSnapshot) ? rec.memberSnapshot : [];
  const members = mergeMemberRows([ownerRow, ...snapshot, inviteeRow]);

  return {
    id: rec.workspaceId,
    workspaceId: rec.workspaceId,
    name: rec.workspaceName || 'Workspace',
    slug: String(rec.workspaceId || 'workspace').slice(0, 36),
    plan: 'Team workspace',
    ownerId,
    createdAt: rec.createdAt || now,
    members,
    invitations: [],
    _shared: true,
  };
}

function emailFromAuthHeader(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  if (!auth.startsWith('Bearer ')) return '';
  const token = auth.slice(7).trim();
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return normEmail(payload.email || payload['cognito:username'] || payload.username || '');
  } catch {
    return '';
  }
}

const PLATFORM_API =
  process.env.VITE_API_URL
  || process.env.PLATFORM_API_URL
  || 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com';

/** Push accept onto hosted Lambda so owner Dynamo roster updates. */
async function forwardAcceptToPlatform(req, payload) {
  try {
    const auth = req.headers?.authorization || req.headers?.Authorization || '';
    const base = String(PLATFORM_API).replace(/\/$/, '');
    await fetch(`${base}/api/invite/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: auth } : {}),
      },
      body: JSON.stringify(payload),
    }).catch(() => null);
  } catch {
    /* non-fatal in local dev */
  }
}

function buildInviteHtml({
  recipientEmail,
  workspaceName,
  inviterName,
  role,
  acceptUrl,
  expiresAt,
  assetBase,
}) {
  const ws = workspaceName || 'a ZEXVRO workspace';
  const inviter = inviterName || 'A teammate';
  const roleName = role || 'Developer';
  const exp = formatExpiry(expiresAt);
  const wordmark = `${assetBase}/brand/wordmark-transparent.png`;
  const mark = `${assetBase}/brand/logo-transparent.png`;

  const expRow = exp
    ? `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #18181b;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;color:#71717a;width:38%;">Expires</td>
        <td style="padding:10px 0;border-bottom:1px solid #18181b;font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;font-weight:500;color:#e4e4e7;text-align:right;">${esc(exp)}</td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark"/><title>Join ${esc(ws)}</title></head>
<body style="margin:0;padding:0;background:#050505;color:#fafafa;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050505;width:100%;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#0a0a0b;border:1px solid #27272a;border-radius:12px;">
  <tr><td style="padding:28px 32px 22px 32px;border-bottom:1px solid #18181b;" align="center">
    <img src="${esc(wordmark)}" width="220" alt="ZEXVRO" style="display:block;margin:0 auto;width:220px;max-width:80%;height:auto;border:0;"/>
  </td></tr>
  <tr><td style="padding:28px 32px 8px 32px;" align="left">
    <div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:10px;">Workspace invitation</div>
    <div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;color:#fafafa;margin-bottom:16px;">Join ${esc(ws)}</div>
    <p style="margin:0 0 12px 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#d4d4d8;">
      <strong style="color:#fafafa;">${esc(inviter)}</strong> invited you to join
      <strong style="color:#fafafa;">${esc(ws)}</strong> on ZEXVRO.
    </p>
    <p style="margin:0 0 16px 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#a1a1aa;">
      Accepting attaches your account to this workspace with the role below. Use the same email when you sign in.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#09090b;border:1px solid #27272a;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:4px 16px 8px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #18181b;font-size:11px;color:#71717a;">Workspace</td>
            <td style="padding:10px 0;border-bottom:1px solid #18181b;font-size:13px;font-weight:500;color:#e4e4e7;text-align:right;">${esc(ws)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #18181b;font-size:11px;color:#71717a;">Role</td>
            <td style="padding:10px 0;border-bottom:1px solid #18181b;font-family:ui-monospace,monospace;font-size:12px;color:#e4e4e7;text-align:right;">roles/${esc(roleName)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #18181b;font-size:11px;color:#71717a;">Invited by</td>
            <td style="padding:10px 0;border-bottom:1px solid #18181b;font-size:13px;color:#e4e4e7;text-align:right;">${esc(inviter)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #18181b;font-size:11px;color:#71717a;">Sign in as</td>
            <td style="padding:10px 0;border-bottom:1px solid #18181b;font-family:ui-monospace,monospace;font-size:12px;color:#e4e4e7;text-align:right;">${esc(recipientEmail)}</td>
          </tr>
          ${expRow}
        </table>
      </td></tr>
    </table>
    <a href="${esc(acceptUrl)}" style="display:inline-block;background:#ffffff;color:#000000;font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;text-decoration:none;padding:14px 22px;border-radius:6px;margin-bottom:20px;">Review &amp; accept invitation</a>
    <p style="margin:16px 0 0 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.55;color:#a1a1aa;">
      If the button does not work, open:<br/>
      <a href="${esc(acceptUrl)}" style="color:#e4e4e7;word-break:break-all;">${esc(acceptUrl)}</a>
    </p>
  </td></tr>
  <tr><td style="padding:8px 32px 28px 32px;" align="center">
    <table role="presentation" width="100%" style="border-top:1px solid #18181b;"><tr>
      <td style="padding:24px 0 0 0;" align="center">
        <img src="${esc(mark)}" width="56" height="56" alt="ZEXVRO" style="display:block;margin:0 auto;width:56px;height:56px;border:0;"/>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:16px 32px 24px 32px;border-top:1px solid #18181b;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;color:#52525b;">
    <p style="margin:0 0 6px 0;">This invitation is intended only for the recipient above. If you did not expect it, ignore this email.</p>
    <p style="margin:0;"><a href="${esc(assetBase)}" style="color:#a1a1aa;text-decoration:none;">zexvro.in</a> · Do not share secrets in email</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendViaBrevo(env, { to, subject, html, text }) {
  const apiKey = (process.env.BREVO_API_KEY || env.BREVO_API_KEY || '').trim();
  if (!apiKey) {
    const err = new Error('BREVO_API_KEY is not configured on the dev server');
    err.code = 'no_key';
    throw err;
  }
  const senderEmail = (
    process.env.BREVO_SENDER_EMAIL ||
    env.BREVO_SENDER_EMAIL ||
    process.env.INVITE_SOURCE_EMAIL ||
    env.INVITE_SOURCE_EMAIL ||
    'noreply@zexvro.in'
  ).trim();
  const senderName = (process.env.BREVO_SENDER_NAME || env.BREVO_SENDER_NAME || 'ZEXVRO').trim();

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
      tags: ['zexvro-invite', 'workspace-iam', 'vite-dev'],
    }),
  });
  const raw = await res.text();
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { raw };
  }
  if (!res.ok) {
    const err = new Error(body.message || body.error_description || raw.slice(0, 200) || `Brevo ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return {
    provider: 'brevo',
    messageId: body.messageId || body.message_id,
    sender: senderEmail,
  };
}

function writeJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 200_000) {
        req.destroy();
        reject(new Error('body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function parseApiPath(url) {
  // /api/invite/* | /api/me/workspaces
  const pathOnly = (url || '').split('?')[0];
  const parts = pathOnly.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[0] !== 'api') return null;
  return { parts, action: parts[1] || '', sub: parts[2] || '' };
}

/**
 * @param {Record<string, string>} env from Vite loadEnv
 */
export function inviteMailMiddleware(env) {
  return async (req, res, next) => {
    const parsed = parseApiPath(req.url || '');
    if (!parsed) return next();

    const isInvite = parsed.action === 'invite';
    const isMeWorkspaces = parsed.action === 'me' && parsed.sub === 'workspaces';
    // GET /api/workspaces/:id/members — local roster (accepted members) for owner sync
    // POST /api/workspaces/:id/leave — remove self from membership index
    const isWorkspaceMembers =
      parsed.action === 'workspaces'
      && parsed.parts[3] === 'members'
      && req.method === 'GET';
    const isWorkspaceLeave =
      parsed.action === 'workspaces'
      && parsed.parts[3] === 'leave'
      && req.method === 'POST';
    if (!isInvite && !isMeWorkspaces && !isWorkspaceMembers && !isWorkspaceLeave) return next();

    if (req.method === 'OPTIONS') {
      writeJson(res, 204, {});
      return;
    }

    if (isWorkspaceLeave) {
      try {
        const workspaceId = decodeURIComponent(parsed.parts[2] || '');
        const body = await readBody(req);
        const email = normEmail(body.email || emailFromAuthHeader(req));
        if (!workspaceId || !email) {
          writeJson(res, 400, { error: 'invalid_request', error_description: 'workspaceId and email required' });
          return;
        }
        const store = loadStore();
        if (store.memberships?.[email]) {
          store.memberships[email] = (store.memberships[email] || []).filter(
            (m) => m.workspaceId !== workspaceId,
          );
        }
        if (store.workspaceMembers?.[workspaceId]) {
          store.workspaceMembers[workspaceId] = (store.workspaceMembers[workspaceId] || []).filter(
            (m) => normEmail(m.email) !== email,
          );
        }
        for (const [token, inv] of Object.entries(store.invites || {})) {
          if (inv.workspaceId === workspaceId && normEmail(inv.email) === email) {
            store.invites[token] = { ...inv, status: 'revoked', revokedAt: Date.now(), leftAt: Date.now() };
          }
        }
        saveStore(store);
        writeJson(res, 200, { status: 'success', workspaceId, email });
      } catch (err) {
        writeJson(res, 500, {
          error: 'leave_failed',
          error_description: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    if (isWorkspaceMembers) {
      const workspaceId = decodeURIComponent(parsed.parts[2] || '');
      const store = loadStore();
      const members = store.workspaceMembers?.[workspaceId] || [];
      // Also collect from accepted invites for this workspace
      const fromInvites = Object.values(store.invites || {})
        .filter((inv) => inv.workspaceId === workspaceId && inv.status === 'accepted')
        .map((inv) => {
          const pid = inv.acceptedBy || inv.username || inv.email;
          const email = normEmail(inv.email);
          return {
            id: pid,
            email,
            name: displayNameFrom(inv, pid, email),
            role: inv.role || 'Viewer',
            status: 'active',
            joinedAt: inv.acceptedAt || Date.now(),
            principalId: pid,
            username: inv.username || (String(pid).includes('@') ? '' : pid),
            inviteId: inv.id || inv.inviteId,
          };
        });
      writeJson(res, 200, {
        workspaceId,
        members: mergeMemberRows([...members, ...fromInvites]),
      });
      return;
    }

    // GET /api/me/workspaces — shared memberships for signed-in email
    if (isMeWorkspaces && req.method === 'GET') {
      const email =
        normEmail(req.headers['x-user-email'])
        || emailFromAuthHeader(req)
        || normEmail(new URL(req.url || '', 'http://local').searchParams.get('email'));
      if (!email) {
        writeJson(res, 401, {
          error: 'unauthorized',
          error_description: 'Sign in or pass email to list shared workspaces',
        });
        return;
      }
      const store = loadStore();
      const memberships = collapseMemberships(store.memberships?.[email] || []);
      // Persist collapsed memberships so UI stops listing smoke dups
      if ((store.memberships?.[email] || []).length !== memberships.length) {
        store.memberships[email] = memberships;
        saveStore(store);
      }
      const workspaces = memberships.map((m) => {
        const inviteRec =
          Object.values(store.invites || {}).find(
            (inv) => inv.workspaceId === m.workspaceId && normEmail(inv.email) === email,
          ) || {
            workspaceId: m.workspaceId,
            workspaceName: m.workspaceName,
            email,
            role: m.role,
            id: m.inviteId,
            acceptedAt: m.joinedAt,
            acceptedBy: m.principalId,
          };
        return workspaceFromInvite(inviteRec, m);
      });
      writeJson(res, 200, { workspaces, memberships });
      return;
    }

    if (!isInvite) return next();

    const action = parsed.sub;

    // GET /api/invite/:token
    if (req.method === 'GET' && action && !['send', 'accept', 'revoke'].includes(action)) {
      const token = decodeURIComponent(action);
      const store = loadStore();
      const rec = store.invites[token];
      if (!rec) {
        writeJson(res, 404, {
          error: 'not_found',
          error_description: 'Invitation not found',
        });
        return;
      }
      writeJson(res, 200, { invite: publicInvite(rec) });
      return;
    }

    // POST /api/invite/accept
    if (req.method === 'POST' && action === 'accept') {
      try {
        const body = await readBody(req);
        const token = String(body.token || '').trim();
        if (!token) {
          writeJson(res, 400, { error: 'invalid_request', error_description: 'token is required' });
          return;
        }
        const store = loadStore();
        const rec = store.invites[token];
        if (!rec) {
          writeJson(res, 404, { error: 'not_found', error_description: 'Invitation not found' });
          return;
        }
        const now = Date.now();
        if (rec.status === 'revoked') {
          writeJson(res, 410, { error: 'revoked', error_description: 'Invitation was revoked' });
          return;
        }
        if (rec.status === 'accepted') {
          if (body.username) rec.username = String(body.username);
          if (body.name) rec.acceptedName = String(body.name);
          const pid = body.principalId || body.username || body.email || rec.acceptedBy;
          const membership = upsertMembership(store, rec, pid);
          upsertWorkspaceMember(store, rec, pid);
          saveStore(store);
          // Best-effort: mirror accept onto hosted platform so owner Dynamo sees active member
          void forwardAcceptToPlatform(req, {
            token,
            principalId: pid,
            email: body.email || rec.email,
            username: body.username || rec.username,
            workspaceId: rec.workspaceId,
            role: rec.role,
          });
          writeJson(res, 200, {
            status: 'success',
            workspaceId: rec.workspaceId,
            workspaceName: rec.workspaceName,
            role: rec.role,
            email: rec.email,
            alreadyAccepted: true,
            invite: publicInvite(rec),
            workspace: workspaceFromInvite(rec, membership),
          });
          return;
        }
        if (rec.expiresAt && Number(rec.expiresAt) < now) {
          rec.status = 'expired';
          store.invites[token] = rec;
          saveStore(store);
          writeJson(res, 410, { error: 'expired', error_description: 'Invitation has expired' });
          return;
        }
        rec.status = 'accepted';
        rec.acceptedAt = now;
        rec.acceptedBy = body.principalId || body.username || body.email || '';
        if (body.username) rec.username = String(body.username);
        if (body.name) rec.acceptedName = String(body.name);
        store.invites[token] = rec;
        const membership = upsertMembership(store, rec, rec.acceptedBy);
        upsertWorkspaceMember(store, rec, rec.acceptedBy);
        saveStore(store);
        void forwardAcceptToPlatform(req, {
          token,
          principalId: rec.acceptedBy,
          email: body.email || rec.email,
          username: body.username || rec.username,
          workspaceId: rec.workspaceId,
          role: rec.role,
          inviteId: rec.id || rec.inviteId,
        });
        writeJson(res, 200, {
          status: 'success',
          workspaceId: rec.workspaceId,
          workspaceName: rec.workspaceName,
          role: rec.role,
          email: rec.email,
          invite: publicInvite(rec),
          workspace: workspaceFromInvite(rec, membership),
        });
      } catch (err) {
        writeJson(res, 500, {
          error: 'accept_failed',
          error_description: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    // POST /api/invite/revoke
    if (req.method === 'POST' && action === 'revoke') {
      try {
        const body = await readBody(req);
        const inviteId = body.inviteId;
        const token = body.token;
        const store = loadStore();
        let found = null;
        for (const [t, rec] of Object.entries(store.invites)) {
          if ((token && t === token) || (inviteId && (rec.id === inviteId || rec.inviteId === inviteId))) {
            found = t;
            break;
          }
        }
        if (!found) {
          writeJson(res, 404, { error: 'not_found', error_description: 'Invitation not found' });
          return;
        }
        store.invites[found].status = 'revoked';
        store.invites[found].revokedAt = Date.now();
        saveStore(store);
        writeJson(res, 200, { status: 'success', invite: publicInvite(store.invites[found]) });
      } catch (err) {
        writeJson(res, 500, {
          error: 'revoke_failed',
          error_description: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    // POST /api/invite/send
    if (req.method === 'POST' && action === 'send') {
      try {
        const body = await readBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) {
          writeJson(res, 400, { error: 'invalid_request', error_description: 'valid email is required' });
          return;
        }

        const token = String(body.token || '').trim();
        if (!token) {
          writeJson(res, 400, { error: 'invalid_request', error_description: 'token is required' });
          return;
        }

        const role = body.role || 'Developer';
        const workspaceId = body.workspaceId || '';
        const workspaceName = body.workspaceName || 'a ZEXVRO workspace';
        const inviterName = body.inviterName || 'A teammate';
        const inviteId = body.inviteId || `inv_${Date.now().toString(36)}`;
        const expiresAt = Number(body.expiresAt) || Date.now() + 7 * 24 * 60 * 60 * 1000;

        const frontendUrl = (
          body.acceptBaseUrl ||
          process.env.FRONTEND_URL ||
          env.FRONTEND_URL ||
          env.APP_URL ||
          'http://127.0.0.1:3000'
        ).replace(/\/$/, '');
        const acceptUrl = `${frontendUrl}/invite/accept?token=${encodeURIComponent(token)}`;
        const assetBase = (
          process.env.MAIL_ASSET_BASE_URL ||
          env.MAIL_ASSET_BASE_URL ||
          'https://console.zexvro.in'
        ).replace(/\/$/, '');

        // Persist BEFORE email so the accept link works even if Brevo is slow.
        const store = loadStore();
        const memberSnapshot = Array.isArray(body.memberSnapshot)
          ? body.memberSnapshot
          : Array.isArray(body.members)
            ? body.members
            : [];
        store.invites[token] = {
          id: inviteId,
          inviteId,
          token,
          workspaceId,
          workspaceName,
          email,
          role,
          status: 'pending',
          createdAt: Date.now(),
          expiresAt,
          invitedBy: inviterName,
          inviterName,
          invitedByEmail: body.invitedByEmail || body.ownerEmail || '',
          ownerEmail: body.ownerEmail || body.invitedByEmail || '',
          ownerId: body.ownerId || '',
          memberSnapshot,
        };
        saveStore(store);

        const subject = `ZEXVRO · Join ${workspaceName} as ${role}`;
        const html = buildInviteHtml({
          recipientEmail: email,
          workspaceName,
          inviterName,
          role,
          acceptUrl,
          expiresAt,
          assetBase,
        });
        const text = [
          'ZEXVRO workspace invitation',
          '',
          `${inviterName} invited you to join ${workspaceName} as roles/${role}.`,
          `Sign in as: ${email}`,
          `Accept: ${acceptUrl}`,
          '',
          '— ZEXVRO',
        ].join('\n');

        const result = await sendViaBrevo(env, { to: email, subject, html, text });
        writeJson(res, 200, {
          status: 'success',
          messageId: result.messageId,
          acceptUrl,
          provider: result.provider,
          sender: result.sender,
          invite: publicInvite(store.invites[token]),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[invite-mail]', message);
        writeJson(res, 502, {
          error: 'email_send_failed',
          error_description: message,
        });
      }
      return;
    }

    writeJson(res, 405, { error: 'method_not_allowed' });
  };
}
