import { create } from 'zustand';
import { projectApi } from '../api/api';
import type { Project, Environment, ServiceInstance, Deployment } from './types';

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'project';
}

interface ProjectState {
  projects: Project[];
  environments: Environment[];
  serviceInstances: ServiceInstance[];
  deployments: Deployment[];
  currentProjectId: string | null;

  currentProject: () => Project | null;
  getProjectEnvironments: (projectId: string) => Environment[];
  getProjectInstances: (projectId: string, environmentId?: string) => ServiceInstance[];
  getProjectDeployments: (projectId: string, environmentId?: string) => Deployment[];

  createProject: (input: {
    workspaceId: string;
    name: string;
    description: string;
    purpose: string;
    framework?: string;
    branch?: string;
    network: string;
    enabledServices?: string[];
  }) => Project;

  updateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'purpose' | 'lifecycle' | 'framework' | 'branch' | 'network' | 'enabledServices'>>) => void;
  archiveProject: (id: string) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string | null) => void;

  createEnvironment: (input: {
    projectId: string;
    workspaceId: string;
    name: string;
    type: Environment['type'];
    network: string;
  }) => Environment;

  createServiceInstance: (input: {
    projectId: string;
    environmentId: string;
    workspaceId: string;
    serviceId: string;
    name: string;
  }) => ServiceInstance;

  updateServiceInstance: (id: string, updates: Partial<Pick<ServiceInstance, 'status' | 'config' | 'name'>>) => void;
  createDeployment: (input: Omit<Deployment, 'id' | 'createdAt' | 'duration'> & { duration?: number | null }) => Deployment;
  updateDeployment: (id: string, updates: Partial<Deployment>) => void;
}

export const useProjectStore = create<ProjectState>()(
  (set, get) => ({
    projects: [],
    environments: [],
    serviceInstances: [],
    deployments: [],
    currentProjectId: null,

    currentProject: () => {
      const { projects, currentProjectId } = get();
      return projects.find(p => p.id === currentProjectId) || null;
    },

    getProjectEnvironments: (projectId) =>
      get().environments.filter(e => e.projectId === projectId),

    getProjectInstances: (projectId, environmentId) =>
      get().serviceInstances.filter(
        i => i.projectId === projectId && (!environmentId || i.environmentId === environmentId)
      ),

    getProjectDeployments: (projectId, environmentId) =>
      get().deployments.filter(
        d => d.projectId === projectId && (!environmentId || d.environmentId === environmentId)
      ),

    createProject: (input) => {
      const now = Date.now();
      const project: Project = {
        id: createId('proj'),
        workspaceId: input.workspaceId,
        name: input.name,
        slug: slugify(input.name),
        description: input.description,
        purpose: input.purpose,
        lifecycle: 'draft',
        health: 'setup_required',
        createdAt: now,
        updatedAt: now,
        owner: 'current-user',
        framework: input.framework || undefined,
        branch: input.branch || undefined,
        network: input.network,
        enabledServices: input.enabledServices || [],
      };

      set(state => ({
        projects: [...state.projects, project],
        currentProjectId: project.id,
      }));
      projectApi.create({ ...project, projectId: project.id, environments: [], serviceInstances: [] })
        .catch(err => console.error('Failed to save project to AWS:', err));
      return project;
    },

    updateProject: (id, updates) => {
      const project = get().projects.find(p => p.id === id);
      set(state => ({
        projects: state.projects.map(p =>
          p.id === id
            ? {
                ...p,
                ...updates,
                slug: updates.name ? slugify(updates.name) : p.slug,
                updatedAt: Date.now(),
              }
            : p
        ),
      }));
      if (project) {
        projectApi.update(id, { ...updates, workspaceId: project.workspaceId })
          .catch(err => console.error('Failed to update project in AWS:', err));
      }
    },

    archiveProject: (id) => {
      const project = get().projects.find(p => p.id === id);
      set(state => ({
        projects: state.projects.map(p =>
          p.id === id ? { ...p, lifecycle: 'archived' as const, updatedAt: Date.now() } : p
        ),
      }));
      if (project) {
        projectApi.update(id, { workspaceId: project.workspaceId, lifecycle: 'archived' })
          .catch(err => console.error('Failed to archive project in AWS:', err));
      }
    },

    deleteProject: (id) => {
      set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        environments: state.environments.filter(e => e.projectId !== id),
        serviceInstances: state.serviceInstances.filter(i => i.projectId !== id),
        deployments: state.deployments.filter(d => d.projectId !== id),
        currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
      }));
      projectApi.delete(id).catch(err => console.error('Failed to delete project in AWS:', err));
    },

    selectProject: (id) => set({ currentProjectId: id }),

    createEnvironment: (input) => {
      const env: Environment = {
        id: createId('env'),
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        name: input.name,
        type: input.type,
        network: input.network,
        createdAt: Date.now(),
      };
      set(state => {
        const nextEnvironments = [...state.environments, env];
        const project = state.projects.find(p => p.id === input.projectId);
        if (project) {
          const projectEnvs = nextEnvironments.filter(e => e.projectId === input.projectId);
          projectApi.update(project.id, {
            workspaceId: project.workspaceId,
            environments: projectEnvs,
          }).catch(err => console.error('Failed to sync environments to project in AWS:', err));
        }
        return { environments: nextEnvironments };
      });
      return env;
    },

    createServiceInstance: (input) => {
      const instance: ServiceInstance = {
        id: createId('inst'),
        projectId: input.projectId,
        environmentId: input.environmentId,
        workspaceId: input.workspaceId,
        serviceId: input.serviceId,
        name: input.name,
        status: 'draft',
        config: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      set(state => {
        const nextInstances = [...state.serviceInstances, instance];
        const project = state.projects.find(p => p.id === input.projectId);
        if (project) {
          const projectInstances = nextInstances.filter(i => i.projectId === input.projectId);
          projectApi.update(project.id, {
            workspaceId: project.workspaceId,
            serviceInstances: projectInstances,
          }).catch(err => console.error('Failed to sync service instances to project in AWS:', err));
        }
        return { serviceInstances: nextInstances };
      });
      return instance;
    },

    updateServiceInstance: (id, updates) =>
      set(state => {
        const nextInstances = state.serviceInstances.map(i =>
          i.id === id ? { ...i, ...updates, updatedAt: Date.now() } : i
        );
        const targetInstance = nextInstances.find(i => i.id === id);
        if (targetInstance) {
          const project = state.projects.find(p => p.id === targetInstance.projectId);
          if (project) {
            const projectInstances = nextInstances.filter(i => i.projectId === project.id);
            projectApi.update(project.id, {
              workspaceId: project.workspaceId,
              serviceInstances: projectInstances,
            }).catch(err => console.error('Failed to sync updated service instances to AWS:', err));
          }
        }
        return { serviceInstances: nextInstances };
      }),

    createDeployment: (input) => {
      const deployment: Deployment = {
        ...input,
        id: createId('dep'),
        createdAt: Date.now(),
        duration: input.duration ?? null,
      };
      set(state => ({ deployments: [deployment, ...state.deployments] }));
      return deployment;
    },

    updateDeployment: (id, updates) =>
      set(state => ({
        deployments: state.deployments.map(deployment =>
          deployment.id === id ? { ...deployment, ...updates } : deployment
        ),
      })),
  })
);
