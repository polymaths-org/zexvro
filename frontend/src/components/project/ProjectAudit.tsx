import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { ShieldAlert, Search, Filter, Calendar } from 'lucide-react';
import { useProjectStore } from '../../stores/project';

type AuditLog = {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  ip: string;
  severity: 'info' | 'warning' | 'critical';
};

export default function ProjectAudit() {
  const { projectId } = useParams({ strict: false });
  const projectStore = useProjectStore();
  const currentProject = projectStore.projects.find(p => p.id === projectId);

  const [search, setSearch] = useState('');
  const [logs] = useState<AuditLog[]>([
    { id: 'aud-1', action: 'Environment variables modified', actor: 'paris@polymaths.org', target: 'Production (STELLAR_NETWORK)', timestamp: '15 minutes ago', ip: '192.168.1.42', severity: 'warning' },
    { id: 'aud-2', action: 'Manual deploy triggered', actor: 'paris@polymaths.org', target: 'Development (commit a29f81d)', timestamp: '22 minutes ago', ip: '192.168.1.42', severity: 'info' },
    { id: 'aud-3', action: 'Decryption view key utilized', actor: 'sophia@polymaths.org', target: 'Zer0 Privacy Pool transactions decrypted', timestamp: '1 hour ago', ip: '100.93.42.11', severity: 'warning' },
    { id: 'aud-4', action: 'Project created', actor: 'paris@polymaths.org', target: 'Project initialization', timestamp: '3 hours ago', ip: '192.168.1.42', severity: 'info' },
    { id: 'aud-5', action: 'Critical environment provisioning error', actor: 'System Agent', target: 'Dev stack teardown', timestamp: '1 day ago', ip: '127.0.0.1', severity: 'critical' },
  ]);

  if (!currentProject) return null;

  const filteredLogs = logs.filter(log =>
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.actor.toLowerCase().includes(search.toLowerCase()) ||
    log.target.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Audit Logs</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Security audit trails and access ledger for {currentProject.name}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search audit trail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:text-zinc-100 dark:focus:border-zinc-600"
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
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
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-2 w-2 rounded-full ${
                        log.severity === 'critical' ? 'bg-red-500 animate-ping' :
                        log.severity === 'warning' ? 'bg-amber-500' :
                        'bg-zinc-400'
                      }`} />
                      <span className="font-semibold text-zinc-900 dark:text-white">{log.action}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-zinc-500">{log.actor}</td>
                  <td className="px-5 py-3.5 text-zinc-500">{log.target}</td>
                  <td className="px-5 py-3.5 font-mono text-zinc-400">{log.ip}</td>
                  <td className="px-5 py-3.5 text-right text-zinc-400">{log.timestamp}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-zinc-400">
                    No matching audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
