import { randomUUID } from 'node:crypto'
import express, { type Request, type Response } from 'express'
import type { HTTPResponseInstructions } from '@x402/core/server'
import type {
  AuditLogger,
  DepinConfig,
  DepinConfigSource,
  PaymentProtocol,
  ProviderConfig,
  RateLimitStore,
  ReplayStore,
  VerifiedPayment,
} from './domain.js'
import { JsonAuditLogger } from './audit.js'
import { facilitatorSettleReadiness } from './facilitator.js'
import { claimPaymentReplay } from './replay.js'
import { MemoryRateLimitStore, MemoryReplayStore } from './stores.js'

class UpstreamError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

interface DepinAppOptions {
  config: DepinConfig
  protocol: PaymentProtocol
  fetchImplementation?: typeof fetch
  environment?: NodeJS.ProcessEnv
  logger?: AuditLogger
  replayStore?: ReplayStore
  rateLimitStore?: RateLimitStore
  configSource?: DepinConfigSource
  stateBackend?: 'memory' | 'file'
  now?: () => number
}

const passthroughRequestHeaders = ['accept', 'accept-language', 'user-agent'] as const
const passthroughResponseHeaders = [
  'cache-control',
  'content-language',
  'content-type',
  'etag',
  'last-modified',
] as const

const EXPOSED_HEADERS = [
  'PAYMENT-REQUIRED',
  'PAYMENT-RESPONSE',
  'X-Request-Id',
  'Retry-After',
].join(', ')

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://zexvrodashboard.xyz',
  'https://www.zexvrodashboard.xyz',
  'https://zexvro.pages.dev',
  'https://main.zexvro.pages.dev',
  // Cloudflare Pages preview / branch aliases (*.zexvro.pages.dev)
  'https://*.zexvro.pages.dev',
]

function parseCorsOrigins(environment: NodeJS.ProcessEnv): string[] {
  const raw = environment.CORS_ALLOWED_ORIGINS || environment.DEPIN_CORS_ORIGINS
  if (raw === undefined || raw.trim() === '') return DEFAULT_CORS_ORIGINS
  return raw
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

/** Exact match or single-label wildcard host (e.g. https://*.zexvro.pages.dev). */
export function isCorsOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  const normalized = origin.trim().replace(/\/$/, '')
  if (!normalized) return false
  if (allowedOrigins.includes(normalized)) return true

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false

  for (const entry of allowedOrigins) {
    if (!entry.includes('*')) continue
    try {
      // Support https://*.example.com only (one subdomain label).
      const wildcard = new URL(entry.replace('://*.', '://wildcard-marker.'))
      if (wildcard.protocol !== parsed.protocol) continue
      const suffix = wildcard.hostname.replace(/^wildcard-marker\./, '')
      if (!suffix || !parsed.hostname.endsWith(`.${suffix}`)) continue
      const sub = parsed.hostname.slice(0, -(suffix.length + 1))
      if (sub.length > 0 && !sub.includes('.')) return true
    } catch {
      // ignore bad allowlist entries
    }
  }
  return false
}

