import type { Workspace, WorkspaceMember, WorkspaceRole } from '../stores/types';

import {roleHasPermission,normalizeWorkspaceRole, type Permission} from '../../../packages/platform-permissions/src';
export * from '../../../packages/platform-permissions/src';

function norm(value: string | undefined | null) {
  return (value || '').trim().toLowerCase();
}

/**
 * Resolve the current user's membership in a workspace.
 * Matches email first, then username / member id / name.
 */
export function resolveWorkspaceMember(
  workspace: Workspace | null | undefined,
  identity: { email?: string; username?: string; userId?: string } | null | undefined,
): WorkspaceMember | null {
  if (!workspace?.members?.length || !identity) return null;

  const email = norm(identity.email);
  const username = norm(identity.username);
  const userId = norm(identity.userId);

  const byEmail = email
    ? workspace.members.find(m => norm(m.email) === email)
    : undefined;
  if (byEmail) return byEmail;

  const byUsername = username
    ? workspace.members.find(
        m =>
          norm(m.id) === username
          || norm(m.name) === username
          || norm(m.email).split('@')[0] === username,
      )
    : undefined;
  if (byUsername) return byUsername;

  const byUserId = userId
    ? workspace.members.find(m => norm(m.id) === userId)
    : undefined;
  if (byUserId) return byUserId;

  // Workspace creator may only be on ownerId with empty member email (legacy rows).
  if (
    (email || username || userId)
    && (
      norm(workspace.ownerId) === email
      || norm(workspace.ownerId) === username
      || norm(workspace.ownerId) === userId
    )
  ) {
    return {
      id: workspace.ownerId,
      email: identity.email || '',
      name: identity.username || identity.email || workspace.ownerId,
      role: 'Owner',
      status: 'active',
      joinedAt: workspace.createdAt,
    };
  }

  return null;
}

export function memberCan(
  member: WorkspaceMember | null | undefined,
  permission: Permission,
): boolean {
  if (!member) return false;
  if (member.status === 'inactive' || member.status === 'revoked' || member.status === 'expired') {
    return false;
  }
  // Invited users may view team list but not mutate until accepted/active.
  if (member.status === 'invited' || member.status === 'pending') {
    return permission === 'workspace.view' || permission === 'team.view';
  }
  return roleHasPermission(member.role, permission);
}

/** Sidebar / route section keys mapped to a required permission. */
export const SECTION_PERMISSION: Record<string, Permission> = {
  overview: 'workspace.view',
  projects: 'workspace.view',
  team: 'team.view',
  credits: 'workspace.view',
  audit: 'audit.view',
  settings: 'workspace.settings.read',
  services: 'workspace.view',
  agent: 'agent.use',
  memory: 'agent.use',
  security: 'security.manage',
  analytics: 'workspace.view',
  zer0: 'finance.view',
  'zer0/people': 'finance.view',
  'zer0/payroll': 'finance.view',
  'zer0/pay': 'finance.pay',
  'zer0/history': 'finance.view',
  'zer0/proofs': 'finance.view',
  'zer0/data-preview': 'finance.view',
  'zer0/settings': 'finance.manage',
  'zer0/stealth': 'finance.view',
};

export function canAccessSection(
  role: WorkspaceRole | string | undefined | null,
  sectionTo: string,
): boolean {
  const permission = SECTION_PERMISSION[sectionTo] || 'workspace.view';
  return roleHasPermission(role, permission);
}

export function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case 'Owner':
      return 'Owner (full control)';
    case 'Admin':
      return 'Admin (manage team & settings)';
    case 'Developer':
      return 'Developer (build & configure)';
    case 'Finance':
      return 'Finance (payroll & payments)';
    case 'Viewer':
      return 'Viewer (read-only)';
    case 'Agent':
      return 'Agent (scoped automation)';
    default:
      return role;
  }
}

/** Short capability bullets for IAM Roles catalog UI */
export const ROLE_PERMISSIONS_SUMMARY: Record<WorkspaceRole, string[]> = {
  Owner: ['Full workspace control', 'Delete workspace', 'Manage all bindings', 'Finance + security'],
  Admin: ['Manage team & invites', 'Write settings', 'Security & curated options', 'No project delete'],
  Developer: ['Create/edit projects', 'Configure services', 'Use Morph agent', 'Read audit'],
  Finance: ['View finance', 'Send payments', 'Manage payroll settings', 'No team admin'],
  Viewer: ['Read workspace', 'View team & audit', 'No mutations'],
  Agent: ['Service-account style', 'Use agent tools', 'Configure services (scoped)'],
};
