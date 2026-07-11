import { useParams } from '@tanstack/react-router';
import { Radio, Power, Cpu } from 'lucide-react';
import { useProjectStore } from '../../stores/project';

export default function WorkspaceInstances() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const projectStore = useProjectStore();
  const instances = projectStore.serviceInstances.filter(instance =>
    projectId ? instance.projectId === projectId : instance.workspaceId === workspaceId
  );
  const projects = projectStore.projects;

  const toggleInstance = (id: string) => {
    const instance = projectStore.serviceInstances.find(item => item.id === id);
    if (!instance) return;
    projectStore.updateServiceInstance(id, {
      status: instance.status === 'active' ? 'disabled' : 'active',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Instances</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Service instances configured from your actual projects.
        </p>
      </div>

      {instances.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-[#080809]">
          <Cpu className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No service instances</h3>
          <p className="mt-1 text-xs text-zinc-500">Create a project with services enabled to see instances here.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {instances.map(instance => {
            const project = projects.find(item => item.id === instance.projectId);
            return (
              <div key={instance.id} className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{instance.name}</h2>
                      <span className="mt-0.5 block truncate text-[10px] uppercase tracking-wider text-zinc-450">{project?.name || instance.projectId}</span>
                    </div>

                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      instance.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${instance.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                      {instance.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="block text-[9px] uppercase tracking-wider text-zinc-400">Service</span>
                      <span className="mt-0.5 flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                        <Cpu className="h-3.5 w-3.5 text-zinc-400" />
                        {instance.serviceId}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase tracking-wider text-zinc-400">Environment</span>
                      <span className="mt-0.5 flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                        <Radio className="h-3.5 w-3.5 text-zinc-400" />
                        {instance.environmentId}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-850">
                  <span className="text-[10px] text-zinc-400">Updated {new Date(instance.updatedAt).toLocaleDateString()}</span>
                  <button
                    onClick={() => toggleInstance(instance.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      instance.status === 'active'
                        ? 'border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-950/20'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {instance.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
