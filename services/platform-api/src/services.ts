import { createServer } from 'node:http'
import { AsyncLocalStorage } from 'node:async_hooks'
import { handleAsNodeRequest } from 'cloudflare:node'
import { env } from 'cloudflare:workers'
import { createApp } from '../../nft-service/api/src/app'
import { D1NftRepository } from '../../nft-service/api/src/d1Repository'
import { R2AssetPinningService } from '../../nft-service/api/src/r2Pinning'
import { NftService } from '../../nft-service/api/src/service'
import {
  StellarNftChainGateway,
  UnavailableNftChainGateway,
} from '../../nft-service/api/src/stellarGateway'
import { createGateApp } from '../../agent-auth/src/app'
import { D1GateRepository } from '../../agent-auth/src/repository.d1'
import { loadConfig } from '../../agent-auth/src/config'
import captchaSdk from '../../../packages/agent-auth-sdk/src/captcha.js'
import { createDepinApp } from '../../depin/src/proxy'
import { parseConfig } from '../../depin/src/config'
import { X402PaymentProtocol } from '../../depin/src/payment'
import { D1ReplayStore } from '../../depin/src/stores.d1'
import type { DepinConfig, PaymentProtocol } from '../../depin/src/domain'
import { authenticate } from './auth'
import { HttpError, Store } from './store'

const base = env.PUBLIC_API_URL || 'https://zexvro-platform-api.zexvro.workers.dev'
const context = new AsyncLocalStorage<{ request: Request; owner?: string }>()
const nftRepo = new D1NftRepository(env.DB)
const gateRepo = new D1GateRepository(env.DB, () => context.getStore()?.owner)
const pinning = new R2AssetPinningService(env.NFT_MEDIA, `${base}/nft`)
const sponsor = env.STELLAR_SPONSOR_SECRET,
  wasm = env.NFT_COLLECTION_WASM_HASH
const chain =
  sponsor && wasm
    ? new StellarNftChainGateway({
        rpcUrl: env.STELLAR_RPC_URL,
        networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
        sponsorSecret: sponsor,
        collectionWasmHash: wasm,
      })
    : new UnavailableNftChainGateway()
