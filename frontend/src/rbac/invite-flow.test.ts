import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '../stores/workspace';

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    inviteApi: {
      create: vi.fn(async (data: { token: string; email: string }) => ({
        status: 'success',
        messageId: 'test-message-id',
        acceptUrl: `http://localhost:3000/invite/accept?token=${data.token}`,
        provider: 'brevo',
        sender: 'noreply@zexvro.in',
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

describe('IAM invite / accept flow', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspaceId: null,
      isHydrated: true,
    });
  });

  it('creates tokenized invitation and accepts into active binding', async () => {
    const ws = useWorkspaceStore.getState().createWorkspace('Acme', 'owner1', 'owner@acme.com');
    const invite = await useWorkspaceStore.getState().createInvitation({
      workspaceId: ws.id,
      email: 'dev@acme.com',
      role: 'Developer',
      invitedBy: 'owner1',
      invitedByEmail: 'owner@acme.com',
    });

    expect(invite.token.length).toBeGreaterThan(16);
    expect(invite.status).toBe('pending');

    const found = useWorkspaceStore.getState().findInviteByToken(invite.token);
    expect(found?.invite.email).toBe('dev@acme.com');

    const result = useWorkspaceStore.getState().acceptInvitationLocal({
      token: invite.token,
      principalId: 'dev-user',
      email: 'dev@acme.com',
      name: 'Dev',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const next = useWorkspaceStore.getState().workspaces.find(w => w.id === ws.id)!;
    const member = next.members.find(m => m.email === 'dev@acme.com');
    expect(member?.status).toBe('active');
    expect(member?.role).toBe('Developer');
    expect(member?.principalId).toBe('dev-user');
    expect(next.invitations?.find(i => i.id === invite.id)?.status).toBe('accepted');
  });

  it('rejects accept with wrong email principal', async () => {
    const ws = useWorkspaceStore.getState().createWorkspace('Acme', 'owner1', 'owner@acme.com');
    const invite = await useWorkspaceStore.getState().createInvitation({
      workspaceId: ws.id,
      email: 'dev@acme.com',
      role: 'Viewer',
      invitedBy: 'owner1',
    });

    const result = useWorkspaceStore.getState().acceptInvitationLocal({
      token: invite.token,
      principalId: 'other',
      email: 'other@acme.com',
      name: 'Other',
    });
    expect(result.ok).toBe(false);
  });

  it('re-binds already-accepted invite for invitee session', async () => {
    const ws = useWorkspaceStore.getState().createWorkspace('Acme', 'owner1', 'owner@acme.com');
    const invite = await useWorkspaceStore.getState().createInvitation({
      workspaceId: ws.id,
      email: 'dev@acme.com',
      role: 'Admin',
      invitedBy: 'owner1',
    });
    const first = useWorkspaceStore.getState().acceptInvitationLocal({
      token: invite.token,
      principalId: 'dev-user',
      email: 'dev@acme.com',
      name: 'Dev',
    });
    expect(first.ok).toBe(true);

    // Invitee browser: only remote meta, no local invite row
    useWorkspaceStore.setState({ workspaces: [], currentWorkspaceId: null });
    const second = useWorkspaceStore.getState().acceptInvitationLocal({
      token: invite.token,
      principalId: 'dev-user',
      email: 'dev@acme.com',
      name: 'Dev',
      remote: {
        workspaceId: ws.id,
        workspaceName: 'Acme',
        role: 'Admin',
        email: 'dev@acme.com',
        inviteId: invite.id,
        invitedBy: 'owner1',
      },
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const bound = useWorkspaceStore.getState().workspaces.find(w => w.id === ws.id);
    expect(bound?.name).toBe('Acme');
    expect(bound?.members.find(m => m.email === 'dev@acme.com')?.status).toBe('active');
  });

  it('revokes pending invitation', async () => {
    const ws = useWorkspaceStore.getState().createWorkspace('Acme', 'owner1', 'owner@acme.com');
    const invite = await useWorkspaceStore.getState().createInvitation({
      workspaceId: ws.id,
      email: 'fin@acme.com',
      role: 'Finance',
      invitedBy: 'owner1',
    });
    await useWorkspaceStore.getState().revokeInvitation(ws.id, invite.id);
    const next = useWorkspaceStore.getState().workspaces.find(w => w.id === ws.id)!;
    expect(next.invitations?.find(i => i.id === invite.id)?.status).toBe('revoked');
  });
});
