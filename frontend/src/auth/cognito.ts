export const COGNITO_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';
export const COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_vyONcitBD';
export const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '7qmkq33si9qk8pgo6ebi3qantm';

const COGNITO_ENDPOINT = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;

export type UserSession = {
  username: string;
  email: string;
  token: string;
  idToken?: string;
  refreshToken?: string;
};

type CognitoTokenResponse = {
  AuthenticationResult?: {
    AccessToken?: string;
    IdToken?: string;
    RefreshToken?: string;
  };
  ChallengeName?: string;
};

const SESSION_STORAGE_KEY = 'zexvro_user_session';
/** Refresh a bit before Cognito access-token expiry (default ~1h). */
const ACCESS_TOKEN_SKEW_MS = 60_000;

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
      parsed.token.split('.').length === 3 &&
      !parsed.token.startsWith('prod_jwt_token_')
    ) {
      return {
        username: parsed.username,
        email: typeof parsed.email === 'string' ? parsed.email : '',
        token: parsed.token,
        idToken: typeof parsed.idToken === 'string' ? parsed.idToken : undefined,
        refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : undefined,
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
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/** Map Cognito / network failures to short, user-facing copy. */
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

async function cognitoRequest<T>(target: string, payload: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(COGNITO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new CognitoAuthError('Network error. Check your connection and try again.');
  }

  const data = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    const type = typeof data.__type === 'string' ? String(data.__type).split('#').pop() : 'CognitoError';
    const message = typeof data.message === 'string' ? data.message : `${type}: request failed`;
    throw new CognitoAuthError(message, type);
  }
  return data as T;
}

export async function signUpUser(username: string, email: string, password: string) {
  return cognitoRequest<{ UserConfirmed?: boolean }>('SignUp', {
    ClientId: COGNITO_CLIENT_ID,
    Username: username,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
    ],
  });
}

export async function confirmSignUp(username: string, code: string) {
  return cognitoRequest('ConfirmSignUp', {
    ClientId: COGNITO_CLIENT_ID,
    Username: username,
    ConfirmationCode: code,
  });
}

export async function signInUser(username: string, password: string): Promise<UserSession> {
  const data = await cognitoRequest<CognitoTokenResponse>('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  });

  if (data.ChallengeName) {
    throw new Error(`Cognito challenge required: ${data.ChallengeName}`);
  }

  const accessToken = data.AuthenticationResult?.AccessToken;
  const idToken = data.AuthenticationResult?.IdToken;
  if (!accessToken) {
    throw new Error('Cognito did not return an access token.');
  }

  const claims = decodeJwtPayload(idToken);
  return {
    username: String(claims['cognito:username'] || claims.preferred_username || username),
    email: String(claims.email || ''),
    token: accessToken,
    idToken,
    refreshToken: data.AuthenticationResult?.RefreshToken,
  };
}

export async function forgotPassword(username: string) {
  return cognitoRequest('ForgotPassword', {
    ClientId: COGNITO_CLIENT_ID,
    Username: username,
  });
}

export async function confirmForgotPassword(username: string, code: string, password: string) {
  return cognitoRequest('ConfirmForgotPassword', {
    ClientId: COGNITO_CLIENT_ID,
    Username: username,
    ConfirmationCode: code,
    Password: password,
  });
}

export async function globalSignOut(accessToken?: string) {
  if (!accessToken) return;
  await cognitoRequest('GlobalSignOut', {
    AccessToken: accessToken,
  });
}

/**
 * Exchange a Cognito refresh token for a new access (+ id) token.
 * Refresh tokens are long-lived; access tokens expire in ~1 hour.
 */
export async function refreshSessionTokens(session: UserSession): Promise<UserSession> {
  if (!session.refreshToken) {
    throw new Error('Session has no refresh token. Sign in again.');
  }

  const data = await cognitoRequest<CognitoTokenResponse>('InitiateAuth', {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: COGNITO_CLIENT_ID,
    AuthParameters: {
      REFRESH_TOKEN: session.refreshToken,
    },
  });

  if (data.ChallengeName) {
    throw new Error(`Cognito challenge required: ${data.ChallengeName}`);
  }

  const accessToken = data.AuthenticationResult?.AccessToken;
  if (!accessToken) {
    throw new Error('Cognito did not return an access token on refresh.');
  }

  const idToken = data.AuthenticationResult?.IdToken || session.idToken;
  const claims = decodeJwtPayload(idToken);
  const next: UserSession = {
    username:
      String(claims['cognito:username'] || claims.preferred_username || session.username),
    email: String(claims.email || session.email || ''),
    token: accessToken,
    idToken,
    // Cognito usually omits RefreshToken on refresh — keep the existing one.
    refreshToken: data.AuthenticationResult?.RefreshToken || session.refreshToken,
  };
  persistSession(next);
  return next;
}

let refreshInFlight: Promise<UserSession> | null = null;

/**
 * Return a usable Cognito **access** token for API calls (NFT dashboard, etc.).
 * Refreshes automatically when expired or near expiry.
 */
export async function ensureValidAccessToken(
  session?: UserSession | null,
): Promise<string> {
  const current = session || readStoredSession();
  if (!current?.token) {
    throw new Error('Not signed in. Sign in to use the NFT dashboard.');
  }

  if (!isAccessTokenExpired(current.token)) {
    return current.token;
  }

  if (!current.refreshToken) {
    clearStoredSession();
    throw new Error('Access token expired. Sign in again.');
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshSessionTokens(current).finally(() => {
      refreshInFlight = null;
    });
  }

  const refreshed = await refreshInFlight;
  return refreshed.token;
}
