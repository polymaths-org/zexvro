import { expect, test } from '@playwright/test';

const depinRecipient = 'GCD4SBBOLPUM7UYWLPRKOP6IYKOZ6FX5YQOJHVVE7RKC2QGZYNUHKRCZ';

function encoded(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

import {installConsoleMock,wallet} from './fixtures/console';
let state: Awaited<ReturnType<typeof installConsoleMock>>;
test.beforeEach(async ({page})=>{state=await installConsoleMock(page)});

test('NFT dashboard deep link is stable on desktop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard/w/ws-test/p/project-test/nft',{waitUntil:'domcontentloaded'});

  await expect(
    page.getByRole('heading', { name: 'NFTo', exact: true }),
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
  await page.goto('/dashboard/w/ws-test/p/project-test/nft/collections/new',{waitUntil:'domcontentloaded'});

  await expect(page.getByRole('heading', { name: 'Create NFT collection' })).toBeVisible();
  await expect(page.getByLabel('NFT name')).toBeVisible();
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
  await page.goto('/dashboard/w/ws-test/p/project-test/nft',{waitUntil:'domcontentloaded'});
  await page.getByRole('button', { name: 'New collection' }).click();

  await expect(page).toHaveURL(/\/dashboard\/w\/ws-test\/p\/project-test\/nft\/collections\/new$/);
  await expect(
    page.getByRole('heading', { name: 'Create NFT collection', exact: true }),
  ).toBeVisible();
});

test('De-pin gateway route shows a standard x402 challenge probe', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard/w/ws-test/p/project-test/depin',{waitUntil:'domcontentloaded'});

  await expect(page.getByRole('heading', { name: 'x402 Gateway' })).toBeVisible();
  await page.getByRole('button',{name:'Routes 1',exact:true}).click();
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

test('mocked sale configuration reaches the wallet signing step in the current studio',async({page})=>{
 const id='4a0dc446-4f57-4cf2-94ec-257b41b786a1';
 state.collections.push({id,workspaceId:'ws-test',name:'Sky Forge',symbol:'SKY',description:'A collection of game items',ownerAddress:wallet,royaltyRecipient:wallet,royaltyBps:500,status:'live',coverImageUri:'',contractId:'C'+'A'.repeat(55),baseMetadataUri:'ipfs://fixture/',collectionMetadataUri:'ipfs://fixture',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 await page.addInitScript(({wallet})=>{(window as any).freighter=true;sessionStorage.setItem('zexvro_nft_wallet_session',JSON.stringify({address:wallet,provider:'albedo',network:'TESTNET'}))},{wallet});
 await page.goto('/dashboard/w/ws-test/p/project-test/nft/collections/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Sale',exact:true}).click();
 await page.getByRole('button',{name:'Prepare sale config',exact:true}).click();
 await expect(page.getByRole('button',{name:/sign.*activate sale/i})).toBeVisible();
});
