import type { Workspace, WorkspaceMember, WorkspaceRole } from '../stores/types';

/** Stable permission keys used by UI gates and (later) API policy. */
export type Permission =
  | 'workspace.view'
  | 'workspace.settings.read'
  | 'workspace.settings.write'
  | 'team.view'
  | 'team.invite'
  | 'team.manage'
  | 'audit.view'
  | 'project.create'
  | 'project.edit'
  | 'project.delete'
  | 'service.configure'
  | 'finance.view'
  | 'finance.pay'
  | 'finance.manage'
  | 'security.manage'
  | 'agent.use'
  | 'admin.curated_options';

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = [
  'Owner',
  'Admin',
  'Developer',
  'Finance',
  'Viewer',
  'Agent',
] as const;

/** Roles that can be assigned via invite UI (not Owner / not Agent service accounts). */
export const INVITABLE_ROLES: readonly WorkspaceRole[] = [
  'Admin',
  'Developer',
  'Finance',
  'Viewer',
] as const;

const ALL: Permission[] = [
  'workspace.view',
  'workspace.settings.read',
  'workspace.settings.write',
  'team.view',
  'team.invite',
  'team.manage',
  'audit.view',
  'project.create',
  'project.edit',
  'project.delete',
  'service.configure',
  'finance.view',
  'finance.pay',
  'finance.manage',
  'security.manage',
  'agent.use',
  'admin.curated_options',
];

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  Owner: ALL,
  Admin: ALL.filter(p => p !== 'project.delete'),
  Developer: [
    'workspace.view',
    'workspace.settings.read',
    'team.view',
    'audit.view',
    'project.create',
    'project.edit',
    'service.configure',
    'agent.use',
  ],
  Finance: [
    'workspace.view',
    'workspace.settings.read',
    'team.view',
    'audit.view',
    'finance.view',
    'finance.pay',
    'finance.manage',
  ],
  Viewer: [
    'workspace.view',
    'workspace.settings.read',
    'team.view',
    'audit.view',
    'finance.view',
    'agent.use',
  ],
  Agent: [
    'workspace.view',
    'agent.use',
    'service.configure',
  ],
};

export function permissionsForRole(role: WorkspaceRole | string | undefined | null): Set<Permission> {
  const key = (WORKSPACE_ROLES as readonly string[]).includes(role || '')
    ? (role as WorkspaceRole)
    : 'Viewer';
  return new Set(ROLE_PERMISSIONS[key]);
}

export function roleHasPermission(
  role: WorkspaceRole | string | undefined | null,
  permission: Permission,
): boolean {
  return permissionsForRole(role).has(permission);
}

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return (WORKSPACE_ROLES as readonly string[]).includes(value);
}

export function normalizeWorkspaceRole(value: string | undefined | null): WorkspaceRole {
  if (value && isWorkspaceRole(value)) return value;
  return 'Viewer';
}

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
