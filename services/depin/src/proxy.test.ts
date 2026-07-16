import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request } from 'express'
import type {
  HTTPResponseInstructions,
  ProcessSettleResultResponse,
} from '@x402/core/server'
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types'
import type {
  AuditLogger,
  AuditRecord,
  DepinConfig,
  PaymentDecision,
  PaymentProtocol,
  VerifiedPayment,
} from './domain.js'
import { createDepinApp } from './proxy.js'

const recipient = 'GCSPMRWNIC4CLCGGWX42GH4TFXC3RAHNO5VHMKHRPBN6EJ56T6AZTDK3'

const requirements: PaymentRequirements = {
  scheme: 'exact',
  network: 'stellar:testnet',
  asset: `C${'A'.repeat(55)}`,
  amount: '10000',
  payTo: recipient,
  maxTimeoutSeconds: 60,
  extra: { areFeesSponsored: true },
}

const config: DepinConfig = {
  port: 4102,
  facilitatorUrl: 'https://x402.org/facilitator',
  maxUpstreamResponseBytes: 1024 * 1024,
  replayTtlMs: 600_000,
  unpaidRateLimit: { maxRequests: 20, windowMs: 60_000 },
  providers: [
    {
      route: '/v1/weather',
      method: 'GET',
      upstreamUrl: 'https://upstream.example/weather?units=metric',
      description: 'Current weather',
      price: '$0.001',
      recipient,
      network: 'stellar:testnet',
      timeoutMs: 20,
      upstreamSecretRef: 'WEATHER_TOKEN',
    },
  ],
}

function encoded(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64')
}

class FakePaymentProtocol implements PaymentProtocol {
  settleMode: 'success' | 'failure' | 'throw' = 'success'
  settleCalls = 0
  cancelCalls = 0

  async initialize(): Promise<void> {}

  async authorize(request: Request): Promise<PaymentDecision> {
    const signature = request.header('PAYMENT-SIGNATURE')
    if (signature === undefined || signature !== 'valid-payment') {
      const reason =
        signature === 'insufficient-payment'
          ? 'insufficient_funds'
          : signature === 'invalid-payment'
            ? 'invalid_signature'
            : signature === 'malformed-payment'
              ? 'invalid_payload'
              : 'payment_required'
      return {
        type: 'payment-error',
        response: paymentError(reason),
      }
    }

    const paymentPayload: PaymentPayload = {
      x402Version: 2,
      accepted: requirements,
      payload: { transaction: 'signed-auth-entry' },
    }
    return {
      type: 'verified',
      payment: {
        requestContext: {} as VerifiedPayment['requestContext'],
        paymentPayload,
        paymentRequirements: requirements,
        cancellationDispatcher: { cancel: async () => undefined },
      },
    }
  }

  async settle(): Promise<ProcessSettleResultResponse> {
    this.settleCalls += 1
    if (this.settleMode === 'throw') throw new Error('facilitator unavailable')
    const header = encoded({ success: this.settleMode === 'success' })
    if (this.settleMode === 'failure') {
      return {
        success: false,
        errorReason: 'settlement_failed',
        errorMessage: 'Facilitator rejected settlement',
        transaction: '',
        network: 'stellar:testnet',
        headers: { 'PAYMENT-RESPONSE': header },
        response: {
          status: 402,
          headers: {
            'PAYMENT-RESPONSE': header,
            'content-type': 'application/json',
          },
          body: {},
        },
      }
    }
    return {
      success: true,
      transaction: 'stellar-transaction-hash',
      network: 'stellar:testnet',
      headers: { 'PAYMENT-RESPONSE': header },
      requirements,
    }
  }

  async cancel(): Promise<void> {
    this.cancelCalls += 1
  }
}

class CapturingLogger implements AuditLogger {
  records: AuditRecord[] = []
  info(record: AuditRecord): void {
    this.records.push(record)
  }
  error(record: AuditRecord): void {
    this.records.push(record)
  }
}

function paymentError(reason: string): HTTPResponseInstructions {
  const paymentRequired = {
    x402Version: 2,
    error: reason,
    resource: { url: 'http://localhost/v1/weather', description: 'Current weather' },
    accepts: [requirements],
  }
  return {
    status: 402,
    headers: {
      'PAYMENT-REQUIRED': encoded(paymentRequired),
      'content-type': 'application/json',
    },
    body: {},
  }
}

