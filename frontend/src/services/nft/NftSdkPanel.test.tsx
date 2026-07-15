import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import NftSdkPanel from './NftSdkPanel';

describe('NftSdkPanel', () => {
  it('shows copy-ready popup SDK snippet with collection id', async () => {
    const user = userEvent.setup();
    render(
      <NftSdkPanel
        collectionId="11111111-1111-4111-8111-111111111111"
        collectionName="Sky Forge"
        modal={false}
      />,
    );

    expect(screen.getByRole('heading', { name: /NFT SDK/i })).toBeInTheDocument();
    expect(screen.getByText('Sky Forge')).toBeInTheDocument();
    expect(screen.getByDisplayValue('11111111-1111-4111-8111-111111111111')).toBeInTheDocument();
    expect(screen.getByText(/openCheckout/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy code/i })).toBeInTheDocument();

    // Snippet body includes the real collection id for paste into games.
    expect(screen.getByText(/11111111-1111-4111-8111-111111111111/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Copy code/i }));
    // Button label flips to Copied on success (clipboard API available in jsdom via userEvent).
    expect(await screen.findByRole('button', { name: /Copied/i })).toBeInTheDocument();
  });

  it('switches to backend curl tab', async () => {
    const user = userEvent.setup();
    render(
      <NftSdkPanel collectionId="22222222-2222-4222-8222-222222222222" modal={false} />,
    );

    await user.click(screen.getByRole('tab', { name: /Backend/i }));
    expect(screen.getByText(/v1\/public\/checkout\/intents/i)).toBeInTheDocument();
  });
});
