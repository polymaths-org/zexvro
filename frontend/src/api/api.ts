/**
 * ZEXVRO API Client
 *
 * Centralized HTTP client for AWS Lambda backend.
 * Stellar transaction building, signing (Freighter), and submission via Horizon.
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
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { ...getAuthHeaders(), ...(options.headers as Record<string, string> || {}) },
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    throw new Error(
      msg.includes('NetworkError') || msg.includes('Failed to fetch')
        ? `Network error reaching API (${API_BASE}). Check VITE_API_URL / CORS / auth session.`
        : msg,
    );
  }
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

export const workspaceApi = {
  list: () => api.get<{ workspaces: any[] }>('/api/workspaces'),
  create: (data: any) => api.post<any>('/api/workspaces', data),
  update: (id: string, data: any) => api.put<any>(`/api/workspaces/${id}`, data),
  delete: (id: string) => api.delete<any>(`/api/workspaces/${id}`),
  invite: (id: string, member: any) => api.post<any>(`/api/workspaces/${id}/invite`, member),
};

export const projectApi = {
  list: (workspaceId: string) => api.get<{ projects: any[] }>(`/api/projects?workspaceId=${encodeURIComponent(workspaceId)}`),
  create: (data: any) => api.post<any>('/api/projects', data),
  update: (id: string, data: any) => api.put<any>(`/api/projects/${id}`, data),
  delete: (id: string) => api.delete<any>(`/api/projects/${id}`),
};

export const employeeApi = {
  list: (workspaceId: string) => api.get<{ employees: any[] }>(`/api/employees?workspaceId=${encodeURIComponent(workspaceId)}`),
  create: (data: any) => api.post<any>('/api/employees', data),
  bulkCreate: (data: any) => api.post<any>('/api/employees/bulk', data),
  update: (id: string, data: any) => api.put<any>(`/api/employees/${id}`, data),
  delete: (id: string, workspaceId?: string) => api.delete<any>(`/api/employees/${id}${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''}`),
};

export const payrollApi = {
  listRuns: (workspaceId: string) => api.get<{ runs: any[] }>(`/api/payroll/runs?workspaceId=${encodeURIComponent(workspaceId)}`),
  createRun: (data: any) => api.post<any>('/api/payroll/runs', data),
  updateRun: (id: string, data: any) => api.put<any>(`/api/payroll/runs/${id}`, data),
};

export const payrollTaxonomyApi = {
  list: (workspaceId: string) => api.get<{ items: any[]; roles: any[]; departments: any[] }>(`/api/payroll/taxonomy?workspaceId=${encodeURIComponent(workspaceId)}`),
  create: (data: any) => api.post<any>('/api/payroll/taxonomy', data),
  update: (id: string, data: any) => api.put<any>(`/api/payroll/taxonomy/${encodeURIComponent(id)}`, data),
  delete: (id: string, workspaceId: string) => api.delete<any>(`/api/payroll/taxonomy/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`),
};

export const memoryApi = {
  get: () => api.get<{ username: string; memory?: Record<string, unknown> }>('/api/memory'),
  update: (memory: Record<string, unknown>) => api.post<{ status: string; memory: Record<string, unknown> }>('/api/memory', { memory }),
};

export const inviteApi = {
  send: (data: { email: string; workspaceId: string; workspaceName: string; inviterName: string; role: string }) =>
    api.post<any>('/api/invite/send', data),
};

export const proofApi = {
  list: async (projectId: string) => {
    try {
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      return await api.get<{ proofs: any[] }>(`/api/proofs${q}`);
    } catch (e) {
      console.warn('proofApi.list failed (non-fatal):', e);
      return { proofs: [] as any[] };
    }
  },
  create: async (data: any) => {
    try {
      return await api.post<any>('/api/proofs', data);
    } catch (e) {
      console.warn('proofApi.create failed (non-fatal):', e);
      return null;
    }
  },
  update: async (id: string, data: any) => {
    try {
      return await api.put<any>(`/api/proofs/${id}`, data);
    } catch (e) {
      console.warn('proofApi.update failed (non-fatal):', e);
      return null;
    }
  },
};

export const zkNotesApi = {
  list: () => api.get<{ notes: any[] }>('/api/zk-notes'),
  save: (note: any) => api.post<any>('/api/zk-notes', note),
  update: (id: string, data: any) => api.put<any>(`/api/zk-notes/${id}`, data),
  delete: (id: string) => api.delete<any>(`/api/zk-notes/${id}`),
};

/** On-demand RapidSNARK / EC2 prove worker (start/stop from Payroll Settings). */
export type ZkWorkerStatus = {
  configured: boolean;
  provider?: string | null;
  state: string;
  online: boolean;
  instanceId?: string | null;
  publicIp?: string | null;
  privateIp?: string | null;
  proverUrl?: string | null;
  message?: string;
  status?: string;
};

