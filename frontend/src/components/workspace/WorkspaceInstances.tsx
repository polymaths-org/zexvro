import { useState } from 'react';
import { Radio, Power, Cpu, RefreshCw } from 'lucide-react';

type Instance = {
  id: string;
  name: string;
  project: string;
  status: 'running' | 'stopped';
  cpu: string;
  ram: string;
  uptime: string;
};

export default function WorkspaceInstances() {
  const [instances, setInstances] = useState<Instance[]>([
    { id: 'inst-1', name: 'Proving Node Alpha', project: 'Zer0 Privacy Pool', status: 'running', cpu: '12%', ram: '1.2 GB / 2 GB', uptime: '10d 4h' },
    { id: 'inst-2', name: 'Transformation Agent Runner', project: 'Migration Sync', status: 'running', cpu: '2%', ram: '0.4 GB / 2 GB', uptime: '1d 12h' },
    { id: 'inst-3', name: 'Trade Negotiation Node', project: 'Arbitrage Pipeline', status: 'stopped', cpu: '0%', ram: '0 GB / 2 GB', uptime: '-' }
  ]);

  const toggleInstance = (id: string) => {
    setInstances(prev => prev.map(inst => {
      if (inst.id === id) {
        const isRunning = inst.status === 'running';
        return {
          ...inst,
          status: isRunning ? 'stopped' : 'running',
          cpu: isRunning ? '0%' : '1%',
          uptime: isRunning ? '-' : 'Just started'
        };
      }
      return inst;
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Instances</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Monitor proving nodes, automated background agents, and transformation runners.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {instances.map(inst => (
          <div key={inst.id} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809] flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{inst.name}</h2>
                  <span className="text-[10px] text-zinc-450 uppercase tracking-wider mt-0.5 block">{inst.project}</span>
                </div>

                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  inst.status === 'running' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${inst.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                  {inst.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 text-xs">
                <div>
                  <span className="text-zinc-400 block uppercase text-[9px] tracking-wider">CPU Usage</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 mt-0.5">
                    <Cpu className="h-3.5 w-3.5 text-zinc-400" />
                    {inst.cpu}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block uppercase text-[9px] tracking-wider">RAM Usage</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 mt-0.5">
                    <Radio className="h-3.5 w-3.5 text-zinc-400" />
                    {inst.ram}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-850 mt-6 pt-4 flex items-center justify-between">
              <span className="text-[10px] text-zinc-400">Uptime: {inst.uptime}</span>

              <button
                onClick={() => toggleInstance(inst.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  inst.status === 'running'
                    ? 'border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-950/20'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
                }`}
              >
                <Power className="h-3.5 w-3.5" />
                {inst.status === 'running' ? 'Shutdown' : 'Startup'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
