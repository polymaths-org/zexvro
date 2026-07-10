import { useState, useEffect, useRef } from 'react';
import { useParams } from '@tanstack/react-router';
import { Terminal, Play, Pause, Trash2, ShieldAlert } from 'lucide-react';
import { useProjectStore } from '../../stores/project';

type LogLine = {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};

const LOG_MESSAGES = [
  { level: 'info' as const, message: 'ZK proof generated successfully in 842ms' },
  { level: 'info' as const, message: 'Soroban contract invocation complete: tx_hash_e92bf18' },
  { level: 'warn' as const, message: 'Slow transaction settlement detected: 1.2s latency' },
  { level: 'info' as const, message: 'Shielded registry keys verified' },
  { level: 'error' as const, message: 'Failed to verify signature for stealth payout to recipient 0x39a1' },
  { level: 'info' as const, message: 'Syncing ledger state: checkpoint block 92490' },
  { level: 'info' as const, message: 'Agent auth CAPTCHA request resolved' }
];

export default function ProjectLogs() {
  const { projectId } = useParams({ strict: false });
  const projectStore = useProjectStore();
  const currentProject = projectStore.projects.find(p => p.id === projectId);

  const [logs, setLogs] = useState<LogLine[]>([
    { timestamp: '22:31:01', level: 'info', message: 'Starting project cluster process...' },
    { timestamp: '22:31:02', level: 'info', message: 'Stellar Soroban network connection established' },
    { timestamp: '22:31:04', level: 'info', message: 'Encryption engine ready: AES-GCM-256' },
  ]);

  const [isActive, setIsActive] = useState(true);
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const randomMsg = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      setLogs(prev => [...prev, {
        timestamp: timeStr,
        level: randomMsg.level,
        message: randomMsg.message
      }].slice(-100)); // Cap at 100 log lines
    }, 3000);

    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!currentProject) return null;

  const filteredLogs = logs.filter(log => {
    if (filterLevel === 'all') return true;
    return log.level === filterLevel;
  });

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-140px)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Project Logs</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Real-time stdout/stderr streams for {currentProject.name}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value as any)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>

          <button
            onClick={() => setIsActive(!isActive)}
            className={`inline-flex items-center gap-1.5 h-8 rounded-md px-3 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                : 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
            }`}
          >
            {isActive ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Resume
              </>
            )}
          </button>

          <button
            onClick={() => setLogs([])}
            className="inline-flex items-center gap-1.5 h-8 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-650 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-850"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>

      <div className="flex-1 rounded-xl bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-350 overflow-y-auto flex flex-col border border-zinc-900 shadow-inner">
        <div className="flex items-center gap-2 text-zinc-500 border-b border-zinc-900 pb-2 mb-3">
          <Terminal className="h-4 w-4" />
          <span>STDOUT STREAM ({currentProject.name}) - {isActive ? 'LIVE' : 'PAUSED'}</span>
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
              No logs matches the filter.
            </div>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
