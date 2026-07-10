import { useParams, Link } from '@tanstack/react-router';
import { Rocket, CheckCircle, Clock } from 'lucide-react';
import { useProjectStore } from '../../stores/project';

export default function WorkspaceDeployments() {
  const { workspaceId } = useParams({ strict: false });
  const projectStore = useProjectStore();
  const projects = projectStore.projects;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Deployments</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Aggregated view of active deployments, branch environments, and project frameworks.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Active Deployments</h2>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {projects.map(project => (
            <div key={project.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                    <CheckCircle className="h-4 w-4" />
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/dashboard/w/${workspaceId}/p/${project.id}/overview`}
                        className="text-sm font-semibold text-zinc-900 hover:underline dark:text-white"
                      >
                        {project.name}
                      </Link>
                      <span className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-850 px-1.5 py-0.5 rounded text-zinc-500">
                        {project.framework}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-450">
                      <span className="font-semibold text-zinc-500">{project.network}</span>
                      <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      <span>{project.branch || 'main'}</span>
                      <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Active for 2 hours</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-11 sm:ml-0">
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  active
                </span>
                <Link
                  to={`/dashboard/w/${workspaceId}/p/${project.id}/deployments`}
                  className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Manage
                </Link>
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="text-center py-12 text-zinc-400 text-xs">
              No projects found in this workspace. Create one to trigger deployments.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