export function createDepinApp(options: DepinAppOptions) {
  const {
    config,
    protocol,
    fetchImplementation = fetch,
    environment = process.env,
    logger = new JsonAuditLogger(),
    replayStore = new MemoryReplayStore(),
    rateLimitStore = new MemoryRateLimitStore(),
    configSource = { type: 'file', detail: 'depin.config.json' },
    stateBackend = 'memory',
    now = Date.now,
  } = options

  const allowedOrigins = parseCorsOrigins(environment)
  // App Runner /tmp file store is per-instance — not shared across scale-out.
  const multiInstanceSafe =
    stateBackend === 'file' && environment.DEPIN_SHARED_STATE === '1'

  const app = express()
  app.disable('x-powered-by')
  // App Runner / proxies set X-Forwarded-For — needed for unpaid rate limits.
  app.set('trust proxy', 1)

  app.use((request, response, next) => {
    const origin = request.header('Origin')
    if (origin && isCorsOriginAllowed(origin, allowedOrigins)) {
      response.setHeader('Access-Control-Allow-Origin', origin.trim().replace(/\/$/, ''))
      response.setHeader('Vary', 'Origin')
      response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      response.setHeader(
        'Access-Control-Allow-Headers',
        'Accept, Content-Type, PAYMENT-SIGNATURE, X-Request-Id',
      )
      response.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADERS)
      response.setHeader('Access-Control-Max-Age', '600')
    }

    if (request.method === 'OPTIONS') {
      response.status(204).end()
      return
    }
    next()
  })

  app.use((request, response, next) => {
    const supplied = request.header('X-Request-Id')
    const requestId =
      supplied !== undefined && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)
        ? supplied
        : randomUUID()
    response.setHeader('X-Request-Id', requestId)
    response.locals.requestId = requestId
    next()
  })

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'depin' })
  })

  app.get('/status', (_request, response) => {
    const facilitator = facilitatorSettleReadiness(
      config.facilitatorUrl,
      environment,
    )
    response.json({
      status: 'ok',
      service: 'depin',
      configSource,
      stateBackend,
      multiInstanceSafe,
      capabilities: {
        scheme: 'exact',
        network: 'stellar:testnet',
        facilitatorUrl: config.facilitatorUrl,
        facilitatorAuthConfigured: facilitator.authConfigured,
        facilitatorOzChannels: facilitator.ozChannels,
        settleAuthRequired: facilitator.settleAuthRequired,
        settleReady: facilitator.settleReady,
        settlement: 'after_upstream_success',
        fees: 'sponsored',
        replayTtlMs: config.replayTtlMs,
        unpaidRateLimit: config.unpaidRateLimit,
      },
      providers: config.providers.map(provider => {
        const upstream = new URL(provider.upstreamUrl)
        return {
          route: provider.route,
          method: provider.method,
          description: provider.description,
          price: provider.price,
          recipient: provider.recipient,
          network: provider.network,
          timeoutMs: provider.timeoutMs,
          upstreamOrigin: upstream.origin,
          upstreamSecretRequired: provider.upstreamSecretRef !== undefined,
        }
      }),
    })
  })

  for (const provider of config.providers) {
    const handler = async (request: Request, response: Response): Promise<void> => {
      const requestId = String(response.locals.requestId)
      const startedAt = now()
      const paymentSignature = request.header('PAYMENT-SIGNATURE')

      if (paymentSignature === undefined) {
        const rateLimit = await rateLimitStore.consume(
          request.ip ?? 'unknown',
          config.unpaidRateLimit.maxRequests,
          config.unpaidRateLimit.windowMs,
        )
        if (!rateLimit.allowed) {
          response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
          response.status(429).json({
            error: {
              code: 'unpaid_rate_limit_exceeded',
              message: 'Too many unpaid requests',
            },
          })
          logger.info({
            event: 'unpaid_rate_limited',
            requestId,
            route: provider.route,
            method: provider.method,
            status: 429,
          })
          return
        }
      }

      let decision
      try {
        decision = await protocol.authorize(request)
      } catch {
        response.status(502).json({
          error: {
            code: 'payment_verification_unavailable',
            message: 'Payment verification is temporarily unavailable',
          },
        })
        logger.error({
          event: 'payment_verification_error',
          requestId,
          route: provider.route,
          method: provider.method,
          status: 502,
        })
        return
      }

      if (decision.type === 'payment-error') {
        if (paymentSignature !== undefined) {
          const rateLimit = await rateLimitStore.consume(
            request.ip ?? 'unknown',
            config.unpaidRateLimit.maxRequests,
            config.unpaidRateLimit.windowMs,
          )
          if (!rateLimit.allowed) {
            response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
            response.status(429).json({
              error: {
                code: 'unpaid_rate_limit_exceeded',
                message: 'Too many unpaid requests',
              },
            })
            logger.info({
              event: 'unpaid_rate_limited',
              requestId,
              route: provider.route,
              method: provider.method,
              status: 429,
            })
            return
          }
        }
        applyProtocolResponse(response, decision.response)
        logger.info({
          event: paymentSignature === undefined ? 'payment_required' : 'payment_rejected',
          requestId,
          route: provider.route,
          method: provider.method,
          status: decision.response.status,
        })
        return
      }

      if (
        paymentSignature === undefined ||
        !(await claimPaymentReplay(
          replayStore,
          replayMaterial(decision.payment),
          config.replayTtlMs,
        ))
      ) {
        await safeCancel(protocol, decision.payment, {
          reason: 'handler_failed',
          responseStatus: 409,
        })
        response.status(409).json({
          error: {
            code: 'payment_replay',
            message: 'This payment authorization has already been used',
          },
        })
        logger.info({
          event: 'payment_replay_rejected',
          requestId,
          route: provider.route,
          method: provider.method,
          status: 409,
        })
        return
      }

      let upstream
      try {
        upstream = await callUpstream({
          request,
          requestId,
          provider,
          environment,
          fetchImplementation,
          maxResponseBytes: config.maxUpstreamResponseBytes,
        })
      } catch (error) {
        const upstreamError =
          error instanceof UpstreamError
            ? error
            : new UpstreamError(502, 'upstream_unavailable', 'Upstream request failed')
        await safeCancel(protocol, decision.payment, {
          reason: error instanceof UpstreamError ? 'handler_failed' : 'handler_threw',
          error,
          responseStatus: upstreamError.status,
        })
        response.status(upstreamError.status).json({
          error: { code: upstreamError.code, message: upstreamError.message },
        })
        logger.error({
          event: 'upstream_failed',
          requestId,
          route: provider.route,
          method: provider.method,
          status: upstreamError.status,
          reason: upstreamError.code,
        })
        return
      }

      let settlement
      try {
        settlement = await protocol.settle(
          decision.payment,
          upstream.body,
          upstream.headers,
        )
      } catch {
        response.status(502).json({
          error: {
            code: 'payment_settlement_unavailable',
            message: 'Payment settlement is temporarily unavailable',
          },
        })
        logger.error({
          event: 'payment_settlement_error',
          requestId,
          route: provider.route,
          method: provider.method,
          status: 502,
        })
        return
      }

      if (!settlement.success) {
        applyProtocolResponse(response, settlement.response)
        logger.error({
          event: 'payment_settlement_failed',
          requestId,
          route: provider.route,
          method: provider.method,
          status: settlement.response.status,
          reason: settlement.errorReason,
        })
        return
      }

      setHeaders(response, upstream.headers)
      setHeaders(response, settlement.headers)
      response.status(upstream.status)
      if (provider.method === 'HEAD' || upstream.status === 204) response.end()
      else response.send(upstream.body)
      logger.info({
        event: 'request_fulfilled',
        requestId,
        route: provider.route,
        method: provider.method,
        status: upstream.status,
        durationMs: now() - startedAt,
        transaction: settlement.transaction,
      })
    }

    if (provider.method === 'GET') app.get(provider.route, handler)
    else app.head(provider.route, handler)
  }

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: 'route_not_found', message: 'Route not found' },
    })
  })

  return app
}

