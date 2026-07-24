import { useMemo } from 'react';
import { readStoredSession } from '../auth/cognito';
import { useWorkspaceStore } from '../stores/workspace';
import type { Workspace, WorkspaceMember, WorkspaceRole } from '../stores/types';
import {
  canAccessSection,
  memberCan,
  type Permission,
  resolveWorkspaceMember,
  roleHasPermission,
} from './permissions';

export type WorkspaceRbac = {
  workspace: Workspace | null;
  member: WorkspaceMember | null;
  role: WorkspaceRole | null;
  can: (permission: Permission) => boolean;
  canSection: (sectionTo: string) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
};

function sessionIdentity() {
  const session = readStoredSession();
  if (!session) return null;
  return {
    email: session.email,
    username: session.username,
    userId: session.username,
  };
}

export function useWorkspaceRbac(workspaceId?: string | null): WorkspaceRbac {
  const workspaces = useWorkspaceStore(s => s.workspaces);

  return useMemo(() => {
    const workspace =
      (workspaceId ? workspaces.find(w => w.id === workspaceId) : null)
      || workspaces[0]
      || null;
    const member = resolveWorkspaceMember(workspace, sessionIdentity());
    const role = member?.role ?? null;

    return {
      workspace,
      member,
      role,
      can: (permission: Permission) => memberCan(member, permission),
      canSection: (sectionTo: string) =>
        member
          ? memberCan(member, 'workspace.view') && canAccessSection(member.role, sectionTo)
          : false,
      isOwner: role === 'Owner',
      isAdmin: role === 'Owner' || role === 'Admin',
    };
  }, [workspaceId, workspaces]);
}

/** Non-hook helper for stores / non-React code. */
export function canInWorkspace(
  workspace: Workspace | null | undefined,
  permission: Permission,
  identity?: { email?: string; username?: string } | null,
): boolean {
  const member = resolveWorkspaceMember(
    workspace,
    identity || sessionIdentity(),
  );
  return memberCan(member, permission);
}

export function roleCan(role: WorkspaceRole | string | null | undefined, permission: Permission) {
  return roleHasPermission(role, permission);
}
