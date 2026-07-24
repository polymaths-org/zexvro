/**
 * Browser popup checkout (same protocol as @zexvro/nft-checkout-sdk openCheckout).
 * Used by Credits (ZCR) pack purchase and game embeds.
 */

export type NftCheckoutSuccess = {
  tokenId?: number;
  transactionHash?: string;
  collectionId?: string;
  buyerAddress?: string;
  creditZcrAmount?: number;
  creditWorkspaceId?: string;
  creditPackId?: string;
};

export type OpenNftCheckoutOptions = {
  collectionId: string;
  checkoutOrigin?: string;
  workspaceId?: string;
  zcrAmount?: number;
  packId?: string;
  width?: number;
  height?: number;
  onSuccess?: (payload: NftCheckoutSuccess) => void;
  onError?: (payload: { message: string; code?: string }) => void;
  onClose?: () => void;
};

export function openNftCheckout(options: OpenNftCheckoutOptions): { close: () => void } {
  if (typeof window === 'undefined') {
    throw new Error('openNftCheckout is browser-only');
  }
  const collectionId = options.collectionId?.trim();
  if (!collectionId) throw new Error('collectionId is required');

  const origin = (options.checkoutOrigin || window.location.origin).replace(/\/$/, '');
  const width = options.width || 440;
  const height = options.height || 720;
  const left = Math.max(0, Math.floor(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.floor(window.screenY + (window.outerHeight - height) / 2));
  const openerOrigin = window.location.origin;
  const params = new URLSearchParams({
    collectionId,
    openerOrigin,
  });
  if (options.workspaceId) params.set('workspaceId', String(options.workspaceId));
  if (options.zcrAmount != null) params.set('zcrAmount', String(options.zcrAmount));
  if (options.packId) params.set('packId', String(options.packId));
  const url = `${origin}/nft/embed/checkout?${params.toString()}`;

  const popup = window.open(
    url,
    'zexvro_nft_checkout',
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  );
  if (!popup) {
    throw new Error('Checkout popup was blocked. Allow popups for this site and try again.');
  }

  let timer: number | undefined;
  const cleanup = () => {
    window.removeEventListener('message', onMessage);
    if (timer) window.clearInterval(timer);
  };

  const onMessage = (event: MessageEvent) => {
    // Embed posts to openerOrigin; checkout may be same-origin or console.zexvro.in.
    if (
      event.origin !== origin
      && event.origin !== openerOrigin
      && event.origin !== window.location.origin
    ) {
      return;
    }
    const data = event.data;
    if (!data || data.source !== 'zexvro-nft-checkout') return;
    if (data.type === 'success') {
      options.onSuccess?.(data.payload || {});
      cleanup();
      try {
        popup.close();
      } catch { /* ignore */ }
    } else if (data.type === 'error') {
      options.onError?.(data.payload || { message: 'Checkout failed' });
    } else if (data.type === 'close') {
      options.onClose?.();
      cleanup();
    }
  };

  window.addEventListener('message', onMessage);
  timer = window.setInterval(() => {
    if (popup.closed) {
      options.onClose?.();
      cleanup();
    }
  }, 500);

  return {
    close() {
      cleanup();
      try {
        popup.close();
      } catch { /* ignore */ }
    },
  };
}
