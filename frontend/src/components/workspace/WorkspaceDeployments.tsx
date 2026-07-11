import { useParams, Link } from '@tanstack/react-router';
import { Rocket, Clock } from 'lucide-react';
import { useProjectStore } from '../../stores/project';

export default function WorkspaceDeployments() {
  const { workspaceId } = useParams({ strict: false });
  const projectStore = useProjectStore();
  const projects = projectStore.projects.filter(project => project.workspaceId === workspaceId);
  const deployments = projectStore.deployments.filter(deployment => deployment.workspaceId === workspaceId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Deployments</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Aggregated deployment records across workspace projects.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Deployment History</h2>
        </div>

        {deployments.length === 0 ? (
          <div className="p-12 text-center">
            <Rocket className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No deployments yet</h3>
            <p className="mt-1 text-xs text-zinc-500">Request a project deployment to populate this view.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {deployments.map(deployment => {
              const project = projects.find(item => item.id === deployment.projectId);
              return (
                <div key={deployment.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-850">
                        <Rocket className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {project && workspaceId ? (
                            <Link to={`/dashboard/w/${workspaceId}/p/${project.id}/deployments`} className="text-sm font-semibold text-zinc-900 hover:underline dark:text-white">
                              {project.name}
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold text-zinc-900 dark:text-white">{deployment.projectId}</span>
                          )}
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-850">
                            {deployment.commitHash}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-450">
                          <span>{deployment.commitMessage}</span>
                          <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(deployment.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-850 dark:text-zinc-300">
                    {deployment.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
