import { useParams, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { FolderKanban, Users, Blocks, Rocket, Settings, CheckCircle2, Circle, Clock } from 'lucide-react';
import { useProjectStore } from '../../stores/project';
import { mockServices } from '../../data/mock';

export default function ProjectOverview() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const project = useProjectStore(s => s.projects.find(p => p.id === projectId));
  const allEnvironments = useProjectStore(s => s.environments);
  const allInstances = useProjectStore(s => s.serviceInstances);
  const environments = useMemo(
    () => allEnvironments.filter(e => e.projectId === projectId),
    [allEnvironments, projectId],
  );
  const instances = useMemo(
    () => allInstances.filter(i => i.projectId === projectId),
    [allInstances, projectId],
  );

  const goTo = (path: string) => navigate({ to: path });

  if (!project) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-[#080809]">
        <FolderKanban className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
        <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">Project not found</h3>
        <p className="mt-1 text-xs text-zinc-500">This project may have been deleted or you don't have access.</p>
        {workspaceId && (
          <button onClick={() => goTo(`/dashboard/w/${workspaceId}/projects`)} className="mt-4 inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            Back to Projects
          </button>
        )}
      </div>
    );
  }

  const setupItems = [
    { label: 'Project created', done: true },
    { label: 'Environment configured', done: environments.length > 0 },
    { label: 'Service added', done: instances.length > 0 },
    { label: 'Team member invited', done: false },
  ];

  const completedCount = setupItems.filter(i => i.done).length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">{project.name}</h1>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                project.lifecycle === 'active' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                project.lifecycle === 'paused' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
              }`}>
                {project.lifecycle}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                project.health === 'healthy' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                project.health === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                {project.health.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{project.description || 'No description'}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
              <span>{project.framework}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <span>{project.network}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <span>{project.branch}</span>
            </div>
          </div>
          {workspaceId && projectId && (
            <button
              onClick={() => goTo(`/dashboard/w/${workspaceId}/p/${projectId}/settings`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Setup Checklist</h2>
          <span className="text-xs text-zinc-400">{completedCount}/{setupItems.length}</span>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {setupItems.map(item => (
            <div key={item.label} className="flex items-center gap-3 px-5 py-3">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-zinc-300 dark:text-zinc-600 shrink-0" />
              )}
              <span className={`text-sm ${item.done ? 'text-zinc-500' : 'text-zinc-900 dark:text-white font-medium'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {workspaceId && projectId && (
          <>
            <QuickAction
              onClick={() => goTo(`/dashboard/w/${workspaceId}/p/${projectId}/services`)}
              icon={<Blocks className="h-5 w-5" />}
              title="Add Service"
              description="Install a service into this project"
            />
            <QuickAction
              onClick={() => goTo(`/dashboard/w/${workspaceId}/p/${projectId}/members`)}
              icon={<Users className="h-5 w-5" />}
              title="Invite Member"
              description="Add team members to this project"
            />
            <QuickAction
              onClick={() => goTo(`/dashboard/w/${workspaceId}/p/${projectId}/environments`)}
              icon={<Rocket className="h-5 w-5" />}
              title="Environments"
              description="Configure dev, staging, and production"
            />
            <QuickAction
              onClick={() => goTo(`/dashboard/w/${workspaceId}/p/${projectId}/deployments`)}
              icon={<Clock className="h-5 w-5" />}
              title="Deployments"
              description="View deployment history"
            />
          </>
        )}
      </div>

      {instances.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
          <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Service Instances</h2>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {instances.map(instance => {
              const service = mockServices.find(s => s.id === instance.serviceId);
              return (
                <div key={instance.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{instance.name}</p>
                    <p className="text-xs text-zinc-500">{service?.name || instance.serviceId}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    instance.status === 'active' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                    instance.status === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                    'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    {instance.status.replace('_', ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
      className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50 w-full"
    >
      <span className="inline-flex items-center justify-center rounded-md bg-zinc-100 p-2 text-zinc-500 group-hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:text-white transition-colors">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">{title}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
    </button>
  );
}
