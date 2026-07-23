import React from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import DashboardLayout from '../components/layout/DashboardLayout';
import WorkspaceOverview from '../components/workspace/WorkspaceOverview';
import ProjectsIndex from '../components/workspace/ProjectsIndex';
import Payroll from '../components/workspace/Payroll';
import ProjectOverview from '../components/project/ProjectOverview';
import ProjectExecutions from '../components/project/ProjectExecutions';
import Zer0Layout from '../components/zer0/Zer0Layout';
import Zer0Dashboard from '../components/zer0/Zer0Dashboard';
import Zer0People from '../components/zer0/Zer0People';
import Zer0PayParty from '../components/zer0/Zer0PayParty';
import Zer0History from '../components/zer0/Zer0History';
import Zer0Proofs from '../components/zer0/Zer0Proofs';
import Zer0Settings from '../components/zer0/Zer0Settings';
import Zer0DataPreview from '../components/zer0/Zer0DataPreview';
import Zer0Stealth from '../components/zer0/Zer0Stealth';
import PlaceholderScreen from '../components/PlaceholderScreen';
import Services from '../components/services/Services';
import AgentStudio from '../components/dashboard/AgentStudio';
import Memory from '../components/dashboard/Memory';
import { useWorkspaceStore } from '../stores/workspace';
import { useProjectStore } from '../stores/project';
import { serviceCatalog } from '../data/serviceCatalog';

import ProjectMembers from '../components/project/ProjectMembers';
import ProjectAudit from '../components/project/ProjectAudit';
import ProjectSettings from '../components/project/ProjectSettings';

import WorkspaceTeam from '../components/workspace/WorkspaceTeam';
import WorkspaceSecurity from '../components/workspace/WorkspaceSecurity';
import WorkspaceAnalytics from '../components/workspace/WorkspaceAnalytics';
import WorkspaceSettings from '../components/workspace/WorkspaceSettings';
import WorkspaceActivity from '../components/workspace/WorkspaceActivity';
import { memoryApi } from '../api/api';
import type { MemoryEntry } from '../types';

// Service components
import TransformationAgent from '../components/services/TransformationAgent';
import TradePipeline from '../components/services/TradePipeline';
import AgentAuth from '../components/services/AgentAuth';
import NftService, { NftCollectionCreate, NftCollectionStudio } from '../components/services/NftService';
import DepinService from '../components/services/DepinService';
import DocsLibrary from '../components/docs/DocsLibrary';
import PublicCollection from '../services/nft/PublicCollection';
import EmbedCheckout from '../services/nft/EmbedCheckout';

import BrandLoader from '../components/BrandLoader';

const MarketingPage = React.lazy(() => import('../marketing/MarketingPage'));
const WithdrawPage = React.lazy(() => import('../components/withdraw/WithdrawPage'));

function AppFallback() {
  return <BrandLoader fullscreen size="lg" />;
}

function MarketingRoute() {
  // Morph / CLI device link: /?code=ABCD-1234 must never show marketing intro.
  // Send users to the console auth + CliActivation flow.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('code') || params.has('activate')) {
      const next = `/dashboard${window.location.search}`;
      if (window.location.pathname + window.location.search !== next) {
        window.location.replace(next);
      }
    }
  }, []);

  const params = new URLSearchParams(window.location.search);
  if (params.has('code') || params.has('activate')) {
    return <AppFallback />;
  }

  return (
    <React.Suspense fallback={<AppFallback />}>
      <MarketingPage />
    </React.Suspense>
  );
}

function WithdrawRoute() {
  return (
    <React.Suspense fallback={<AppFallback />}>
      <WithdrawPage />
    </React.Suspense>
  );
}

function Placeholder({ section }: { section: string }) {
  return <PlaceholderScreen section={section} />;
}

function WorkspaceServicesScreen() {
  const { projectId } = useParams({ strict: false });
  const projectStore = useProjectStore();
  const currentProject = projectStore.projects.find(p => p.id === projectId);
  const [services, setServices] = React.useState(serviceCatalog);

  const projectServices = React.useMemo(() => {
    if (!currentProject) return services;
    const enabled = currentProject.enabledServices || [];
    return services.map(s => ({
      ...s,
      status: enabled.includes(s.id) ? 'active' as const : 'inactive' as const
    }));
  }, [services, currentProject]);

  return <Services services={projectServices} setServices={setServices} />;
}

function WorkspaceAgentScreen() {
  return <AgentStudio />;
}

