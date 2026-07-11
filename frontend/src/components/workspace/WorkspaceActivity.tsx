import { useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Search, ShieldCheck, User, Activity } from 'lucide-react';
import { useProjectStore } from '../../stores/project';
import { useWorkspaceStore } from '../../stores/workspace';

type ActivityItem = {
  id: string;
  type: 'workspace' | 'project' | 'member';
  message: string;
  actor: string;
  time: number;
};

export default function WorkspaceActivity() {
  const { workspaceId } = useParams({ strict: false });
  const [search, setSearch] = useState('');
  const allProjects = useProjectStore(s => s.projects);
  const workspace = useWorkspaceStore(s => s.workspaces.find(item => item.id === workspaceId));
  const projects = useMemo(
    () => allProjects.filter(project => project.workspaceId === workspaceId),
    [allProjects, workspaceId],
  );

  const activities = useMemo<ActivityItem[]>(() => [
    ...(workspace ? [{
      id: `workspace_${workspace.id}`,
      type: 'workspace' as const,
      message: `Workspace "${workspace.name}" created`,
      actor: workspace.ownerId || 'workspace',
      time: workspace.createdAt,
    }] : []),
    ...projects.map(project => ({
      id: `project_${project.id}`,
      type: 'project' as const,
      message: `Customer project "${project.name}" created`,
      actor: project.owner || workspace?.ownerId || 'workspace',
      time: project.createdAt,
    })),
    ...(workspace?.members || [])
      .filter(member => member.status === 'invited' || member.status === 'pending')
      .map(member => ({
        id: `member_${member.id}`,
        type: 'member' as const,
        message: `Member invite created for ${member.email}`,
        actor: workspace?.ownerId || 'workspace',
        time: member.joinedAt,
      })),
  ].sort((a, b) => b.time - a.time), [projects, workspace]);

  const filtered = activities.filter(item =>
    item.message.toLowerCase().includes(search.toLowerCase()) ||
    item.actor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Audit Log</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Audit events derived from actual workspace, project, and invite records.
        </p>
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

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Audit Events</h2>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No audit events yet</h3>
            <p className="mt-1 text-xs text-zinc-500">Workspace, project, and invite events will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {filtered.map(item => (
              <div key={item.id} className="flex items-start gap-4 p-5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  item.type === 'member' ? 'bg-blue-500/10 text-blue-500' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-850'
                }`}>
                  {item.type === 'member' ? <User className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-relaxed text-zinc-900 dark:text-white">{item.message}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-400">
                    <span className="font-semibold text-zinc-550">{item.actor}</span>
                    <span>{new Date(item.time).toLocaleString()}</span>
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
