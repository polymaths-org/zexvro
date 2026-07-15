import { useState } from 'react';
import { ShieldCheck, UserCheck, ShieldAlert, KeyRound } from 'lucide-react';

type AuthLog = {
  id: string;
  agent: string;
  action: string;
  status: 'passed' | 'challenged' | 'rejected';
  time: string;
  ip: string;
};

export default function AgentAuth() {
  const [logs, setLogs] = useState<AuthLog[]>([
    { id: 'al-1', agent: 'MarketMaker-Stellar', action: 'Ledger Query Token', status: 'passed', time: '2 minutes ago', ip: '102.45.190.22' },
    { id: 'al-2', agent: 'ArbitrageBot-0x', action: 'Asset Swap Execution', status: 'challenged', time: '10 minutes ago', ip: '124.91.42.119' },
    { id: 'al-3', agent: 'ExternalScraper', action: 'Contract state scan', status: 'rejected', time: '1 hour ago', ip: '82.90.11.4' }
  ]);

  const handleOverride = (id: string) => {
    alert(`Human intent validated. Overriding challenge for ${id}...`);
    setLogs(prev => prev.map(l => l.id === id ? { ...l, status: 'passed' } : l));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Agent Authentication</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Monitor agent identities, verify human authorization loops, and configure API access keys.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Authentication Logs</h2>
          <div className="space-y-3">
            {logs.map(log => (
              <div key={log.id} className="p-3.5 border border-zinc-100 dark:border-zinc-850 rounded-lg flex items-center justify-between gap-4 bg-zinc-50/20 dark:bg-zinc-900/10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 font-mono">{log.agent}</span>
                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-mono">{log.ip}</span>
                  </div>
                  <span className="text-xs text-zinc-450 block mt-1">{log.action} • {log.time}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    log.status === 'passed' ? 'bg-green-500/10 text-green-500' :
                    log.status === 'challenged' ? 'bg-amber-500/10 text-amber-500 animate-pulse' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    {log.status}
                  </span>

                  {log.status === 'challenged' && (
                    <button
                      onClick={() => handleOverride(log.id)}
                      className="inline-flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-[10px] font-semibold text-white px-2 py-1 rounded transition"
                    >
                      <UserCheck className="h-3 w-3" /> Approve Human
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Auth Config */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809] space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Security Constraints</h2>
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-zinc-450 block mb-1.5">Validate Human Intent (CAPTCHA)</span>
              <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-750 dark:text-zinc-250">
                <input type="checkbox" defaultChecked className="rounded text-zinc-900 focus:ring-zinc-900" />
                <span>Override high-value payouts</span>
              </label>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-850 pt-3">
              <span className="text-zinc-450 block mb-1">Rate Limit Threshold</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">120 requests / minute</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
