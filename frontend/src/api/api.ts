/**
 * ZEXVRO API Client
 * 
 * Centralized HTTP client for AWS Lambda backend.
 * Currently stubs Stellar SDK calls — will become live when credentials are provided.
 */

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_BASE = import.meta.env.VITE_API_URL ||
  (IS_LOCAL ? 'http://localhost:8080' : 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com');

function getAuthHeaders(): Record<string, string> {
  const session = localStorage.getItem('zexvro_user_session');
  if (!session) return { 'Content-Type': 'application/json' };
  try {
    const parsed = JSON.parse(session);
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${parsed.token}`,
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers as Record<string, string> || {}) },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error_description || error.error || 'API request failed');
  }
  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/* ─── Stellar SDK Stubs ─── */
// TODO: Replace with actual Stellar SDK calls when credentials are provided

export const stellar = {
  /** Check pool balance on-chain */
  getPoolBalance: async (_walletAddress: string) => {
    // TODO: Stellar SDK — server.loadAccount(walletAddress).then(acc => acc.balances)
    return { USDC: 0, XLM: 0, EURC: 0 };
  },

  /** Submit a payment transaction to Stellar */
  submitPayment: async (_from: string, _to: string, _amount: number, _asset: string) => {
    // TODO: Stellar SDK — build + sign + submit transaction
    return { txHash: `0xstub_${Date.now().toString(16)}`, success: true };
  },

  /** Generate a ZK proof via Soroban contract */
  generateProof: async (_contractAddress: string, _inputs: unknown) => {
    // TODO: Soroban SDK — invoke contract method
    return { proofData: '0xstub_proof', verificationKey: '0xstub_vk' };
  },
};