describe('De-pin proxy', () => {
  let protocol: FakePaymentProtocol
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>
  let logger: CapturingLogger

  beforeEach(() => {
    protocol = new FakePaymentProtocol()
    fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ temperature: 21 }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-upstream-secret': 'hidden' },
      }),
    )
    logger = new CapturingLogger()
  })

  function app(overrides: Partial<DepinConfig> = {}) {
    return createDepinApp({
      config: { ...config, ...overrides },
      protocol,
      fetchImplementation: fetchMock,
      environment: { WEATHER_TOKEN: 'provider-secret' },
      logger,
    })
  }

  it('returns a sanitized gateway manifest for frontend setup screens', async () => {
    const response = await request(app()).get('/status').expect(200)

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'depin',
      configSource: { type: 'file', detail: 'depin.config.json' },
      stateBackend: 'memory',
      multiInstanceSafe: false,
      capabilities: {
        scheme: 'exact',
        network: 'stellar:testnet',
        settlement: 'after_upstream_success',
        fees: 'sponsored',
        settleReady: true,
        facilitatorAuthConfigured: false,
        facilitatorOzChannels: false,
      },
      providers: [
        {
          route: '/v1/weather',
          method: 'GET',
          description: 'Current weather',
          price: '$0.001',
          recipient,
          network: 'stellar:testnet',
          timeoutMs: 20,
          upstreamOrigin: 'https://upstream.example',
          upstreamSecretRequired: true,
        },
      ],
    })

    const manifest = JSON.stringify(response.body)
    expect(manifest).not.toContain('WEATHER_TOKEN')
    expect(manifest).not.toContain('provider-secret')
    expect(manifest).not.toContain('/weather?units=metric')
  })

  it.each(['', 'malformed-payment', 'invalid-payment', 'insufficient-payment'])(
    'returns the standard 402 contract for unpaid or rejected payment %s',
    async (signature) => {
      let call = request(app()).get('/v1/weather')
      if (signature !== '') call = call.set('PAYMENT-SIGNATURE', signature)
      const response = await call.expect(402)

      expect(response.headers['payment-required']).toBeTypeOf('string')
      const decoded = JSON.parse(
        Buffer.from(String(response.headers['payment-required']), 'base64').toString(),
      ) as { x402Version: number; accepts: PaymentRequirements[] }
      expect(decoded.x402Version).toBe(2)
      expect(decoded.accepts[0]).toMatchObject({
        scheme: 'exact',
        network: 'stellar:testnet',
      })
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('releases a successful upstream response only after settlement', async () => {
    const response = await request(app())
      .get('/v1/weather?city=Delhi')
      .set('PAYMENT-SIGNATURE', 'valid-payment')
      .set('Authorization', 'Bearer client-credential')
      .set('X-Request-Id', 'request-123')
      .expect(200)

    expect(response.body).toEqual({ temperature: 21 })
    expect(response.headers['payment-response']).toBeTypeOf('string')
    expect(response.headers['x-upstream-secret']).toBeUndefined()
    expect(response.headers['x-request-id']).toBe('request-123')
    expect(protocol.settleCalls).toBe(1)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBeInstanceOf(URL)
    const targetUrl = (url as URL).toString()
    expect(targetUrl).toContain('city=Delhi')
    expect(targetUrl).toContain('units=metric')
    const upstreamHeaders = init?.headers as Headers
    expect(upstreamHeaders.get('authorization')).toBe('Bearer provider-secret')
    expect(upstreamHeaders.get('payment-signature')).toBeNull()
  })

  it('rejects a replay before a second upstream fulfillment', async () => {
    const gateway = app()
    await request(gateway)
      .get('/v1/weather')
      .set('PAYMENT-SIGNATURE', 'valid-payment')
      .expect(200)
    const replay = await request(gateway)
      .get('/v1/weather')
      .set('PAYMENT-SIGNATURE', 'valid-payment')
      .expect(409)

    expect(replay.body.error.code).toBe('payment_replay')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(protocol.cancelCalls).toBe(1)
  })

  it('does not settle upstream errors and withholds their body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('private upstream failure details', { status: 500 }),
    )
    const response = await request(app())
      .get('/v1/weather')
      .set('PAYMENT-SIGNATURE', 'valid-payment')
      .expect(502)

    expect(response.text).not.toContain('private upstream failure details')
    expect(response.body.error.code).toBe('upstream_failed')
    expect(protocol.settleCalls).toBe(0)
    expect(protocol.cancelCalls).toBe(1)
  })

  it('times out the upstream without settling', async () => {
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    )
    const response = await request(app())
      .get('/v1/weather')
      .set('PAYMENT-SIGNATURE', 'valid-payment')
      .expect(504)

    expect(response.body.error.code).toBe('upstream_timeout')
    expect(protocol.settleCalls).toBe(0)
  })

  it('withholds a successful upstream response when settlement fails', async () => {
    protocol.settleMode = 'failure'
    const response = await request(app())
      .get('/v1/weather')
      .set('PAYMENT-SIGNATURE', 'valid-payment')
      .expect(402)

    expect(response.headers['payment-response']).toBeTypeOf('string')
    expect(response.body).toEqual({})
    expect(response.text).not.toContain('temperature')
  })

  it('rate limits repeated unpaid requests without affecting paid verification', async () => {
    const gateway = app({
      unpaidRateLimit: { maxRequests: 1, windowMs: 60_000 },
    })
    await request(gateway).get('/v1/weather').expect(402)
    const limited = await request(gateway).get('/v1/weather').expect(429)
    expect(limited.headers['retry-after']).toBe('60')

    await request(gateway)
      .get('/v1/weather')
      .set('PAYMENT-SIGNATURE', 'valid-payment')
      .expect(200)
  })

  it('counts malformed payment attempts toward the unpaid limit', async () => {
    const gateway = app({
      unpaidRateLimit: { maxRequests: 1, windowMs: 60_000 },
    })
    await request(gateway)
      .get('/v1/weather')
      .set('PAYMENT-SIGNATURE', 'malformed-payment')
      .expect(402)
    await request(gateway)
      .get('/v1/weather')
      .set('PAYMENT-SIGNATURE', 'malformed-payment-again')
      .expect(429)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never records payment or upstream secret material in audit logs', async () => {
    await request(app())
      .get('/v1/weather')
      .set('PAYMENT-SIGNATURE', 'valid-payment')
      .expect(200)

    const logs = JSON.stringify(logger.records)
    expect(logs).not.toContain('provider-secret')
    expect(logs).not.toContain('valid-payment')
    expect(logs).not.toContain('client-credential')
  })
})
