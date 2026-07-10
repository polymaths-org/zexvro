import { useState } from 'react';
import { RefreshCw, Play, SearchCode, CheckCircle, FileCode } from 'lucide-react';

type MigrationTask = {
  file: string;
  status: 'pending' | 'success' | 'transforming';
  changes: number;
};

export default function TransformationAgent() {
  const [tasks, setTasks] = useState<MigrationTask[]>([
    { file: 'src/contracts/TokenPool.sol', status: 'pending', changes: 0 },
    { file: 'src/utils/crypto.ts', status: 'pending', changes: 0 },
    { file: 'src/hooks/useShield.tsx', status: 'pending', changes: 0 }
  ]);

  const [loading, setLoading] = useState(false);

  const startScan = () => {
    setLoading(true);
    let currentIdx = 0;

    const interval = setInterval(() => {
      if (currentIdx >= tasks.length) {
        clearInterval(interval);
        setLoading(false);
        return;
      }

      setTasks(prev => prev.map((t, idx) => {
        if (idx === currentIdx) {
          return { ...t, status: 'transforming' };
        }
        return t;
      }));

      setTimeout(() => {
        setTasks(prev => prev.map((t, idx) => {
          if (idx === currentIdx) {
            return { ...t, status: 'success', changes: Math.floor(Math.random() * 8) + 2 };
          }
          return t;
        }));
        currentIdx++;
      }, 1000);

    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Transformation Agent</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Automatically compile, scan, and refactor AST node trees using ZEXVRO intelligent AI models.
          </p>
        </div>

        <button
          onClick={startScan}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Run Migration Scan
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Source Files Queue</h2>
        </div>

        <div className="space-y-3">
          {tasks.map(t => (
            <div key={t.file} className="flex items-center justify-between p-3 border border-zinc-100 dark:border-zinc-850 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/10">
              <div className="flex items-center gap-3">
                <FileCode className="h-5 w-5 text-indigo-500" />
                <div>
                  <span className="text-xs font-mono text-zinc-800 dark:text-zinc-200 font-bold block">{t.file}</span>
                  {t.changes > 0 && (
                    <span className="text-[10px] text-emerald-500 font-medium">Modified {t.changes} imports and structures</span>
                  )}
                </div>
              </div>

              <div>
                <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  t.status === 'success' ? 'bg-green-500/10 text-green-500' :
                  t.status === 'transforming' ? 'bg-indigo-500/10 text-indigo-550 animate-pulse' :
                  'bg-zinc-100 dark:bg-zinc-800 text-zinc-505'
                }`}>
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
