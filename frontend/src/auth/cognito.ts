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
