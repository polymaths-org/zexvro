import { useState } from 'react';
import { Database, Plus, RefreshCw, Trash2, Cpu, HardDrive } from 'lucide-react';

type NodeDevice = {
  id: string;
  name: string;
  ip: string;
  storageAllocated: string;
  trafficServed: string;
  status: 'active' | 'offline';
};

export default function DepinService() {
  const [nodes, setNodes] = useState<NodeDevice[]>([
    { id: 'node-1', name: 'US-East Storage Node', ip: '108.92.12.11', storageAllocated: '450 GB', trafficServed: '1.2 TB', status: 'active' },
    { id: 'node-2', name: 'EU-West Prover Node', ip: '190.22.84.101', storageAllocated: '120 GB', trafficServed: '420 GB', status: 'active' }
  ]);

  const [loading, setLoading] = useState(false);

  const simulateNewNode = () => {
    setLoading(true);
    setTimeout(() => {
      const newNode: NodeDevice = {
        id: `node-${Date.now()}`,
        name: `APAC Prover Node-${Math.floor(Math.random() * 100)}`,
        ip: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.44.12`,
        storageAllocated: '200 GB',
        trafficServed: '0 GB',
        status: 'active'
      };
      setNodes(prev => [...prev, newNode]);
      setLoading(false);
    }, 1500);
  };

  const deleteNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">De-pin Service</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Connect hardware devices, distribute storage workloads, and track bandwidth revenue shares.
          </p>
        </div>

        <button
          onClick={simulateNewNode}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Register Node
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Device Registries</h2>
          <div className="space-y-3">
            {nodes.map(node => (
              <div key={node.id} className="p-3.5 border border-zinc-100 dark:border-zinc-850 rounded-lg flex items-center justify-between gap-4 bg-zinc-50/20 dark:bg-zinc-900/10">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{node.name}</span>
                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono">{node.ip}</span>
                  </div>

                  <div className="mt-1.5 text-[11px] text-zinc-400 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><HardDrive className="h-3.5 w-3.5 text-zinc-400" /> {node.storageAllocated}</span>
                    <span className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5 text-zinc-400" /> {node.trafficServed}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    node.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {node.status}
                  </span>

                  <button
                    onClick={() => deleteNode(node.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry info */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809] flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">De-pin Network Summary</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-450">Active Providers</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-bold">{nodes.length} nodes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-450">Aggregated Storage</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-bold">
                  {nodes.reduce((acc, curr) => acc + parseInt(curr.storageAllocated), 0)} GB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-450">Validation Consensus</span>
                <span className="text-green-500 font-semibold">99.8% Sync</span>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-100 dark:border-zinc-850 pt-4 text-[11px] text-zinc-400">
            Hardware node registration executes a smart-contract locking proof-of-space to ensure valid capacity.
          </div>
        </div>
      </div>
    </div>
  );
}
