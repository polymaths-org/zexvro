import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { ShieldAlert, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { workspaceApi, type WorkspaceAuditEvent } from '../../api/api';
import { useProjectStore } from '../../stores/project';

export default function ProjectAudit() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const currentProject = useProjectStore(s => s.projects.find(project => project.id === projectId));
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<WorkspaceAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      // Prefer server-side project filter; also fetch workspace events and filter client-side
      // so project-scoped pages still show related invite/workspace activity when projectId unset on row.
      const res = await workspaceApi.listAudit(workspaceId, { limit: 100, projectId });
      let list = Array.isArray(res.events) ? res.events : [];
      if (list.length === 0 && projectId) {
        const all = await workspaceApi.listAudit(workspaceId, { limit: 100 });
        list = (all.events || []).filter(
          e => e.projectId === projectId
            || (typeof e.meta?.projectId === 'string' && e.meta.projectId === projectId)
            || (e.target || '').includes(projectId),
        );
      }
      setEvents(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLogs = useMemo(() => events.filter(log => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (log.action || '').toLowerCase().includes(q)
      || (log.actorEmail || log.actorId || '').toLowerCase().includes(q)
      || (log.target || '').toLowerCase().includes(q)
    );
  }), [events, search]);

  if (!currentProject) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Audit Logs</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Security audit trail for {currentProject.name}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
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

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        {loading && events.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500">Loading…</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No audit events yet</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Project-scoped events appear here when the backend records activity with this project id.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 dark:border-zinc-800">
                  <th className="px-5 py-3 font-semibold uppercase">Action</th>
                  <th className="px-5 py-3 font-semibold uppercase">Actor</th>
                  <th className="px-5 py-3 font-semibold uppercase">Target</th>
                  <th className="px-5 py-3 font-semibold uppercase">Severity</th>
                  <th className="px-5 py-3 font-semibold uppercase text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {filteredLogs.map(log => (
                  <tr key={log.id || log.eventKey} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <td className="px-5 py-3.5 font-semibold text-zinc-900 dark:text-white">{log.action}</td>
                    <td className="px-5 py-3.5 font-mono text-zinc-500">{log.actorEmail || log.actorId || '—'}</td>
                    <td className="px-5 py-3.5 text-zinc-500">{log.target || '—'}</td>
                    <td className="px-5 py-3.5 font-mono text-zinc-400">{log.severity || 'info'}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-400">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                    </td>
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
