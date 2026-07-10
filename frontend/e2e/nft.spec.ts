import { expect, test } from '@playwright/test';

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
});

test('NFT dashboard deep link is stable on desktop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/services/nft');

  await expect(
    page.getByRole('heading', { name: 'Collections', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No collections yet' })).toBeVisible();
  await expect(page).toHaveURL(/\/services\/nft$/);
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
  await page.goto('/services/nft/collections/new');

  await expect(page.getByRole('heading', { name: 'Create collection' })).toBeVisible();
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

test('workspace search routes NFT directly to its dashboard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/overview');

  await page.getByRole('button', { name: /Search/ }).first().click();
  await page.getByPlaceholder('Type a screen or operation command...').fill('NFT');
  await page.getByRole('button', { name: /Navigate to NFT Service/ }).click();

  await expect(page).toHaveURL(/\/services\/nft$/);
  await expect(
    page.getByRole('heading', { name: 'Collections', exact: true }),
  ).toBeVisible();
});
