import { employeeApi, projectApi, workspaceApi, proofApi, payrollApi } from '../api/api';
import { useWorkspaceStore } from './workspace';
import { useProjectStore } from './project';
import { useZer0Store } from './zer0';

let isHydrating = false;
let pullInFlight: Promise<void> | null = null;

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

function waitForZer0Rehydrate(timeoutMs = 2500): Promise<void> {
  const persistApi = (useZer0Store as any).persist;
  if (!persistApi?.hasHydrated) return Promise.resolve();
  if (persistApi.hasHydrated()) return Promise.resolve();
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      unsub?.();
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    const unsub = persistApi.onFinishHydration?.(() => done());
  });
}

function mergeById<T extends { id: string }>(local: T[], remote: T[], preferRemoteFields?: (localItem: T, remoteItem: T) => T): T[] {
  const byId = new Map<string, T>();
  for (const item of local) {
    if (item?.id) byId.set(item.id, item);
  }
  for (const item of remote) {
    if (!item?.id) continue;
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    byId.set(item.id, preferRemoteFields ? preferRemoteFields(existing, item) : { ...existing, ...item });
  }
  return Array.from(byId.values());
}

function runToPayment(run: any, fallbackProjectId: string) {
  const runId = run.id || run.runId;
  if (!runId) return null;
  const item = run.lineItems?.[0] || {};
  return {
    id: runId,
    projectId: run.projectId || item.projectId || fallbackProjectId || '',
    employeeId: item.employeeId || null,
    recipientName: item.name || 'Unknown',
    recipientWallet: item.walletAddress || '',
    amount: Number(item.amount ?? run.totalAmount ?? 0) || 0,
    currency: item.currency || 'XLM',
    type: item.type || run.type || 'payroll',
    status: run.status || 'processing',
    shielded: item.shielded ?? false,
    memo: item.memo || run.memo || '',
    proofId: run.proofId || item.proofId || null,
    txHash: run.txHash || null,
    lastError: run.status === 'failed' ? (run.lastError || 'Unknown error') : null,
    approvedBy: null,
    createdAt: Number(run.createdAt) || Date.now(),
    processedAt: run.processedAt ? Number(run.processedAt) : null,
  };
}

function normalizeProof(raw: any) {
  if (!raw) return null;
  const id = raw.id || raw.proofId;
  if (!id) return null;
  return {
    id,
    projectId: raw.projectId || '',
    paymentId: raw.paymentId || '',
    proofSystem: raw.proofSystem || 'Groth16',
    status: raw.status || 'queued',
    verificationKey: raw.verificationKey ?? null,
    proofData: raw.proofData ?? null,
    generationTimeMs: raw.generationTimeMs ?? null,
    createdAt: Number(raw.createdAt) || Date.now(),
    verifiedAt: raw.verifiedAt ? Number(raw.verifiedAt) : null,
  };
}

export async function pullFromAWS() {
  const session = getUserSession();
  if (!session?.token) return;
  if (pullInFlight) return pullInFlight;

  pullInFlight = (async () => {
    isHydrating = true;
    try {
      // Never race empty remote data against localStorage rehydrate
      await waitForZer0Rehydrate();

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
      if (!currentWorkspaceId) return;

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

      // Re-read after awaits so localStorage rehydrate / in-session data is not lost
      const localState = useZer0Store.getState();
      let payments = [...(localState.payments || [])];
      let proofs = [...(localState.proofs || [])];

      try {
        const proofRes = await proofApi.list('');
        const remoteProofs = (proofRes.proofs || [])
          .map(normalizeProof)
          .filter(Boolean) as any[];

        // Merge: never replace local with empty remote
        proofs = mergeById(proofs, remoteProofs, (localProof, remoteProof) => {
          const remoteRank = remoteProof.status === 'verified' ? 3
            : remoteProof.status === 'generating' ? 2
            : remoteProof.status === 'failed' ? 1
            : 0;
          const localRank = localProof.status === 'verified' ? 3
            : localProof.status === 'generating' ? 2
            : localProof.status === 'failed' ? 1
            : 0;
          if (remoteRank > localRank) return { ...localProof, ...remoteProof };
          if (localRank > remoteRank) return { ...remoteProof, ...localProof, status: localProof.status };
          return {
            ...localProof,
            ...remoteProof,
            proofData: remoteProof.proofData || localProof.proofData,
            verificationKey: remoteProof.verificationKey || localProof.verificationKey,
            generationTimeMs: remoteProof.generationTimeMs ?? localProof.generationTimeMs,
            verifiedAt: remoteProof.verifiedAt || localProof.verifiedAt,
          };
        });
      } catch (e) {
        console.error('Failed to pull proofs from AWS:', e);
      }

      try {
        const runData = await payrollApi.listRuns(currentWorkspaceId);
        const runs = runData.runs || [];
        const currentProjectId = useProjectStore.getState().currentProjectId || '';
        const byId = new Map(payments.map(p => [p.id, p]));

        for (const run of runs) {
          const mapped = runToPayment(run, currentProjectId);
          if (!mapped) continue;
          const existing = byId.get(mapped.id);
          if (!existing) {
            byId.set(mapped.id, mapped as any);
            continue;
          }
          byId.set(mapped.id, {
            ...existing,
            projectId: existing.projectId || mapped.projectId,
            status: mapped.status || existing.status,
            txHash: mapped.txHash || existing.txHash,
            processedAt: mapped.processedAt || existing.processedAt,
            amount: mapped.amount || existing.amount,
            shielded: mapped.shielded ?? existing.shielded,
            recipientName: existing.recipientName || mapped.recipientName,
            recipientWallet: existing.recipientWallet || mapped.recipientWallet,
            memo: existing.memo || mapped.memo,
            proofId: existing.proofId || mapped.proofId,
            type: existing.type || mapped.type,
            currency: existing.currency || mapped.currency,
          });
        }

        payments = Array.from(byId.values());
      } catch (err) {
        console.error('Failed to sync payroll runs with Zer0 payments:', err);
      }

      // Attach proof ids to payments when missing
      const proofsByPayment = new Map<string, string>();
      for (const proof of proofs) {
        if (proof.paymentId && proof.id) proofsByPayment.set(proof.paymentId, proof.id);
      }
      payments = payments.map(p => (
        p.proofId || !proofsByPayment.has(p.id)
          ? p
          : { ...p, proofId: proofsByPayment.get(p.id)! }
      ));

      payments.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      proofs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      useZer0Store.setState({
        employees: employees.length ? employees : localState.employees,
        payments,
        proofs,
        settings: { ...useZer0Store.getState().settings },
      });
    } catch (err) {
      console.error('Failed to pull ZEXVRO state from AWS DynamoDB:', err);
    } finally {
      isHydrating = false;
      useWorkspaceStore.getState().setHydrated(true);
      pullInFlight = null;
    }
  })();

  return pullInFlight;
}

export function pushToAWS() {
  // Memory endpoint is reserved for the transformation agent.
  // App state is persisted via dedicated APIs (workspace, project, employee, payroll, proof).
}

export function initializeAWSSync() {
  useWorkspaceStore.subscribe(() => pushToAWS());
  useProjectStore.subscribe(() => pushToAWS());
  useZer0Store.subscribe(() => pushToAWS());
}
