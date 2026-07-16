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

async function cognitoRequest<T>(target: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(COGNITO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const type = typeof data.__type === 'string' ? data.__type.split('#').pop() : 'CognitoError';
    throw new Error(data.message || `${type}: request failed`);
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
