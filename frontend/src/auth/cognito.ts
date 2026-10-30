import {currentStorageAccount,notifyAccountChanged} from '../lib/accountStorage';
// Compatibility filename for existing imports; authentication is now Cloudflare D1.
import {platformApiBase} from '../services/mail/mailApi';

export type UserSession = {
  username: string;
  email: string;
  token: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

const SESSION_STORAGE_KEY = 'zexvro_user_session';
/** Refresh well before access-token expiry so tab resumes never force a re-login. */
const ACCESS_TOKEN_SKEW_MS = 5 * 60_000;

function decodeJwtPayload(token?: string): Record<string, unknown> {
  if (!token) return {};
  const [, payload] = token.split('.');
  if (!payload) return {};
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(normalized));
  } catch {
    return {};
  }
}

export function getAccessTokenExpiryMs(token?: string): number | null {
  if(token?.startsWith('zx_')) {
    try {const stored=JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)||'{}');return stored.token===token&&typeof stored.expiresAt==='number'?stored.expiresAt:0;}catch{return 0;}
  }
  const exp = decodeJwtPayload(token).exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

export function isAccessTokenExpired(token?: string, skewMs = ACCESS_TOKEN_SKEW_MS): boolean {
  if (!token) return true;
  const expMs = getAccessTokenExpiryMs(token);
  if (expMs === null) return false;
  return Date.now() >= expMs - skewMs;
}

export function readStoredSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserSession>;
    if (
      typeof parsed.username === 'string' &&
      typeof parsed.token === 'string' &&
      parsed.token.startsWith('zx_') &&
      typeof parsed.expiresAt === 'number'
    ) {
      return {
        username: parsed.username,
        email: typeof parsed.email === 'string' ? parsed.email : '',
        token: parsed.token,
        idToken: typeof parsed.idToken === 'string' ? parsed.idToken : undefined,
        refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : undefined,
        expiresAt: parsed.expiresAt,
      };
    }
  } catch {
    // ignore
  }
  // Invalid / legacy placeholder sessions must not stay in storage.
  localStorage.removeItem(SESSION_STORAGE_KEY);
  return null;
}

export function persistSession(session: UserSession) {
  const previous=currentStorageAccount();
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  notifyAccountChanged(previous);
}

export function clearStoredSession() {
  const previous=currentStorageAccount();
  localStorage.removeItem(SESSION_STORAGE_KEY);
  notifyAccountChanged(previous);
}

/** Map Authentication / network failures to short, user-facing copy. */
export function formatAuthError(error: unknown, action: 'signup' | 'signin' | 'confirm' | 'forgot' | 'reset' | 'general' = 'general'): string {
  if (!(error instanceof Error) && typeof error !== 'string') {
    return fallbackAuthMessage(action);
  }

  const raw = error instanceof Error ? error.message : String(error);
  const type = error instanceof Error && 'cognitoType' in error
    ? String((error as Error & { cognitoType?: string }).cognitoType || '')
    : '';
  const lower = raw.toLowerCase();
  const key = `${type} ${raw}`.toLowerCase();

  if (
    key.includes('usernameexistsexception') ||
    lower.includes('user already exists')
  ) {
    return 'That username is already taken. Try another, or sign in.';
  }

  if (
    key.includes('aliasexistsexception') ||
    lower.includes('account with the given email already exists') ||
    (lower.includes('already exists') && lower.includes('email'))
  ) {
    return 'An account with this email already exists. Sign in or reset your password.';
  }

  if (key.includes('invalidpasswordexception') || lower.includes('password did not conform')) {
    if (lower.includes('uppercase')) return 'Password needs at least one uppercase letter.';
    if (lower.includes('lowercase')) return 'Password needs at least one lowercase letter.';
    if (lower.includes('number') || lower.includes('numeric')) return 'Password needs at least one number.';
    if (lower.includes('symbol') || lower.includes('special')) return 'Password needs at least one special character.';
    if (lower.includes('length') || lower.includes('8')) return 'Password must be at least 8 characters.';
    return 'Password is too weak. Use 8+ characters with letters and numbers.';
  }

  if (key.includes('invalidparameterexception')) {
    if (lower.includes('email')) return 'Enter a valid email address.';
    if (lower.includes('username') || lower.includes('user name')) return 'Username is invalid. Use letters, numbers, or _ . - only.';
    if (lower.includes('password')) return 'Password does not meet the requirements.';
    return 'Some details look invalid. Check username, email, and password.';
  }

  if (key.includes('codemismatchexception') || lower.includes('invalid verification code') || lower.includes('invalid code')) {
    return 'That code is wrong. Check the email and try again.';
  }

  if (key.includes('expiredcodeexception') || lower.includes('expired')) {
    return 'That code has expired. Request a new one.';
  }

  if (key.includes('usernotfoundexception') || lower.includes('user does not exist')) {
    if (action === 'signin') return 'No account found with that username. Create an account first.';
    if (action === 'forgot' || action === 'reset') return 'No account found with that username.';
    return 'Account not found.';
  }

  if (key.includes('usernotconfirmedexception') || lower.includes('user is not confirmed')) {
    return 'Confirm your email first. Enter the code we sent you.';
  }

  if (
    key.includes('notauthorizedexception') ||
    lower.includes('incorrect username or password') ||
    lower.includes('password attempts exceeded')
  ) {
    if (lower.includes('attempts exceeded') || lower.includes('password attempts')) {
      return 'Too many failed attempts. Wait a bit, then try again.';
    }
    return 'Wrong username or password.';
  }

  if (key.includes('limitexceededexception') || key.includes('toomanyrequestsexception') || lower.includes('attempt limit')) {
    return 'Too many tries. Wait a minute and try again.';
  }

  if (key.includes('toomanysfailedattemptsexception') || lower.includes('too many failed attempts')) {
    return 'Too many failed attempts. Wait a bit, then try again.';
  }

  if (key.includes('invalidlambdaresponseexception') || key.includes('unexpectedlambdaexception')) {
    return 'Sign-up is temporarily unavailable. Try again in a moment.';
  }

  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('load failed')) {
    return 'Network error. Check your connection and try again.';
  }

  if (raw.length > 0 && raw.length < 120 && !raw.includes('__type') && !raw.includes('Exception')) {
    return raw;
  }

  return fallbackAuthMessage(action);
}

