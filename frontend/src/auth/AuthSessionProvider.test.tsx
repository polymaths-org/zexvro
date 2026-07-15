import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSessionProvider } from './AuthSessionProvider';

describe('AuthSessionProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps dashboard content behind the Cognito sign-in gate', () => {
    render(
      <MemoryRouter initialEntries={['/services/nft']}>
        <AuthSessionProvider>
          <div>private dashboard</div>
        </AuthSessionProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('private dashboard')).not.toBeInTheDocument();
  });

  it('restores a valid session without changing the requested deep link', async () => {
    window.localStorage.setItem(
      'zexvro_user_session',
      JSON.stringify({ username: 'nabil', token: 'header.payload.signature' }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    render(
      <MemoryRouter initialEntries={['/services/nft']}>
        <AuthSessionProvider>
          <div>private dashboard</div>
        </AuthSessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('private dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('clears legacy placeholder sessions instead of bypassing authentication', () => {
    window.localStorage.setItem(
      'zexvro_user_session',
      JSON.stringify({ username: 'legacy', token: 'prod_jwt_token_placeholder' }),
    );

    render(
      <MemoryRouter>
        <AuthSessionProvider>
          <div>private dashboard</div>
        </AuthSessionProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(window.localStorage.getItem('zexvro_user_session')).toBeNull();
  });

  it('preserves CLI activation links for authenticated users', async () => {
    window.localStorage.setItem(
      'zexvro_user_session',
      JSON.stringify({ username: 'nabil', token: 'header.payload.signature' }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    render(
      <MemoryRouter initialEntries={['/overview?code=ab12-cd34']}>
        <AuthSessionProvider>
          <div>private dashboard</div>
        </AuthSessionProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Link CLI Device' }),
    ).toBeInTheDocument();
    expect(screen.getByText('AB12-CD34')).toBeInTheDocument();
    expect(screen.queryByText('private dashboard')).not.toBeInTheDocument();
  });
});
