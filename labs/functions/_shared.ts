import { createStore } from '../src/backend/store.js';
import {
  signSession,
  verifySession,
  sessionCookie,
  COOKIE_NAME,
} from '../src/backend/session.js';
import { Lab, User } from '../src/types.js';

export interface Env {
  APP_URL?: string;
  LABS_SESSION_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  LABS_ADMIN_GITHUB_LOGINS?: string;
  LABS_STATE_BACKEND?: string;
  LABS_DYNAMO_REGION?: string;
  LABS_DYNAMO_TABLE?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  GEMINI_API_KEY?: string;
  ASSETS: Fetcher;
}

let cachedStore: any = null;
let cachedStoreKey = '';
const ADMIN_SET: Set<string> = new Set();

export function config(env: Env) {
  const APP_URL = env.APP_URL || 'https://labs.zexvro.in';
  const isSecure = APP_URL.startsWith('https://');
  const SESSION_SECRET = env.LABS_SESSION_SECRET || 'dev-only-change-me';
  const GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID || '';
  const GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET || '';
  const backend = env.LABS_STATE_BACKEND || 'firestore';
  return {
    APP_URL,
    isSecure,
    SESSION_SECRET,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    backend,
    FIREBASE_API_KEY: env.FIREBASE_API_KEY || '',
  };
}

export function adminLogins(env: Env): Set<string> {
  if (ADMIN_SET.size === 0) {
    (env.LABS_ADMIN_GITHUB_LOGINS || 'zexvro')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .forEach((s) => ADMIN_SET.add(s));
  }
  return ADMIN_SET;
}

export function getStore(env: Env) {
  const backend = env.LABS_STATE_BACKEND || 'firestore';
  const dynamoCreds =
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined;
  const hasFirebaseSA = !!(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
  const effectiveBackend =
    backend === 'firestore' && !hasFirebaseSA ? 'memory' : backend;
  const key = `${effectiveBackend}|${dynamoCreds?.accessKeyId || ''}|${env.FIREBASE_PROJECT_ID || ''}`;
  if (cachedStore && cachedStoreKey === key) return cachedStore;
  cachedStore = createStore({
    backend: effectiveBackend,
    region: env.LABS_DYNAMO_REGION || 'us-east-1',
    tableName: env.LABS_DYNAMO_TABLE || 'zexvro-labs',
    credentials: dynamoCreds,
    useFetchHandler: true,
    firestore: {
      projectId: env.FIREBASE_PROJECT_ID || '',
      clientEmail: env.FIREBASE_CLIENT_EMAIL || '',
      privateKey: env.FIREBASE_PRIVATE_KEY || '',
    },
  });
  cachedStoreKey = key;
  return cachedStore;
}

// --- Firebase Auth (stateless, ID-token based) ------------------------------

export function isAdmin(user: User | null, env: Env): boolean {
  if (!user) return false;
  const set = adminLogins(env);
  const candidates = [user.username, user.email, (user.email || '').split('@')[0]].map((s) =>
    (s || '').toLowerCase(),
  );
  return candidates.some((c) => c && set.has(c)) || user.role === 'admin';
}

// Verify a Firebase ID token using the identitytoolkit lookup API (no service
// account needed — the web API key is enough for token validation).
export async function verifyFirebaseToken(token: string, env: Env): Promise<User | null> {
  const apiKey = env.FIREBASE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      },
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const fbUser = data?.users?.[0];
    if (!fbUser?.localId) return null;
    const email = fbUser.email || '';
    const username =
      (fbUser.providerUserInfo?.[0]?.screenName || '').toLowerCase() ||
      email.split('@')[0] ||
      'learner';
    const user: User = {
      id: fbUser.localId,
      name: fbUser.displayName || email.split('@')[0] || 'Learner',
      email,
      username,
      avatarUrl: fbUser.photoUrl || '',
      role: 'student',
      xp: 0,
      streakDays: 0,
      completedLabsCount: 0,
      githubConnected: !!fbUser.providerUserInfo?.some((p: any) => p.providerId === 'github.com'),
    };
    // Allow an admin override stored on the Firestore user document.
    try {
      const store = getStore(env);
      const profile = await store.getUser(user.id);
      if (profile) {
        user.role = profile.role === 'admin' ? 'admin' : user.role;
        user.xp = profile.xp || 0;
        user.streakDays = profile.streakDays || 0;
        user.completedLabsCount = profile.completedLabsCount || 0;
        if (profile.name) user.name = profile.name;
        if (profile.avatarUrl) user.avatarUrl = profile.avatarUrl;
      }
    } catch {
      /* non-fatal */
    }
    if (isAdmin(user, env)) user.role = 'admin';
    return user;
  } catch {
    return null;
  }
}

