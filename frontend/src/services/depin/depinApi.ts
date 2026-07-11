const DEPIN_API_BASE = (import.meta.env.VITE_DEPIN_API_URL || '/api/depin').replace(/\/$/, '');

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
  capabilities: {
    scheme: 'exact';
    network: 'stellar:testnet';
    facilitatorUrl: string;
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
  if (!contentType.includes('application/json')) return undefined;
  return response.json().catch(() => undefined);
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${DEPIN_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const payload = await readJson(response);

  if (!response.ok) {
    const apiError = payload as ApiErrorPayload | undefined;
    throw new DepinApiError(
      response.status,
      apiError?.error?.code || 'depin_api_error',
      apiError?.error?.message || `De-pin gateway request failed (${response.status})`,
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
  const response = await fetch(`${DEPIN_API_BASE}${provider.route}`, {
    method: provider.method,
    headers: {
      Accept: 'application/json',
    },
    signal,
  });
  const paymentRequired = decodePaymentRequired(response.headers.get('PAYMENT-REQUIRED'));

  return {
    httpStatus: response.status,
    hasPaymentRequiredHeader: paymentRequired !== undefined,
    paymentRequired,
  } satisfies DepinProbeResult;
}