function WorkspaceMemoryScreen() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const [openNewMemoryModal, setOpenNewMemoryModal] = React.useState(false);
  const memoryKey = projectId
    ? `projectMemory:${projectId}`
    : `workspaceMemory:${workspaceId || 'default'}`;
  const saveTimerRef = React.useRef<number | null>(null);

  const [memoryEntries, setMemoryEntries] = React.useState<MemoryEntry[]>([]);
  const [memoryLoaded, setMemoryLoaded] = React.useState(false);
  const [morphMeta, setMorphMeta] = React.useState<Record<string, unknown>>({});
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setMemoryLoaded(false);
    setLoadError(null);
    memoryApi
      .get()
      .then((response) => {
        if (cancelled) return;
        const bag = response.memory || {};
        const savedEntries = bag[memoryKey];
        setMemoryEntries(Array.isArray(savedEntries) ? (savedEntries as MemoryEntry[]) : []);
        const meta: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(bag)) {
          if (
            k.startsWith('morph:') ||
            k.includes('siteKey') ||
            k.includes('collectionId') ||
            k.includes('gateSite') ||
            k.includes('deployUrl')
          ) {
            meta[k] = v;
          }
        }
        setMorphMeta(meta);
        setMemoryLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load shared memory from AWS:', err);
        setMemoryEntries([]);
        setLoadError(err instanceof Error ? err.message : 'Failed to load');
        setMemoryLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [memoryKey]);

  React.useEffect(() => {
    if (!memoryLoaded) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      setSaveError(null);
      memoryApi.update({ [memoryKey]: memoryEntries }).catch((err) => {
        console.error('Failed to save shared memory to AWS:', err);
        setSaveError(err instanceof Error ? err.message : 'Save failed');
      });
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [memoryEntries, memoryKey, memoryLoaded]);

  const scopeLabel = projectId
    ? 'This project'
    : workspaceId
      ? 'This workspace'
      : 'Shared memory';

  return (
    <Memory
      memoryEntries={memoryEntries}
      setMemoryEntries={setMemoryEntries}
      openNewMemoryModal={openNewMemoryModal}
      setOpenNewMemoryModal={setOpenNewMemoryModal}
      scopeLabel={scopeLabel}
      workspaceId={typeof workspaceId === 'string' ? workspaceId : undefined}
      projectId={typeof projectId === 'string' ? projectId : undefined}
      morphMeta={morphMeta}
      loading={!memoryLoaded && !loadError}
      saveError={saveError || loadError}
    />
  );
}

function DashboardShortcutRedirect({ section }: { section: 'agent' | 'services' }) {
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const navigate = useNavigate();

  React.useEffect(() => {
    const workspace = workspaces[0];
    if (workspace) {
      navigate({ to: section === 'services' ? `/dashboard/w/${workspace.id}/projects` : `/dashboard/w/${workspace.id}/overview` });
      return;
    }
    navigate({ to: '/dashboard' });
  }, [navigate, section, workspaces]);

  return <BrandLoader fullscreen size="md" label="Opening console…" />;
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#050505]">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">404</h1>
        <p className="mt-2 text-sm text-zinc-500">Page not found</p>
        <a href="/dashboard" className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
          Go to Dashboard
        </a>
      </div>
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: MarketingRoute,
});

/** Public stealth claim / withdraw — no dashboard login required */
const withdrawRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/withdraw',
  component: WithdrawRoute,
});

const agentShortcutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/agent',
  component: () => <DashboardShortcutRedirect section="agent" />,
});

const servicesShortcutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/services',
  component: () => <DashboardShortcutRedirect section="services" />,
});

const misspelledServicesShortcutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/serives',
  component: () => <DashboardShortcutRedirect section="services" />,
});

const dashboardAgentShortcutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard/agent',
  component: () => <DashboardShortcutRedirect section="agent" />,
});

const dashboardServicesShortcutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard/services',
  component: () => <DashboardShortcutRedirect section="services" />,
});

// Dashboard layout route — renders the shell, children render in <Outlet />
const dashboardLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'dashboard',
  component: DashboardLayout,
});

// --- Workspace screens ---
const wsOverviewRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/overview',
  component: WorkspaceOverview,
});

const wsProjectsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/projects',
  component: ProjectsIndex,
});

const wsProjectsNewRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/projects/new',
  component: () => <ProjectsIndex initialShowWizard />,
});

const wsZer0LayoutRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/zer0',
  component: Zer0Layout,
});

