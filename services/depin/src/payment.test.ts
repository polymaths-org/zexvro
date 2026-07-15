import type { Request } from 'express'
import { describe, expect, it } from 'vitest'
import {
  type FacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
} from '@x402/core/server'
import { ExactStellarScheme } from '@x402/stellar/exact/server'
import type { DepinConfig } from './domain.js'
import { buildX402Routes, X402PaymentProtocol } from './payment.js'

const recipient = 'GCSPMRWNIC4CLCGGWX42GH4TFXC3RAHNO5VHMKHRPBN6EJ56T6AZTDK3'
const config: DepinConfig = {
  port: 4102,
  facilitatorUrl: 'https://x402.org/facilitator',
  maxUpstreamResponseBytes: 1024,
  replayTtlMs: 600_000,
  unpaidRateLimit: { maxRequests: 10, windowMs: 60_000 },
  providers: [
    {
      route: '/paid',
      method: 'GET',
      upstreamUrl: 'https://example.com/data',
      description: 'Paid data',
      price: '$0.001',
      recipient,
      network: 'stellar:testnet',
      timeoutMs: 1000,
    },
  ],
}

describe('official x402 Stellar protocol adapter', () => {
  it('builds a v2 PAYMENT-REQUIRED response with exact testnet USDC requirements', async () => {
    const facilitator: FacilitatorClient = {
      async getSupported() {
        return {
          kinds: [
            {
              x402Version: 2,
              scheme: 'exact',
              network: 'stellar:testnet',
              extra: { areFeesSponsored: true },
            },
          ],
          extensions: [],
          signers: { 'stellar:testnet': [recipient] },
        }
      },
      async verify() {
        return { isValid: false, invalidReason: 'unused' }
      },
      async settle() {
        return {
          success: false,
          transaction: '',
          network: 'stellar:testnet',
          errorReason: 'unused',
        }
      },
    }
    const resourceServer = new x402ResourceServer(facilitator).register(
      'stellar:testnet',
      new ExactStellarScheme(),
    )
    const httpServer = new x402HTTPResourceServer(
      resourceServer,
      buildX402Routes(config.providers),
    )
    const protocol = new X402PaymentProtocol(config, httpServer)
    await protocol.initialize()

    const request = {
      method: 'GET',
      path: '/paid',
      protocol: 'http',
      originalUrl: '/paid',
      query: {},
      body: undefined,
      headers: { host: 'localhost:4102' },
      header(name: string) {
        if (name.toLowerCase() === 'host') return 'localhost:4102'
        if (name.toLowerCase() === 'accept') return 'application/json'
        return undefined
      },
    } as unknown as Request

    const decision = await protocol.authorize(request)
    expect(decision.type).toBe('payment-error')
    if (decision.type !== 'payment-error') return
    expect(decision.response.status).toBe(402)
    const header =
      decision.response.headers['PAYMENT-REQUIRED'] ??
      decision.response.headers['payment-required']
    expect(header).toBeDefined()
    if (header === undefined) return
    const paymentRequired = JSON.parse(
      Buffer.from(header, 'base64').toString(),
    ) as {
      x402Version: number
      accepts: Array<{
        scheme: string
        network: string
        asset: string
        extra: Record<string, unknown>
      }>
    }
    expect(paymentRequired.x402Version).toBe(2)
    expect(paymentRequired.accepts[0]).toMatchObject({
      scheme: 'exact',
      network: 'stellar:testnet',
      extra: { areFeesSponsored: true },
    })
    expect(paymentRequired.accepts[0]?.asset).toMatch(/^C/)
  })
})