function fallbackAuthMessage(action: 'signup' | 'signin' | 'confirm' | 'forgot' | 'reset' | 'general'): string {
  switch (action) {
    case 'signup':
      return 'Could not create account. Check your details and try again.';
    case 'signin':
      return 'Could not sign in. Check your username and password.';
    case 'confirm':
      return 'Could not confirm account. Check the code and try again.';
    case 'forgot':
      return 'Could not send reset code. Check the username and try again.';
    case 'reset':
      return 'Could not reset password. Check the code and try again.';
    default:
      return 'Something went wrong. Try again.';
  }
}

class CognitoAuthError extends Error {
  cognitoType?: string;
  constructor(message: string, cognitoType?: string) {
    super(message);
    this.name = 'CognitoAuthError';
    this.cognitoType = cognitoType;
  }
}

async function authRequest<T>(path: string, payload: Record<string, unknown>, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${platformApiBase()}/auth/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}) },
      body: JSON.stringify(payload),
    });
  } catch { throw new CognitoAuthError('Network error. Check your connection and try again.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new CognitoAuthError(data.error || 'Sign-in request failed', response.status===401?'NotAuthorizedException':'AuthError');
  return data as T;
}
export function signUpUser(username: string, email: string, password: string) {
  return authRequest<{UserConfirmed: boolean; recoveryKey: string}>('signup', {username,email,password});
}
export async function confirmSignUp(_username: string, _code: string) {
  throw new Error('New accounts are ready immediately. Sign in with your password.');
}
export function signInUser(username: string, password: string): Promise<UserSession> {
  return authRequest<UserSession>('signin', {username,password});
}
export async function forgotPassword(_username: string) {
  return {recoveryRequired:true};
}
export function confirmForgotPassword(username: string, code: string, password: string) {
  return authRequest<{recoveryKey:string}>('reset-password', {username,recoveryKey:code,password});
}
export async function globalSignOut(accessToken?: string) {
  if(accessToken)await authRequest('signout',{},accessToken);
}
export function isAuthFailure(error: unknown): boolean {
  return error instanceof CognitoAuthError && error.cognitoType==='NotAuthorizedException';
}
export async function refreshSessionTokens(session: UserSession): Promise<UserSession> {
  if (!session.refreshToken) throw new CognitoAuthError('Session has no refresh token. Sign in again.', 'NotAuthorizedException');
  const next=await authRequest<UserSession>('refresh',{refreshToken:session.refreshToken});
  persistSession(next);return next;
}

let refreshInFlight: Promise<UserSession> | null = null;

/**
 * Return a usable Cloudflare session token for API calls (NFT dashboard, etc.).
 * Refreshes automatically when expired or near expiry.
 * Only clears storage on definitive auth failures (not network blips).
 */
export async function ensureValidAccessToken(
  session?: UserSession | null,
): Promise<string> {
  const current = session || readStoredSession();
  if (!current?.token) {
    throw new CognitoAuthError('Not signed in.', 'NotAuthorizedException');
  }

  if (typeof current.expiresAt === 'number' && Date.now() < current.expiresAt - ACCESS_TOKEN_SKEW_MS) {
    return current.token;
  }

  if (!current.refreshToken) {
    clearStoredSession();
    throw new CognitoAuthError('Access token expired. Sign in again.', 'NotAuthorizedException');
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshSessionTokens(current).finally(() => {
      refreshInFlight = null;
    });
  }

  try {
    const refreshed = await refreshInFlight;
    return refreshed.token;
  } catch (error) {
    if (isAuthFailure(error)) {
      clearStoredSession();
    }
    throw error;
  }
}
