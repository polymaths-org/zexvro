import { employeeApi, inviteApi, projectApi, workspaceApi, proofApi, payrollApi } from '../api/api';
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

function memberDisplayScore(m: Workspace['members'][number]) {
  const emailLocal = String(m.email || '').includes('@')
    ? String(m.email).split('@')[0].toLowerCase()
    : '';
  const name = String(m.name || '');
  const pid = String(m.principalId || m.id || '');
  const hasRealUsername =
    (pid && !pid.includes('@') && !pid.startsWith('member_') && pid.toLowerCase() !== emailLocal)
    || (name && !name.includes('@') && name.toLowerCase() !== emailLocal);
  return (
    (m.status === 'active' ? 8 : 0)
    + (m.email ? 4 : 0)
    + (hasRealUsername ? 4 : 0)
    + (m.role === 'Owner' ? 1 : 0)
  );
}

function mergeMembersLists(
  a: Workspace['members'] = [],
  b: Workspace['members'] = [],
): Workspace['members'] {
  const byKey = new Map<string, Workspace['members'][number]>();
  for (const m of [...a, ...b]) {
    if (!m) continue;
    const key = String(m.email || m.id || m.principalId || '').trim().toLowerCase();
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, m);
      continue;
    }
    // Prefer active + real Cognito username (nabil3) over email-local name (snabilshaikh186)
    const pick = memberDisplayScore(m) >= memberDisplayScore(prev)
      ? { ...prev, ...m }
      : { ...m, ...prev };
    // Always keep the better username/principalId
    const emailLocal = String(pick.email || '').includes('@')
      ? String(pick.email).split('@')[0]
      : '';
    for (const src of [m, prev]) {
      const pid = String(src.principalId || src.id || '');
      if (pid && !pid.includes('@') && !pid.startsWith('member_') && pid !== emailLocal) {
        pick.principalId = pid;
        if (!pick.name || pick.name.toLowerCase() === emailLocal.toLowerCase()) {
          pick.name = pid;
        }
      }
    }
    byKey.set(key, pick);
  }
  return Array.from(byKey.values());
}

function uniqueByWorkspaceId(items: Workspace[]) {
  const byId = new Map<string, Workspace>();
  for (const item of items) {
    if (!item?.id) continue;
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    // Prefer richer member/invite data when merging shared + owned
    byId.set(item.id, {
      ...existing,
      ...item,
      members: mergeMembersLists(existing.members, item.members),
      invitations: (item.invitations?.length ? item.invitations : existing.invitations) || [],
      name: item.name || existing.name,
      ownerId:
        item.ownerId && item.ownerId !== 'remote-owner'
          ? item.ownerId
          : existing.ownerId || item.ownerId,
    });
  }
  return Array.from(byId.values());
}

/** Collapse same-name rows (owner spam + shared stubs). Keep richest real workspace. */
function collapseDuplicateNames(items: Workspace[], session?: { username?: string; email?: string }) {
  const uname = String(session?.username || '').trim().toLowerCase();
  const email = String(session?.email || '').trim().toLowerCase();
  const score = (w: Workspace) => {
    const members = w.members?.length || 0;
    const invites = w.invitations?.length || 0;
    const owner = String(w.ownerId || '').trim().toLowerCase();
    const isStub = owner === 'remote-owner' || owner === '';
    const isMine = owner && (owner === uname || owner === email);
    // Prefer real Dynamo rows, then more members/invites, then newer
    return (
      (isStub ? 0 : 1_000_000)
      + (isMine ? 100_000 : 0)
      + members * 1000
      + invites * 10
      + (Number(w.createdAt) || 0) / 1e15
    );
  };
  // Group by name; also group shared "N4bi10p's Workspace" spam across different owner ids
  const byName = new Map<string, Workspace>();
  for (const w of items) {
    const key = String(w.name || '').trim().toLowerCase();
    if (!key) {
      byName.set(w.id, w);
      continue;
    }
    const prev = byName.get(key);
    if (!prev || score(w) >= score(prev)) byName.set(key, w);
  }
  return uniqueByWorkspaceId(Array.from(byName.values()));
}

