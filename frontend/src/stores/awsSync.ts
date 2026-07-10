import { useWorkspaceStore } from './workspace';
import { useProjectStore } from './project';
import { useZer0Store } from './zer0';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080'
    : 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com');

let isHydrating = false;
let syncTimeout: number | null = null;

function getUserSession() {
  try {
    const sessionStr = localStorage.getItem('zexvro_user_session');
    if (!sessionStr) return null;
    return JSON.parse(sessionStr);
  } catch {
    return null;
  }
}

export async function pullFromAWS() {
  const session = getUserSession();
  if (!session || !session.token) return;

  isHydrating = true;
  try {
    const response = await fetch(`${API_BASE_URL}/api/memory`, {
      headers: {
        'Authorization': `Bearer ${session.token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const mem = data.memory || {};

      // Hydrate stores if remote data exists
      if (mem.workspaces) {
        useWorkspaceStore.setState({ workspaces: mem.workspaces });
      }
      if (mem.currentWorkspaceId) {
        useWorkspaceStore.setState({ currentWorkspaceId: mem.currentWorkspaceId });
      }

      if (mem.projects) {
        useProjectStore.setState({
          projects: mem.projects,
          environments: mem.environments || [],
          serviceInstances: mem.serviceInstances || [],
          deployments: mem.deployments || [],
          currentProjectId: mem.currentProjectId || null
        });
      }

      if (mem.employees || mem.payments || mem.pool || mem.settings) {
        useZer0Store.setState({
          employees: mem.employees || [],
          payments: mem.payments || [],
          proofs: mem.proofs || [],
          pool: mem.pool || { balances: { USDC: 0, XLM: 0, EURC: 0 }, totalDeposited: 0, totalWithdrawn: 0, totalPaymentsProcessed: 0, lastUpdated: Date.now() },
          settings: mem.settings || {}
        });
      }
    }
  } catch (err) {
    console.error('Failed to pull ZEXVRO state from AWS DynamoDB:', err);
  } finally {
    isHydrating = false;
  }
}

export function pushToAWS() {
  if (isHydrating) return;

  const session = getUserSession();
  if (!session || !session.token) return;

  if (syncTimeout) {
    window.clearTimeout(syncTimeout);
  }

  syncTimeout = window.setTimeout(async () => {
    const wState = useWorkspaceStore.getState();
    const pState = useProjectStore.getState();
    const zState = useZer0Store.getState();

    const memoryPayload = {
      workspaces: wState.workspaces,
      currentWorkspaceId: wState.currentWorkspaceId,
      projects: pState.projects,
      environments: pState.environments,
      serviceInstances: pState.serviceInstances,
      deployments: pState.deployments,
      currentProjectId: pState.currentProjectId,
      employees: zState.employees,
      payments: zState.payments,
      proofs: zState.proofs,
      pool: zState.pool,
      settings: zState.settings,
    };

    try {
      await fetch(`${API_BASE_URL}/api/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`
        },
        body: JSON.stringify({ memory: memoryPayload })
      });
    } catch (err) {
      console.error('Failed to push ZEXVRO state to AWS DynamoDB:', err);
    }
  }, 1000);
}

// Initialize subscriptions to trigger push on any state mutation
export function initializeAWSSync() {
  useWorkspaceStore.subscribe(() => pushToAWS());
  useProjectStore.subscribe(() => pushToAWS());
  useZer0Store.subscribe(() => pushToAWS());
}
