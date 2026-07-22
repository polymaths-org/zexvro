import { describe, expect, it } from 'vitest';
import type { Workspace } from '../stores/types';
import {
  canAccessSection,
  memberCan,
  normalizeWorkspaceRole,
  permissionsForRole,
  resolveWorkspaceMember,
  roleHasPermission,
} from './permissions';

const baseWorkspace: Workspace = {
  id: 'ws_1',
  name: 'Polymaths',
  slug: 'polymaths',
  plan: 'Team',
  ownerId: 'nabil',
  createdAt: 1,
  members: [
    {
      id: 'm_owner',
      email: 'nabil@polymaths.org',
      name: 'Nabil',
      role: 'Owner',
      status: 'active',
      joinedAt: 1,
    },
    {
      id: 'm_dev',
      email: 'dev@polymaths.org',
      name: 'Dev',
      role: 'Developer',
      status: 'active',
      joinedAt: 2,
    },
    {
      id: 'm_fin',
      email: 'fin@polymaths.org',
      name: 'Fin',
      role: 'Finance',
      status: 'active',
      joinedAt: 3,
    },
    {
      id: 'm_view',
      email: 'view@polymaths.org',
      name: 'View',
      role: 'Viewer',
      status: 'active',
      joinedAt: 4,
    },
    {
      id: 'm_inv',
      email: 'invited@polymaths.org',
      name: 'Invited',
      role: 'Admin',
      status: 'invited',
      joinedAt: 5,
    },
  ],
};

describe('rbac permissions', () => {
  it('gives Owner full control', () => {
    expect(roleHasPermission('Owner', 'team.manage')).toBe(true);
    expect(roleHasPermission('Owner', 'workspace.settings.write')).toBe(true);
    expect(roleHasPermission('Owner', 'finance.pay')).toBe(true);
  });

  it('restricts Viewer mutations', () => {
    expect(roleHasPermission('Viewer', 'workspace.view')).toBe(true);
    expect(roleHasPermission('Viewer', 'team.invite')).toBe(false);
    expect(roleHasPermission('Viewer', 'workspace.settings.write')).toBe(false);
    expect(roleHasPermission('Viewer', 'finance.pay')).toBe(false);
  });

  it('allows Finance payroll but not team admin', () => {
    expect(roleHasPermission('Finance', 'finance.pay')).toBe(true);
    expect(roleHasPermission('Finance', 'finance.manage')).toBe(true);
    expect(roleHasPermission('Finance', 'team.manage')).toBe(false);
    expect(roleHasPermission('Finance', 'service.configure')).toBe(false);
  });

  it('allows Developer configure but not finance pay', () => {
    expect(roleHasPermission('Developer', 'service.configure')).toBe(true);
    expect(roleHasPermission('Developer', 'project.create')).toBe(true);
    expect(roleHasPermission('Developer', 'finance.pay')).toBe(false);
    expect(roleHasPermission('Developer', 'team.invite')).toBe(false);
  });

  it('resolves member by email', () => {
    const member = resolveWorkspaceMember(baseWorkspace, {
      email: 'dev@polymaths.org',
      username: 'other',
    });
    expect(member?.role).toBe('Developer');
  });

  it('falls back to ownerId when email missing on owner row', () => {
    const ws: Workspace = {
      ...baseWorkspace,
      members: [{
        id: 'nabil',
        email: '',
        name: 'nabil',
        role: 'Owner',
        status: 'active',
        joinedAt: 1,
      }],
    };
    const member = resolveWorkspaceMember(ws, { email: 'nabil@x.com', username: 'nabil' });
    expect(member?.role).toBe('Owner');
  });

  it('blocks invited members from mutations', () => {
    const invited = baseWorkspace.members.find(m => m.status === 'invited')!;
    expect(memberCan(invited, 'team.view')).toBe(true);
    expect(memberCan(invited, 'team.invite')).toBe(false);
    expect(memberCan(invited, 'workspace.settings.write')).toBe(false);
  });

  it('maps sidebar sections to role access', () => {
    expect(canAccessSection('Viewer', 'team')).toBe(true);
    expect(canAccessSection('Viewer', 'zer0/pay')).toBe(false);
    expect(canAccessSection('Finance', 'zer0/pay')).toBe(true);
    expect(canAccessSection('Developer', 'settings')).toBe(true);
    expect(canAccessSection('Developer', 'security')).toBe(false);
  });

  it('normalizes unknown roles to Viewer', () => {
    expect(normalizeWorkspaceRole('Nope')).toBe('Viewer');
    expect(permissionsForRole('Nope').has('workspace.view')).toBe(true);
    expect(permissionsForRole('Nope').has('team.manage')).toBe(false);
  });
});
