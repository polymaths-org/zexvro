import { create } from 'zustand';
import { inviteApi, workspaceApi } from '../api/api';
import type { TeamInvite, Workspace, WorkspaceMember, WorkspaceRole } from './types';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'workspace';
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function namesEqual(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function normEmail(email: string) {
  return email.trim().toLowerCase();
}

function patchWorkspace(workspaces: Workspace[], workspaceId: string, patch: (w: Workspace) => Workspace) {
  return workspaces.map(w => (w.id === workspaceId ? patch(w) : w));
}

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  currentWorkspace: () => Workspace | null;
  isHydrated: boolean;
  setHydrated: (val: boolean) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  createWorkspace: (name: string, ownerId: string, ownerEmail?: string) => Workspace;
  selectWorkspace: (id: string) => void;
  updateWorkspace: (id: string, updates: Partial<Pick<Workspace, 'name' | 'plan' | 'settings' | 'invitations' | 'members'>>) => void;
  deleteWorkspace: (id: string) => void;
  /** @deprecated prefer createInvitation for IAM invite flow */
  addMember: (workspaceId: string, member: Omit<WorkspaceMember, 'id' | 'joinedAt'>) => void;
  removeMember: (workspaceId: string, memberId: string) => void;
  /** Non-owner leaves a shared workspace (removes self from roster + list). */
  leaveWorkspace: (workspaceId: string, identity: { email?: string; username?: string; userId?: string }) => Promise<void>;
  updateMemberRole: (workspaceId: string, memberId: string, role: WorkspaceMember['role'], boundBy?: string) => void;
  createInvitation: (input: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    invitedBy: string;
    invitedByEmail?: string;
    note?: string;
  }) => Promise<TeamInvite>;
  revokeInvitation: (workspaceId: string, inviteId: string) => Promise<void>;
  resendInvitation: (workspaceId: string, inviteId: string) => Promise<TeamInvite>;
  acceptInvitationLocal: (input: {
    token: string;
    principalId: string;
    email: string;
    name: string;
    /** Server invite record when invitee has no local copy */
    remote?: {
      workspaceId: string;
      workspaceName?: string;
      role: WorkspaceRole;
      email: string;
      inviteId?: string;
      invitedBy?: string;
      ownerId?: string;
      members?: WorkspaceMember[];
    };
  }) => { ok: true; workspaceId: string } | { ok: false; error: string };
  findInviteByToken: (token: string) => { workspace: Workspace; invite: TeamInvite } | null;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  (set, get) => ({
    workspaces: [],
    currentWorkspaceId: null,
    isHydrated: false,

    setHydrated: (val) => set({ isHydrated: val }),

    setWorkspaces: (workspaces) => set({ workspaces }),

    currentWorkspace: () => {
      const { workspaces, currentWorkspaceId } = get();
      return workspaces.find(w => w.id === currentWorkspaceId) || workspaces[0] || null;
    },

    createWorkspace: (name, ownerId, ownerEmail = '') => {
      const workspaceName = name.trim() || 'Workspace';
      const existing = get().workspaces.find(workspace => namesEqual(workspace.name, workspaceName));
      if (existing) {
        set({ currentWorkspaceId: existing.id });
        return existing;
      }

      const email = ownerEmail.trim();
      const displayName = email.includes('@') ? email.split('@')[0] : (ownerId || 'Owner');
      const now = Date.now();
      const workspace: Workspace = {
        id: createId('ws'),
        name: workspaceName,
        slug: slugify(workspaceName),
        plan: 'Team workspace',
        ownerId,
        createdAt: now,
        invitations: [],
        members: [{
          id: ownerId,
          email,
          name: displayName,
          role: 'Owner',
          status: 'active',
          joinedAt: now,
          principalType: 'user',
          principalId: ownerId,
          roleBoundAt: now,
          roleBoundBy: email || ownerId,
        }],
      };
      set(state => ({
        workspaces: [...state.workspaces, workspace],
        currentWorkspaceId: workspace.id,
      }));
      workspaceApi.create(workspace)
        .then((res: { workspace?: { id?: string; workspaceId?: string } }) => {
          const serverId = res?.workspace?.id || res?.workspace?.workspaceId;
          if (!serverId || serverId === workspace.id) return;
          // Server may return an existing same-name workspace — swap local id
          set(state => ({
            workspaces: state.workspaces.map(w =>
              w.id === workspace.id ? { ...w, id: serverId } : w
            ),
            currentWorkspaceId:
              state.currentWorkspaceId === workspace.id ? serverId : state.currentWorkspaceId,
          }));
        })
        .catch(err => console.error('Failed to save workspace to AWS:', err));
      return workspace;
    },

    selectWorkspace: (id) => set({ currentWorkspaceId: id }),

    updateWorkspace: (id, updates) => {
      const trimmedName = updates.name?.trim();
      if (trimmedName && get().workspaces.some(workspace => workspace.id !== id && namesEqual(workspace.name, trimmedName))) {
        console.warn('Workspace name must be unique.');
        return;
      }
      const safeUpdates = trimmedName ? { ...updates, name: trimmedName } : updates;
      set(state => ({
        workspaces: state.workspaces.map(w =>
          w.id === id ? { ...w, ...safeUpdates, slug: safeUpdates.name ? slugify(safeUpdates.name) : w.slug } : w
        ),
      }));
      workspaceApi.update(id, safeUpdates).catch(err => console.error('Failed to update workspace in AWS:', err));
    },

    deleteWorkspace: (id) => {
      set(state => {
        const filtered = state.workspaces.filter(w => w.id !== id);
        return {
          workspaces: filtered,
          currentWorkspaceId:
            state.currentWorkspaceId === id
              ? filtered[0]?.id || null
              : state.currentWorkspaceId,
        };
      });
      workspaceApi.delete(id).catch(err => console.error('Failed to delete workspace in AWS:', err));
    },

    addMember: (workspaceId, member) => {
      const fullMember: WorkspaceMember = {
        ...member,
        id: createId('member'),
        joinedAt: Date.now(),
        principalType: member.role === 'Agent' ? 'serviceAccount' : 'user',
      };
      set(state => ({
        workspaces: patchWorkspace(state.workspaces, workspaceId, w => ({
          ...w,
          members: [...w.members, fullMember],
        })),
      }));
      workspaceApi.invite(workspaceId, fullMember).catch(err => console.error('Failed to save invite to AWS:', err));
    },

    removeMember: (workspaceId, memberId) =>
      set(state => ({
        workspaces: patchWorkspace(state.workspaces, workspaceId, w => ({
          ...w,
          members: w.members.filter(m => m.id !== memberId),
        })),
      })),

    leaveWorkspace: async (workspaceId, identity) => {
      const ws = get().workspaces.find(w => w.id === workspaceId);
      if (!ws) return;
      const email = normEmail(identity.email || '');
      const username = normEmail(identity.username || '');
      const userId = normEmail(identity.userId || '');
      const self = ws.members.find(m => {
        const me = normEmail(m.email);
        const mid = normEmail(m.id);
        const pid = normEmail(m.principalId || '');
        return (
          (email && me === email)
          || (username && (mid === username || pid === username || me.split('@')[0] === username))
          || (userId && (mid === userId || pid === userId))
        );
      });
      if (self?.role === 'Owner' || normEmail(ws.ownerId) === email || normEmail(ws.ownerId) === username) {
        throw new Error('Owners cannot leave their workspace. Transfer ownership or delete it.');
      }

      const nextMembers = ws.members.filter(m => {
        if (self && m.id === self.id) return false;
        if (email && normEmail(m.email) === email) return false;
        return true;
      });

      // Drop from local switcher for this user
      set(state => {
        const filtered = state.workspaces.filter(w => w.id !== workspaceId);
        return {
          workspaces: filtered,
          currentWorkspaceId:
            state.currentWorkspaceId === workspaceId
              ? filtered[0]?.id || null
              : state.currentWorkspaceId,
        };
      });

      // Best-effort: update owner roster on platform (may 403 for non-admins — ok)
      workspaceApi.update(workspaceId, { members: nextMembers }).catch(() => undefined);

      // Local Vite membership index
      try {
        await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: identity.email, username: identity.username }),
        });
      } catch {
        /* ignore */
      }
    },

    updateMemberRole: (workspaceId, memberId, role, boundBy) =>
      set(state => ({
        workspaces: patchWorkspace(state.workspaces, workspaceId, w => ({
          ...w,
          members: w.members.map(m =>
            m.id === memberId
              ? {
                  ...m,
                  role,
                  principalType: role === 'Agent' ? 'serviceAccount' : (m.principalType || 'user'),
                  roleBoundAt: Date.now(),
                  roleBoundBy: boundBy || m.roleBoundBy,
                }
              : m
          ),
        })),
      })),

    createInvitation: async ({ workspaceId, email, role, invitedBy, invitedByEmail, note }) => {
      const workspace = get().workspaces.find(w => w.id === workspaceId);
      if (!workspace) throw new Error('Workspace not found');

      const cleanEmail = normEmail(email);
      if (!cleanEmail.includes('@')) throw new Error('Valid email required');

      const activeMember = workspace.members.some(
        m => normEmail(m.email) === cleanEmail && m.status === 'active',
      );
      if (activeMember) throw new Error('This email already has an active workspace binding');

      const pendingInvite = (workspace.invitations || []).find(
        i => normEmail(i.email) === cleanEmail && i.status === 'pending' && i.expiresAt > Date.now(),
      );
      if (pendingInvite) {
        // Refresh token + resend mail instead of hard-failing (common after silent email failure).
        return get().resendInvitation(workspaceId, pendingInvite.id);
      }

      const now = Date.now();
      const invite: TeamInvite = {
        id: createId('inv'),
        workspaceId,
        workspaceName: workspace.name,
        email: cleanEmail,
        role,
        status: 'pending',
        createdAt: now,
        expiresAt: now + INVITE_TTL_MS,
        invitedBy,
        invitedByEmail,
        token: createToken(),
        principalType: role === 'Agent' ? 'serviceAccount' : 'user',
        note,
      };

      // Placeholder member row until accept.
      const pendingMember: WorkspaceMember = {
        id: createId('member'),
        email: cleanEmail,
        name: cleanEmail.split('@')[0],
        role,
        status: 'invited',
        joinedAt: now,
        principalType: invite.principalType,
        inviteId: invite.id,
      };

      set(state => ({
        workspaces: patchWorkspace(state.workspaces, workspaceId, w => ({
          ...w,
          invitations: [...(w.invitations || []).filter(i => !(normEmail(i.email) === cleanEmail && i.status === 'pending')), invite],
          members: [
            ...w.members.filter(m => !(normEmail(m.email) === cleanEmail && (m.status === 'invited' || m.status === 'pending'))),
            pendingMember,
          ],
        })),
      }));

      const next = get().workspaces.find(w => w.id === workspaceId);
      if (next) {
        // Persist token to workspace before mail so prod accept (find_workspace_invite) can resolve it.
        try {
          await workspaceApi.update(workspaceId, {
            members: next.members,
            invitations: next.invitations,
          });
        } catch (err) {
          console.error('Failed to persist invitation:', err);
          const message = err instanceof Error ? err.message : 'Failed to persist invitation';
          const e = new Error(message) as Error & { invite: TeamInvite };
          e.invite = { ...invite, _mailStatus: 'failed' as const, _mailError: message } as TeamInvite;
          throw e;
        }
      }

      try {
        const mail = await inviteApi.create({
          email: cleanEmail,
          workspaceId,
          workspaceName: workspace.name,
          inviterName: invitedByEmail || invitedBy,
          role,
          token: invite.token,
          inviteId: invite.id,
          expiresAt: invite.expiresAt,
          acceptBaseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
          ownerId: workspace.ownerId,
          ownerEmail: invitedByEmail || workspace.members.find(m => m.role === 'Owner')?.email || '',
          invitedByEmail,
          // Full roster so invitee UI shows every member after accept
          memberSnapshot: workspace.members.map(m => ({
            id: m.id,
            email: m.email,
            name: m.name,
            role: m.role,
            status: m.status,
            joinedAt: m.joinedAt,
            principalId: m.principalId || m.id,
            principalType: m.principalType,
          })),
        });
        return Object.assign({}, invite, {
          _mailStatus: 'sent' as const,
          _messageId: mail.messageId,
          _acceptUrl: mail.acceptUrl,
        });
      } catch (err) {
        console.warn('Invite email/API failed; invitation kept locally:', err);
        const message = err instanceof Error ? err.message : 'Email send failed';
        const enriched = {
          ...invite,
          _mailStatus: 'failed' as const,
          _mailError: message,
        };
        // Re-throw so UI can show failure (invitation still saved locally above).
        const e = new Error(message) as Error & { invite: typeof enriched };
        e.invite = enriched;
        throw e;
      }
    },

    revokeInvitation: async (workspaceId, inviteId) => {
      set(state => ({
        workspaces: patchWorkspace(state.workspaces, workspaceId, w => ({
          ...w,
          invitations: (w.invitations || []).map(i =>
            i.id === inviteId
              ? { ...i, status: 'revoked' as const, revokedAt: Date.now() }
              : i
          ),
          members: w.members.filter(m => m.inviteId !== inviteId || m.status === 'active'),
        })),
      }));
      const next = get().workspaces.find(w => w.id === workspaceId);
      if (next) {
        workspaceApi.update(workspaceId, {
          members: next.members,
          invitations: next.invitations,
        }).catch(err => console.error('Failed to persist revoke:', err));
      }
      try {
        await inviteApi.revoke({ workspaceId, inviteId });
      } catch {
        /* local revoke is source of truth when API missing */
      }
    },

    resendInvitation: async (workspaceId, inviteId) => {
      const workspace = get().workspaces.find(w => w.id === workspaceId);
      const invite = workspace?.invitations?.find(i => i.id === inviteId);
      if (!workspace || !invite) throw new Error('Invitation not found');
      if (invite.status !== 'pending') throw new Error('Only pending invitations can be resent');

      const now = Date.now();
      const refreshed: TeamInvite = {
        ...invite,
        token: createToken(),
        createdAt: now,
        expiresAt: now + INVITE_TTL_MS,
        status: 'pending',
      };

      set(state => ({
        workspaces: patchWorkspace(state.workspaces, workspaceId, w => ({
          ...w,
          invitations: (w.invitations || []).map(i => (i.id === inviteId ? refreshed : i)),
        })),
      }));

      const next = get().workspaces.find(w => w.id === workspaceId);
      if (next) {
        try {
          await workspaceApi.update(workspaceId, { invitations: next.invitations });
        } catch (err) {
          console.error('Failed to persist resend invitation:', err);
          throw err instanceof Error ? err : new Error('Failed to persist invitation');
        }
      }

      try {
        await inviteApi.create({
          email: refreshed.email,
          workspaceId,
          workspaceName: workspace.name,
          inviterName: refreshed.invitedByEmail || refreshed.invitedBy,
          role: refreshed.role,
          token: refreshed.token,
          inviteId: refreshed.id,
          expiresAt: refreshed.expiresAt,
          acceptBaseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        });
      } catch (err) {
        console.warn('Resend email failed:', err);
        throw err instanceof Error ? err : new Error('Resend email failed');
      }
      return refreshed;
    },

    findInviteByToken: (token) => {
      const clean = token.trim();
      if (!clean) return null;
      for (const workspace of get().workspaces) {
        const invite = (workspace.invitations || []).find(i => i.token === clean);
        if (invite) return { workspace, invite };
      }
      return null;
    },

    acceptInvitationLocal: ({ token, principalId, email, name, remote: remoteMeta }) => {
      const found = get().findInviteByToken(token);

      let workspace = found?.workspace ?? null;
      let invite = found?.invite ?? null;

      if (!invite && remoteMeta?.workspaceId) {
        let ws = get().workspaces.find(w => w.id === remoteMeta.workspaceId);
        if (!ws) {
          const remoteMembers = Array.isArray((remoteMeta as { members?: WorkspaceMember[] }).members)
            ? (remoteMeta as { members: WorkspaceMember[] }).members
            : [];
          ws = {
            id: remoteMeta.workspaceId,
            name: remoteMeta.workspaceName || 'Workspace',
            slug: remoteMeta.workspaceId.slice(0, 24),
            plan: 'Team workspace',
            ownerId: (remoteMeta as { ownerId?: string }).ownerId || 'remote-owner',
            createdAt: Date.now(),
            members: remoteMembers,
            invitations: [],
          };
          set(state => ({ workspaces: [...state.workspaces, ws!] }));
        }
        const pending: TeamInvite = {
          id: remoteMeta.inviteId || `inv_${token.slice(0, 8)}`,
          workspaceId: remoteMeta.workspaceId,
          workspaceName: remoteMeta.workspaceName,
          email: remoteMeta.email,
          role: remoteMeta.role,
          status: 'pending',
          createdAt: Date.now(),
          expiresAt: Date.now() + INVITE_TTL_MS,
          invitedBy: remoteMeta.invitedBy || 'Owner',
          token,
        };
        set(state => ({
          workspaces: patchWorkspace(state.workspaces, remoteMeta.workspaceId, w => ({
            ...w,
            name: remoteMeta.workspaceName || w.name,
            invitations: [...(w.invitations || []).filter(i => i.token !== token), pending],
          })),
        }));
        workspace = get().workspaces.find(w => w.id === remoteMeta.workspaceId) || null;
        invite = workspace?.invitations?.find(i => i.token === token) || pending;
      }

      if (!workspace || !invite) {
        return { ok: false, error: 'Invitation not found. Open the link again after the inviter re-sends.' };
      }

      if (invite.status === 'revoked') return { ok: false, error: 'This invitation was revoked' };
      if (invite.status !== 'accepted' && invite.expiresAt < Date.now()) {
        set(state => ({
          workspaces: patchWorkspace(state.workspaces, workspace!.id, w => ({
            ...w,
            invitations: (w.invitations || []).map(i =>
              i.id === invite!.id ? { ...i, status: 'expired' as const } : i
            ),
          })),
        }));
        return { ok: false, error: 'This invitation has expired' };
      }

      const cleanEmail = normEmail(email || invite.email);
      if (normEmail(invite.email) !== cleanEmail) {
        return { ok: false, error: `Sign in as ${invite.email} to accept this invitation` };
      }

      const now = Date.now();
      const binding: WorkspaceMember = {
        id: principalId,
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        role: invite.role,
        status: 'active',
        joinedAt: now,
        principalType: invite.principalType || 'user',
        principalId,
        roleBoundAt: now,
        roleBoundBy: invite.invitedByEmail || invite.invitedBy,
        inviteId: invite.id,
      };

      set(state => ({
        workspaces: patchWorkspace(state.workspaces, workspace!.id, w => {
          const baseMembers = [
            ...(remoteMeta?.members || []),
            ...w.members,
          ];
          // Dedupe by email/id then attach accept binding
          const byKey = new Map<string, WorkspaceMember>();
          for (const m of baseMembers) {
            const key = normEmail(m.email) || String(m.id || m.principalId || '');
            if (!key) continue;
            byKey.set(key, m);
          }
          byKey.set(cleanEmail || principalId, binding);
          return {
            ...w,
            name: remoteMeta?.workspaceName || w.name,
            ownerId: remoteMeta?.ownerId || w.ownerId,
            invitations: (w.invitations || []).map(i =>
              i.id === invite!.id || i.token === token
                ? { ...i, status: 'accepted' as const, acceptedAt: now, acceptedBy: principalId }
                : i
            ),
            members: Array.from(byKey.values()),
          };
        }),
        currentWorkspaceId: workspace!.id,
      }));

      // Always try to persist accept onto platform (Lambda accepts non-owner and writes members).
      // Owner-only PUT is a fallback when the invitee is also the owner (re-bind).
      const next = get().workspaces.find(w => w.id === workspace!.id);
      if (next) {
        workspaceApi.update(workspace.id, {
          members: next.members,
          invitations: next.invitations,
        }).catch(() => {
          /* invitee may not have PUT rights — Lambda accept path is source of truth */
        });
      }

      return { ok: true, workspaceId: workspace.id };
    },
  })
);