let lastPullSucceeded = false;

export function didLastWorkspacePullSucceed() {
  return lastPullSucceeded;
}

function isSharedForSession(ws: Workspace, session: { username?: string; email?: string }) {
  const uname = String(session.username || '').trim().toLowerCase();
  const email = String(session.email || '').trim().toLowerCase();
  const owner = String(ws.ownerId || '').trim().toLowerCase();
  if (owner && (owner === uname || owner === email)) return false;
  const members = ws.members || [];
  return members.some(m => {
    const status = String(m.status || 'active').toLowerCase();
    if (status !== 'active' && m.role !== 'Owner') return false;
    const mEmail = String(m.email || '').trim().toLowerCase();
    const mId = String(m.id || m.principalId || '').trim().toLowerCase();
    return (email && mEmail === email) || (uname && (mId === uname || mEmail.split('@')[0] === uname));
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

function membersFingerprint(members: Workspace['members'] = []) {
  return members
    .map(m =>
      [
        String(m.email || '').toLowerCase(),
        m.role,
        m.status,
        m.principalId || m.id || '',
        m.name || '',
      ].join(':'),
    )
    .sort()
    .join('|');
}

const detailInFlight = new Map<string, Promise<void>>();

/** Refresh one workspace (members roster) from platform API + local accept index. */
export async function loadWorkspaceDetail(workspaceId: string) {
  const session = getUserSession();
  if (!session?.token || !workspaceId) return;

  const existingFlight = detailInFlight.get(workspaceId);
  if (existingFlight) return existingFlight;

  const run = (async () => {
    let remoteMembers: Workspace['members'] = [];
    let remoteInvites: Workspace['invitations'] = [];
    let remoteName = '';
    let remoteOwner = '';

    try {
      const res = await workspaceApi.get(workspaceId);
      const remote = res?.workspace;
      if (remote) {
        remoteMembers = (remote.members || []) as Workspace['members'];
        remoteInvites = (remote.invitations || []) as Workspace['invitations'];
        remoteName = remote.name || '';
        remoteOwner = remote.ownerId || '';
      }
    } catch {
      /* old Lambda / no access — continue with local index */
    }

    // Local Vite accepted-members index (works even if Dynamo never got the accept)
    try {
      const local = await inviteApi.listLocalMembers(workspaceId);
      if (local.length) {
        remoteMembers = mergeMembersLists(
          remoteMembers,
          local.map((m: any) => {
            const email = String(m.email || '');
            const pid = String(m.principalId || m.username || m.id || '');
            const username = String(m.username || (!pid.includes('@') ? pid : '') || '');
            const name =
              username
              || String(m.name || '')
              || (email.includes('@') ? email.split('@')[0] : 'Member');
            return {
              id: pid || email,
              email,
              name,
              role: (m.role || 'Viewer') as Workspace['members'][number]['role'],
              status: (m.status === 'invited' || m.status === 'pending' ? m.status : 'active') as Workspace['members'][number]['status'],
              joinedAt: Number(m.joinedAt) || Date.now(),
              principalId: pid || undefined,
              principalType: m.principalType,
              inviteId: m.inviteId ? String(m.inviteId) : undefined,
              roleBoundAt: m.roleBoundAt ? Number(m.roleBoundAt) : undefined,
            };
          }),
        );
      }
    } catch {
      /* ignore */
    }

    const prev = useWorkspaceStore.getState().workspaces;
    const idx = prev.findIndex(w => w.id === workspaceId);
    if (idx < 0) return;

    const existing = prev[idx];
    // Always union with existing local members so pull/detail never shrinks the roster
    const merged = mergeMembersLists(existing.members, remoteMembers).map(m => {
      const email = String(m.email || '').toLowerCase();
      const better = remoteMembers.find(
        r => String(r.email || '').toLowerCase() === email && r.status === 'active',
      );
      if (better && (m.status === 'invited' || m.status === 'pending')) {
        return { ...m, ...better, status: 'active' as const };
      }
      // Never demote an active local member just because Dynamo is stale
      if (m.status === 'active') return m;
      return m;
    });

    if (!merged.length && !remoteName) return;

    const invitations = (remoteInvites?.length ? remoteInvites : existing.invitations || []).map(inv => {
      const active = merged.some(
        m =>
          String(m.email || '').toLowerCase() === String(inv.email || '').toLowerCase()
          && m.status === 'active',
      );
      if (active && inv.status === 'pending') {
        return { ...inv, status: 'accepted' as const, acceptedAt: Date.now() };
      }
      return inv;
    });

    // Skip setState when nothing meaningful changed (stops 5s flicker re-renders)
    if (
      membersFingerprint(existing.members) === membersFingerprint(merged)
      && (remoteName || existing.name) === existing.name
      && (remoteOwner || existing.ownerId) === existing.ownerId
    ) {
      return;
    }

    const next = [...prev];
    next[idx] = {
      ...existing,
      name: remoteName || existing.name,
      ownerId: remoteOwner || existing.ownerId,
      members: merged,
      invitations,
    };
    useWorkspaceStore.setState({ workspaces: next });
  })().finally(() => {
    detailInFlight.delete(workspaceId);
  });

  detailInFlight.set(workspaceId, run);
  return run;
}

/** Fetch projects (+ env/instances) for a workspace and merge into the project store. */
export async function loadProjectsForWorkspace(workspaceId: string) {
  const session = getUserSession();
  if (!session?.token || !workspaceId) return;
  try {
    const projData = await projectApi.list(workspaceId);
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

      const localBefore = useWorkspaceStore.getState().workspaces || [];
      const wsData = await workspaceApi.list();
      lastPullSucceeded = true;
      let remoteWorkspaces = (wsData.workspaces || []).map(workspace =>
        idFromRemote(workspace, 'workspaceId'),
      ) as Workspace[];

      // Local Vite membership index (invite accept file store) — stubs only if AWS missing
      let localShared: Workspace[] = [];
      try {
        const shared = await inviteApi.listShared(session.email);
        localShared = (shared.workspaces || []).map(workspace =>
          idFromRemote(workspace as Record<string, unknown>, 'workspaceId'),
        ) as unknown as Workspace[];
      } catch {
        /* prod Lambda may not expose /api/me/workspaces yet */
      }

      // Keep local shared workspaces that pull would otherwise wipe
      const preservedShared = localBefore.filter(ws => isSharedForSession(ws, session));

      // Prefer AWS rows; still merge local shared stubs for richer member rosters
      const extraShared = [...localShared, ...preservedShared].filter(w => {
        if (/^ws_(smoke|e2e|shared_)/i.test(String(w.id || ''))) return false;
        return true;
      });

      // Collapse same-name owned spam; merge members from all sources first
      let workspaces = collapseDuplicateNames(
        uniqueByWorkspaceId([...remoteWorkspaces, ...extraShared]),
        session,
      );

      // Critical: never let a thin Dynamo list wipe accepted members between polls
      const latestLocal = useWorkspaceStore.getState().workspaces || localBefore;
      workspaces = workspaces.map(w => {
        const prev = latestLocal.find(x => x.id === w.id);
        if (!prev?.members?.length) return w;
        return {
          ...w,
          members: mergeMembersLists(prev.members, w.members),
          invitations: w.invitations?.length ? w.invitations : prev.invitations,
        };
      });
      // Keep workspaces that exist only locally (shared stubs not yet on list)
      for (const prev of latestLocal) {
        if (!workspaces.some(w => w.id === prev.id) && isSharedForSession(prev, session)) {
          workspaces = [...workspaces, prev];
        }
      }

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

      const empData = await employeeApi.list(resolvedWorkspaceId);
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

      useZer0Store.setState({
        employees: employees.length ? employees : localState.employees,
        payments,
        proofs,
        settings: { ...useZer0Store.getState().settings },
      });
    } catch (err) {
      lastPullSucceeded = false;
      console.error('Failed to pull ZEXVRO state from AWS DynamoDB:', err);
    } finally {
      isHydrating = false;
      // Only mark hydrated after a successful list so we never auto-create on network blips
      if (lastPullSucceeded) {
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
