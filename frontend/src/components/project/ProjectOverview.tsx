import { useParams, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Blocks, FolderKanban, Play, Settings, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useProjectStore } from '../../stores/project';
import { useWorkspaceStore } from '../../stores/workspace';
import { useZer0Store } from '../../stores/zer0';
import { serviceCatalog } from '../../data/serviceCatalog';

function statusLabel(value: string) {
  return value.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export default function ProjectOverview() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const project = useProjectStore(s => s.projects.find(p => p.id === projectId));
  const allInstances = useProjectStore(s => s.serviceInstances);
  const workspace = useWorkspaceStore(s => s.workspaces.find(item => item.id === workspaceId));
  const zer0Pool = useZer0Store(s => s.pool);
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
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-[#080809]">
        <FolderKanban className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
        <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">Project not found</h3>
        <p className="mt-1 text-xs text-zinc-500">This customer project may have been removed or is outside your workspace access.</p>
        {workspaceId && (
          <button onClick={() => goTo(`/dashboard/w/${workspaceId}/projects`)} className="mt-4 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Back to Projects
          </button>
        )}
      </div>
    );
  }

  const enabledServices = project.enabledServices || [];
  const activeServices = serviceCatalog.filter(service => enabledServices.includes(service.id));
  const serviceRows = serviceCatalog.map(service => {
    const instance = instances.find(item => item.serviceId === service.id);
    const enabled = enabledServices.includes(service.id);
    const status = instance?.status || (enabled ? 'needs_configuration' : 'disabled');
    return { service, status };
  });

  const zkTvl = Object.values(zer0Pool.balances).reduce((sum, value) => sum + Number(value || 0), 0);
  const configuredServices = instances.filter(instance => ['ready', 'active'].includes(instance.status)).length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">{project.name}</h1>
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {statusLabel(project.lifecycle)}
              </span>
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                {statusLabel(project.health)}
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
              {project.description || 'Configure Web3 services and agent runs for this customer migration project.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              <span>{project.network}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <span>{project.branch}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <span>{activeServices.length} enabled services</span>
            </div>
          </div>
          {workspaceId && projectId && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => goTo(`/dashboard/w/${workspaceId}/p/${projectId}/executions`)}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
              >
                <Play className="h-3.5 w-3.5" />
                Run Execution
              </button>
              <button
                onClick={() => goTo(`/dashboard/w/${workspaceId}/p/${projectId}/settings`)}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Wallet className="h-4 w-4" />} label="ZK Pool TVL" value={`${zkTvl.toLocaleString()} total`} detail="USDC, XLM, and EURC balances" />
        <Metric icon={<Blocks className="h-4 w-4" />} label="Enabled Services" value={String(activeServices.length)} detail="Configured for this customer project" />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Ready Services" value={String(configuredServices)} detail="Ready or active Web3 services" />
        <Metric icon={<Users className="h-4 w-4" />} label="Payees" value={String(zer0Employees.length)} detail={`${workspace?.members.length || 0} workspace members`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
          <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Web3 Service Status</h2>
            <p className="mt-0.5 text-xs text-zinc-500">The six ZEXVRO services available for Web2-to-Web3 migration work.</p>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {serviceRows.map(({ service, status }) => (
              <div key={service.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{service.name}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{service.description}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  status === 'active' || status === 'ready'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : status === 'disabled'
                      ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  {statusLabel(status)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <QuickAction
            onClick={() => workspaceId && projectId && goTo(`/dashboard/w/${workspaceId}/p/${projectId}/services`)}
            icon={<Blocks className="h-5 w-5" />}
            title="Services Manager"
            description="Enable privacy pools, Morph, A-2-A trade, agent auth, NFT, or De-pin services."
          />
          <QuickAction
            onClick={() => workspaceId && projectId && goTo(`/dashboard/w/${workspaceId}/p/${projectId}/executions`)}
            icon={<Play className="h-5 w-5" />}
            title="Executions & Runs"
            description="Trigger agent and Web3 service runs for this customer project."
          />
          <QuickAction
            onClick={() => workspaceId && projectId && goTo(`/dashboard/w/${workspaceId}/p/${projectId}/zer0/payroll`)}
            icon={<Wallet className="h-5 w-5" />}
            title="Zer0 Payroll"
            description="Manage payroll runs, payees, roles, departments, and payment history."
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
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#080809]">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-3 truncate text-xl font-semibold text-zinc-900 dark:text-white">{value}</p>
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
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
    >
      <span className="inline-flex items-center justify-center rounded-md bg-zinc-100 p-2 text-zinc-500 transition group-hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:text-white">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
    </button>
  );
}
