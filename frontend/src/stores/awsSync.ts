import {resolveWorkspaceMember,memberCan} from '../rbac/permissions';
import { employeeApi, projectApi, workspaceApi, proofApi, payrollApi } from '../api/api';
import { useWorkspaceStore } from './workspace';
import { useProjectStore } from './project';
import { useZer0Store } from './zer0';
import type { Workspace } from './types';

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

let lastPullSucceeded = false;
export function didLastWorkspacePullSucceed() { return lastPullSucceeded; }
function sameAccount(session: {username?: string}) {
  return getUserSession()?.username === session.username;
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

const detailInFlight = new Map<string, Promise<void>>();

/** D1 is authoritative: removed members and revoked invites must disappear. */
export async function loadWorkspaceDetail(workspaceId: string) {
  const session = getUserSession();
  if (!session?.token || !workspaceId) return;
  const key = `${session.username}:${workspaceId}`;
  const existing = detailInFlight.get(key);
  if (existing) return existing;
  const run = (async () => {
    try {
      const {workspace} = await workspaceApi.get(workspaceId);
      if (!workspace || !sameAccount(session)) return;
      useWorkspaceStore.setState(state => ({workspaces: state.workspaces.map(local =>
        local.id === workspaceId ? {...local, ...workspace, id: workspaceId,
          members: workspace.members || [], invitations: workspace.invitations || []} : local
      )}));
    } catch (error) {
      console.error('Could not refresh workspace:', error);
    }
  })().finally(() => detailInFlight.delete(key));
  detailInFlight.set(key, run);
  return run;
}

/** Fetch projects (+ env/instances) for a workspace and merge into the project store. */
export async function loadProjectsForWorkspace(workspaceId: string) {
  const session = getUserSession();
  if (!session?.token || !workspaceId) return;
  try {
    const projData = await projectApi.list(workspaceId);
    if (!sameAccount(session)) return;
    const remoteProjects = (projData.projects || []).map(project =>
      idFromRemote({ ...project, workspaceId: project.workspaceId || workspaceId }, 'projectId'),
    );
    const remoteEnvs = remoteProjects.flatMap((project: any) =>
      (project.environments || []).map((env: any) =>
        idFromRemote({ ...env, projectId: env.projectId || project.id, workspaceId }, 'id'),
      ),
    );
    const remoteInstances = remoteProjects.flatMap((project: any) =>
      (project.serviceInstances || []).map((inst: any) =>
        idFromRemote({ ...inst, projectId: inst.projectId || project.id, workspaceId }, 'id'),
      ),
    );

    const prev = useProjectStore.getState();
    // Drop stale rows for this workspace, keep other workspaces, then merge remote
    const otherProjects = (prev.projects || []).filter(p => p.workspaceId !== workspaceId);
    const otherEnvs = (prev.environments || []).filter(e => e.workspaceId !== workspaceId);
    const otherInstances = (prev.serviceInstances || []).filter(i => i.workspaceId !== workspaceId);

    const projects = mergeById(otherProjects, remoteProjects as any);
    const environments = mergeById(otherEnvs, remoteEnvs as any);
    const serviceInstances = mergeById(otherInstances, remoteInstances as any);

    const currentProjectId = prev.currentProjectId;
    const stillValid = currentProjectId && projects.some(p => p.id === currentProjectId);
    const firstInWs = projects.find(p => p.workspaceId === workspaceId)?.id || null;

    useProjectStore.setState({
      projects,
      environments,
      serviceInstances,
      deployments: prev.deployments,
      currentProjectId: stillValid ? currentProjectId : (firstInWs || projects[0]?.id || null),
    });
  } catch (err) {
    console.error(`Failed to load projects for workspace ${workspaceId}:`, err);
  }
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
      if (!sameAccount(session)) return;
      lastPullSucceeded = true;
      const workspaces = (wsData.workspaces || []).map(workspace =>
        idFromRemote(workspace, 'workspaceId'),
      ) as Workspace[];
      // Keep distinct D1 IDs even when owners independently choose the same name.
      const accessible = new Set(workspaces.map(w => w.id));
      useProjectStore.setState(state => ({
        projects: state.projects.filter(p => accessible.has(p.workspaceId)),
        environments: state.environments.filter(e => accessible.has(e.workspaceId)),
        serviceInstances: state.serviceInstances.filter(i => accessible.has(i.workspaceId)),
      }));

      // Always apply successful list result (including empty) so auto-create can run once
      const currentWorkspaceId = useWorkspaceStore.getState().currentWorkspaceId;
      const resolvedWorkspaceId =
        workspaces.some(workspace => workspace.id === currentWorkspaceId)
          ? currentWorkspaceId
          : workspaces[0]?.id || null;

      useWorkspaceStore.setState({ workspaces, currentWorkspaceId: resolvedWorkspaceId });

      if (!resolvedWorkspaceId) return;

      // Load projects for every accessible workspace; roster enrichment for active one
      const wsIds = workspaces.map(ws => ws.id).filter(Boolean).slice(0, 25);
      await Promise.all(wsIds.map(id => loadProjectsForWorkspace(id)));
      // Single roster refresh for current workspace (avoid N parallel detail races)
      await loadWorkspaceDetail(resolvedWorkspaceId);

      const active = useWorkspaceStore.getState().workspaces.find(w=>w.id===resolvedWorkspaceId);
      if(!memberCan(resolveWorkspaceMember(active,session),'finance.view'))return;
      const empData = await employeeApi.list(resolvedWorkspaceId);
      if (!sameAccount(session)) return;
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
        console.error('Failed to pull proofs from the API:', e);
      }

      try {
        const runData = await payrollApi.listRuns(resolvedWorkspaceId);
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

      if (!sameAccount(session)) return;
      useZer0Store.setState({
        employees,
        payments,
        proofs,
        settings: { ...useZer0Store.getState().settings },
      });
    } catch (err) {
      lastPullSucceeded = false;
      console.error('Failed to pull ZEXVRO state from Cloudflare D1:', err);
    } finally {
      isHydrating = false;
      // Only mark hydrated after a successful list so we never auto-create on network blips
      if (sameAccount(session) && lastPullSucceeded) {
        useWorkspaceStore.getState().setHydrated(true);
      }
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
