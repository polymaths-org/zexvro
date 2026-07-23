/**
 * ZEXVRO transactional mail client.
 *
 * Browser never talks to Brevo with the API key.
 * All mail goes through a server endpoint that calls https://api.brevo.com.
 *
 * Local:  POST /api/invite/send  → Vite middleware → Brevo
 * Prod:   POST {VITE_API_URL|/API Gateway}/api/invite/send → Lambda → Brevo
 *
 * Never uses localhost:8080.
 */

const IS_LOCAL =
  typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const PROD_PLATFORM_API = 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com';

/** Platform backend (workspaces, memory, …) — never localhost:8080. */
export function platformApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // Local mock on 8080 is unused; point at hosted API Gateway.
  return PROD_PLATFORM_API;
}

/**
 * Mail send base. Local same-origin so Vite Brevo middleware handles it.
 * Production uses platform API (Lambda + Brevo).
 * Override with VITE_MAIL_API_URL if needed.
 */
export function mailApiBase(): string {
  const override = (import.meta.env.VITE_MAIL_API_URL as string | undefined)?.trim();
  if (override) return override.replace(/\/$/, '');
  if (IS_LOCAL) return ''; // → /api/invite/send on Vite
  return platformApiBase();
}

export type SendWorkspaceInviteInput = {
  email: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  token: string;
  inviteId: string;
  expiresAt: number;
  acceptBaseUrl?: string;
  ownerId?: string;
  ownerEmail?: string;
  invitedByEmail?: string;
  memberSnapshot?: Array<Record<string, unknown>>;
};

export type SendWorkspaceInviteResult = {
  status: string;
  messageId?: string;
  acceptUrl?: string;
  provider?: string;
  sender?: string;
};

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const session = localStorage.getItem('zexvro_user_session');
    if (!session) return headers;
    const parsed = JSON.parse(session);
    if (parsed?.token) headers.Authorization = `Bearer ${parsed.token}`;
  } catch {
    /* ignore */
  }
  return headers;
}

/**
 * Send workspace invite email via server → Brevo.
 * Throws if the mail endpoint fails.
 */
export async function sendWorkspaceInviteEmail(
  input: SendWorkspaceInviteInput,
): Promise<SendWorkspaceInviteResult> {
  const path = '/api/invite/send';
  const base = mailApiBase();
  const url = `${base}${path}`;

  const token = String(input.token || '').trim();
  if (!token) {
    throw new Error('Invite token is required — cannot send mail without accept link');
  }

  const payload = {
    ...input,
    token,
    acceptBaseUrl:
      input.acceptBaseUrl
      || (typeof window !== 'undefined' ? window.location.origin : undefined),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg.includes('Failed to fetch') || msg.includes('NetworkError')
        ? `Mail send failed (network). Local: restart Vite so /api/invite/send → Brevo is loaded. Endpoint: ${url || path}`
        : msg,
    );
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.error_description
      || data.error
      || data.message
      || `Mail send failed (${response.status})`,
    );
  }

  return {
    status: data.status || 'success',
    messageId: data.messageId,
    acceptUrl: data.acceptUrl,
    provider: data.provider || 'brevo',
    sender: data.sender,
  };
}

export type InvitePreview = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: string;
  status: string;
  expiresAt: number;
  invitedBy: string;
};

/** GET invite by token (local Vite store or Lambda). */
export async function getInviteByToken(token: string): Promise<{ invite: InvitePreview }> {
  const clean = token.trim();
  const base = mailApiBase();
  const url = `${base}/api/invite/${encodeURIComponent(clean)}`;
  const response = await fetch(url, { headers: authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Invitation not found');
  }
  return data as { invite: InvitePreview };
}

/** POST accept invite by token. */
export async function acceptInviteByToken(input: {
  token: string;
  principalId?: string;
  email?: string;
  username?: string;
  name?: string;
}): Promise<{
  status: string;
  workspaceId: string;
  workspaceName?: string;
  role: string;
  email?: string;
  alreadyAccepted?: boolean;
  invite?: InvitePreview;
  workspace?: Record<string, unknown>;
}> {
  const base = mailApiBase();
  const url = `${base}/api/invite/accept`;
  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Accept failed');
  }
  return data;
}

/** Shared workspaces for current user (local Vite membership index). */
export async function listMySharedWorkspaces(email?: string): Promise<{
  workspaces: Array<Record<string, unknown>>;
  memberships?: Array<Record<string, unknown>>;
}> {
  const base = mailApiBase();
  const headers = authHeaders();
  if (email) headers['X-User-Email'] = email.trim().toLowerCase();
  const q = email ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : '';
  const url = `${base}/api/me/workspaces${q}`;
  const response = await fetch(url, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Local-only endpoint may 404 on prod Lambda — soft fail
    if (response.status === 404) return { workspaces: [] };
    throw new Error(data.error_description || data.error || 'Failed to list shared workspaces');
  }
  return {
    workspaces: Array.isArray(data.workspaces) ? data.workspaces : [],
    memberships: Array.isArray(data.memberships) ? data.memberships : [],
  };
}

/** Local roster of accepted members for a workspace (owner sync). */
export async function listLocalWorkspaceMembers(workspaceId: string): Promise<
  Array<Record<string, unknown>>
> {
  if (!workspaceId) return [];
  const base = mailApiBase();
  const url = `${base}/api/workspaces/${encodeURIComponent(workspaceId)}/members`;
  try {
    const response = await fetch(url, { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return [];
    return Array.isArray(data.members) ? data.members : [];
  } catch {
    return [];
  }
}
