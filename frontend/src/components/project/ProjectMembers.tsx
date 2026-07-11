import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Users, UserPlus, Shield, X } from 'lucide-react';
import { useProjectStore } from '../../stores/project';
import { useWorkspaceStore } from '../../stores/workspace';
import type { WorkspaceRole } from '../../stores/types';

export default function ProjectMembers() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const currentProject = useProjectStore(s => s.projects.find(project => project.id === projectId));
  const workspace = useWorkspaceStore(s => s.workspaces.find(item => item.id === workspaceId));
  const addMember = useWorkspaceStore(s => s.addMember);
  const removeMember = useWorkspaceStore(s => s.removeMember);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('Developer');

  if (!currentProject || !workspace) return null;

  const members = workspace.members;

  const handleInvite = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    addMember(workspace.id, {
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
    removeMember(workspace.id, id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Project Members</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Workspace members with access to {currentProject.name}.
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite Member
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Authorized Team</h2>
          <span className="text-xs text-zinc-450">{members.length} member{members.length !== 1 ? 's' : ''}</span>
        </div>

        {members.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No members yet</h3>
            <p className="mt-1 text-xs text-zinc-500">Invite a teammate to grant project access.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {members.map(member => (
              <div key={member.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">{member.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                      member.status === 'active' || member.status === 'accepted'
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}>
                      {member.status === 'active' ? 'accepted' : member.status}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-zinc-400">{member.email || 'No email provided'}</p>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    {member.role}
                  </span>

                  {member.role !== 'Owner' && (
                    <button onClick={() => handleRemove(member.id)} className="p-1 text-zinc-400 transition-colors hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowInviteModal(false)} />
          <div className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Invite Project Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-zinc-400 hover:text-zinc-650">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-550">Name</label>
                <input value={inviteName} onChange={event => setInviteName(event.target.value)} required className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-550">Email Address</label>
                <input type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} required className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-550">Role Permissions</label>
                <select value={inviteRole} onChange={event => setInviteRole(event.target.value as WorkspaceRole)} className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                  <option value="Admin">Admin</option>
                  <option value="Developer">Developer</option>
                  <option value="Finance">Finance</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <button type="button" onClick={() => setShowInviteModal(false)} className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
                <button type="submit" className="rounded-md bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">Send Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
