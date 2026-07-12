import { expect, test } from '@playwright/test';

const depinRecipient = 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ';

function encoded(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'zexvro_user_session',
      JSON.stringify({ username: 'nabil', token: 'header.payload.signature' }),
    );
  });
  await page.route('**/api/memory', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ memory: { cli_connected: false } }),
    });
  });
  await page.route('**/api/nft/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        service: 'nft-service',
        capabilities: {
          network: 'stellar:testnet',
          pinningConfigured: true,
          stellarConfigured: true,
          storageMode: 'local',
        },
      }),
    });
  });
  await page.route('**/api/nft/v1/collections?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ collections: [] }),
    });
  });
  await page.route('**/api/depin/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', service: 'depin' }),
    });
  });
  await page.route('**/api/depin/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        service: 'depin',
        capabilities: {
          scheme: 'exact',
          network: 'stellar:testnet',
          facilitatorUrl: 'https://x402.org/facilitator',
          settlement: 'after_upstream_success',
          fees: 'sponsored',
          replayTtlMs: 600000,
          unpaidRateLimit: { maxRequests: 30, windowMs: 60000 },
        },
        providers: [
          {
            route: '/v1/nft-health',
            method: 'GET',
            description: 'ZEXVRO NFT service health response',
            price: '$0.001',
            recipient: depinRecipient,
            network: 'stellar:testnet',
            timeoutMs: 5000,
            upstreamOrigin: 'http://127.0.0.1:4101',
            upstreamSecretRequired: false,
          },
        ],
      }),
    });
  });
  await page.route('**/api/depin/v1/nft-health', async (route) => {
    await route.fulfill({
      status: 402,
      contentType: 'application/json',
      headers: {
        'PAYMENT-REQUIRED': encoded({
          x402Version: 2,
          accepts: [
            {
              scheme: 'exact',
              network: 'stellar:testnet',
              amount: '10000',
              payTo: depinRecipient,
            },
          ],
        }),
      },
      body: JSON.stringify({}),
    });
  });
});

test('NFT dashboard deep link is stable on desktop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard/w/ws-test/p/project-test/nft');

  await expect(
    page.getByRole('heading', { name: 'Collections', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No collections yet' })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/w\/ws-test\/p\/project-test\/nft$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('nft-dashboard-desktop.png'),
    fullPage: true,
  });
});

test('collection wizard deep link fits a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/w/ws-test/p/project-test/nft/collections/new');

  await expect(page.getByRole('heading', { name: 'Deploy a Stellar collection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Collection details' })).toBeVisible();
  await expect(page.getByLabel('Name')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('nft-create-mobile.png'),
    fullPage: true,
  });
});

test('new collection action routes to the project wizard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/dashboard/w/ws-test/p/project-test/nft');
  await page.getByRole('button', { name: 'New collection' }).click();

  await expect(page).toHaveURL(/\/dashboard\/w\/ws-test\/p\/project-test\/nft\/collections\/new$/);
  await expect(
    page.getByRole('heading', { name: 'Deploy a Stellar collection', exact: true }),
  ).toBeVisible();
});

test('De-pin gateway route shows a standard x402 challenge probe', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard/w/ws-test/p/project-test/depin');

  await expect(page.getByRole('heading', { name: 'x402 Gateway' })).toBeVisible();
  await expect(page.getByText('GET /v1/nft-health')).toBeVisible();
  await page.getByRole('button', { name: 'Probe 402' }).click();

  await expect(page.getByText('PAYMENT-REQUIRED')).toBeVisible();
  await expect(page.getByText('0.001 USDC')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('depin-gateway-desktop.png'),
    fullPage: true,
  });
});

test('mocked sale configuration wallet path reaches sign CTA', async ({ page }) => {
  const collectionId = '4a0dc446-4f57-4cf2-94ec-257b41b786a1';
  const owner = 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ';
  await page.route('**/api/nft/v1/collections?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        collections: [{
          id: collectionId,
          workspaceId: 'ws-test',
          name: 'Sky Forge',
          symbol: 'SKY',
          description: 'A collection of verifiable game items.',
          ownerAddress: owner,
          baseMetadataUri: 'ipfs://bafybase/',
          collectionMetadataUri: 'ipfs://bafymeta',
          coverImageUri: 'ipfs://bafycover',
          royaltyRecipient: owner,
          royaltyBps: 500,
          status: 'live',
          contractId: `C${'A'.repeat(55)}`,
          deploymentTxHash: 'deployment-hash',
          createdAt: '2026-07-11T00:00:00.000Z',
          updatedAt: '2026-07-11T00:00:00.000Z',
        }],
      }),
    });
  });
  await page.route('**/api/nft/v1/collections/*/sale-config/intent', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        intent: {
          serializedTransaction: 'prepared-sale',
          requiredSigners: [owner],
        },
      }),
    });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard/w/ws-test/p/project-test/nft');
  await expect(page.getByText('Sky Forge')).toBeVisible();
  await page.getByTitle('Configure primary sale').click();
  await page.getByRole('button', { name: /prepare sale/i }).click();
  await expect(page.getByRole('button', { name: /sign with wallet/i })).toBeVisible();
});