const nftService = new NftService(
  nftRepo,
  pinning,
  chain,
  300,
  () => new Date(),
  env.STELLAR_PAYMENT_TOKEN,
  `${base}/nft`,
)
async function authorizeScope(
  scope: string,
  identities: string[],
  write: boolean,
) {
  const [workspaceId, projectId] = scope.split(':')
  if (!workspaceId) throw new HttpError(400, 'Workspace scope required')
  const store = new Store(env.DB)
  if(write)await store.requirePermission(workspaceId,identities,'service.configure')
  else await store.authorize(workspaceId,identities)
  if (projectId) {
    const project = await store.record('project', projectId)
    if (!project || project.workspaceId !== workspaceId)
      throw new HttpError(403, 'Project access denied')
  }
}
const nftApp = createApp(nftService, {
  migrateLegacyScope: false,
  allowedOrigins: env.ALLOWED_ORIGINS.split(','),
  capabilities: {
    network: 'stellar:pubnet',
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    rpcUrl: env.STELLAR_RPC_URL,
    paymentTokenAddress: env.STELLAR_PAYMENT_TOKEN,
    pinningConfigured: true,
    stellarConfigured: Boolean(sponsor && wasm),
    storageMode: 'r2',
  },
  assetReader: pinning,
  authenticate: async (req, res, next) => {
    try {
      const original = context.getStore()?.request
      if (!original) throw new HttpError(500, 'Request context missing')
      const user = await authenticate(original, env),
        write = !['GET', 'HEAD'].includes(req.method)
      if (
        write &&
        !(await env.WRITE_RATE_LIMITER.limit({ key: user.username })).success
      )
        throw new HttpError(429, 'Write rate exceeded')
      res.locals.nftIdentity = { subject: user.username }
      const match = req.path.match(/^\/v1\/collections\/([^/]+)/)
      let scope =
        typeof req.query.workspaceId === 'string'
          ? req.query.workspaceId
          : req.body?.workspaceId
      let collectionId = match?.[1] || req.body?.collectionId
      const intentId = req.path.match(/^\/v1\/checkout\/intents\/([^/]+)/)?.[1]
      if (intentId) {
        const intent = await nftRepo.getCheckoutIntent(intentId)
        if (!intent) throw new HttpError(404, 'Checkout not found')
        collectionId = intent.collectionId
      }
      if (collectionId) {
        const collection = await nftRepo.getCollection(String(collectionId))
        if (!collection) throw new HttpError(404, 'Collection not found')
        const dot = collection.workspaceId.indexOf('.')
        scope = Buffer.from(
          collection.workspaceId.slice(dot + 1),
          'base64url',
        ).toString('utf8')
      }
      if (scope) await authorizeScope(String(scope), user.identities, write)
      else if (req.path !== '/v1/media')
        throw new HttpError(400, 'Workspace scope required')
      next()
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      res
        .status(status)
        .json({
          error: {
            code: 'access_denied',
            message:
              error instanceof HttpError ? error.message : 'Request failed',
          },
        })
    }
  },
})
createServer(nftApp).listen(4101)
let gateReady = false
function gate() {
  if (
    !env.GATE_SIGNING_SECRET ||
    env.GATE_SIGNING_SECRET.startsWith('local-development')
  )
    throw new HttpError(503, 'Gate signing is not configured')
  if (gateReady) return 4103
  const config = {
    ...loadConfig({
      NODE_ENV: 'production',
      AGENT_AUTH_ISSUER: `${base}/gate`,
      AGENT_AUTH_SIGNING_SECRET: env.GATE_SIGNING_SECRET,
    }),
    stateBackend: 'd1' as const,
    corsOrigins: env.ALLOWED_ORIGINS.split(','),
  }
  const app = createGateApp(config, gateRepo, {
    adminAuth: (_req, _res, next) => {
      if (!context.getStore()?.owner)
        throw new HttpError(401, 'Sign in required')
      next()
    },
  })
  createServer(app).listen(4103)
  gateReady = true
  return 4103
}
let depinReady = false
function depin() {
  if (depinReady) return 4102
  const configured = Boolean(env.DEPIN_CONFIG_JSON?.trim())
  // Never invent a provider, billable destination or wallet during setup.
  const config: DepinConfig = configured
    ? {...parseConfig(JSON.parse(env.DEPIN_CONFIG_JSON)), unpaidRateLimit: {maxRequests:30,windowMs:60000}}
    : {port:4102,facilitatorUrl:'https://x402.org/facilitator',maxUpstreamResponseBytes:1048576,
       replayTtlMs:600000,unpaidRateLimit:{maxRequests:30,windowMs:60000},providers:[]}
  let initialized = false
  const real = configured ? new X402PaymentProtocol(config) : null
  const protocol: PaymentProtocol = {
    initialize: async () => {},
    authorize: async request => {
      if (!real) throw new HttpError(503,'Configure a DEDSEC provider and payment recipient first')
      // Only completed public metadata is reused, never in-flight I/O promises.
      if (!initialized) { await real.initialize(); initialized = true }
      return real.authorize(request)
    },
    settle: (payment,body,headers) => real!.settle(payment,body,headers),
    cancel: (payment,input) => real!.cancel(payment,input),
  }
  createServer(createDepinApp({config,protocol,stateBackend:'d1',
    configSource:{type:'inline',detail:configured?'Cloudflare provider configuration':'Not configured'},
    environment:{...process.env,CORS_ALLOWED_ORIGINS:env.ALLOWED_ORIGINS},
    replayStore:new D1ReplayStore(env.DB),
    rateLimitStore:{consume:async key => ({allowed:(await env.DEPIN_UNPAID_RATE_LIMITER.limit({key})).success,retryAfterSeconds:60})},
  })).listen(4102)
  depinReady = true
  return 4102
}
export async function serviceFetch(request: Request) {
  const url = new URL(request.url),
    isGate = url.pathname.startsWith('/gate'),
    isDepin = url.pathname.startsWith('/depin')
  const path = url.pathname.slice(isGate ? 5 : isDepin ? 6 : 4) || '/'
  url.pathname = path
  const ctx: { request: Request; owner?: string } = { request }
  if (
    isGate &&
    request.method !== 'OPTIONS' &&
    (path.startsWith('/v1/admin') || path.startsWith('/v1/webauthn/register'))
  ) {
    const user = await authenticate(request, env)
    ctx.owner = user.username
    if (
      !['GET', 'HEAD'].includes(request.method) &&
      !(await env.WRITE_RATE_LIMITER.limit({ key: user.username })).success
    )
      throw new HttpError(429, 'Write rate exceeded')
  }
  if (isGate && path === '/v1/sdk/captcha.js')
    return new Response(captchaSdk, {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public,max-age=300',
      },
    })
  const port = isGate ? gate() : isDepin ? depin() : 4101
  if(isDepin){
    const headers=new Headers(request.headers);
    headers.set('X-Forwarded-For',request.headers.get('CF-Connecting-IP') || '127.0.0.1');
    request=new Request(request,{headers});
  }
  return context.run(ctx, () =>
    handleAsNodeRequest(port, new Request(url, request)),
  )
}
