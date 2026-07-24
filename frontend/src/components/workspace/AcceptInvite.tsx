import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, KeyRound, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { inviteApi } from '../../api/api';
import {
  clearStoredSession,
  ensureValidAccessToken,
  isAccessTokenExpired,
  readStoredSession,
  type UserSession,
} from '../../auth/cognito';
import { useWorkspaceStore } from '../../stores/workspace';
import { roleLabel } from '../../rbac/permissions';
import type { WorkspaceRole } from '../../stores/types';

type Preview = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: string;
  status: string;
  expiresAt: number;
  invitedBy: string;
};

function useQueryToken() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('token') || '').trim();
  }, []);
}

export default function AcceptInvite() {
  const token = useQueryToken();
  const navigate = useNavigate();
  const acceptLocal = useWorkspaceStore(s => s.acceptInvitationLocal);
  const findLocal = useWorkspaceStore(s => s.findInviteByToken);

  const [session, setSession] = useState<UserSession | null>(() => readStoredSession());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState<{ workspaceId: string; role: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoadError('Missing invitation token. Open the link from your invite email.');
        setLoading(false);
        return;
      }

      // 1) Server store (Vite .data file or Lambda) — works for any browser
      // 2) Local zustand (same browser as inviter)
      try {
        const res = await inviteApi.getByToken(token);
        if (!cancelled && res.invite) {
          setPreview(res.invite as Preview);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('invite getByToken failed', err);
      }

      const local = findLocal(token);
      if (!cancelled && local) {
        setPreview({
          id: local.invite.id,
          workspaceId: local.workspace.id,
          workspaceName: local.workspace.name,
          email: local.invite.email,
          role: local.invite.role,
          status: local.invite.status,
          expiresAt: local.invite.expiresAt,
          invitedBy: local.invite.invitedByEmail || local.invite.invitedBy,
        });
      } else if (!cancelled) {
        setLoadError(
          'Invitation not found. Ask the owner to Resend the invite (restart Vite if this is local so the invite store is active), then open the new link.',
        );
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, findLocal]);

  const emailMatch = useMemo(() => {
    if (!preview || !session) return null;
    const a = (session.email || '').trim().toLowerCase();
    const b = (preview.email || '').trim().toLowerCase();
    if (!a || !b) return null;
    return a === b;
  }, [preview, session]);

  const handleAccept = async () => {
    if (!token || !session) {
      setActionError('Sign in to accept this invitation.');
      return;
    }
    setAccepting(true);
    setActionError('');
    try {
      let active = session;
      if (isAccessTokenExpired(session.token)) {
        await ensureValidAccessToken(session);
        active = readStoredSession() || session;
        setSession(active);
      }

      const principalId = active.username || active.email;
      let remoteMeta:
        | {
            workspaceId: string;
            workspaceName?: string;
            role: WorkspaceRole;
            email: string;
            inviteId?: string;
            invitedBy?: string;
            ownerId?: string;
            members?: import('../../stores/types').WorkspaceMember[];
          }
        | undefined;

      try {
        const remote = await inviteApi.accept({
          token,
          principalId,
          email: active.email,
          username: active.username,
          name: active.username || active.email.split('@')[0],
        });
        const rw = remote.workspace as {
          id?: string;
          workspaceId?: string;
          name?: string;
          members?: import('../../stores/types').WorkspaceMember[];
          ownerId?: string;
        } | undefined;
        remoteMeta = {
          workspaceId: remote.workspaceId,
          workspaceName: remote.workspaceName || rw?.name || preview?.workspaceName,
          role: (remote.role || preview?.role || 'Viewer') as WorkspaceRole,
          email: remote.email || preview?.email || active.email,
          inviteId: remote.invite?.id || preview?.id,
          invitedBy: preview?.invitedBy,
          ownerId: rw?.ownerId,
          members: Array.isArray(rw?.members) ? rw.members : undefined,
        };
        // Prefer full workspace payload from accept (shared membership bind with full roster)
        if (rw && typeof rw === 'object') {
          const id = rw.id || rw.workspaceId || remote.workspaceId;
          if (id) {
            const existing = useWorkspaceStore.getState().workspaces;
            const idx = existing.findIndex(w => w.id === id);
            const nextWs = {
              id,
              name: rw.name || remoteMeta.workspaceName || 'Workspace',
              slug: id.slice(0, 24),
              plan: 'Team workspace',
              ownerId: rw.ownerId || 'remote-owner',
              createdAt: Date.now(),
              members: (rw.members as never[]) || [],
              invitations: [] as never[],
            };
            if (idx < 0) {
              useWorkspaceStore.setState({ workspaces: [...existing, nextWs as never] });
            } else {
              // Merge members so we never shrink the roster
              const prev = existing[idx];
              const mergedMembers = [
                ...(prev.members || []),
                ...((rw.members as never[]) || []),
              ];
              const byKey = new Map<string, never>();
              for (const m of mergedMembers as Array<{ email?: string; id?: string }>) {
                const key = String(m.email || m.id || '').toLowerCase();
                if (key) byKey.set(key, m as never);
              }
              const workspaces = [...existing];
              workspaces[idx] = {
                ...prev,
                ...nextWs,
                members: Array.from(byKey.values()) as never,
              } as never;
              useWorkspaceStore.setState({ workspaces });
            }
          }
        }
      } catch (remoteErr) {
        // If server accept failed but we have preview, still try local bind from preview.
        if (preview?.workspaceId) {
          remoteMeta = {
            workspaceId: preview.workspaceId,
            workspaceName: preview.workspaceName,
            role: preview.role as WorkspaceRole,
            email: preview.email,
            inviteId: preview.id,
            invitedBy: preview.invitedBy,
          };
        } else {
          throw remoteErr instanceof Error ? remoteErr : new Error('Accept failed');
        }
      }

      const local = acceptLocal({
        token,
        principalId,
        email: active.email,
        name: active.username || active.email.split('@')[0],
        remote: remoteMeta,
      });
      if (!local.ok) {
        throw new Error(local.error);
      }
      setDone({
        workspaceId: local.workspaceId,
        role: remoteMeta?.role || preview?.role || 'Viewer',
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleSignOut = async () => {
    clearStoredSession();
    setSession(null);
    window.location.href = `/invite/accept?token=${encodeURIComponent(token)}`;
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading invitation…
        </div>
      </Shell>
    );
  }

  if (loadError || !preview) {
    return (
      <Shell>
        <ErrorBox message={loadError || 'Invitation unavailable'} />
        <Link to="/dashboard" className="mt-4 text-xs font-medium text-blue-500 hover:underline">
          Go to dashboard
        </Link>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Role binding active</h1>
          <p className="text-sm text-zinc-500">
            You are now <strong className="text-zinc-800 dark:text-zinc-200">{done.role}</strong> on this workspace.
          </p>
          <button
            type="button"
            onClick={() =>
              navigate({
                to: '/dashboard/w/$workspaceId/overview',
                params: { workspaceId: done.workspaceId },
              })
            }
            className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
          >
            Open workspace
          </button>
        </div>
      </Shell>
    );
  }

  const expired = preview.status === 'expired' || (preview.expiresAt > 0 && preview.expiresAt < Date.now() && preview.status !== 'accepted');
  const alreadyAccepted = preview.status === 'accepted';
  const blocked = preview.status === 'revoked' || expired;

  return (
    <Shell>
      <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
        <KeyRound className="h-3.5 w-3.5" /> Workspace invitation
      </div>

      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
        {alreadyAccepted ? 'Workspace access' : `Join ${preview.workspaceName || 'workspace'}`}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {alreadyAccepted
          ? 'This invitation was already accepted. Open the workspace or re-bind if it is missing from your switcher.'
          : 'Accepting adds your account to this workspace with the role below.'}
      </p>

      <div className="mt-6 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
        <Row label="Resource" value={preview.workspaceName || preview.workspaceId} />
        <Row label="Role" value={`roles/${preview.role}`} mono />
        <Row label="Role detail" value={roleLabel((preview.role as WorkspaceRole) || 'Viewer')} />
        <Row label="Email" value={preview.email} mono />
        <Row label="Invited by" value={preview.invitedBy || '—'} />
        <Row
          label="Status"
          value={expired ? 'expired' : preview.status}
        />
        {preview.expiresAt > 0 && (
          <Row label="Expires" value={new Date(preview.expiresAt).toLocaleString()} />
        )}
      </div>

      {!session && (
        <div className="mt-5 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
          Sign in with <strong>{preview.email}</strong> to accept. You will return here after auth.
        </div>
      )}

      {session && emailMatch === false && (
        <div className="mt-5 flex gap-2 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Signed in as <strong>{session.email}</strong>, but this invite is for{' '}
            <strong>{preview.email}</strong>. Switch accounts to continue.
          </span>
        </div>
      )}

      {actionError && (
        <div className="mt-4 flex gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {!session && (
          <a
            href={`/dashboard?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
          >
            <Shield className="h-3.5 w-3.5" />
            Sign in to accept
          </a>
        )}
        {session && !blocked && emailMatch !== false && (
          <button
            type="button"
            disabled={accepting}
            onClick={() => void handleAccept()}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            {accepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {alreadyAccepted ? 'Open / re-bind workspace' : 'Accept & bind role'}
          </button>
        )}
        {session && emailMatch === false && (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
          >
            Sign out
          </button>
        )}
        {blocked && (
          <p className="text-xs text-zinc-500">
            This invitation cannot be accepted ({expired ? 'expired' : preview.status}).
          </p>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-[#050505]">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#0A0A0B]">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="shrink-0 text-zinc-400">{label}</span>
      <span className={`text-right text-zinc-800 dark:text-zinc-200 ${mono ? 'font-mono text-[11px]' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex gap-2 text-sm text-red-600 dark:text-red-400">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}
