import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Rocket, Clock, RefreshCw, CheckCircle, AlertCircle, ArrowLeftRight } from 'lucide-react';
import { useProjectStore } from '../../stores/project';

type DeployItem = {
  id: string;
  commitSha: string;
  commitMsg: string;
  branch: string;
  trigger: string;
  status: 'success' | 'failed' | 'building';
  time: string;
  env: string;
};

export default function ProjectDeployments() {
  const { projectId } = useParams({ strict: false });
  const projectStore = useProjectStore();
  const currentProject = projectStore.projects.find(p => p.id === projectId);

  const [deploys, setDeploys] = useState<DeployItem[]>([
    { id: 'dep-1', commitSha: 'a29f81d', commitMsg: 'feat: add zero-knowledge proof verifier bindings', branch: 'main', trigger: 'git push', status: 'success', time: '10 minutes ago', env: 'Production' },
    { id: 'dep-2', commitSha: 'e98cf21', commitMsg: 'fix: address encryption decrypt view-key overflow', branch: 'main', trigger: 'git push', status: 'success', time: '1 hour ago', env: 'Staging' },
    { id: 'dep-3', commitSha: '7f91ba5', commitMsg: 'chore: configure stellar testnet connection configurations', branch: 'dev', trigger: 'manual play', status: 'success', time: '4 hours ago', env: 'Development' },
    { id: 'dep-4', commitSha: '2d8bf42', commitMsg: 'refactor: split sidebar component modularly', branch: 'dev', trigger: 'git push', status: 'failed', time: '1 day ago', env: 'Development' }
  ]);

  const [building, setBuilding] = useState(false);

  if (!currentProject) return null;

  const triggerManualDeploy = () => {
    if (building) return;
    setBuilding(true);
    
    const newDeploy: DeployItem = {
      id: `dep-${Date.now()}`,
      commitSha: Math.random().toString(16).slice(2, 9),
      commitMsg: 'manual: trigger manual cluster deployment rebuild',
      branch: currentProject.branch || 'main',
      trigger: 'manual play',
      status: 'building',
      time: 'Just now',
      env: 'Development'
    };

    setDeploys(prev => [newDeploy, ...prev]);

    setTimeout(() => {
      setDeploys(prev => prev.map(d => d.id === newDeploy.id ? { ...d, status: 'success' } : d));
      setBuilding(false);
    }, 2500);
  };

  const handleRollback = (deployId: string) => {
    alert(`Initiating rollback to deployment ${deployId}...`);
    // Simulated state shift
    setDeploys(prev => prev.map(d => d.id === deployId ? { ...d, time: 'Rolled back to just now' } : d));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Deployments</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Build logs and deployment versions for {currentProject.name}
          </p>
        </div>
        <button
          onClick={triggerManualDeploy}
          disabled={building}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
        >
          {building ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
          Deploy Commit
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Build History</h2>
        </div>
        
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {deploys.map(deploy => (
            <div key={deploy.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    deploy.status === 'success' ? 'bg-green-500/10 text-green-500' :
                    deploy.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                    'bg-amber-500/10 text-amber-500 animate-pulse'
                  }`}>
                    {deploy.status === 'success' && <CheckCircle className="h-4 w-4" />}
                    {deploy.status === 'failed' && <AlertCircle className="h-4 w-4" />}
                    {deploy.status === 'building' && <RefreshCw className="h-4 w-4 animate-spin" />}
                  </span>
                  
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{deploy.commitMsg}</p>
                      <span className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-850 px-1.5 py-0.5 rounded text-zinc-500 dark:text-zinc-400">
                        {deploy.commitSha}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
                      <span className="font-semibold text-zinc-500">{deploy.env}</span>
                      <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      <span>{deploy.branch}</span>
                      <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {deploy.time}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-11 sm:ml-0">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  deploy.status === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                  deploy.status === 'failed' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  {deploy.status}
                </span>

                {deploy.status === 'success' && (
                  <button
                    onClick={() => handleRollback(deploy.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <ArrowLeftRight className="h-3 w-3" /> Rollback
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