export const zkWorkerApi = {
  status: () => api.get<ZkWorkerStatus>('/api/zk-worker/status'),
  start: () => api.post<ZkWorkerStatus>('/api/zk-worker/start', {}),
  stop: () => api.post<ZkWorkerStatus>('/api/zk-worker/stop', {}),
  /** Proxy to worker fullProve. mode browser_fallback → use local snarkjs. */
  prove: (input: Record<string, unknown>) =>
    api.post<{
      mode: 'remote' | 'browser_fallback' | 'error';
      reason?: string;
      message?: string;
      proof?: { a: string; b: string; c: string };
      a?: string;
      b?: string;
      c?: string;
      worker?: ZkWorkerStatus;
      error?: string;
    }>('/api/zk-worker/prove', { input }),
  /** Server-side Merkle leaf fetch + path build (avoids browser O(tree) RPCs). */
  merkle: (contract: string, commitments: string[]) =>
    api.post<{
      mode?: string;
      reason?: string;
      message?: string;
      error?: string;
      contract?: string;
      count?: number;
      rootHex?: string;
      paths?: Record<string, {
        leafIndex?: number;
        pathElements?: string[];
        pathIndices?: number[];
        root?: string;
        rootHex?: string;
        error?: string;
      }>;
      timings?: { totalMs?: number };
    }>('/api/zk-worker/merkle', { contract, commitments }),
/**
   * Start async private-pay settle on EC2 relayer.
   * Returns { jobId } immediately — poll with job().
   */
  settle: (body: {
    toAddress: string;
    poolContract: string;
    amountStroops: string | number;
    notes: Array<{ secret: string; nullifier: string; commitment?: string; nullifierHash?: string }>;
  }) =>
    api.post<{
      mode?: string;
      jobId?: string;
      status?: string;
      ok?: boolean;
      reason?: string;
      message?: string;
      error?: string;
      lastTxHash?: string;
      fundHash?: string;
      notes?: Array<{
        commitment: string;
        nullifierHash: string;
        leafIndex?: number;
        depositHash?: string;
      }>;
      withdraws?: Array<{ commitment: string; hash: string; ms?: number }>;
      steps?: Array<{ step: string; hash?: string; ms?: number }>;
      timings?: { totalMs?: number };
      relayer?: string;
    }>('/api/zk-worker/settle', body),
  /** Poll async worker job (settle). */
  job: (jobId: string) =>
    api.get<{
      jobId?: string;
      status?: 'running' | 'done' | 'error' | string;
      progress?: string;
      result?: {
        ok?: boolean;
        lastTxHash?: string;
        fundHash?: string;
        notes?: Array<{
          commitment: string;
          nullifierHash: string;
          leafIndex?: number;
          depositHash?: string;
        }>;
        withdraws?: Array<{ commitment: string; hash: string; ms?: number }>;
        steps?: Array<{ step: string; hash?: string; ms?: number }>;
        timings?: { totalMs?: number };
        relayer?: string;
      };
      error?: string;
      mode?: string;
      reason?: string;
      message?: string;
    }>(`/api/zk-worker/jobs/${encodeURIComponent(jobId)}`),
};

/* ─── Stellar SDK — Real On-Chain Transactions ─── */

import {
  TransactionBuilder, Operation, Asset, Networks, Account, BASE_FEE, Memo,
} from 'stellar-sdk';
import { signTransaction as freighterSign } from '@stellar/freighter-api';

