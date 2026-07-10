import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
    framework: string;
    branch: string;
    network: string;
    enabledServices?: string[];
  }) => Project;

  updateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'purpose' | 'lifecycle' | 'framework' | 'branch' | 'network'>>) => void;
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
}

export const useProjectStore = create<ProjectState>()(
  persist(
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
          lifecycle: 'active', // Set to active since it has environments/services now
          health: 'healthy',
          createdAt: now,
          updatedAt: now,
          owner: 'current-user',
          framework: input.framework,
          branch: input.branch,
          network: input.network,
          enabledServices: input.enabledServices || [],
        };

        const envs: Environment[] = [
          {
            id: createId('env'),
            projectId: project.id,
            workspaceId: input.workspaceId,
            name: 'Development',
            type: 'development',
            network: input.network,
            createdAt: now,
          },
          {
            id: createId('env'),
            projectId: project.id,
            workspaceId: input.workspaceId,
            name: 'Staging',
            type: 'staging',
            network: input.network,
            createdAt: now,
          },
          {
            id: createId('env'),
            projectId: project.id,
            workspaceId: input.workspaceId,
            name: 'Production',
            type: 'production',
            network: input.network,
            createdAt: now,
          },
        ];

        const instances: ServiceInstance[] = (input.enabledServices || []).map(serviceId => {
          let name = 'Unknown Service';
          if (serviceId === 'srv-privacy') name = 'Zero-Knowledge Privacy Pool';
          else if (serviceId === 'srv-transformation') name = 'Transformation Agent';
          else if (serviceId === 'srv-trade') name = 'A-2-A Trade Pipeline';
          else if (serviceId === 'srv-agent-auth') name = 'Agent Authentication';
          else if (serviceId === 'srv-nft') name = 'NFT Service';
          else if (serviceId === 'srv-depin') name = 'De-pin Service';

          return {
            id: createId('inst'),
            projectId: project.id,
            environmentId: envs[0].id, // Default to Development environment
            workspaceId: input.workspaceId,
            serviceId,
            name,
            status: 'needs_configuration' as const,
            config: {},
            createdAt: now,
            updatedAt: now,
          };
        });

        set(state => ({
          projects: [...state.projects, project],
          environments: [...state.environments, ...envs],
          serviceInstances: [...state.serviceInstances, ...instances],
          currentProjectId: project.id,
        }));
        return project;
      },

      updateProject: (id, updates) =>
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
        })),

      archiveProject: (id) =>
        set(state => ({
          projects: state.projects.map(p =>
            p.id === id ? { ...p, lifecycle: 'archived' as const, updatedAt: Date.now() } : p
          ),
        })),

      deleteProject: (id) =>
        set(state => ({
          projects: state.projects.filter(p => p.id !== id),
          environments: state.environments.filter(e => e.projectId !== id),
          serviceInstances: state.serviceInstances.filter(i => i.projectId !== id),
          deployments: state.deployments.filter(d => d.projectId !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
        })),

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
        set(state => ({
          environments: [...state.environments, env],
        }));
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
        set(state => ({
          serviceInstances: [...state.serviceInstances, instance],
        }));
        return instance;
      },

      updateServiceInstance: (id, updates) =>
        set(state => ({
          serviceInstances: state.serviceInstances.map(i =>
            i.id === id ? { ...i, ...updates, updatedAt: Date.now() } : i
          ),
        })),
    }),
    { name: 'zexvro_projects' }
  )
);
