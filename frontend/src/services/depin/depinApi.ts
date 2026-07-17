const HOSTED_DEPIN_API = 'https://sr9k3xpmbj.us-east-1.awsapprunner.com';
const configuredDepinApi = (import.meta.env.VITE_DEPIN_API_URL || '').trim().replace(/\/$/, '');
// Prefer explicit env; fall back to hosted App Runner so Pages/local never hit a dead proxy.
const DEPIN_API_BASE = configuredDepinApi || HOSTED_DEPIN_API;

/** Shared API origin for dashboard + docs. */
export function getDepinApiBaseUrl(): string {
  return DEPIN_API_BASE;
}

export interface DepinHealth {
  status: 'ok';
  service: 'depin';
}

export interface DepinProvider {
  route: string;
  method: 'GET' | 'HEAD';
  description: string;
  price: string;
  recipient: string;
  network: 'stellar:testnet';
  timeoutMs: number;
  upstreamOrigin: string;
  upstreamSecretRequired: boolean;
}

export interface DepinStatus {
  status: 'ok';
  service: 'depin';
  configSource?: {
    type: 'file' | 'inline' | 'url';
    detail: string;
  };
  stateBackend?: 'memory' | 'file';
  /** True only when state is shared across instances (not App Runner /tmp alone). */
  multiInstanceSafe?: boolean;
  capabilities: {
    scheme: 'exact';
    network: 'stellar:testnet';
    facilitatorUrl: string;
    facilitatorAuthConfigured?: boolean;
    facilitatorOzChannels?: boolean;
    settleAuthRequired?: boolean;
    /** False when OZ Channels is configured without OZ_API_KEY. */
    settleReady?: boolean;
    settlement: 'after_upstream_success';
    fees: 'sponsored';
    replayTtlMs: number;
    unpaidRateLimit: {
      maxRequests: number;
      windowMs: number;
    };
  };
  providers: DepinProvider[];
}

interface PaymentRequiredHeader {
  x402Version?: number;
  error?: string;
  accepts?: Array<{
    scheme?: string;
    network?: string;
    asset?: string;
    amount?: string;
    payTo?: string;
    maxTimeoutSeconds?: number;
    extra?: Record<string, unknown>;
  }>;
}

export interface DepinProbeResult {
  httpStatus: number;
  hasPaymentRequiredHeader: boolean;
  paymentRequired?: PaymentRequiredHeader;
}

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export class DepinApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'DepinApiError';
    this.status = status;
    this.code = code;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => undefined);
  }
  const text = await response.text().catch(() => '');
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function networkErrorMessage(path: string, error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('Network request failed')) {
    return (
      `Network error reaching De-pin (${DEPIN_API_BASE}${path}). ` +
      'Gateway may be down, VITE_DEPIN_API_URL may be wrong, or App Runner CORS may need redeploy.'
    );
  }
  return msg;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${DEPIN_API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch (error) {
    throw new DepinApiError(0, 'depin_network_error', networkErrorMessage(path, error));
  }
  const payload = await readJson(response);

  if (!response.ok) {
    const apiError = payload as ApiErrorPayload | undefined;
    throw new DepinApiError(
      response.status,
      apiError?.error?.code || 'depin_api_error',
      apiError?.error?.message
        || `De-pin gateway request failed (${response.status}) for ${DEPIN_API_BASE}${path}`,
    );
  }

  if (payload === null || payload === undefined || typeof payload !== 'object') {
    throw new DepinApiError(
      502,
      'invalid_depin_api_response',
      `De-pin API returned a non-JSON response for ${path}. Check VITE_DEPIN_API_URL.`,
    );
  }

  return payload as T;
}

function decodePaymentRequired(value: string | null): PaymentRequiredHeader | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(globalThis.atob(value)) as PaymentRequiredHeader;
  } catch {
    return undefined;
  }
}

export function getDepinHealth(signal?: AbortSignal) {
  return requestJson<DepinHealth>('/health', { signal });
}

export function getDepinStatus(signal?: AbortSignal) {
  return requestJson<DepinStatus>('/status', { signal });
}

export async function probeDepinProvider(provider: DepinProvider, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(`${DEPIN_API_BASE}${provider.route}`, {
      method: provider.method,
      headers: {
        Accept: 'application/json',
      },
      signal,
    });
  } catch (error) {
    throw new DepinApiError(0, 'depin_network_error', networkErrorMessage(provider.route, error));
  }
  const paymentRequired = decodePaymentRequired(response.headers.get('PAYMENT-REQUIRED'));

  return {
    httpStatus: response.status,
    hasPaymentRequiredHeader: paymentRequired !== undefined,
    paymentRequired,
  } satisfies DepinProbeResult;
}
