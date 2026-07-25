/**
 * @zexvro/nft-checkout-sdk (inline for browser)
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

export function createNftCheckoutClient(options) {
  const apiBase = (options.apiBase || '').replace(/\/$/, '')
  if (!apiBase) {
    throw new Error('apiBase is required')
  }

  return {
    getCollection(collectionId) {
      return requestJson(apiBase, `/v1/public/collections/${encodeURIComponent(collectionId)}`)
    },

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
  const url = `${origin}/nft/embed/checkout?collectionId=${encodeURIComponent(collectionId)}`

  const popup = window.open(
    url,
    'zexvro_nft_checkout',
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  )

  const cleanup = () => {
    window.removeEventListener('message', onMessage)
    if (timer) window.clearInterval(timer)
  }

  const onMessage = (event) => {
    // Accept the configured checkout origin (and common Pages aliases).
    const allowed = new Set([
      origin,
      'https://main.zexvro.pages.dev',
      'https://zexvro.pages.dev',
    ])
    if (event.origin && !allowed.has(event.origin) && event.origin !== origin) return
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

export default { createNftCheckoutClient, openCheckout }
