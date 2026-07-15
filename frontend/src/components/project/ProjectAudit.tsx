import { useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { ShieldAlert, Search } from 'lucide-react';
import { useProjectStore } from '../../stores/project';

type AuditLog = {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: number;
  ip: string;
  severity: 'info' | 'warning' | 'critical';
};

export default function ProjectAudit() {
  const { projectId } = useParams({ strict: false });
  const currentProject = useProjectStore(s => s.projects.find(project => project.id === projectId));
  const [search, setSearch] = useState('');
  const logs: AuditLog[] = [];

  const filteredLogs = useMemo(() => logs.filter(log =>
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.actor.toLowerCase().includes(search.toLowerCase()) ||
    log.target.toLowerCase().includes(search.toLowerCase())
  ), [logs, search]);

  if (!currentProject) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Audit Logs</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Security audit trail for {currentProject.name}.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search audit trail..."
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:text-zinc-100 dark:focus:border-zinc-600"
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No audit events yet</h3>
            <p className="mt-1 text-xs text-zinc-500">Events will appear here once the backend audit pipeline records activity.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 dark:border-zinc-800">
                  <th className="px-5 py-3 font-semibold uppercase">Action</th>
                  <th className="px-5 py-3 font-semibold uppercase">Actor</th>
                  <th className="px-5 py-3 font-semibold uppercase">Target</th>
                  <th className="px-5 py-3 font-semibold uppercase">IP Address</th>
                  <th className="px-5 py-3 font-semibold uppercase text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <td className="px-5 py-3.5 font-semibold text-zinc-900 dark:text-white">{log.action}</td>
                    <td className="px-5 py-3.5 font-mono text-zinc-500">{log.actor}</td>
                    <td className="px-5 py-3.5 text-zinc-500">{log.target}</td>
                    <td className="px-5 py-3.5 font-mono text-zinc-400">{log.ip}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-400">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
