import { useNavigate, useParams } from '@tanstack/react-router';
import { useMemo, useState, useEffect } from 'react';
import {
  FolderKanban, Blocks, Users, Shield, Plus, ArrowRight, Activity,
  AlertTriangle, Wallet, Settings2, X,
} from 'lucide-react';
import { useProjectStore } from '../../stores/project';
import { useWorkspaceStore } from '../../stores/workspace';
import { useZer0Store } from '../../stores/zer0';
import { serviceCatalog } from '../../data/serviceCatalog';
import { stellar } from '../../api/api';
import {
  useUIStore,
  type OverviewWidgetId,
} from '../../stores/ui';

const CONVERSION_RATES: Record<'USDC' | 'XLM' | 'EURC', { rate: number; symbol: string; label: string }> = {
  USDC: { rate: 1.00, symbol: '$', label: 'USD' },
  EURC: { rate: 1.08, symbol: '$', label: 'USD' },
  XLM: { rate: 0.12, symbol: '$', label: 'USD' },
};

const WIDGET_META: Array<{ id: OverviewWidgetId; label: string; description: string }> = [
  { id: 'projects', label: 'Projects', description: 'Project list and create shortcut' },
  { id: 'stats', label: 'Summary metrics', description: 'Projects, services, invites, team counts' },
  { id: 'wallet', label: 'Funding wallet', description: 'Connected wallet and balances' },
  { id: 'actions', label: 'Quick actions', description: 'Shortcuts to services, team, credits' },
];

