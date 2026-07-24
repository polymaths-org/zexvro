import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  AlertCircle, Check, Copy, KeyRound, LogOut, RefreshCw, Shield, UserPlus, X, Users, Mail, BookOpen,
} from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace';
import type { TeamInvite, WorkspaceMember, WorkspaceRole } from '../../stores/types';
import {
  INVITABLE_ROLES,
  ROLE_PERMISSIONS_SUMMARY,
  roleLabel,
  WORKSPACE_ROLES,
} from '../../rbac/permissions';
import { useWorkspaceRbac } from '../../rbac/useWorkspaceRbac';
import RequirePermission, { AccessDenied } from '../../rbac/RequirePermission';
import { readStoredSession } from '../../auth/cognito';
import { loadWorkspaceDetail } from '../../stores/awsSync';

type Tab = 'members' | 'invitations' | 'roles';

function displayEmail(member: WorkspaceMember) {
  const email = (member.email || '').trim();
  if (email) return email;
  if (member.role === 'Owner') return 'Owner email not set';
  return '—';
}

/** Prefer Cognito username over email local-part. */
function displayMemberName(member: WorkspaceMember) {
  const email = (member.email || '').trim().toLowerCase();
  const emailLocal = email.includes('@') ? email.split('@')[0] : '';
  const candidates = [
    member.principalId,
    member.id,
    member.name,
  ]
    .map(v => String(v || '').trim())
    .filter(Boolean);

  for (const c of candidates) {
    // Skip raw emails and pure email-local fallbacks when a real username exists
    if (c.includes('@')) continue;
    if (emailLocal && c.toLowerCase() === emailLocal && candidates.some(x =>
      x
      && !x.includes('@')
      && x.toLowerCase() !== emailLocal
    )) {
      continue;
    }
    return c;
  }
  return member.name || emailLocal || 'Member';
}

function principalLabel(member: WorkspaceMember) {
  const kind = member.principalType === 'serviceAccount' || member.role === 'Agent'
    ? 'serviceAccount'
    : 'user';
  // Show Cognito username (nabil3), not email
  const username =
    (member.principalId && !String(member.principalId).includes('@')
      ? member.principalId
      : null)
    || (member.id && !String(member.id).includes('@') && !String(member.id).startsWith('member_')
      ? member.id
      : null)
    || displayMemberName(member);
  return `${kind}:${username}`;
}

function inviteStatus(invite: TeamInvite) {
  if (invite.status === 'pending' && invite.expiresAt < Date.now()) return 'expired';
  return invite.status;
}

