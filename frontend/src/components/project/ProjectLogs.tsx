import { useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Terminal, Trash2 } from 'lucide-react';
import { useProjectStore } from '../../stores/project';
import type { DeploymentStatus } from '../../stores/types';

type LogLine = {
  createdAt: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};

type LogFilter = 'all' | 'info' | 'warn' | 'error';

const statusLevel: Record<DeploymentStatus, LogLine['level']> = {
  pending: 'info',
  building: 'info',
  deploying: 'info',
  live: 'info',
  failed: 'error',
  cancelled: 'warn',
};

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function ProjectLogs() {
  const { projectId } = useParams({ strict: false });
  const projectStore = useProjectStore();
  const currentProject = projectStore.projects.find(p => p.id === projectId);

  const [clearedAt, setClearedAt] = useState(0);
  const [filterLevel, setFilterLevel] = useState<LogFilter>('all');

  const deploymentLogs = useMemo<LogLine[]>(() => {
    const environmentsById = new Map(projectStore.environments.map(env => [env.id, env.name]));

    return projectStore.deployments
      .filter(deployment => deployment.projectId === projectId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(deployment => {
        const environmentName = environmentsById.get(deployment.environmentId) || 'unassigned environment';
        const commit = deployment.commitHash ? ` at ${deployment.commitHash}` : '';
        const message = deployment.commitMessage ? `: ${deployment.commitMessage}` : '';

        return {
          createdAt: deployment.createdAt,
          timestamp: formatTime(deployment.createdAt),
          level: statusLevel[deployment.status],
          message: `Deployment ${deployment.status} for ${environmentName}${commit}${message}`,
        };
      });
  }, [projectId, projectStore.deployments, projectStore.environments]);

  if (!currentProject) return null;

  const filteredLogs = deploymentLogs.filter(log => {
    if (log.createdAt <= clearedAt) return false;
    if (filterLevel === 'all') return true;
    return log.level === filterLevel;
  });

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-140px)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Project Logs</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Deployment events and runner output for {currentProject.name}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value as LogFilter)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>

          <button
            onClick={() => setClearedAt(Date.now())}
            className="inline-flex items-center gap-1.5 h-8 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-650 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-850"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>

      <div className="flex-1 rounded-xl bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-350 overflow-y-auto flex flex-col border border-zinc-900 shadow-inner">
        <div className="flex items-center gap-2 text-zinc-500 border-b border-zinc-900 pb-2 mb-3">
          <Terminal className="h-4 w-4" />
          <span>DEPLOYMENT EVENT STREAM ({currentProject.name})</span>
        </div>
        
        <div className="flex-1 space-y-1">
          {filteredLogs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-3 hover:bg-zinc-900/40 p-0.5 rounded transition-all">
              <span className="text-zinc-600 select-none shrink-0">{log.timestamp}</span>
              <span className={`uppercase font-bold text-[9px] px-1 rounded shrink-0 select-none ${
                log.level === 'info' ? 'bg-zinc-800 text-zinc-400' :
                log.level === 'warn' ? 'bg-amber-500/20 text-amber-500' :
                'bg-red-500/20 text-red-500'
              }`}>
                {log.level}
              </span>
              <span className="text-zinc-300 select-text break-all">{log.message}</span>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-zinc-600">
              {deploymentLogs.length === 0 ? 'No deployment logs yet.' : 'No logs match the selected filter.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
