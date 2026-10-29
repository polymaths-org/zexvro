import crypto from 'crypto';

// Minimal HMAC-signed session cookie (no external JWT dependency).
export interface SessionPayload {
  githubId: string;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
  role?: 'student' | 'admin';
  iss: string;
  iat?:number;
  exp?:number;
}

const COOKIE_NAME = 'zexvro_labs_session';
const HOUR_MS = 60 * 60 * 1000;

function hmac(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signSession(payload: SessionPayload, secret: string): string {
  if(secret.length<32)throw new Error('Session signing is not configured');
  const now=Math.floor(Date.now()/1000);
  const body = Buffer.from(JSON.stringify({...payload,iat:now,exp:now+7*24*3600})).toString('base64url');
  return `${body}.${hmac(body, secret)}`;
}

export function verifySession(token: string, secret: string): SessionPayload | null {
  try {
    if(secret.length<32 || token.split('.').length!==2)return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = hmac(body, secret);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (payload.iss !== 'zexvro-labs' || !Number.isFinite(payload.exp) || payload.exp!<=Date.now()/1000 || !payload.githubId || !payload.login) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, maxAgeMs: number, secure: boolean): string {
  const chunks = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) chunks.push('Secure');
  return chunks.join('; ');
}

export function clearSessionCookie(secure: boolean): string {
  return sessionCookie('', 0, secure);
}

export { COOKIE_NAME, HOUR_MS };