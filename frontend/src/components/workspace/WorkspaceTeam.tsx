import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Users, UserPlus, Shield, X, Mail } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace';
import type { WorkspaceRole } from '../../stores/types';

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

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || !currentWorkspace) return;

    addMember(currentWorkspace.id, {
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'invited',
    });

    setInviteName('');
    setInviteEmail('');
    setInviteRole('Developer');
    setShowInviteModal(false);
  };

  const handleRemove = (id: string) => {
    if (!currentWorkspace) return;
    removeMember(currentWorkspace.id, id);
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

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Team Directory</h2>
          <span className="text-xs text-zinc-450">{members.length} user{members.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {members.map(member => (
            <div key={member.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">{member.name}</span>
                  {member.status === 'invited' && (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-500 uppercase">
                      Pending invite
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-450 font-mono mt-0.5">{member.email || 'No email provided'}</p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span className="text-xs font-medium text-zinc-550 dark:text-zinc-400 flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  {member.role}
                </span>

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
          ))}
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
                  className="rounded-md bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
