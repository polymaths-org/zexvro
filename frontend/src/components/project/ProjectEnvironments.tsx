import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Plus, Trash2, ShieldCheck, Play, Radio, KeyRound } from 'lucide-react';
import { useProjectStore } from '../../stores/project';

type EnvVar = { key: string; value: string; isSecret: boolean };

export default function ProjectEnvironments() {
  const { projectId } = useParams({ strict: false });
  const projectStore = useProjectStore();
  const currentProject = projectStore.projects.find(p => p.id === projectId);

  const [envs, setEnvs] = useState([
    { id: 'dev', name: 'Development', branch: 'dev', status: 'online', logs: ['Server listening on port 8080', 'Database connected'] },
    { id: 'staging', name: 'Staging', branch: 'staging', status: 'online', logs: ['Build succeeded', 'Running tests...'] },
    { id: 'prod', name: 'Production', branch: 'main', status: 'online', logs: ['Traffic routing active', 'Health checks passing'] }
  ]);

  const [activeTab, setActiveTab] = useState<'dev' | 'staging' | 'prod'>('dev');
  const [envVars, setEnvVars] = useState<Record<string, EnvVar[]>>({
    dev: [
      { key: 'STELLAR_NETWORK', value: 'testnet', isSecret: false },
      { key: 'API_SECRET_KEY', value: 'sk_test_51Mz...', isSecret: true }
    ],
    staging: [
      { key: 'STELLAR_NETWORK', value: 'testnet', isSecret: false },
      { key: 'API_SECRET_KEY', value: 'sk_staging_921...', isSecret: true }
    ],
    prod: [
      { key: 'STELLAR_NETWORK', value: 'pubnet', isSecret: false },
      { key: 'API_SECRET_KEY', value: 'sk_live_839...', isSecret: true }
    ]
  });

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  if (!currentProject) return null;

  const currentTabVars = envVars[activeTab] || [];
  const currentEnv = envs.find(e => e.id === activeTab)!;

  const handleAddVar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    setEnvVars(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], { key: newKey.trim().toUpperCase(), value: newValue.trim(), isSecret }]
    }));
    setNewKey('');
    setNewValue('');
    setIsSecret(false);
  };

  const handleRemoveVar = (keyToRemove: string) => {
    setEnvVars(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter(v => v.key !== keyToRemove)
    }));
  };

  const triggerDeploy = () => {
    setProvisioning(true);
    setEnvs(prev => prev.map(e => e.id === activeTab ? { ...e, status: 'building' } : e));
    
    setTimeout(() => {
      setEnvs(prev => prev.map(e => e.id === activeTab ? { 
        ...e, 
        status: 'online',
        logs: [...e.logs, `[${new Date().toLocaleTimeString()}] Manual redeploy triggered`, 'Building assets...', 'Deploy complete. Ready.'] 
      } : e));
      setProvisioning(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Environments</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Provision and configure runtime settings for {currentProject.name}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        {envs.map(env => (
          <button
            key={env.id}
            onClick={() => setActiveTab(env.id as any)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px ${
              activeTab === env.id
                ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            {env.name}
            <span className={`ml-2 inline-flex h-1.5 w-1.5 rounded-full ${
              env.status === 'online' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`} />
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Environment Details & Config */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Runtime Settings</h2>
              <button
                onClick={triggerDeploy}
                disabled={provisioning}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
              >
                <Play className="h-3 w-3" />
                Redeploy
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider block">Target Network</span>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-1 flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-blue-500" />
                  {currentProject.network}
                </span>
              </div>
              <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider block">Branch Mapping</span>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-1">
                  <code>{currentEnv.branch}</code>
                </span>
              </div>
            </div>
          </div>

          {/* Env Variables List */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Environment Variables</h2>
            
            <form onSubmit={handleAddVar} className="grid gap-3 sm:grid-cols-4 mb-5">
              <input
                type="text"
                placeholder="KEY"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <input
                type="text"
                placeholder="VALUE"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isSecret}
                  onChange={e => setIsSecret(e.target.checked)}
                  className="rounded text-zinc-900 focus:ring-zinc-900 dark:text-white dark:focus:ring-white"
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Secret
                </span>
              </label>
              <button
                type="submit"
                className="h-9 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </form>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {currentTabVars.map(v => (
                <div key={v.key} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 dark:border-zinc-800/60 dark:bg-zinc-900/20">
                  <div className="min-w-0">
                    <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 block truncate">{v.key}</span>
                    <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      {v.isSecret ? (
                        <>
                          <KeyRound className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="tracking-widest">••••••••</span>
                        </>
                      ) : (
                        v.value
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveVar(v.key)}
                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {currentTabVars.length === 0 && (
                <div className="text-center py-6 text-xs text-zinc-400">
                  No environment variables defined.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deploy Logs */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809] flex flex-col">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Deployment Logs</h2>
          <div className="flex-1 rounded-lg bg-zinc-950 p-3 font-mono text-[10px] leading-relaxed text-zinc-400 overflow-y-auto max-h-[400px]">
            {currentEnv.logs.map((log, idx) => (
              <div key={idx} className="truncate select-text">
                <span className="text-zinc-600">[{idx + 1}]</span> {log}
              </div>
            ))}
            {currentEnv.status === 'building' && (
              <div className="text-amber-500 animate-pulse mt-1">
                ⚙ Building deployment snapshot...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
