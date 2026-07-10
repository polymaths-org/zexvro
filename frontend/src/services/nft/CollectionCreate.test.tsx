import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CollectionCreate from './CollectionCreate';
import CollectionDashboard from './CollectionDashboard';

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={['/services/nft/collections/new']}>
      <Routes>
        <Route path="/services/nft/collections/new" element={<CollectionCreate workspaceId="studio-a" />} />
        <Route path="/services/nft" element={<CollectionDashboard workspaceId="studio-a" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CollectionCreate', () => {
  it('validates required collection details', async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Use 3–64 characters.')).toBeInTheDocument();
    expect(screen.getByText('Use 2–10 uppercase letters or numbers.')).toBeInTheDocument();
    expect(screen.getByText('Use 10–500 characters.')).toBeInTheDocument();
  });

  it('creates a local collection and returns to its dashboard', async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.type(screen.getByLabelText('Name'), 'Astral Gear');
    await user.type(screen.getByLabelText('Symbol'), 'gear');
    await user.type(screen.getByLabelText(/^Description/), 'Equipment used throughout the Astral Gear game world.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const file = new File(['cover'], 'gear.webp', { type: 'image/webp' });
    await user.upload(screen.getByLabelText(/Choose collection cover/), file);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Save local draft' }));

    expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument();
    expect(screen.getByText('Astral Gear')).toBeInTheDocument();
    expect(screen.getByText('GEAR')).toBeInTheDocument();
  });

  it('does not leak an in-progress form when the active workspace changes', async () => {
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter>
        <CollectionCreate workspaceId="studio-a" />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Name'), 'Studio A Items');
    await user.type(screen.getByLabelText('Symbol'), 'ITEM');

    view.rerender(
      <MemoryRouter>
        <CollectionCreate workspaceId="studio-b" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''));
    expect(screen.getByLabelText('Symbol')).toHaveValue('');

    view.rerender(
      <MemoryRouter>
        <CollectionCreate workspaceId="studio-a" />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Name')).toHaveValue('Studio A Items'),
    );
    expect(screen.getByLabelText('Symbol')).toHaveValue('ITEM');
  });
});
