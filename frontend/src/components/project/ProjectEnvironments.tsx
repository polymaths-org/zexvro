import { useEffect, useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Plus, Trash2, ShieldCheck, Radio, KeyRound } from 'lucide-react';
import { useProjectStore } from '../../stores/project';
import type { Environment } from '../../stores/types';

type EnvVar = { key: string; value: string; isSecret: boolean };

export default function ProjectEnvironments() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const projectStore = useProjectStore();
  const currentProject = projectStore.projects.find(p => p.id === projectId);
  const environments = useMemo(
    () => projectStore.environments.filter(env => env.projectId === projectId),
    [projectStore.environments, projectId],
  );

  const [activeEnvId, setActiveEnvId] = useState('');
  const [envVars, setEnvVars] = useState<Record<string, EnvVar[]>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvType, setNewEnvType] = useState<Environment['type']>('development');

  useEffect(() => {
    if (!activeEnvId && environments[0]) {
      setActiveEnvId(environments[0].id);
    }
  }, [activeEnvId, environments]);

  if (!currentProject || !workspaceId || !projectId) return null;

  const activeEnv = environments.find(env => env.id === activeEnvId) || environments[0] || null;
  const currentTabVars = activeEnv ? envVars[activeEnv.id] || [] : [];

  const handleAddEnvironment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newEnvName.trim()) return;
    const env = projectStore.createEnvironment({
      projectId,
      workspaceId,
      name: newEnvName.trim(),
      type: newEnvType,
      network: currentProject.network,
    });
    setActiveEnvId(env.id);
    setNewEnvName('');
    setNewEnvType('development');
  };

  const handleAddVar = (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeEnv || !newKey.trim() || !newValue.trim()) return;

    setEnvVars(prev => ({
      ...prev,
      [activeEnv.id]: [...(prev[activeEnv.id] || []), { key: newKey.trim().toUpperCase(), value: newValue.trim(), isSecret }],
    }));
    setNewKey('');
    setNewValue('');
    setIsSecret(false);
  };

  const handleRemoveVar = (keyToRemove: string) => {
    if (!activeEnv) return;
    setEnvVars(prev => ({
      ...prev,
      [activeEnv.id]: (prev[activeEnv.id] || []).filter(item => item.key !== keyToRemove),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Environments</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Configure runtime environments and variables for {currentProject.name}.
          </p>
        </div>
        <form onSubmit={handleAddEnvironment} className="flex flex-wrap gap-2">
          <input
            value={newEnvName}
            onChange={event => setNewEnvName(event.target.value)}
            placeholder="Environment name"
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <select
            value={newEnvType}
            onChange={event => setNewEnvType(event.target.value as Environment['type'])}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </form>
      </div>

      {environments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-[#080809]">
          <Radio className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No environments configured</h3>
          <p className="mt-1 text-xs text-zinc-500">Add an environment to start configuring runtime variables.</p>
        </div>
      ) : (
        <>
          <div className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
            {environments.map(env => (
              <button
                key={env.id}
                onClick={() => setActiveEnvId(env.id)}
                className={`shrink-0 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px ${
                  activeEnv?.id === env.id
                    ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                {env.name}
                <span className="ml-2 text-[10px] font-medium text-zinc-400">{env.type}</span>
              </button>
            ))}
          </div>

          {activeEnv && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
                  <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Runtime Settings</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Info label="Target Network" value={activeEnv.network || currentProject.network} />
                    <Info label="Environment Type" value={activeEnv.type} />
                    <Info label="Created" value={new Date(activeEnv.createdAt).toLocaleDateString()} />
                    <Info label="Project Branch" value={currentProject.branch || 'main'} />
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
                  <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Environment Variables</h2>
                  <form onSubmit={handleAddVar} className="grid gap-3 sm:grid-cols-4 mb-5">
                    <input value={newKey} onChange={event => setNewKey(event.target.value)} placeholder="KEY" className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
                    <input value={newValue} onChange={event => setNewValue(event.target.value)} placeholder="VALUE" className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={isSecret} onChange={event => setIsSecret(event.target.checked)} className="rounded text-zinc-900 focus:ring-zinc-900 dark:text-white dark:focus:ring-white" />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Secret
                      </span>
                    </label>
                    <button type="submit" className="h-9 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </form>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {currentTabVars.map(item => (
                      <div key={item.key} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 dark:border-zinc-800/60 dark:bg-zinc-900/20">
                        <div className="min-w-0">
                          <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 block truncate">{item.key}</span>
                          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                            {item.isSecret ? <><KeyRound className="h-3 w-3 text-amber-500 shrink-0" /><span className="tracking-widest">hidden</span></> : item.value}
                          </span>
                        </div>
                        <button onClick={() => handleRemoveVar(item.key)} className="p-1 text-zinc-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {currentTabVars.length === 0 && <div className="text-center py-6 text-xs text-zinc-400">No environment variables defined.</div>}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
                <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Deployment Logs</h2>
                <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
                  Logs will appear after a deployment runner reports output for this environment.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider block">{label}</span>
      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-1 flex items-center gap-1.5">
        <Radio className="h-3.5 w-3.5 text-blue-500" />
        {value}
      </span>
    </div>
  );
}