export default function WorkspaceTeam() {
  const { workspaceId } = useParams({ strict: false });
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const currentWorkspace = workspaces.find(w => w.id === workspaceId) || workspaces[0] || null;
  const removeMember = useWorkspaceStore(s => s.removeMember);
  const leaveWorkspace = useWorkspaceStore(s => s.leaveWorkspace);
  const updateMemberRole = useWorkspaceStore(s => s.updateMemberRole);
  const createInvitation = useWorkspaceStore(s => s.createInvitation);
  const revokeInvitation = useWorkspaceStore(s => s.revokeInvitation);
  const resendInvitation = useWorkspaceStore(s => s.resendInvitation);
  const { can, role: myRole, member: me } = useWorkspaceRbac(workspaceId);
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('members');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('Developer');
  const [inviteNote, setInviteNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastAcceptUrl, setLastAcceptUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const members = currentWorkspace?.members || [];
  const invitations = currentWorkspace?.invitations || [];

  // Pull accepted members while Team page is open (deduped; no flicker)
  useEffect(() => {
    if (!workspaceId) return;
    void loadWorkspaceDetail(workspaceId);
    const t = setInterval(() => void loadWorkspaceDetail(workspaceId), 12000);
    return () => clearInterval(t);
  }, [workspaceId]);

  const activeMembers = useMemo(
    () => members.filter(m => m.status === 'active' || m.role === 'Owner'),
    [members],
  );
  const pendingInvites = useMemo(
    () => invitations.filter(i => inviteStatus(i) === 'pending'),
    [invitations],
  );

  const session = readStoredSession();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !can('team.invite')) return;
    setBusy(true);
    setError('');
    setNotice('');
    setLastAcceptUrl('');
    try {
      const invite = await createInvitation({
        workspaceId: currentWorkspace.id,
        email: inviteEmail.trim(),
        role: inviteRole,
        invitedBy: session?.username || me?.name || 'admin',
        invitedByEmail: session?.email || me?.email,
        note: inviteNote.trim() || undefined,
      });
      const origin = window.location.origin;
      const url =
        (invite as { _acceptUrl?: string })._acceptUrl
        || `${origin}/invite/accept?token=${invite.token}`;
      setLastAcceptUrl(url);
      setNotice(
        `Invitation email sent to ${invite.email} as roles/${invite.role}.`,
      );
      setInviteEmail('');
      setInviteNote('');
      setInviteRole('Developer');
      setShowInvite(false);
      setTab('invitations');
    } catch (err) {
      const anyErr = err as Error & { invite?: { token?: string; email?: string; role?: string } };
      if (anyErr.invite?.token) {
        const url = `${window.location.origin}/invite/accept?token=${anyErr.invite.token}`;
        setLastAcceptUrl(url);
        setTab('invitations');
        setInviteEmail('');
        setShowInvite(false);
        setError(
          `Invitation saved, but email failed: ${anyErr.message}. Copy the accept link and share it, or fix BREVO_API_KEY and Resend.`,
        );
        setNotice('');
      } else {
        setError(err instanceof Error ? err.message : 'Invite failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    if (!lastAcceptUrl) return;
    try {
      await navigator.clipboard.writeText(lastAcceptUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy link');
    }
  };

  return (
    <RequirePermission permission="team.view" workspaceId={workspaceId} fallback={<AccessDenied title="Team access required" />}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              <KeyRound className="h-3.5 w-3.5" /> Team &amp; access
            </div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {currentWorkspace?.name || 'Workspace'} · Members & roles
            </h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
              Invite a member, they accept a link, then receive a workspace role. Your role:{' '}
              <strong className="text-zinc-700 dark:text-zinc-200">{myRole || '—'}</strong>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can('team.invite') && (
              <button
                type="button"
                onClick={() => setShowInvite(true)}
                className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Grant access
              </button>
            )}
            {myRole && myRole !== 'Owner' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!currentWorkspace) return;
                  const ok = window.confirm(
                    `Leave "${currentWorkspace.name}"? You will lose access until invited again.`,
                  );
                  if (!ok) return;
                  setBusy(true);
                  setError('');
                  void leaveWorkspace(currentWorkspace.id, {
                    email: session?.email,
                    username: session?.username,
                  })
                    .then(() => {
                      const remaining = useWorkspaceStore.getState().workspaces;
                      const next = remaining[0];
                      if (next) {
                        navigate({
                          to: '/dashboard/w/$workspaceId/overview',
                          params: { workspaceId: next.id },
                        });
                      } else {
                        navigate({ to: '/dashboard' });
                      }
                    })
                    .catch(err => {
                      setError(err instanceof Error ? err.message : 'Could not leave workspace');
                    })
                    .finally(() => setBusy(false));
                }}
                className="inline-flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave workspace
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="space-y-2 rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-700 dark:text-green-400">
            <p>{notice}</p>
            {lastAcceptUrl && (
              <div className="flex flex-wrap items-center gap-2">
                <code className="max-w-full truncate rounded bg-black/5 px-2 py-1 font-mono text-[10px] dark:bg-white/5">
                  {lastAcceptUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void copyUrl()}
                  className="inline-flex items-center gap-1 rounded border border-green-500/30 px-2 py-1 text-[10px] font-semibold"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy accept link'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          {(
            [
              { id: 'members' as const, label: 'Members', icon: Users, count: activeMembers.length },
              { id: 'invitations' as const, label: 'Invitations', icon: Mail, count: pendingInvites.length },
              { id: 'roles' as const, label: 'Roles', icon: BookOpen, count: WORKSPACE_ROLES.length },
            ]
          ).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition ${
                tab === t.id
                  ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] dark:bg-zinc-900">{t.count}</span>
            </button>
          ))}
        </div>

        {tab === 'members' && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 bg-zinc-50/80 font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/50">
                <tr>
                  <th className="px-4 py-2.5">Member</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {members.map(member => (
                  <tr key={member.id} className="bg-white dark:bg-[#080809]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900 dark:text-white">{displayMemberName(member)}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-zinc-400">{principalLabel(member)}</div>
                      <div className="text-[10px] text-zinc-500">{displayEmail(member)}</div>
                    </td>
                    <td className="px-4 py-3">
                      {can('team.manage') && member.role !== 'Owner' ? (
                        <select
                          value={member.role}
                          onChange={e =>
                            updateMemberRole(
                              currentWorkspace!.id,
                              member.id,
                              e.target.value as WorkspaceRole,
                              session?.email || session?.username,
                            )
                          }
                          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          {INVITABLE_ROLES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
                          <Shield className="h-3 w-3 text-indigo-500" />
                          roles/{member.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={member.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {member.role !== 'Owner' && can('team.manage') && member.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => removeMember(currentWorkspace!.id, member.id)}
                          className="text-zinc-400 hover:text-red-500"
                          title="Remove binding"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'invitations' && (
          <div className="space-y-3">
            {invitations.length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-xs text-zinc-500 dark:border-zinc-800">
                No invitations yet. Grant access to send a tokenized accept link.
              </p>
            )}
            {invitations.map(inv => {
              const st = inviteStatus(inv);
              return (
                <div
                  key={inv.id}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-[#080809]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white">{inv.email}</span>
                      <StatusPill status={st} />
                      <span className="font-mono text-[10px] text-zinc-400">roles/{inv.role}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      Invited by {inv.invitedByEmail || inv.invitedBy} · expires{' '}
                      {new Date(inv.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {st === 'pending' && can('team.invite') && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const next = await resendInvitation(currentWorkspace!.id, inv.id);
                              setLastAcceptUrl(`${window.location.origin}/invite/accept?token=${next.token}`);
                              setNotice(`Resent invite to ${next.email}`);
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Resend failed');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          disabled={busy}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium dark:border-zinc-700"
                        >
                          <RefreshCw className="h-3 w-3" /> Resend
                        </button>
                        <button
                          type="button"
                          onClick={() => void revokeInvitation(currentWorkspace!.id, inv.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2 py-1 text-[11px] font-medium text-red-600"
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'roles' && (
          <div className="grid gap-3 md:grid-cols-2">
            {WORKSPACE_ROLES.map(role => (
              <div
                key={role}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#080809]"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">roles/{role}</h3>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">{roleLabel(role)}</p>
                <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  {ROLE_PERMISSIONS_SUMMARY[role].map(line => (
                    <li key={line} className="text-[11px] text-zinc-600 dark:text-zinc-400">· {line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {showInvite && can('team.invite') && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
            <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Grant workspace access</h2>
                <button type="button" onClick={() => setShowInvite(false)} className="text-zinc-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                Creates a pending invitation and accept link. The invitee must sign in with the invited email.
              </p>
              <form onSubmit={e => void handleInvite(e)} className="mt-4 space-y-3">
                <Field label="Email">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </Field>
                <Field label="Role binding">
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as WorkspaceRole)}
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    {INVITABLE_ROLES.map(r => (
                      <option key={r} value={r}>{roleLabel(r)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Note (optional)">
                  <input
                    value={inviteNote}
                    onChange={e => setInviteNote(e.target.value)}
                    placeholder="e.g. contractor for NFT launch"
                    className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </Field>
                <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <button type="button" onClick={() => setShowInvite(false)} className="rounded-md px-3 py-1.5 text-xs text-zinc-500">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
                  >
                    {busy ? 'Creating…' : 'Create invitation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-600',
    accepted: 'bg-emerald-500/10 text-emerald-600',
    pending: 'bg-amber-500/10 text-amber-600',
    invited: 'bg-amber-500/10 text-amber-600',
    expired: 'bg-zinc-500/10 text-zinc-500',
    revoked: 'bg-red-500/10 text-red-600',
    inactive: 'bg-zinc-500/10 text-zinc-500',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${map[status] || map.pending}`}>
      {status}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
