import type { Request } from 'express'
import {
  HTTPFacilitatorClient,
  type HTTPRequestContext,
  type RoutesConfig,
  x402HTTPResourceServer,
  x402ResourceServer,
} from '@x402/core/server'
import { ExpressAdapter } from '@x402/express'
import { ExactStellarScheme } from '@x402/stellar/exact/server'
import type {
  DepinConfig,
  PaymentDecision,
  PaymentProtocol,
  ProviderConfig,
  VerifiedPayment,
} from './domain.js'

export function buildX402Routes(providers: ProviderConfig[]): RoutesConfig {
  return Object.fromEntries(
    providers.map((provider) => [
      `${provider.method} ${provider.route}`,
      {
        accepts: {
          scheme: 'exact',
          price: provider.price,
          network: provider.network,
          payTo: provider.recipient,
          maxTimeoutSeconds: Math.max(
            60,
            Math.ceil(provider.timeoutMs / 1_000) + 30,
          ),
        },
        description: provider.description,
        mimeType: 'application/json',
        serviceName: 'ZEXVRO De-pin',
      },
    ]),
  )
}

export class X402PaymentProtocol implements PaymentProtocol {
  private readonly server: x402HTTPResourceServer

  constructor(config: DepinConfig, server?: x402HTTPResourceServer) {
    if (server !== undefined) {
      this.server = server
      return
    }
    const facilitator = new HTTPFacilitatorClient({ url: config.facilitatorUrl })
    const resourceServer = new x402ResourceServer(facilitator).register(
      'stellar:testnet',
      new ExactStellarScheme(),
    )
    this.server = new x402HTTPResourceServer(
      resourceServer,
      buildX402Routes(config.providers),
    )
  }

  initialize(): Promise<void> {
    return this.server.initialize()
  }

  async authorize(request: Request): Promise<PaymentDecision> {
    const adapter = new ExpressAdapter(request)
    const paymentHeader = request.header('PAYMENT-SIGNATURE')
    const requestContext: HTTPRequestContext = {
      adapter,
      path: request.path,
      method: request.method,
      ...(paymentHeader === undefined ? {} : { paymentHeader }),
    }
    const result = await this.server.processHTTPRequest(requestContext)
    if (result.type === 'payment-error') return result
    if (result.type === 'no-payment-required') {
      return {
        type: 'payment-error',
        response: {
          status: 500,
          headers: { 'content-type': 'application/json' },
          body: {
            error: {
              code: 'payment_route_misconfigured',
              message: 'The configured route was not protected by x402',
            },
          },
        },
      }
    }

    return {
      type: 'verified',
      payment: {
        requestContext,
        paymentPayload: result.paymentPayload,
        paymentRequirements: result.paymentRequirements,
        ...(result.declaredExtensions === undefined
          ? {}
          : { declaredExtensions: result.declaredExtensions }),
        cancellationDispatcher: result.cancellationDispatcher,
      },
    }
  }

  settle(
    payment: VerifiedPayment,
    responseBody: Buffer,
    responseHeaders: Record<string, string>,
  ) {
    return this.server.processSettlement(
      payment.paymentPayload,
      payment.paymentRequirements,
      payment.declaredExtensions,
      {
        request: payment.requestContext,
        responseBody,
        responseHeaders,
      },
    )
  }

  cancel(
    payment: VerifiedPayment,
    input: {
      reason: 'handler_threw' | 'handler_failed'
      error?: unknown
      responseStatus?: number
    },
  ): Promise<void> {
    return payment.cancellationDispatcher.cancel(input)
  }
}
