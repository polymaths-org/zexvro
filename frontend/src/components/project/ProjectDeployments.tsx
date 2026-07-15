import { useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Rocket, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { useProjectStore } from '../../stores/project';
import type { DeploymentStatus } from '../../stores/types';

const STATUS_CLASS: Record<DeploymentStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  building: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  deploying: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  live: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  cancelled: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400',
};

export default function ProjectDeployments() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const projectStore = useProjectStore();
  const currentProject = projectStore.projects.find(project => project.id === projectId);
  const environments = useMemo(
    () => projectStore.environments.filter(env => env.projectId === projectId),
    [projectStore.environments, projectId],
  );
  const deployments = useMemo(
    () => projectStore.deployments.filter(deployment => deployment.projectId === projectId),
    [projectStore.deployments, projectId],
  );

  const [commitHash, setCommitHash] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [environmentId, setEnvironmentId] = useState('');
  const [error, setError] = useState('');

  if (!currentProject || !workspaceId || !projectId) return null;

  const selectedEnvironmentId = environmentId || environments[0]?.id || '';

  const requestDeployment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEnvironmentId) {
      setError('Create an environment before requesting a deployment.');
      return;
    }
    if (!commitHash.trim()) {
      setError('Enter the commit hash to deploy.');
      return;
    }
    setError('');
    projectStore.createDeployment({
      projectId,
      workspaceId,
      environmentId: selectedEnvironmentId,
      serviceInstanceId: '',
      status: 'pending',
      commitHash: commitHash.trim(),
      commitMessage: commitMessage.trim() || 'Manual deployment request',
      author: currentProject.owner,
    });
    setCommitHash('');
    setCommitMessage('');
  };

  const updateStatus = (id: string, status: DeploymentStatus) => {
    projectStore.updateDeployment(id, { status, duration: status === 'live' ? 0 : null });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Deployments</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Deployment requests and build statuses for {currentProject.name}.
          </p>
        </div>
      </div>

      <form onSubmit={requestDeployment} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
        <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr_1fr_auto]">
          <input
            value={commitHash}
            onChange={event => setCommitHash(event.target.value)}
            placeholder="Commit hash"
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 font-mono text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <input
            value={commitMessage}
            onChange={event => setCommitMessage(event.target.value)}
            placeholder="Commit message"
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <select
            value={selectedEnvironmentId}
            onChange={event => setEnvironmentId(event.target.value)}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {environments.length === 0 ? (
              <option value="">No environments</option>
            ) : environments.map(env => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>
          <button className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
            <Rocket className="h-3.5 w-3.5" />
            Request
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}
      </form>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Build History</h2>
        </div>

        {deployments.length === 0 ? (
          <div className="p-12 text-center">
            <Rocket className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No deployments yet</h3>
            <p className="mt-1 text-xs text-zinc-500">Deployment records will appear after you request one or connect a build runner.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {deployments.map(deployment => {
              const env = environments.find(item => item.id === deployment.environmentId);
              return (
                <div key={deployment.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${STATUS_CLASS[deployment.status]}`}>
                        <RefreshCw className={`h-4 w-4 ${deployment.status === 'building' || deployment.status === 'deploying' ? 'animate-spin' : ''}`} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{deployment.commitMessage}</p>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-850 dark:text-zinc-400">{deployment.commitHash}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-400">
                          <span className="font-semibold text-zinc-500">{env?.name || 'Unknown environment'}</span>
                          <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                          <span>{currentProject.branch || 'main'}</span>
                          <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(deployment.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[deployment.status]}`}>
                      {deployment.status}
                    </span>
                    {(['building', 'deploying', 'live', 'failed', 'cancelled'] as DeploymentStatus[]).map(status => (
                      <button
                        key={status}
                        onClick={() => updateStatus(deployment.id, status)}
                        className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
