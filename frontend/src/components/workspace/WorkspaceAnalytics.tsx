import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { BarChart3, TrendingUp, Cpu, HardDrive, Globe, RefreshCw } from 'lucide-react';

export default function WorkspaceAnalytics() {
  const { workspaceId } = useParams({ strict: false });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRange, setSelectedRange] = useState<'24h' | '7d' | '30d'>('7d');

  const triggerRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const barData = {
    '24h': [25, 45, 60, 30, 80, 95, 40],
    '7d': [45, 75, 55, 90, 65, 85, 110],
    '30d': [90, 80, 120, 110, 130, 150, 160]
  };

  const currentBars = barData[selectedRange];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Resource usage metrics and platform throughput overview for workspace: {workspaceId}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            {(['24h', '7d', '30d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  selectedRange === range
                    ? 'bg-zinc-150 text-zinc-900 dark:bg-zinc-800 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={triggerRefresh}
            className="p-2 border border-zinc-200 bg-white rounded-lg hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-500 transition"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active ZK proof cycles', value: '48,901', desc: '+12.4% vs last period', icon: TrendingUp, color: 'text-blue-500' },
          { label: 'Total Node CPU Time', value: '1.42 hrs', desc: '0.04% average cluster load', icon: Cpu, color: 'text-emerald-500' },
          { label: 'Shielded State Memory', value: '4.19 GB', desc: 'Out of 8 GB pool size', icon: HardDrive, color: 'text-indigo-500' },
          { label: 'Network Bandwidth', value: '109 GB', desc: 'Egress traffic total', icon: Globe, color: 'text-amber-500' }
        ].map((stat, idx) => (
          <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{stat.label}</span>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <p className="mt-2.5 text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{stat.value}</p>
            <p className="mt-1 text-xs text-zinc-400">{stat.desc}</p>
          </div>
        ))}
      </div>

      {/* SVG Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Transaction Logs Throughput</h2>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span>Soroban contract calls / min</span>
            </div>
          </div>

          {/* Bar Chart Representation using CSS/SVG */}
          <div className="flex-1 min-h-[220px] flex items-end justify-between gap-4 pt-6">
            {currentBars.map((val, idx) => {
              const heightPct = Math.round((val / 160) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                  <div className="w-full relative bg-zinc-100 dark:bg-zinc-850/80 rounded-t-lg h-[180px] flex items-end overflow-hidden">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-gradient-to-t from-blue-650 to-blue-500 group-hover:to-blue-400 transition-all duration-500 rounded-t-lg relative"
                    >
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] font-mono rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {val}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-semibold font-mono">Day {idx + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809] flex flex-col">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Storage Allocation</h2>
          <div className="flex-1 flex flex-col justify-center items-center">
            {/* SVG Circle Graph */}
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-zinc-100 dark:text-zinc-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-blue-500"
                  strokeWidth="3.5"
                  strokeDasharray="75, 100"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-zinc-900 dark:text-white">75%</span>
                <span className="text-[9px] text-zinc-400 font-semibold tracking-wider">USED</span>
              </div>
            </div>

            <div className="mt-6 space-y-2 w-full text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Active Registry Data</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">3.14 GB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-zinc-200 dark:bg-zinc-700" /> Free Memory</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">1.05 GB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