/** Known USDC/EURC testnet issuers (Stellar Development Foundation) */
const TESTNET_ISSUERS: Record<string, string> = {
  USDC: 'GBBD47IF6LWK7P7M7SC3DEUQ7OCSEZUO7UHYE2442BENPDUXZUCMV32V',
  EURC: 'GB3Q6QDZYADPKVZGQ5G4Y3XSZFCR5B4XHY7G2T2GK4YRQO6G4SP6YO3G',
};

function isTestnet(horizonUrl: string): boolean {
  return horizonUrl.includes('testnet');
}

function getNetworkPassphrase(horizonUrl: string): string {
  return isTestnet(horizonUrl) ? Networks.TESTNET : Networks.PUBLIC;
}

function getStellarAsset(currency: string, horizonUrl: string): Asset {
  if (currency === 'XLM') return Asset.native();
  const issuer = TESTNET_ISSUERS[currency];
  if (!issuer) throw new Error(`Unknown asset: ${currency}. Only XLM, USDC, EURC are supported.`);
  return new Asset(currency, issuer);
}

const STELLAR_G_RE = /^G[A-Z2-7]{55}$/;

async function signAndSubmitHorizonTx(
  transactionXdr: string,
  passphrase: string,
  horizonUrl: string,
): Promise<{ txHash: string }> {
  const signedResult = await freighterSign(transactionXdr, { networkPassphrase: passphrase });
  if (signedResult.error) {
    const errMsg = typeof signedResult.error === 'object'
      ? (signedResult.error as any).message || JSON.stringify(signedResult.error)
      : signedResult.error;
    throw new Error(`Transaction signing failed: ${errMsg}`);
  }
  if (!signedResult.signedTxXdr) {
    throw new Error('Transaction was not signed. Did you approve in Freighter?');
  }
  const submitResponse = await fetch(`${horizonUrl.replace(/\/$/, '')}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ tx: signedResult.signedTxXdr }).toString(),
  });
  const submitData = await submitResponse.json();
  if (!submitResponse.ok || submitData.status === 'ERROR') {
    const detail = submitData.extras?.result_codes
      ? JSON.stringify(submitData.extras.result_codes)
      : (submitData.extras?.result_xdr || submitData.detail || submitData.title || 'Unknown error');
    throw new Error(`Transaction submission failed: ${detail}`);
  }
  return { txHash: submitData.hash };
}

export const stellar = {
  isValidPublicKey: (key: string) => STELLAR_G_RE.test((key || '').trim()),

  /** Horizon account probe — does not throw on 404. */
  accountExists: async (
    walletAddress: string,
    horizonUrl = 'https://horizon-testnet.stellar.org',
  ): Promise<{ exists: boolean; balances?: { USDC: number; XLM: number; EURC: number } }> => {
    const cleanUrl = horizonUrl.replace(/\/$/, '');
    const addr = (walletAddress || '').trim();
    if (!STELLAR_G_RE.test(addr)) return { exists: false };
    try {
      const response = await fetch(`${cleanUrl}/accounts/${addr}`);
      if (response.status === 404) return { exists: false };
      if (!response.ok) throw new Error(`Horizon error: ${response.statusText}`);
      const data = await response.json();
      const balances = { USDC: 0, XLM: 0, EURC: 0 };
      if (Array.isArray(data.balances)) {
        for (const bal of data.balances) {
          if (bal.asset_type === 'native') balances.XLM = parseFloat(bal.balance) || 0;
          else if (bal.asset_code === 'USDC') balances.USDC = parseFloat(bal.balance) || 0;
          else if (bal.asset_code === 'EURC') balances.EURC = parseFloat(bal.balance) || 0;
        }
      }
      return { exists: true, balances };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to probe Stellar account');
    }
  },

  getPoolBalance: async (walletAddress: string, horizonUrl = 'https://horizon-testnet.stellar.org') => {
    try {
      const probe = await stellar.accountExists(walletAddress, horizonUrl);
      return probe.balances || { USDC: 0, XLM: 0, EURC: 0 };
    } catch (err) {
      console.error('Failed to fetch Stellar balance:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to retrieve account details from Horizon API');
    }
  },

  /**
   * Ensure a G… account exists on-chain (CreateAccount). Required before pool withdraw
   * to a fresh stealth one-time address. Signs with Freighter from `fromAddress`.
   */
  ensureAccount: async (
    fromAddress: string,
    toAddress: string,
    horizonUrl: string,
    startingBalanceXlm = 1.5,
  ): Promise<{ txHash: string | null; created: boolean }> => {
    const cleanUrl = horizonUrl.replace(/\/$/, '');
    const from = fromAddress.trim();
    const to = toAddress.trim();
    if (!STELLAR_G_RE.test(from)) throw new Error('Funding wallet address is invalid (need G… 56 chars).');
    if (!STELLAR_G_RE.test(to)) throw new Error('Destination wallet address is invalid (need G… 56 chars).');

    const destProbe = await stellar.accountExists(to, cleanUrl);
    if (destProbe.exists) return { txHash: null, created: false };

    const accountResponse = await fetch(`${cleanUrl}/accounts/${from}`);
    if (!accountResponse.ok) {
      throw new Error(`Funding wallet not found or unfunded on Horizon: ${from.slice(0, 8)}…`);
    }
    const accountData = await accountResponse.json();
    const passphrase = getNetworkPassphrase(horizonUrl);
    const sourceAccount = new Account(from, accountData.sequence);
    const startBal = Math.max(1, startingBalanceXlm).toFixed(7);
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: passphrase,
    })
      .addOperation(Operation.createAccount({
        destination: to,
        startingBalance: startBal,
      }))
      .setTimeout(180)
      .build();

    const { txHash } = await signAndSubmitHorizonTx(transaction.toXDR(), passphrase, cleanUrl);
    return { txHash, created: true };
  },

  /**
   * Build, sign (via Freighter), and submit a real Stellar payment transaction.
   * Auto-createAccount when destination is missing (XLM only).
   */
  submitPayment: async (
    fromAddress: string,
    toAddress: string,
    amount: number,
    currency: string,
    horizonUrl: string,
    memo?: string,
  ): Promise<{ txHash: string; success: boolean }> => {
    const cleanUrl = horizonUrl.replace(/\/$/, '');
    const passphrase = getNetworkPassphrase(horizonUrl);
    const asset = getStellarAsset(currency, horizonUrl);
    const from = fromAddress.trim();
    const to = toAddress.trim();

    if (!STELLAR_G_RE.test(from)) {
      throw new Error('Funding wallet is not a valid Stellar public key (G…, 56 chars).');
    }
    if (!STELLAR_G_RE.test(to)) {
      throw new Error('Recipient wallet is not a valid Stellar public key (G…, 56 chars).');
    }
    if (!(amount > 0)) {
      throw new Error('Payment amount must be greater than zero.');
    }

    // 1. Fetch source account sequence number from Horizon
    const accountResponse = await fetch(`${cleanUrl}/accounts/${from}`);
    if (!accountResponse.ok) {
      throw new Error(`Source account not found or unfunded: ${from}`);
    }
    const accountData = await accountResponse.json();
    const sequence = accountData.sequence;

    // Destination existence (XLM can create; other assets require trustline/account)
    const dest = await stellar.accountExists(to, cleanUrl);
    if (!dest.exists && currency !== 'XLM') {
      throw new Error(
        `Recipient account ${to.slice(0, 6)}… does not exist on Stellar yet. `
        + `Fund it with XLM first, then retry ${currency}.`,
      );
    }

    // 2. Build the transaction
    const sourceAccount = new Account(from, sequence);
    const txBuilder = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: passphrase,
    });

    if (!dest.exists && currency === 'XLM') {
      // createAccount requires >= 1 XLM starting balance
      if (amount < 1) {
        throw new Error('Recipient wallet is new — send at least 1 XLM to create the account.');
      }
      txBuilder.addOperation(
        Operation.createAccount({
          destination: to,
          startingBalance: amount.toFixed(7),
        }),
      );
    } else {
      txBuilder.addOperation(
        Operation.payment({
          destination: to,
          asset,
          amount: amount.toFixed(7),
        }),
      );
    }

    if (memo) {
      txBuilder.addMemo(Memo.text(memo.slice(0, 28)));
    }

    const transaction = txBuilder.setTimeout(180).build();
    const { txHash } = await signAndSubmitHorizonTx(transaction.toXDR(), passphrase, cleanUrl);
    return { txHash, success: true };
  },
};