function replayMaterial(payment: VerifiedPayment): string {
  const transaction = payment.paymentPayload.payload.transaction
  return JSON.stringify({
    x402Version: payment.paymentPayload.x402Version,
    scheme: payment.paymentRequirements.scheme,
    network: payment.paymentRequirements.network,
    asset: payment.paymentRequirements.asset,
    amount: payment.paymentRequirements.amount,
    payTo: payment.paymentRequirements.payTo,
    transaction: typeof transaction === 'string' ? transaction : payment.paymentPayload.payload,
  })
}

async function callUpstream(input: {
  request: Request
  requestId: string
  provider: ProviderConfig
  environment: NodeJS.ProcessEnv
  fetchImplementation: typeof fetch
  maxResponseBytes: number
}): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  const target = new URL(input.provider.upstreamUrl)
  for (const [key, value] of Object.entries(input.request.query)) {
    appendQueryValue(target, key, value)
  }

  const headers = new Headers({ 'X-Request-Id': input.requestId })
  for (const name of passthroughRequestHeaders) {
    const value = input.request.header(name)
    if (value !== undefined) headers.set(name, value)
  }
  if (input.provider.upstreamSecretRef !== undefined) {
    const secret = input.environment[input.provider.upstreamSecretRef]
    if (secret === undefined || secret === '') {
      throw new UpstreamError(
        503,
        'upstream_secret_unavailable',
        'The upstream credential is not configured',
      )
    }
    headers.set('Authorization', `Bearer ${secret}`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), input.provider.timeoutMs)
  let upstreamResponse: globalThis.Response
  try {
    upstreamResponse = await input.fetchImplementation(target, {
      method: input.provider.method,
      headers,
      signal: controller.signal,
      redirect: 'manual',
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new UpstreamError(504, 'upstream_timeout', 'The upstream request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!upstreamResponse.ok) {
    throw new UpstreamError(
      502,
      'upstream_failed',
      `The upstream returned HTTP ${String(upstreamResponse.status)}`,
    )
  }

  const body = await readLimitedBody(upstreamResponse, input.maxResponseBytes)
  const responseHeaders: Record<string, string> = {}
  for (const name of passthroughResponseHeaders) {
    const value = upstreamResponse.headers.get(name)
    if (value !== null) responseHeaders[name] = value
  }
  return { status: upstreamResponse.status, headers: responseHeaders, body }
}

function appendQueryValue(target: URL, key: string, value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) appendQueryValue(target, key, item)
    return
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    target.searchParams.append(key, String(value))
  }
}

async function readLimitedBody(response: globalThis.Response, maximumBytes: number): Promise<Buffer> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new UpstreamError(
      502,
      'upstream_response_too_large',
      'The upstream response exceeded the configured limit',
    )
  }
  if (response.body === null) return Buffer.alloc(0)

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maximumBytes) {
      await reader.cancel()
      throw new UpstreamError(
        502,
        'upstream_response_too_large',
        'The upstream response exceeded the configured limit',
      )
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, size)
}

async function safeCancel(
  protocol: PaymentProtocol,
  payment: VerifiedPayment,
  input: {
    reason: 'handler_threw' | 'handler_failed'
    error?: unknown
    responseStatus?: number
  },
): Promise<void> {
  try {
    await protocol.cancel(payment, input)
  } catch {
    // Cancellation hooks are advisory and must not hide the original failure.
  }
}

function applyProtocolResponse(
  response: Response,
  instructions: HTTPResponseInstructions,
): void {
  setHeaders(response, instructions.headers)
  response.status(instructions.status)
  if (instructions.body === undefined) response.end()
  else response.send(instructions.body)
}

function setHeaders(response: Response, headers: Record<string, string>): void {
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value)
}
