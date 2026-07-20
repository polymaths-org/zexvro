import { describe, expect, it } from 'vitest';
import { formatAuthError } from './cognito';

function err(message: string, cognitoType?: string) {
  const e = new Error(message) as Error & { cognitoType?: string };
  if (cognitoType) e.cognitoType = cognitoType;
  return e;
}

describe('formatAuthError', () => {
  it('maps username taken', () => {
    expect(formatAuthError(err('User already exists', 'UsernameExistsException'), 'signup')).toBe(
      'That username is already taken. Try another, or sign in.',
    );
  });

  it('maps email already registered', () => {
    expect(
      formatAuthError(err('An account with the given email already exists.', 'AliasExistsException'), 'signup'),
    ).toBe('An account with this email already exists. Sign in or reset your password.');
  });

  it('maps weak password details', () => {
    expect(
      formatAuthError(err('Password did not conform with policy: Password must have uppercase characters', 'InvalidPasswordException'), 'signup'),
    ).toBe('Password needs at least one uppercase letter.');
  });

  it('maps bad credentials', () => {
    expect(
      formatAuthError(err('Incorrect username or password.', 'NotAuthorizedException'), 'signin'),
    ).toBe('Wrong username or password.');
  });

  it('maps unconfirmed user', () => {
    expect(
      formatAuthError(err('User is not confirmed.', 'UserNotConfirmedException'), 'signin'),
    ).toBe('Confirm your email first. Enter the code we sent you.');
  });

  it('maps invalid code', () => {
    expect(
      formatAuthError(err('Invalid verification code provided, please try again.', 'CodeMismatchException'), 'confirm'),
    ).toBe('That code is wrong. Check the email and try again.');
  });

  it('falls back for unknown signup errors', () => {
    expect(formatAuthError(err('SomeInternalException: boom', 'SomeInternalException'), 'signup')).toBe(
      'Could not create account. Check your details and try again.',
    );
  });
});
