import { api, employeeApi, projectApi, workspaceApi } from '../api/api';
import { useWorkspaceStore } from './workspace';
import { useProjectStore } from './project';
import { useZer0Store } from './zer0';
import type { Workspace } from './types';

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

function idFromRemote<T extends Record<string, any>>(item: T, fallbackKey: string): T {
  return {
    ...item,
    id: item.id || item[fallbackKey],
  };
}

function uniqueByWorkspaceName<T extends { name?: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = String(item.name || '').trim().toLowerCase();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function pullMemoryFallback() {
  try {
    const data = await api.get<{ memory?: Record<string, any> }>('/api/memory');
    return data.memory || {};
  } catch (err) {
    console.error('Failed to pull fallback memory from AWS:', err);
    return {};
  }
}

export async function pullFromAWS() {
  const session = getUserSession();
  if (!session?.token) return;

  isHydrating = true;
  try {
    const fallback = await pullMemoryFallback();

    const wsData = await workspaceApi.list();
    const workspaces = uniqueByWorkspaceName(
      (wsData.workspaces || []).map(workspace => idFromRemote(workspace, 'workspaceId')),
    );

    if (workspaces.length) {
      const fallbackWorkspaceId = fallback.currentWorkspaceId;
      const currentWorkspaceId =
        workspaces.some(workspace => workspace.id === fallbackWorkspaceId)
          ? fallbackWorkspaceId
          : workspaces[0].id;

      useWorkspaceStore.setState({ workspaces, currentWorkspaceId });
    } else if (fallback.workspaces) {
      const fallbackWorkspaces = uniqueByWorkspaceName((fallback.workspaces || []) as Workspace[]);
      useWorkspaceStore.setState({
        workspaces: fallbackWorkspaces,
        currentWorkspaceId: fallback.currentWorkspaceId || fallbackWorkspaces[0]?.id || null,
      });
    } else if (fallback.currentWorkspaceId) {
      useWorkspaceStore.setState({ currentWorkspaceId: fallback.currentWorkspaceId });
    }

    const currentWorkspaceId = useWorkspaceStore.getState().currentWorkspaceId;
    if (currentWorkspaceId) {
      const projData = await projectApi.list(currentWorkspaceId);
      const projects = (projData.projects || []).map(project => idFromRemote(project, 'projectId'));
      const environments = projects.flatMap(project => project.environments || []);
      const serviceInstances = projects.flatMap(project => project.serviceInstances || []);

      useProjectStore.setState({
        projects,
        environments: environments.length ? environments : fallback.environments || [],
        serviceInstances: serviceInstances.length ? serviceInstances : fallback.serviceInstances || [],
        deployments: fallback.deployments || [],
        currentProjectId: fallback.currentProjectId || projects[0]?.id || null,
      });

      const empData = await employeeApi.list(currentWorkspaceId);
      const employees = (empData.employees || []).map(employee => idFromRemote(employee, 'employeeId'));
      useZer0Store.setState({
        employees,
        payments: fallback.payments || [],
        proofs: fallback.proofs || [],
        pool: useZer0Store.getState().pool,
        settings: { ...useZer0Store.getState().settings, ...(fallback.settings || {}) },
      });
    } else if (fallback.projects || fallback.employees || fallback.payments || fallback.pool || fallback.settings) {
      useProjectStore.setState({
        projects: fallback.projects || [],
        environments: fallback.environments || [],
        serviceInstances: fallback.serviceInstances || [],
        deployments: fallback.deployments || [],
        currentProjectId: fallback.currentProjectId || null,
      });

      useZer0Store.setState({
        employees: fallback.employees || [],
        payments: fallback.payments || [],
        proofs: fallback.proofs || [],
        pool: useZer0Store.getState().pool,
        settings: { ...useZer0Store.getState().settings, ...(fallback.settings || {}) },
      });
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
  if (!session?.token) return;

  if (syncTimeout) {
    window.clearTimeout(syncTimeout);
  }

  syncTimeout = window.setTimeout(async () => {
    const wState = useWorkspaceStore.getState();
    const pState = useProjectStore.getState();
    const zState = useZer0Store.getState();

    const memoryPayload = {
      currentWorkspaceId: wState.currentWorkspaceId,
      environments: pState.environments,
      serviceInstances: pState.serviceInstances,
      deployments: pState.deployments,
      currentProjectId: pState.currentProjectId,
      payments: zState.payments,
      proofs: zState.proofs,
      pool: zState.pool,
      settings: zState.settings,
    };

    try {
      await api.post('/api/memory', { memory: memoryPayload });
    } catch (err) {
      console.error('Failed to push fallback ZEXVRO state to AWS DynamoDB:', err);
    }
  }, 1000);
}

export function initializeAWSSync() {
  useWorkspaceStore.subscribe(() => pushToAWS());
  useProjectStore.subscribe(() => pushToAWS());
  useZer0Store.subscribe(() => pushToAWS());
}
