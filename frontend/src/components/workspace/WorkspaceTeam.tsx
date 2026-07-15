import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { AlertCircle, RefreshCw, UserPlus, Shield, X } from 'lucide-react';
import { inviteApi } from '../../api/api';
import { useWorkspaceStore } from '../../stores/workspace';
import type { WorkspaceMember, WorkspaceRole } from '../../stores/types';

type InviteDisplayStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

function getInviteStatus(member: WorkspaceMember): InviteDisplayStatus {
  if (member.status === 'active') return 'accepted';
  if (member.status === 'inactive') return 'revoked';
  if (member.status === 'expired' || member.status === 'revoked' || member.status === 'accepted' || member.status === 'pending') {
    return member.status;
  }
  return 'pending';
}

const INVITE_BADGES: Record<InviteDisplayStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  accepted: 'bg-green-500/10 text-green-600 dark:text-green-400',
  expired: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400',
  revoked: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

function statusLabel(status: InviteDisplayStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getSessionName() {
  try {
    const session = JSON.parse(localStorage.getItem('zexvro_user_session') || '{}');
    return session.email || session.username || 'A teammate';
  } catch {
    return 'A teammate';
  }
}

export default function WorkspaceTeam() {
  const { workspaceId } = useParams({ strict: false });
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const currentWorkspace = workspaces.find(w => w.id === workspaceId) || workspaces[0] || null;
  const addMember = useWorkspaceStore(s => s.addMember);
  const removeMember = useWorkspaceStore(s => s.removeMember);

  const members = currentWorkspace ? currentWorkspace.members : [];

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('Developer');
  const [inviteError, setInviteError] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || !currentWorkspace) return;

    setIsInviting(true);
    setInviteError('');
    setInviteNotice('');

    addMember(currentWorkspace.id, {
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'invited',
    });

    try {
      await inviteApi.send({
        email: inviteEmail.trim(),
        workspaceId: currentWorkspace.id,
        workspaceName: currentWorkspace.name,
        inviterName: getSessionName(),
        role: inviteRole,
      });
      setInviteNotice(`Invite email sent to ${inviteEmail.trim()}.`);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('Developer');
      setShowInviteModal(false);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite was saved, but the email could not be sent.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = (id: string) => {
    if (!currentWorkspace) return;
    removeMember(currentWorkspace.id, id);
  };

  const resendInvite = async (member: WorkspaceMember) => {
    if (!currentWorkspace) return;

    setResendingId(member.id);
    setInviteError('');
    setInviteNotice('');
    try {
      await inviteApi.send({
        email: member.email,
        workspaceId: currentWorkspace.id,
        workspaceName: currentWorkspace.name,
        inviterName: getSessionName(),
        role: member.role,
      });
      setInviteNotice(`Invite email resent to ${member.email}.`);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not resend invite email.');
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Team</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage access control permissions for this entire workspace ({currentWorkspace?.name || workspaceId})
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite User
        </button>
      </div>

      {inviteError && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{inviteError}</span>
        </div>
      )}

      {inviteNotice && (
        <div className="rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-600 dark:text-green-400">
          {inviteNotice}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Team Directory</h2>
          <span className="text-xs text-zinc-450">{members.length} user{members.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {members.map(member => {
            const inviteStatus = getInviteStatus(member);
            return (
            <div key={member.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">{member.name}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${INVITE_BADGES[inviteStatus]}`}>
                    {statusLabel(inviteStatus)}
                  </span>
                </div>
                <p className="text-xs text-zinc-450 font-mono mt-0.5">{member.email || 'No email provided'}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-medium text-zinc-550 dark:text-zinc-400 flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  {member.role}
                </span>

                {inviteStatus === 'pending' && (
                  <button
                    onClick={() => resendInvite(member)}
                    disabled={resendingId === member.id}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <RefreshCw className={`h-3 w-3 ${resendingId === member.id ? 'animate-spin' : ''}`} />
                    Resend Invite
                  </button>
                )}

                {member.role !== 'Owner' && (
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
          })}
        </div>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowInviteModal(false)} />
          <div className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Invite Workspace Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-zinc-400 hover:text-zinc-650">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-550 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="John Doe"
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-550 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="john@polymaths.org"
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-550 mb-1">Role Permissions</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as WorkspaceRole)}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="Admin">Workspace Admin (Full access)</option>
                  <option value="Developer">Developer (Read/Deploy access)</option>
                  <option value="Finance">Finance Manager (Payroll access)</option>
                  <option value="Viewer">Viewer (Read-only access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800 mt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="rounded-md bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900"
                >
                  {isInviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
