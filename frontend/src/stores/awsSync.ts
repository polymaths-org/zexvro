import { employeeApi, projectApi, workspaceApi, proofApi, payrollApi } from '../api/api';
import { useWorkspaceStore } from './workspace';
import { useProjectStore } from './project';
import { useZer0Store } from './zer0';

let isHydrating = false;

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

export async function pullFromAWS() {
  const session = getUserSession();
  if (!session?.token) return;

  isHydrating = true;
  try {
    // All data comes from dedicated APIs — no memory endpoint calls
    const wsData = await workspaceApi.list();
    const workspaces = uniqueByWorkspaceName(
      (wsData.workspaces || []).map(workspace => idFromRemote(workspace, 'workspaceId')),
    );

    if (workspaces.length) {
      const currentWorkspaceId = useWorkspaceStore.getState().currentWorkspaceId;
      const resolvedWorkspaceId =
        workspaces.some(workspace => workspace.id === currentWorkspaceId)
          ? currentWorkspaceId
          : workspaces[0].id;

      useWorkspaceStore.setState({ workspaces, currentWorkspaceId: resolvedWorkspaceId });
    }

    const currentWorkspaceId = useWorkspaceStore.getState().currentWorkspaceId;
    if (currentWorkspaceId) {
      const projData = await projectApi.list(currentWorkspaceId);
      const projects = (projData.projects || []).map(project => idFromRemote(project, 'projectId'));
      const environments = projects.flatMap(project => project.environments || []);
      const serviceInstances = projects.flatMap(project => project.serviceInstances || []);

      useProjectStore.setState({
        projects,
        environments,
        serviceInstances,
        deployments: useProjectStore.getState().deployments,
        currentProjectId: useProjectStore.getState().currentProjectId || projects[0]?.id || null,
      });

      const empData = await employeeApi.list(currentWorkspaceId);
      const employees = (empData.employees || []).map(employee => idFromRemote(employee, 'employeeId'));
      
      let proofs: any[] = [];
      try {
        const proofRes = await proofApi.list('');
        proofs = proofRes.proofs || [];
      } catch (e) {
        console.error('Failed to pull proofs from AWS:', e);
        proofs = useZer0Store.getState().proofs;
      }

      // Start with current store payments (preserve anything created this session)
      let payments = [...useZer0Store.getState().payments];

      try {
        const runData = await payrollApi.listRuns(currentWorkspaceId);
        const runs = runData.runs || [];
        
        const existingPaymentIds = new Set(payments.map(p => p.id));

        const currentProjectId = useProjectStore.getState().currentProjectId || '';

        // Import runs that don't exist in local payments yet
        for (const run of runs) {
          const runId = run.id || run.runId;
          if (existingPaymentIds.has(runId)) continue;
          if (!run.lineItems || !run.lineItems.length) continue;
          const item = run.lineItems[0];
          payments.push({
            id: runId,
            projectId: run.projectId || item.projectId || currentProjectId || '',
            employeeId: item.employeeId || null,
            recipientName: item.name || 'Unknown',
            recipientWallet: item.walletAddress || '',
            amount: item.amount || run.totalAmount || 0,
            currency: item.currency || 'XLM',
            type: item.type || run.type || 'payroll',
            status: run.status || 'processing',
            shielded: item.shielded ?? false,
            memo: item.memo || run.memo || '',
            proofId: null,
            txHash: run.txHash || null,
            lastError: run.status === 'failed' ? (run.lastError || 'Unknown error') : null,
            approvedBy: null,
            createdAt: run.createdAt || Date.now(),
            processedAt: run.processedAt || null,
          });
          existingPaymentIds.add(runId);
        }

        // Merge AWS run status into local payments (don't wipe local history)
        payments = payments.map(p => {
          const matchingRun = runs.find(run => (run.id === p.id || run.runId === p.id));
          if (!matchingRun) return p;
          return {
            ...p,
            projectId: p.projectId || matchingRun.projectId || currentProjectId || '',
            status: matchingRun.status || p.status,
            txHash: matchingRun.txHash || p.txHash,
            processedAt: matchingRun.processedAt || p.processedAt,
            amount: matchingRun.totalAmount ?? p.amount,
          };
        });
      } catch (err) {
        console.error('Failed to sync payroll runs with Zer0 payments:', err);
      }

      useZer0Store.setState({
        employees,
        payments,
        proofs,
        settings: { ...useZer0Store.getState().settings },
      });
    }
  } catch (err) {
    console.error('Failed to pull ZEXVRO state from AWS DynamoDB:', err);
  } finally {
    isHydrating = false;
    useWorkspaceStore.getState().setHydrated(true);
  }
}

export function pushToAWS() {
  // Memory endpoint is reserved for the transformation agent.
  // App state is persisted via dedicated APIs (workspace, project, employee, payroll, proof).
  // No action needed here.
}

export function initializeAWSSync() {
  useWorkspaceStore.subscribe(() => pushToAWS());
  useProjectStore.subscribe(() => pushToAWS());
  useZer0Store.subscribe(() => pushToAWS());
}