const wsZer0DashboardRoute = createRoute({
  getParentRoute: () => wsZer0LayoutRoute,
  path: '/',
  component: Zer0Dashboard,
});

const wsZer0PeopleRoute = createRoute({
  getParentRoute: () => wsZer0LayoutRoute,
  path: 'people',
  component: Zer0People,
});

const wsZer0PayRoute = createRoute({
  getParentRoute: () => wsZer0LayoutRoute,
  path: 'pay',
  component: Zer0PayParty,
});

const wsZer0HistoryRoute = createRoute({
  getParentRoute: () => wsZer0LayoutRoute,
  path: 'history',
  component: Zer0History,
});

const wsZer0PayrollRoute = createRoute({
  getParentRoute: () => wsZer0LayoutRoute,
  path: 'payroll',
  component: Payroll,
});

const wsZer0ProofsRoute = createRoute({
  getParentRoute: () => wsZer0LayoutRoute,
  path: 'proofs',
  component: Zer0Proofs,
});

const wsZer0DataPreviewRoute = createRoute({
  getParentRoute: () => wsZer0LayoutRoute,
  path: 'data-preview',
  component: Zer0DataPreview,
});

const wsZer0StealthRoute = createRoute({
  getParentRoute: () => wsZer0LayoutRoute,
  path: 'stealth',
  component: Zer0Stealth,
});

const wsZer0SettingsRoute = createRoute({
  getParentRoute: () => wsZer0LayoutRoute,
  path: 'settings',
  component: Zer0Settings,
});

const wsAuditRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/audit',
  component: WorkspaceActivity,
});

const wsServicesRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/services',
  component: WorkspaceServicesScreen,
});

const wsAgentRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/agent',
  component: WorkspaceAgentScreen,
});

const wsMemoryRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/memory',
  component: WorkspaceMemoryScreen,
});

const wsTeamRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/team',
  component: WorkspaceTeam,
});

const wsSecurityRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/security',
  component: WorkspaceSecurity,
});

const wsAnalyticsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/analytics',
  component: WorkspaceAnalytics,
});

const wsSettingsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/settings',
  component: WorkspaceSettings,
});

// --- Project screens ---
const projectRootRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/dashboard/w/$workspaceId/p/$projectId/overview',
      params: { workspaceId: params.workspaceId, projectId: params.projectId },
    });
  },
});

const projectOverviewRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/overview',
  component: ProjectOverview,
});

const projectExecutionsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/executions',
  component: ProjectExecutions,
});

const projectProjectsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/projects',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/dashboard/w/$workspaceId/projects', params: { workspaceId: params.workspaceId } });
  },
});

const projectServicesRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/services',
  component: WorkspaceServicesScreen,
});

const projectZer0LayoutRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/zer0',
  component: Zer0Layout,
});

const projectZer0DashboardRoute = createRoute({
  getParentRoute: () => projectZer0LayoutRoute,
  path: '/',
  component: Zer0Dashboard,
});

const projectZer0PeopleRoute = createRoute({
  getParentRoute: () => projectZer0LayoutRoute,
  path: 'people',
  component: Zer0People,
});

const projectZer0PayRoute = createRoute({
  getParentRoute: () => projectZer0LayoutRoute,
  path: 'pay',
  component: Zer0PayParty,
});

const projectZer0HistoryRoute = createRoute({
  getParentRoute: () => projectZer0LayoutRoute,
  path: 'history',
  component: Zer0History,
});

const projectZer0PayrollRoute = createRoute({
  getParentRoute: () => projectZer0LayoutRoute,
  path: 'payroll',
  component: Payroll,
});

const projectZer0ProofsRoute = createRoute({
  getParentRoute: () => projectZer0LayoutRoute,
  path: 'proofs',
  component: Zer0Proofs,
});

const projectZer0DataPreviewRoute = createRoute({
  getParentRoute: () => projectZer0LayoutRoute,
  path: 'data-preview',
  component: Zer0DataPreview,
});

const projectZer0StealthRoute = createRoute({
  getParentRoute: () => projectZer0LayoutRoute,
  path: 'stealth',
  component: Zer0Stealth,
});

const projectZer0SettingsRoute = createRoute({
  getParentRoute: () => projectZer0LayoutRoute,
  path: 'settings',
  component: Zer0Settings,
});

const projectAgentRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/agent',
  component: WorkspaceAgentScreen,
});

const projectMemoryRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/memory',
  component: WorkspaceMemoryScreen,
});

const projectTeamRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/team',
  component: ProjectMembers,
});

const projectSecurityRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/security',
  component: WorkspaceSecurity,
});

const projectAnalyticsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/analytics',
  component: WorkspaceAnalytics,
});

const projectAgentsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/agents',
  component: WorkspaceAgentScreen,
});

const projectMembersRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/members',
  component: ProjectMembers,
});

const projectAuditRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/audit',
  component: ProjectAudit,
});

const projectSettingsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/settings',
  component: ProjectSettings,
});

// Service-specific routes
const projectTransformationRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/transformation',
  component: TransformationAgent,
});

const projectTradeRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/trade',
  component: TradePipeline,
});

const projectAgentAuthRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/agent-auth',
  component: AgentAuth,
});

const projectNftRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/nft',
  component: NftService,
});

const projectNftCreateRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/nft/collections/new',
  component: NftCollectionCreate,
});

const projectNftStudioRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/nft/collections/$collectionId',
  component: NftCollectionStudio,
});

const projectDepinRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard/w/$workspaceId/p/$projectId/depin',
  component: DepinService,
});

function DashboardIndexRedirect() {
  const workspaceStore = useWorkspaceStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (workspaceStore.workspaces.length > 0) {
      const ws = workspaceStore.workspaces[0];
      navigate({ to: '/dashboard/w/$workspaceId/overview', params: { workspaceId: ws.id } });
    }
  }, [workspaceStore.workspaces.length]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-6" role="status" aria-label="Loading workspace">
      <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
      <div className="h-4 w-full max-w-md rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 animate-pulse" />
        ))}
      </div>
      <p className="pt-2 text-sm text-zinc-500">Loading workspace…</p>
    </div>
  );
}

const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/dashboard',
  component: DashboardIndexRedirect,
});

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: DocsLibrary,
});

const publicNftCollectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/collections/$collectionId',
  component: PublicCollection,
});

const embedNftCheckoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/embed/checkout',
  validateSearch: (search: Record<string, unknown>) => ({
    collectionId: typeof search.collectionId === 'string' ? search.collectionId : '',
    // Game embeds (e.g. http://127.0.0.1:4173) pass their origin so success postMessage can return.
    openerOrigin: typeof search.openerOrigin === 'string' ? search.openerOrigin : '',
  }),
  component: EmbedCheckout,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  withdrawRoute,
  agentShortcutRoute,
  servicesShortcutRoute,
  misspelledServicesShortcutRoute,
  dashboardAgentShortcutRoute,
  dashboardServicesShortcutRoute,
  docsRoute,
  publicNftCollectionRoute,
  embedNftCheckoutRoute,
  dashboardLayoutRoute.addChildren([
    dashboardIndexRoute,
    wsOverviewRoute,
    wsProjectsRoute,
    wsProjectsNewRoute,
    wsZer0LayoutRoute.addChildren([
      wsZer0DashboardRoute,
      wsZer0PeopleRoute,
      wsZer0PayRoute,
      wsZer0HistoryRoute,
      wsZer0PayrollRoute,
      wsZer0ProofsRoute,
      wsZer0StealthRoute,
      wsZer0DataPreviewRoute,
      wsZer0SettingsRoute,
    ]),
    wsAuditRoute,
    wsServicesRoute,
    wsAgentRoute,
    wsMemoryRoute,
    wsTeamRoute,
    wsSecurityRoute,
    wsAnalyticsRoute,
    wsSettingsRoute,
    projectRootRoute,
    projectOverviewRoute,
    projectExecutionsRoute,
    projectProjectsRoute,
    projectServicesRoute,
    projectZer0LayoutRoute.addChildren([
      projectZer0DashboardRoute,
      projectZer0PeopleRoute,
      projectZer0PayRoute,
      projectZer0HistoryRoute,
      projectZer0PayrollRoute,
      projectZer0ProofsRoute,
      projectZer0StealthRoute,
      projectZer0DataPreviewRoute,
      projectZer0SettingsRoute,
    ]),
    projectAgentRoute,
    projectMemoryRoute,
    projectTeamRoute,
    projectSecurityRoute,
    projectAnalyticsRoute,
    projectAgentsRoute,
    projectMembersRoute,
    projectAuditRoute,
    projectSettingsRoute,
    projectTransformationRoute,
    projectTradeRoute,
    projectAgentAuthRoute,
    projectNftRoute,
    projectNftCreateRoute,
    projectNftStudioRoute,
    projectDepinRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});
