import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CollectionDashboard from './CollectionDashboard';
import { createCollection } from './collectionStore';

describe('CollectionDashboard', () => {
  it('shows an honest empty state', () => {
    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'No collections yet' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing will be sent on-chain/i)).toBeInTheDocument();
  });

  it('shows collections stored for the current workspace', () => {
    createCollection('studio-a', {
      name: 'Astral Gear',
      symbol: 'GEAR',
      description: 'Equipment used throughout the Astral Gear game world.',
      coverName: 'gear.webp',
      royaltyBps: 500,
    });

    render(
      <MemoryRouter>
        <CollectionDashboard workspaceId="studio-a" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Astral Gear')).toBeInTheDocument();
    expect(screen.getByText('GEAR')).toBeInTheDocument();
    expect(screen.getByText('5.00%')).toBeInTheDocument();
  });
});
