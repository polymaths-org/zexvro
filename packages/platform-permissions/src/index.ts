export type WorkspaceRole='Owner'|'Admin'|'Developer'|'Finance'|'Viewer'|'Agent';

/** Stable permission keys used by UI gates and API policy. */
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
