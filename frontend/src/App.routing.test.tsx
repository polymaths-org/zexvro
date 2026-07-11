import { describe, expect, it } from 'vitest';
import { router } from './routes/router';

describe('dashboard routing', () => {
  const routePaths = Object.keys(router.routesByPath);

  it('registers the project NFT dashboard route', () => {
    expect(routePaths).toContain('/dashboard/w/$workspaceId/p/$projectId/nft');
  });

  it('registers the collection creation deep link', () => {
    expect(routePaths).toContain('/dashboard/w/$workspaceId/p/$projectId/nft/collections/new');
  });

  it('keeps the public marketing entry route', () => {
    expect(routePaths).toContain('/');
  });
});
