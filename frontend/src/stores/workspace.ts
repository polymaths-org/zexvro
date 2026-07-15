import { create } from 'zustand';
import { workspaceApi } from '../api/api';
import type { Workspace, WorkspaceMember } from './types';

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

function namesEqual(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  currentWorkspace: () => Workspace | null;
  isHydrated: boolean;
  setHydrated: (val: boolean) => void;
  createWorkspace: (name: string, ownerId: string) => Workspace;
  selectWorkspace: (id: string) => void;
  updateWorkspace: (id: string, updates: Partial<Pick<Workspace, 'name' | 'plan' | 'settings'>>) => void;
  deleteWorkspace: (id: string) => void;
  addMember: (workspaceId: string, member: Omit<WorkspaceMember, 'id' | 'joinedAt'>) => void;
  removeMember: (workspaceId: string, memberId: string) => void;
  updateMemberRole: (workspaceId: string, memberId: string, role: WorkspaceMember['role']) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  (set, get) => ({
    workspaces: [],
    currentWorkspaceId: null,
    isHydrated: false,

    setHydrated: (val) => set({ isHydrated: val }),

    currentWorkspace: () => {
      const { workspaces, currentWorkspaceId } = get();
      return workspaces.find(w => w.id === currentWorkspaceId) || workspaces[0] || null;
    },

    createWorkspace: (name, ownerId) => {
      const workspaceName = name.trim() || 'Workspace';
      const existing = get().workspaces.find(workspace => namesEqual(workspace.name, workspaceName));
      if (existing) {
        set({ currentWorkspaceId: existing.id });
        return existing;
      }

      const workspace: Workspace = {
        id: createId('ws'),
        name: workspaceName,
        slug: slugify(workspaceName),
        plan: 'Team workspace',
        ownerId,
        createdAt: Date.now(),
        members: [{
          id: ownerId,
          email: '',
          name: ownerId,
          role: 'Owner',
          status: 'active',
          joinedAt: Date.now(),
        }],
      };
      set(state => ({
        workspaces: [...state.workspaces, workspace],
        currentWorkspaceId: workspace.id,
      }));
      workspaceApi.create(workspace).catch(err => console.error('Failed to save workspace to AWS:', err));
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
      const fullMember = { ...member, id: createId('member'), joinedAt: Date.now() };
      set(state => ({
        workspaces: state.workspaces.map(w =>
          w.id === workspaceId
            ? {
                ...w,
                members: [...w.members, fullMember],
              }
            : w
        ),
      }));
      workspaceApi.invite(workspaceId, fullMember).catch(err => console.error('Failed to save invite to AWS:', err));
    },

    removeMember: (workspaceId, memberId) =>
      set(state => ({
        workspaces: state.workspaces.map(w =>
          w.id === workspaceId
            ? { ...w, members: w.members.filter(m => m.id !== memberId) }
            : w
        ),
      })),

    updateMemberRole: (workspaceId, memberId, role) =>
      set(state => ({
        workspaces: state.workspaces.map(w =>
          w.id === workspaceId
            ? {
                ...w,
                members: w.members.map(m =>
                  m.id === memberId ? { ...m, role } : m
                ),
              }
            : w
        ),
      })),
  })
);