function formatFiatConversion(amount: number, cryptoCurrency: 'USDC' | 'XLM' | 'EURC', preferredFiat: 'USD' | 'EUR' = 'USD'): string {
  const usdVal = amount * (CONVERSION_RATES[cryptoCurrency]?.rate || 1);
  if (preferredFiat === 'EUR') {
    const eurVal = usdVal * 0.925;
    return `€${eurVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
  }
  return `$${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

export default function WorkspaceOverview() {
  const { workspaceId } = useParams({ strict: false });
  const navigate = useNavigate();
  const allProjects = useProjectStore(s => s.projects);
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const settingsState = useZer0Store(s => s.settings);
  const overviewWidgets = useUIStore(s => s.overviewWidgets);
  const setOverviewWidget = useUIStore(s => s.setOverviewWidget);
  const resetOverviewWidgets = useUIStore(s => s.resetOverviewWidgets);

  const [customizeOpen, setCustomizeOpen] = useState(false);

  const projects = useMemo(
    () => allProjects.filter(p => p.workspaceId === workspaceId),
    [allProjects, workspaceId],
  );
  const workspace = useMemo(
    () => workspaces.find(w => w.id === workspaceId),
    [workspaces, workspaceId],
  );
  const services = serviceCatalog;

  const activeProjects = projects.filter(p => p.lifecycle === 'active');
  const draftProjects = projects.filter(p => p.lifecycle === 'draft');
  const invitedMembers = workspace?.members.filter(member => member.status === 'invited' || member.status === 'pending').length || 0;

  const preferredCurrency = ((workspace?.settings as any)?.preferredCurrency || 'USD') as 'USD' | 'EUR';

  const goTo = (path: string) => navigate({ to: path });

  const isWalletConnected = settingsState?.walletAddress && /^G[A-Z2-7]{55}$/.test(settingsState.walletAddress);

  const [balances, setBalances] = useState<{ XLM: number; USDC: number; EURC: number } | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);

  const show = {
    projects: overviewWidgets.projects !== false,
    stats: overviewWidgets.stats !== false,
    wallet: overviewWidgets.wallet !== false,
    actions: overviewWidgets.actions !== false,
  };

  useEffect(() => {
    if (!isWalletConnected || !settingsState.walletAddress) {
      setBalances(null);
      return;
    }
    let active = true;
    setBalancesLoading(true);
    setBalancesError(null);

    // Prefer explicit Zer0 horizon; fall back from project-wide network preference.
    let horizonUrl = (settingsState as { horizonUrl?: string } | null)?.horizonUrl?.trim();
    if (!horizonUrl) {
      const mainnetPref = projects.some(p => {
        const n = String(p.network || '').toLowerCase();
        const sn = p.serviceNetworks?.zer0;
        return sn === 'mainnet' || n.includes('main');
      });
      horizonUrl = mainnetPref
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org';
    }

    stellar.getPoolBalance(settingsState.walletAddress, horizonUrl)
      .then(res => {
        if (active) {
          setBalances(res);
          useZer0Store.setState(state => ({
            pool: {
              ...state.pool,
              balances: {
                USDC: Number(res.USDC || 0),
                XLM: Number(res.XLM || 0),
                EURC: Number(res.EURC || 0),
              },
              lastUpdated: Date.now(),
            },
          }));
        }
      })
      .catch(err => {
        if (active) {
          setBalancesError(err.message || 'Failed to fetch balances');
        }
      })
      .finally(() => {
        if (active) {
          setBalancesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isWalletConnected, settingsState?.walletAddress, (settingsState as { horizonUrl?: string } | null)?.horizonUrl, projects]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {!isWalletConnected && (
        <div className="relative overflow-hidden rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Funding wallet disconnected</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Connect Freighter, Albedo, or xBull in Zer0 settings to fund payments and the privacy pool.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => goTo(`/dashboard/w/${workspaceId}/zer0/settings`)}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-amber-600 px-4 text-xs font-semibold text-white transition hover:bg-amber-500"
            >
              <Wallet className="h-3.5 w-3.5" />
              Configure wallet
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="border-b border-zinc-200 pb-5 dark:border-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Overview</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {workspace?.name || 'Workspace'} — projects, services, team, and credits.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <Settings2 className="h-4 w-4" />
              Customize
            </button>
            {workspaceId && (
              <button
                type="button"
                onClick={() => goTo(`/dashboard/w/${workspaceId}/projects/new`)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                <Plus className="h-4 w-4" />
                New project
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Projects first — primary surface */}
      {show.projects && (
        <section className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Projects</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {projects.length} total · {activeProjects.length} active · {draftProjects.length} draft
              </p>
            </div>
            <div className="flex items-center gap-2">
              {workspaceId && (
                <>
                  <button
                    type="button"
                    onClick={() => goTo(`/dashboard/w/${workspaceId}/projects`)}
                    className="text-xs font-medium text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    View all
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(`/dashboard/w/${workspaceId}/projects/new`)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </button>
                </>
              )}
            </div>
          </div>

          {projects.length > 0 ? (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {projects.slice(0, 8).map(project => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => goTo(`/dashboard/w/${workspaceId}/p/${project.id}/overview`)}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                      <FolderKanban className="h-4 w-4 text-zinc-500" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">{project.name}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {project.description || project.network || 'No description'}
                        {(project.enabledServices || []).length > 0
                          ? ` · ${(project.enabledServices || []).length} services`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium capitalize ${
                      project.lifecycle === 'active'
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : project.lifecycle === 'paused'
                          ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                    }`}>
                      {project.lifecycle}
                    </span>
                    <ArrowRight className="h-4 w-4 text-zinc-400" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <FolderKanban className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
              <h3 className="mt-3 text-sm font-semibold text-zinc-950 dark:text-white">No projects yet</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Create a project to enable Zer0, Morph, REQWID, NFTo, or DEDSEC.
              </p>
              {workspaceId && (
                <button
                  type="button"
                  onClick={() => goTo(`/dashboard/w/${workspaceId}/projects/new`)}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create project
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {show.stats && (
        <div className="grid gap-px border-y border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<FolderKanban className="h-4 w-4" />}
            label="Projects"
            value={projects.length}
            detail={`${activeProjects.length} active, ${draftProjects.length} draft`}
          />
          <StatCard
            icon={<Blocks className="h-4 w-4" />}
            label="Services"
            value={services.length}
            detail="MVP service catalog"
          />
          <StatCard
            icon={<Shield className="h-4 w-4" />}
            label="Invites"
            value={invitedMembers}
            detail="Pending team access"
          />
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Team"
            value={workspace?.members.length || 1}
            detail="Workspace members"
          />
        </div>
      )}

      {show.wallet && isWalletConnected && (
        <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <div className="mb-4 flex flex-col justify-between gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Funding wallet</h3>
                <p className="mt-0.5 select-all font-mono text-xs text-zinc-500">
                  {settingsState.walletAddress}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Connected
              </span>
              <button
                type="button"
                onClick={() => goTo(`/dashboard/w/${workspaceId}/zer0/settings`)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                Manage
              </button>
            </div>
          </div>

          <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Balances</h4>
          {balancesLoading ? (
            <div className="flex items-center justify-center py-6">
              <span className="text-xs text-zinc-500">Loading balances…</span>
            </div>
          ) : balancesError ? (
            <div className="rounded-md bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {balancesError}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {(['XLM', 'USDC', 'EURC'] as const).map((asset) => (
                <div key={asset} className="rounded-md border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-900/50 dark:bg-zinc-950">
                  <div className="text-xs text-zinc-500">{asset}</div>
                  <div className="mt-1 text-lg font-bold text-zinc-950 dark:text-white">
                    {(balances?.[asset] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-400">
                    ~ {formatFiatConversion(balances?.[asset] || 0, asset, preferredCurrency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {show.actions && workspaceId && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            onClick={() => goTo(`/dashboard/w/${workspaceId}/projects`)}
            icon={<FolderKanban className="h-5 w-5" />}
            title="Projects"
            description="Browse and open workspace projects"
          />
          <QuickAction
            onClick={() => goTo(`/dashboard/w/${workspaceId}/services`)}
            icon={<Blocks className="h-5 w-5" />}
            title="Services"
            description="Zer0, Morph, REQWID, NFTo, DEDSEC"
          />
          <QuickAction
            onClick={() => goTo(`/dashboard/w/${workspaceId}/team`)}
            icon={<Users className="h-5 w-5" />}
            title="Team"
            description="Members, invites, and roles"
          />
          <QuickAction
            onClick={() => goTo(`/dashboard/w/${workspaceId}/audit`)}
            icon={<Shield className="h-5 w-5" />}
            title="Audit log"
            description="Workspace activity history"
          />
          <QuickAction
            onClick={() => goTo(`/dashboard/w/${workspaceId}/credits`)}
            icon={<Activity className="h-5 w-5" />}
            title="Credits (ZCR)"
            description="Balance, promos, testnet / mainnet"
          />
          <QuickAction
            onClick={() => goTo(`/dashboard/w/${workspaceId}/zer0`)}
            icon={<Wallet className="h-5 w-5" />}
            title="Zer0"
            description="Private payments and funding wallet"
          />
        </div>
      )}

      {/* Customize panel (AWS-style) */}
      {customizeOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close customize"
            className="absolute inset-0 bg-black/40"
            onClick={() => setCustomizeOpen(false)}
          />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="flex items-start justify-between border-b border-zinc-200 p-5 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Customize overview</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Show or hide sections on this dashboard.</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizeOpen(false)}
                className="rounded-md border border-zinc-200 p-1.5 text-zinc-500 dark:border-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-5">
              {WIDGET_META.map((w) => {
                const on = overviewWidgets[w.id] !== false;
                return (
                  <label
                    key={w.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 p-3 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => setOverviewWidget(w.id, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-500"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-950 dark:text-white">{w.label}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">{w.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 border-t border-zinc-200 p-5 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => resetOverviewWidgets()}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-zinc-200 text-sm font-medium dark:border-zinc-800"
              >
                Reset defaults
              </button>
              <button
                type="button"
                onClick={() => setCustomizeOpen(false)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-zinc-950 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, detail }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="bg-white p-4 dark:bg-[#0A0A0B]">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] text-zinc-400">{detail}</p>
    </div>
  );
}

function QuickAction({ onClick, icon, title, description }: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-md border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
    >
      <span className="inline-flex items-center justify-center rounded-md border border-zinc-200 p-2 text-zinc-500 transition group-hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:group-hover:text-white">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-950 dark:text-white">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
    </button>
  );
}