export async function authenticate(req: Request, env: Env): Promise<User | null> {
  // Prefer Firebase ID token (new auth).
  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    const fbUser = await verifyFirebaseToken(bearer.trim(), env);
    if (fbUser) return fbUser;
  }
  // Legacy cookie session (existing /auth/callback flow).
  return getSessionUser(req, env);
}

export function getSessionUser(req: Request, env: Env): User | null {
  const raw = req.headers.get('cookie');
  if (!raw) return null;
  const match = raw
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = match.slice(COOKIE_NAME.length + 1);
  const payload = verifySession(token, config(env).SESSION_SECRET);
  if (!payload) return null;
  return {
    id: payload.githubId,
    name: payload.name || payload.login,
    email: payload.email || '',
    username: payload.login,
    avatarUrl: payload.avatarUrl,
    role: payload.role || 'student',
    xp: 0,
    streakDays: 0,
    completedLabsCount: 0,
    githubConnected: true,
  };
}

export async function requireUser(req: Request, env: Env): Promise<User | null> {
  return authenticate(req, env);
}

// --- Rate limiting (best-effort sliding window, in-memory) -------------------

const RATE_LIMITS = new Map<string, number[]>();

interface RateResult {
  ok: boolean;
  retryAfterSec: number;
}

export function checkRateLimit(env: Env, key: string, limit: number, windowMs: number): RateResult {
  if (key === 'anon') return { ok: true, retryAfterSec: 0 };
  const now = Date.now();
  const hits = (RATE_LIMITS.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const oldest = hits[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  hits.push(now);
  RATE_LIMITS.set(key, hits);
  if (RATE_LIMITS.size > 5000) {
    for (const [k, v] of RATE_LIMITS) {
      if (v.every((t) => now - t > windowMs)) RATE_LIMITS.delete(k);
    }
  }
  return { ok: true, retryAfterSec: 0 };
}

// Public fields always safe to expose on lab reads. Admin-only fields stripped
// for non-admin requesters so task answers / access codes never leak.
const PUBLIC_LAB_KEYS = new Set([
  'id', 'title', 'slug', 'description', 'category', 'difficulty', 'durationMinutes',
  'xpReward', 'badgeId', 'badgeName', 'badgeIconUrl', 'isPublished', 'featured', 'tags',
  'tasks', 'pages', 'overviewMarkdown', 'initialCode', 'initialTerminalCommand', 'author',
  'createdAt', 'updatedAt', 'bannerUrl', 'timeLimitMinutes', 'moduleId', 'status',
  'completions', 'enrolledCount', 'credential',
]);

const SENSITIVE_LAB_KEYS = ['expectedFlag', 'expectedOutput', 'verificationCommand', 'accessCode', 'password', 'editors'];

export function sanitizeLab(lab: Lab | null | undefined, admin: boolean): Lab | null | undefined {
  if (!lab) return lab;
  if (admin) return lab;
  const clone: any = { ...lab };
  for (const key of SENSITIVE_LAB_KEYS) delete clone[key];
  const stripTask = (t: any) => {
    if (!t || typeof t !== 'object') return t;
    const c = { ...t };
    for (const key of SENSITIVE_LAB_KEYS) delete c[key];
    return c;
  };
  clone.tasks = (clone.tasks || []).map(stripTask);
  clone.pages = (clone.pages || []).map((p: any) => ({ ...p, elements: (p.elements || []).map(stripTask) }));
  const allowed: Record<string, unknown> = {};
  for (const key of Object.keys(clone)) {
    if (PUBLIC_LAB_KEYS.has(key)) allowed[key] = clone[key];
  }
  return allowed as unknown as Lab;
}

export async function setSession(res: Response, user: User, env: Env): Promise<Response> {
  const { SESSION_SECRET, isSecure } = config(env);
  const token = signSession(
    {
      githubId: user.id,
      login: user.username,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      iss: 'zexvro-labs',
    },
    SESSION_SECRET,
  );
  res.headers.set('Set-Cookie', sessionCookie(token, 7 * 24 * 60 * 60 * 1000, isSecure));
  return res;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function readBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
