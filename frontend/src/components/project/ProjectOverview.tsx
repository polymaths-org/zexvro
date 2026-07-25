import { useParams, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Blocks, FolderKanban, Settings, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useProjectStore } from '../../stores/project';
import { useWorkspaceStore } from '../../stores/workspace';
import { useZer0Store } from '../../stores/zer0';
import { serviceCatalog } from '../../data/serviceCatalog';
import {
  balanceNetworkLabel,
  resolveWorkspaceChainEnv,
} from '../../lib/stellarNetwork';

function statusLabel(value: string) {
  return value.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function networkLabel(network?: string) {
  if (!network) return 'Testnet';
  const n = network.toLowerCase();
  if (n.includes('main')) return 'Mainnet';
  if (n === 'mainnet' || n === 'testnet') return n.charAt(0).toUpperCase() + n.slice(1);
  return network;
}

export default function ProjectOverview() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const project = useProjectStore(s => s.projects.find(p => p.id === projectId));
  const allInstances = useProjectStore(s => s.serviceInstances);
  const workspace = useWorkspaceStore(s => s.workspaces.find(item => item.id === workspaceId));
  const zer0Pool = useZer0Store(s => s.pool);
  const zer0HorizonUrl = useZer0Store(s => s.settings?.horizonUrl);
  const allZer0Employees = useZer0Store(s => s.employees);

  const goTo = (path: string) => navigate({ to: path });
  const instances = useMemo(
    () => allInstances.filter(instance => instance.projectId === projectId),
    [allInstances, projectId],
  );
  const zer0Employees = useMemo(
    () => allZer0Employees.filter(employee => employee.projectId === projectId || employee.projectId === workspaceId),
    [allZer0Employees, projectId, workspaceId],
  );

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-[#080809]">
          <FolderKanban className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">Project not found</h3>
          <p className="mt-1 text-xs text-zinc-500">This project may have been removed or is outside your workspace access.</p>
          {workspaceId && (
            <button onClick={() => goTo(`/dashboard/w/${workspaceId}/projects`)} className="mt-4 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
              Back to Projects
            </button>
          )}
        </div>
      </div>
    );
  }

  const enabledServices = project.enabledServices || [];
  const activeServices = serviceCatalog.filter(service => enabledServices.includes(service.id));
  const serviceRows = serviceCatalog
    .filter(service => service.category !== 'trade')
    .map(service => {
      const instance = instances.find(item => item.serviceId === service.id);
      const enabled = enabledServices.includes(service.id);
      // Prefer real instance status; enabled without instance = On (not fake "needs configuration").
      let status = 'disabled';
      if (instance?.status) status = instance.status;
      else if (enabled) status = 'enabled';
      return { service, status, enabled };
    });

  const zkTvl = Object.values(zer0Pool.balances).reduce((sum, value) => sum + Number(value || 0), 0);
  const readyCount = serviceRows.filter(row =>
    row.enabled || ['ready', 'active', 'enabled'].includes(row.status),
  ).length;
  const mainnetPrefs = Object.values(project.serviceNetworks || {}).filter(v => v === 'mainnet').length;
  const chainEnv = resolveWorkspaceChainEnv({
    workspaceEnvironment: workspace?.environment || workspace?.settings?.environment,
    projectNetworks: [project.serviceNetworks?.zer0, project.network],
    horizonUrl: zer0HorizonUrl,
  });
  const chainLabel = balanceNetworkLabel(chainEnv);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="border-b border-zinc-200 pb-5 dark:border-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">{project.name}</h1>
              <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                {statusLabel(project.lifecycle)}
              </span>
              <span className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                {networkLabel(project.network)}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
              {project.description || 'Configure Web3 services for this project.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              <span>{activeServices.length} enabled services</span>
              {project.branch ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                  <span>{project.branch}</span>
                </>
              ) : null}
            </div>
          </div>
          {workspaceId && projectId && (
            <button
              onClick={() => goTo(`/dashboard/w/${workspaceId}/p/${projectId}/settings`)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-px border-y border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Blocks className="h-4 w-4" />} label="Enabled services" value={String(activeServices.length)} detail={`${readyCount} ready · MVP catalog`} />
        <Metric icon={<Wallet className="h-4 w-4" />} label="Wallet balances" value={zkTvl > 0 ? zkTvl.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'} detail={`Zer0 linked wallet · ${chainLabel} · USDC/XLM/EURC`} />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Network prefs" value={networkLabel(project.network)} detail={mainnetPrefs > 0 ? `${mainnetPrefs} service(s) on mainnet · workspace ${chainLabel}` : `Workspace ${chainLabel} · per-service prefs in Settings`} />
        <Metric icon={<Users className="h-4 w-4" />} label="Team" value={String(workspace?.members.length || 0)} detail={`${zer0Employees.length} Zer0 payees`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
        <div>
          <div className="border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Service status</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Five MVP services — Zer0 · Morph · REQWID · NFTo · DEDSEC.</p>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {serviceRows.map(({ service, status }) => (
              <div key={service.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-950 dark:text-white">{service.name}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{service.description}</p>
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                  status === 'active' || status === 'ready' || status === 'enabled'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : status === 'disabled'
                      ? 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                      : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                }`}>
                  {statusLabel(status)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <QuickAction
            onClick={() => workspaceId && projectId && goTo(`/dashboard/w/${workspaceId}/p/${projectId}/services`)}
            icon={<Blocks className="h-5 w-5" />}
            title="Services Manager"
            description="Enable Zer0, Morph, REQWID, NFTo, or DEDSEC."
          />
          <QuickAction
            onClick={() => workspaceId && projectId && goTo(`/dashboard/w/${workspaceId}/p/${projectId}/zer0`)}
            icon={<Wallet className="h-5 w-5" />}
            title="Zer0"
            description="Private payments, payees, proofs, and network settings."
          />
          <QuickAction
            onClick={() => workspaceId && projectId && goTo(`/dashboard/w/${workspaceId}/p/${projectId}/settings`)}
            icon={<Settings className="h-5 w-5" />}
            title="Project settings"
            description="Default network and per-service testnet / mainnet."
          />
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, detail }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-white p-4 dark:bg-[#0A0A0B]">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-3 truncate text-xl font-semibold text-zinc-950 dark:text-white">{value}</p>
      <p className="mt-1 truncate text-[11px] text-zinc-400">{detail}</p>
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
