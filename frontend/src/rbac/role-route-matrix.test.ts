/**
 * Full matrix: each workspace role × inviteability × permissions × sidebar/route sections.
 * Run: npx vitest run src/rbac/role-route-matrix.test.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workspace, WorkspaceMember, WorkspaceRole } from '../stores/types';
import { useWorkspaceStore } from '../stores/workspace';
import {
  INVITABLE_ROLES,
  SECTION_PERMISSION,
  WORKSPACE_ROLES,
  canAccessSection,
  memberCan,
  roleHasPermission,
  type Permission,
} from './permissions';

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    inviteApi: {
      create: vi.fn(async (data: { token: string }) => ({
        status: 'success',
        messageId: 'msg',
        acceptUrl: `http://localhost:3000/invite/accept?token=${data.token}`,
        provider: 'brevo',
      })),
      revoke: vi.fn(async () => ({ status: 'success' })),
      send: vi.fn(async () => ({ status: 'success' })),
      getByToken: vi.fn(),
      accept: vi.fn(),
    },
    workspaceApi: {
      create: vi.fn(async () => ({ status: 'success' })),
      update: vi.fn(async () => ({ status: 'success' })),
      delete: vi.fn(async () => ({ status: 'success' })),
      list: vi.fn(async () => ({ workspaces: [] })),
      invite: vi.fn(async () => ({ status: 'success' })),
    },
  };
});

/** Permissions that matter for shared-workspace product surface */
const CRITICAL_PERMISSIONS: Permission[] = [
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

/** Expected allow-list per role (must match permissions.ts ROLE_PERMISSIONS) */
const EXPECTED: Record<WorkspaceRole, Permission[]> = {
  Owner: [...CRITICAL_PERMISSIONS],
  Admin: CRITICAL_PERMISSIONS.filter(p => p !== 'project.delete'),
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
  Agent: ['workspace.view', 'agent.use', 'service.configure'],
};

/** Sidebar / route sections used in DashboardLayout */
const ROUTE_SECTIONS = Object.keys(SECTION_PERMISSION);

function member(role: WorkspaceRole, status: WorkspaceMember['status'] = 'active'): WorkspaceMember {
  return {
    id: `m_${role}`,
    email: `${role.toLowerCase()}@example.com`,
    name: role,
    role,
    status,
    joinedAt: Date.now(),
    principalId: `principal_${role}`,
  };
}

function workspaceWith(roles: WorkspaceRole[]): Workspace {
  return {
    id: 'ws_matrix',
    name: 'Matrix WS',
    slug: 'matrix',
    plan: 'Team',
    ownerId: 'owner1',
    createdAt: 1,
    members: [
      member('Owner'),
      ...roles.filter(r => r !== 'Owner').map(r => member(r)),
    ],
  };
}

describe('role catalog', () => {
  it('defines all six roles and four invitable roles', () => {
    expect([...WORKSPACE_ROLES]).toEqual([
      'Owner',
      'Admin',
      'Developer',
      'Finance',
      'Viewer',
      'Agent',
    ]);
    expect([...INVITABLE_ROLES]).toEqual(['Admin', 'Developer', 'Finance', 'Viewer']);
    // Owner and Agent must never appear in invite dropdown
    expect(INVITABLE_ROLES).not.toContain('Owner');
    expect(INVITABLE_ROLES).not.toContain('Agent');
  });
});

describe('permission matrix per role', () => {
  for (const role of WORKSPACE_ROLES) {
    it(`${role}: exact critical permission set`, () => {
      const expected = new Set(EXPECTED[role]);
      for (const p of CRITICAL_PERMISSIONS) {
        const allowed = roleHasPermission(role, p);
        expect(allowed, `${role} / ${p}`).toBe(expected.has(p));
      }
    });
  }
});

describe('route / sidebar section access per role', () => {
  for (const role of WORKSPACE_ROLES) {
    it(`${role}: section gates`, () => {
      for (const section of ROUTE_SECTIONS) {
        const perm = SECTION_PERMISSION[section];
        const expected = roleHasPermission(role, perm);
        expect(canAccessSection(role, section), `${role} section ${section}`).toBe(expected);
      }
    });
  }

  it('product-critical section samples', () => {
    // Team page
    expect(canAccessSection('Viewer', 'team')).toBe(true);
    expect(canAccessSection('Agent', 'team')).toBe(false);

    // Settings write is not section — settings read is
    expect(canAccessSection('Developer', 'settings')).toBe(true);
    expect(canAccessSection('Agent', 'settings')).toBe(false);

    // Security (manage)
    expect(canAccessSection('Admin', 'security')).toBe(true);
    expect(canAccessSection('Developer', 'security')).toBe(false);
    expect(canAccessSection('Viewer', 'security')).toBe(false);

    // Zer0 pay requires finance.pay
    expect(canAccessSection('Finance', 'zer0/pay')).toBe(true);
    expect(canAccessSection('Owner', 'zer0/pay')).toBe(true);
    expect(canAccessSection('Developer', 'zer0/pay')).toBe(false);
    expect(canAccessSection('Viewer', 'zer0/pay')).toBe(false);

    // Zer0 settings requires finance.manage
    expect(canAccessSection('Finance', 'zer0/settings')).toBe(true);
    expect(canAccessSection('Viewer', 'zer0/settings')).toBe(false);

    // Agent studio
    expect(canAccessSection('Developer', 'agent')).toBe(true);
    expect(canAccessSection('Finance', 'agent')).toBe(false);
    expect(canAccessSection('Agent', 'agent')).toBe(true);
  });
});

describe('shared-workspace member actions', () => {
  it('only Owner/Admin can invite and manage team', () => {
    for (const role of WORKSPACE_ROLES) {
      const m = member(role);
      const canInvite = memberCan(m, 'team.invite');
      const canManage = memberCan(m, 'team.manage');
      if (role === 'Owner' || role === 'Admin') {
        expect(canInvite, role).toBe(true);
        expect(canManage, role).toBe(true);
      } else {
        expect(canInvite, role).toBe(false);
        expect(canManage, role).toBe(false);
      }
    }
  });

  it('service.configure (NFT / De-pin config) for build roles', () => {
    expect(memberCan(member('Owner'), 'service.configure')).toBe(true);
    expect(memberCan(member('Admin'), 'service.configure')).toBe(true);
    expect(memberCan(member('Developer'), 'service.configure')).toBe(true);
    expect(memberCan(member('Agent'), 'service.configure')).toBe(true);
    expect(memberCan(member('Finance'), 'service.configure')).toBe(false);
    expect(memberCan(member('Viewer'), 'service.configure')).toBe(false);
  });

  it('invited (not yet accepted) cannot mutate even if Admin role on invite', () => {
    const invited = member('Admin', 'invited');
    expect(memberCan(invited, 'workspace.view')).toBe(true);
    expect(memberCan(invited, 'team.view')).toBe(true);
    expect(memberCan(invited, 'team.invite')).toBe(false);
    expect(memberCan(invited, 'service.configure')).toBe(false);
    expect(memberCan(invited, 'finance.pay')).toBe(false);
  });
});

describe('invite → accept for each invitable role', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspaceId: null,
      isHydrated: true,
    });
  });

  for (const role of INVITABLE_ROLES) {
    it(`invite and accept as ${role}`, async () => {
      const ws = useWorkspaceStore.getState().createWorkspace(
        'Shared Co',
        'owner1',
        'owner@shared.co',
      );
      const email = `${role.toLowerCase()}@shared.co`;
      const invite = await useWorkspaceStore.getState().createInvitation({
        workspaceId: ws.id,
        email,
        role,
        invitedBy: 'owner1',
        invitedByEmail: 'owner@shared.co',
      });
      expect(invite.role).toBe(role);
      expect(invite.status).toBe('pending');

      const pending = useWorkspaceStore
        .getState()
        .workspaces.find(w => w.id === ws.id)
        ?.members.find(m => m.email === email);
      expect(pending?.status).toBe('invited');
      expect(memberCan(pending, 'team.invite')).toBe(false);

      const accept = useWorkspaceStore.getState().acceptInvitationLocal({
        token: invite.token,
        principalId: `user_${role}`,
        email,
        name: role,
      });
      expect(accept.ok).toBe(true);

      const active = useWorkspaceStore
        .getState()
        .workspaces.find(w => w.id === ws.id)
        ?.members.find(m => m.email === email);
      expect(active?.status).toBe('active');
      expect(active?.role).toBe(role);

      // Post-accept permission spot-checks
      for (const p of CRITICAL_PERMISSIONS) {
        expect(memberCan(active, p), `${role} active ${p}`).toBe(
          roleHasPermission(role, p),
        );
      }
    });
  }

  it('cannot invite Owner or Agent via createInvitation role type (UI uses INVITABLE only)', () => {
    // Type-level: INVITABLE_ROLES excludes them; runtime list check
    expect(INVITABLE_ROLES.includes('Owner' as WorkspaceRole)).toBe(false);
    expect(INVITABLE_ROLES.includes('Agent' as WorkspaceRole)).toBe(false);
  });
});

describe('shared workspace membership resolution', () => {
  it('each role resolves and can view workspace', () => {
    const ws = workspaceWith([...WORKSPACE_ROLES]);
    for (const role of WORKSPACE_ROLES) {
      const m = ws.members.find(x => x.role === role);
      expect(m).toBeTruthy();
      expect(memberCan(m, 'workspace.view')).toBe(true);
    }
  });
});
