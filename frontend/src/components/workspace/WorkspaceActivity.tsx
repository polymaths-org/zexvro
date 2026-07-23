import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Search, ShieldCheck, User, Activity, RefreshCw, AlertTriangle } from 'lucide-react';
import { workspaceApi, type WorkspaceAuditEvent } from '../../api/api';
import { useProjectStore } from '../../stores/project';
import { useWorkspaceStore } from '../../stores/workspace';

type ActivityItem = {
  id: string;
  type: 'workspace' | 'project' | 'member' | 'audit';
  message: string;
  actor: string;
  time: number;
  severity?: string;
  action?: string;
};

function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    'invite.sent': 'Invitation sent',
    'invite.accepted': 'Invitation accepted',
    'invite.revoked': 'Invitation revoked',
    'workspace.updated': 'Workspace updated',
    'member.role_changed': 'Member role changed',
    'member.removed': 'Member removed',
    'member.left': 'Member left workspace',
    'credits.grant': 'Credits granted',
    'credits.consume': 'Credits consumed',
  };
  return map[action] || action.replace(/[._]/g, ' ');
}

function eventToItem(ev: WorkspaceAuditEvent): ActivityItem {
  const actor = ev.actorEmail || ev.actorId || 'system';
  const target = ev.target ? ` → ${ev.target}` : '';
  const role = typeof ev.meta?.role === 'string' ? ` (${ev.meta.role})` : '';
  return {
    id: ev.id || ev.eventKey || `${ev.createdAt}-${ev.action}`,
    type: 'audit',
    message: `${humanizeAction(ev.action)}${role}${target}`,
    actor,
    time: ev.createdAt || 0,
    severity: ev.severity,
    action: ev.action,
  };
}

/** Fallback derived rows when ledger is empty (bootstrap context). */
function deriveLocalItems(
  workspace: ReturnType<typeof useWorkspaceStore.getState>['workspaces'][0] | undefined,
  projects: { id: string; name: string; owner?: string; createdAt: number }[],
): ActivityItem[] {
  if (!workspace) return [];
  return [
    {
      id: `workspace_${workspace.id}`,
      type: 'workspace' as const,
      message: `Workspace "${workspace.name}" created`,
      actor: workspace.ownerId || 'workspace',
      time: workspace.createdAt,
    },
    ...projects.map(project => ({
      id: `project_${project.id}`,
      type: 'project' as const,
      message: `Customer project "${project.name}" created`,
      actor: project.owner || workspace.ownerId || 'workspace',
      time: project.createdAt,
    })),
    ...(workspace.members || [])
      .filter(member => member.status === 'invited' || member.status === 'pending')
      .map(member => ({
        id: `member_${member.id}`,
        type: 'member' as const,
        message: `Member invite created for ${member.email}`,
        actor: workspace.ownerId || 'workspace',
        time: member.joinedAt,
      })),
  ].sort((a, b) => b.time - a.time);
}

export default function WorkspaceActivity() {
  const { workspaceId } = useParams({ strict: false });
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<WorkspaceAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'ledger' | 'derived'>('derived');

  const allProjects = useProjectStore(s => s.projects);
  const workspace = useWorkspaceStore(s => s.workspaces.find(item => item.id === workspaceId));
  const projects = useMemo(
    () => allProjects.filter(project => project.workspaceId === workspaceId),
    [allProjects, workspaceId],
  );

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await workspaceApi.listAudit(workspaceId, { limit: 100 });
      const list = Array.isArray(res.events) ? res.events : [];
      setEvents(list);
      setSource(list.length > 0 ? 'ledger' : 'derived');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load audit log';
      setError(msg);
      setEvents([]);
      setSource('derived');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activities = useMemo<ActivityItem[]>(() => {
    if (events.length > 0) {
      return events.map(eventToItem).sort((a, b) => b.time - a.time);
    }
    return deriveLocalItems(workspace, projects);
  }, [events, workspace, projects]);

  const filtered = activities.filter(item =>
    item.message.toLowerCase().includes(search.toLowerCase())
    || item.actor.toLowerCase().includes(search.toLowerCase())
    || (item.action || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Audit Log</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {source === 'ledger'
              ? 'Append-only security ledger for invites, roles, and workspace changes.'
              : 'Showing local context until the first durable audit event is recorded.'}
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
          placeholder="Filter workspace audit log..."
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:text-zinc-100 dark:focus:border-zinc-600"
        />
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Could not load remote ledger ({error}). Showing local derived events if available.</span>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Audit Events</h2>
          <span className="text-[10px] font-mono uppercase tracking-wide text-zinc-400">
            {source === 'ledger' ? 'ledger' : 'derived'} · {filtered.length}
          </span>
        </div>

        {loading && events.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500">Loading audit events…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No audit events yet</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Invite, accept, revoke, and settings changes will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {filtered.map(item => (
              <div key={item.id} className="flex items-start gap-4 p-5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  item.severity === 'warning' || item.severity === 'critical'
                    ? 'bg-amber-500/10 text-amber-500'
                    : item.type === 'member' || (item.action || '').startsWith('invite')
                      ? 'bg-blue-500/10 text-blue-500'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-850'
                }`}>
                  {item.type === 'member' || (item.action || '').startsWith('invite')
                    ? <User className="h-4 w-4" />
                    : <ShieldCheck className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-relaxed text-zinc-900 dark:text-white">{item.message}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span className="font-semibold text-zinc-500 dark:text-zinc-400">{item.actor}</span>
                    {item.action ? <span className="font-mono text-[10px]">{item.action}</span> : null}
                    <span>{item.time ? new Date(item.time).toLocaleString() : '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
