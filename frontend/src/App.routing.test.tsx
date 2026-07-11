import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AuthSessionProvider } from './auth/AuthSessionProvider';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthSessionProvider>
        <App />
        <LocationProbe />
      </AuthSessionProvider>
    </MemoryRouter>,
  );
}

describe('dashboard routing', () => {
  beforeEach(() => {
    window.localStorage.setItem(
      'zexvro_user_session',
      JSON.stringify({ username: 'nabil', token: 'header.payload.signature' }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the NFT dashboard directly from its URL', async () => {
    renderRoute('/services/nft');

    expect(await screen.findByRole('heading', { name: 'Collections' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/services/nft');
  });

  it('loads the collection wizard from a deep link', async () => {
    renderRoute('/services/nft/collections/new');

    expect(await screen.findByRole('heading', { name: 'Deploy a Stellar collection' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Collection details' })).toBeInTheDocument();
  });

  it('redirects unknown URLs to overview', async () => {
    renderRoute('/does-not-exist');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/overview');
    });
  });
});
