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
  delete: (id: string) => api.delete<any>(`/api/employees/${id}`),
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
