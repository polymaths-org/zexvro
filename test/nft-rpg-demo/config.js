/**
 * ZEXVRO NFT RPG demo
 *
 * 1. npm run dev  (zexvro root) → API :4101 + app :3000
 * 2. Serve this folder: node scripts/serve.mjs → :4173
 * 3. Shop → Oak Shield → Buy with ZEXVRO → Freighter on Testnet
 */
export const ZEXVRO_CONFIG = {
  apiBase: 'http://localhost:3000/api/nft',
  checkoutOrigin: 'http://localhost:3000',

  /**
   * Per-item live NFT collections (Studio Integrate SDK → openCheckout).
   * Oak Shield is the primary popup-checkout SKU for this harness.
   */
  itemCollections: {
    'oak-shield': {
      collectionId: 'c080bf4d-ebf7-42a3-ab46-5192929d8e72',
      checkoutOrigin: 'http://localhost:3000',
      priceLabel: 'primary sale USDC',
    },
  },

  /** Fallback when an item has no per-item entry (optional). */
  collectionId: '',
  unlockItemId: 'oak-shield',

  /** 'popup' | 'headless' | 'offline' */
  checkoutMode: 'popup',

  priceLabel: 'primary sale USDC',
};
