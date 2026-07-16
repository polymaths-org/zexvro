/**
 * @zexvro/nft-checkout-sdk
 *
 * Three integration modes for indie game / web checkout:
 * 1. Headless HTTP helpers (build your own UI)
 * 2. openCheckout popup (Razorpay-style window)
 * 3. Backend-only: call the same public REST routes from your server
 *
 * Token IDs: omit tokenId — the NFT API allocates the next free ID.
 */

/**
 * @typedef {object} CheckoutIntent
 * @property {string} id
 * @property {string} collectionId
 * @property {number} tokenId
 * @property {string} buyerAddress
 * @property {string} serializedTransaction
 * @property {string[]} requiredSigners
 * @property {'pending_signature'|'submitting'|'confirmed'|'failed'} status
 * @property {string} expiresAt
 * @property {string} [transactionHash]
 * @property {string} [failureReason]
 */

/**
 * @typedef {object} PublicCollectionBundle
 * @property {object} collection
 * @property {{ items: object[], nextTokenId: number, mintedCount: number }} [inventory]
 */

/**
 * @param {string} baseUrl
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function requestJson(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, init)
  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => undefined)
    : await response.text().catch(() => undefined)

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && body.error && body.error.message
        ? body.error.message
        : `NFT API error (${response.status})`
    const error = new Error(message)
    error.status = response.status
    error.code = body && typeof body === 'object' && body.error ? body.error.code : 'request_failed'
    error.details = body && typeof body === 'object' && body.error ? body.error.details : body
    throw error
  }
  return body
}

/**
 * Headless client for custom UIs and game backends.
 * @param {{ apiBase: string }} options apiBase e.g. https://api.example.com/api/nft
 */
export function createNftCheckoutClient(options) {
  const apiBase = (options.apiBase || '').replace(/\/$/, '')
  if (!apiBase) {
    throw new Error('apiBase is required (NFT public API origin, e.g. https://host/api/nft)')
  }

  return {
    /**
     * @param {string} collectionId
     * @returns {Promise<PublicCollectionBundle>}
     */
    getCollection(collectionId) {
      return requestJson(apiBase, `/v1/public/collections/${encodeURIComponent(collectionId)}`)
    },

    /**
     * Create a checkout intent. Omit tokenId for always-auto allocation.
     * @param {{ collectionId: string, buyerAddress: string, tokenId?: number, idempotencyKey?: string }} input
     * @returns {Promise<CheckoutIntent>}
     */
    async createCheckoutIntent(input) {
      const idempotencyKey =
        input.idempotencyKey ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)
      const body = {
        collectionId: input.collectionId,
        buyerAddress: input.buyerAddress,
      }
      if (input.tokenId !== undefined) body.tokenId = input.tokenId
      const result = await requestJson(apiBase, '/v1/public/checkout/intents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      })
      return result.intent
    },

    /**
     * Submit buyer-signed auth entries (AssembledTransaction JSON from wallet helper).
     * @param {{ intentId: string, signedTransaction: string }} input
     * @returns {Promise<CheckoutIntent>}
     */
    async submitCheckoutIntent(input) {
      const result = await requestJson(
        apiBase,
        `/v1/public/checkout/intents/${encodeURIComponent(input.intentId)}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signedTransaction: input.signedTransaction }),
        },
      )
      return result.intent
    },
  }
}

/**
 * Open a hosted checkout popup (Razorpay-style).
 * Host page must allow postMessage from checkoutOrigin.
 *
 * @param {{
 *   collectionId: string,
 *   checkoutOrigin?: string,
 *   width?: number,
 *   height?: number,
 *   onSuccess?: (payload: { tokenId: number, transactionHash: string, collectionId: string }) => void,
 *   onError?: (payload: { message: string, code?: string }) => void,
 *   onClose?: () => void,
 * }} options
 * @returns {{ close: () => void }}
 */
export function openCheckout(options) {
  if (typeof window === 'undefined') {
    throw new Error('openCheckout is browser-only')
  }
  const collectionId = options.collectionId
  if (!collectionId) throw new Error('collectionId is required')

  const origin = (options.checkoutOrigin || window.location.origin).replace(/\/$/, '')
  const width = options.width || 440
  const height = options.height || 720
  const left = Math.max(0, Math.floor(window.screenX + (window.outerWidth - width) / 2))
  const top = Math.max(0, Math.floor(window.screenY + (window.outerHeight - height) / 2))
  // Tell the embed which opener origin may receive postMessage (game may be on another port).
  const openerOrigin = window.location.origin
  const url =
    `${origin}/nft/embed/checkout` +
    `?collectionId=${encodeURIComponent(collectionId)}` +
    `&openerOrigin=${encodeURIComponent(openerOrigin)}`

  const popup = window.open(
    url,
    'zexvro_nft_checkout',
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  )
  if (!popup) {
    throw new Error('Checkout popup was blocked. Allow popups for this site and try again.')
  }

  const cleanup = () => {
    window.removeEventListener('message', onMessage)
    if (timer) window.clearInterval(timer)
  }

  const onMessage = (event) => {
    if (event.origin !== origin) return
    const data = event.data
    if (!data || data.source !== 'zexvro-nft-checkout') return
    if (data.type === 'success') {
      options.onSuccess?.(data.payload)
      cleanup()
      popup?.close()
    } else if (data.type === 'error') {
      options.onError?.(data.payload)
    } else if (data.type === 'close') {
      options.onClose?.()
      cleanup()
    }
  }

  window.addEventListener('message', onMessage)

  const timer = window.setInterval(() => {
    if (popup && popup.closed) {
      options.onClose?.()
      cleanup()
    }
  }, 500)

  return {
    close() {
      cleanup()
      popup?.close()
    },
  }
}

export default {
  createNftCheckoutClient,
  openCheckout,
}
