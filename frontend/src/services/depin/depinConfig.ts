/** Client-side Access Shield / De-pin config builder (no control-plane API). */

export type DepinHttpMethod = 'GET' | 'HEAD';

export interface DepinProviderDraft {
  route: string;
  method: DepinHttpMethod;
  upstreamUrl: string;
  description: string;
  price: string;
  recipient: string;
  network: 'stellar:testnet';
  timeoutMs: number;
  upstreamSecretRef?: string;
}

export interface DepinGatewayConfig {
  port: number;
  facilitatorUrl: string;
  maxUpstreamResponseBytes: number;
  replayTtlMs: number;
  unpaidRateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  providers: DepinProviderDraft[];
}

export const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';
export const OZ_CHANNELS_TESTNET = 'https://channels.openzeppelin.com/x402/testnet';
export const HOSTED_DEPIN_SECRET = 'zexvro/depin/config-json';

export const EMPTY_PROVIDER_DRAFT: DepinProviderDraft = {
  route: '/v1/my-resource',
  method: 'GET',
  upstreamUrl: 'https://httpbin.org/get',
  description: 'Protected HTTP resource',
  price: '$0.001',
  recipient: '',
  network: 'stellar:testnet',
  timeoutMs: 5000,
};

export const DEFAULT_GATEWAY_SHELL: Omit<DepinGatewayConfig, 'providers'> = {
  port: 4102,
  facilitatorUrl: DEFAULT_FACILITATOR_URL,
  maxUpstreamResponseBytes: 10_485_760,
  replayTtlMs: 600_000,
  unpaidRateLimit: { maxRequests: 30, windowMs: 60_000 },
};

const DRAFT_KEY = 'zexvro.depin.provider-drafts.v1';

export function isStellarGAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value.trim());
}

export function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed) return '';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith('/')) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

export function normalizePrice(price: string): string {
  const trimmed = price.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('$') ? trimmed : `$${trimmed}`;
}

export function validateProviderDraft(draft: DepinProviderDraft): string[] {
  const errors: string[] = [];
  const route = normalizeRoute(draft.route);
  if (!route || route === '/') {
    errors.push('Route must be a concrete path like /v1/weather');
  } else if (!/^\/(?:[A-Za-z0-9._~-]+\/?)*$/.test(route)) {
    errors.push('Route may only use path-safe characters');
  } else if (route === '/health' || route === '/status') {
    errors.push('/health and /status are reserved by the gateway');
  }

  if (draft.method !== 'GET' && draft.method !== 'HEAD') {
    errors.push('Only GET and HEAD are supported in this MVP');
  }

  const description = draft.description.trim();
  if (!description) errors.push('Description is required');
  else if (description.length > 240) errors.push('Description must be 240 characters or less');

  const price = normalizePrice(draft.price);
  if (!/^\$(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(price)) {
    errors.push('Price must look like $0.001 (max 7 decimals)');
  } else {
    const amount = Number(price.slice(1));
    if (!(amount > 0 && amount <= 1000)) errors.push('Price must be greater than $0 and at most $1000');
  }

  if (!isStellarGAddress(draft.recipient)) {
    errors.push('Recipient must be a Stellar G-address (not the USDC C-contract)');
  }

  try {
    const url = new URL(draft.upstreamUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      errors.push('Upstream URL must be http(s)');
    }
    if (url.username || url.password) errors.push('Upstream URL cannot include credentials');
    if (url.hash) errors.push('Upstream URL cannot include a fragment');
  } catch {
    errors.push('Upstream URL is invalid');
  }

  if (!Number.isInteger(draft.timeoutMs) || draft.timeoutMs < 100 || draft.timeoutMs > 60_000) {
    errors.push('Timeout must be between 100 and 60000 ms');
  }

  if (draft.upstreamSecretRef?.trim()) {
    if (!/^[A-Z][A-Z0-9_]{1,127}$/.test(draft.upstreamSecretRef.trim())) {
      errors.push('upstreamSecretRef must be an ENV_NAME like UPSTREAM_API_TOKEN');
    }
  }

  return errors;
}

export function sanitizeProviderDraft(draft: DepinProviderDraft): DepinProviderDraft {
  const secret = draft.upstreamSecretRef?.trim();
  return {
    route: normalizeRoute(draft.route),
    method: draft.method,
    upstreamUrl: draft.upstreamUrl.trim(),
    description: draft.description.trim(),
    price: normalizePrice(draft.price),
    recipient: draft.recipient.trim(),
    network: 'stellar:testnet',
    timeoutMs: draft.timeoutMs,
    ...(secret ? { upstreamSecretRef: secret } : {}),
  };
}

export function buildGatewayConfig(
  providers: DepinProviderDraft[],
  overrides?: Partial<Omit<DepinGatewayConfig, 'providers'>>,
): DepinGatewayConfig {
  return {
    ...DEFAULT_GATEWAY_SHELL,
    ...overrides,
    providers: providers.map(sanitizeProviderDraft),
  };
}

export function formatConfigJson(config: DepinGatewayConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function loadProviderDrafts(): DepinProviderDraft[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DepinProviderDraft => (
      item != null
      && typeof item === 'object'
      && typeof (item as DepinProviderDraft).route === 'string'
    ));
  } catch {
    return [];
  }
}

export function saveProviderDrafts(providers: DepinProviderDraft[]) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(providers.map(sanitizeProviderDraft)));
}

export function clearProviderDrafts() {
  localStorage.removeItem(DRAFT_KEY);
}

export function mergeProviders(
  live: Array<{ route: string; method: string }>,
  drafts: DepinProviderDraft[],
): DepinProviderDraft[] {
  const keys = new Set(live.map((p) => `${p.method} ${p.route}`));
  return drafts.filter((d) => !keys.has(`${d.method} ${normalizeRoute(d.route)}`));
}

export function localDeployInstructions(configPath = 'services/depin/depin.config.json'): string {
  return [
    '# Local deploy — write config then restart De-pin',
    `1. Save the JSON as ${configPath}`,
    '2. Set recipient to your provider G-address (USDC trustline on testnet)',
    '3. Optional paid settle: facilitatorUrl = OpenZeppelin Channels + OZ_API_KEY in root .env',
    '4. Restart: npm run dev:all   (or npm run dev:depin)',
    '5. Dashboard → Refresh → Probe 402 on the new route',
  ].join('\n');
}

export function hostedDeployInstructions(): string {
  return [
    '# Hosted App Runner deploy',
    `1. Put the full JSON in Secrets Manager secret ${HOSTED_DEPIN_SECRET}`,
    '   (or set DEPIN_CONFIG_JSON on the zexvro-depin service)',
    '2. Ensure CORS_ALLOWED_ORIGINS includes your dashboard origin',
    '3. Redeploy: node scripts/redeploy-depin-aws.mjs',
    '4. Hard-refresh the dashboard and Probe 402',
  ].join('\n');
}

export function probeCurl(apiBase: string, route: string, method: DepinHttpMethod = 'GET'): string {
  const base = apiBase.replace(/\/$/, '');
  if (method === 'HEAD') {
    return `curl -i -X HEAD '${base}${route}'`;
  }
  return `curl -i '${base}${route}'`;
}

export function paidDemoCommand(apiBase: string, recipient: string): string {
  return [
    'STELLAR_PRIVATE_KEY="$(stellar keys secret zexvro-buyer)" \\',
    `DEPIN_URL='${apiBase.replace(/\/$/, '')}' \\`,
    `DEPIN_EXPECTED_RECIPIENT='${recipient || 'G...PROVIDER'}' \\`,
    'npm --prefix services/depin run demo:client',
  ].join('\n');
}
