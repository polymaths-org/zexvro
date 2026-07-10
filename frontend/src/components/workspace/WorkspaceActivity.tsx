import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Search, ShieldAlert, CheckCircle, User, Activity } from 'lucide-react';

type ActivityItem = {
  id: string;
  type: 'security' | 'deploy' | 'creation';
  message: string;
  actor: string;
  time: string;
  ip: string;
};

export default function WorkspaceActivity() {
  const { workspaceId } = useParams({ strict: false });
  const [search, setSearch] = useState('');
  const [activities] = useState<ActivityItem[]>([
    { id: 'act-1', type: 'deploy', message: 'Project "Zer0 Privacy Dapp" successfully rebuilt on production cluster', actor: 'paris@polymaths.org', time: '12 minutes ago', ip: '192.168.1.42' },
    { id: 'act-2', type: 'security', message: 'API Token "Staging Token" deleted', actor: 'paris@polymaths.org', time: '1 hour ago', ip: '192.168.1.42' },
    { id: 'act-3', type: 'creation', message: 'New member Alex Rivera invited to workspace', actor: 'paris@polymaths.org', time: '3 hours ago', ip: '192.168.1.42' },
    { id: 'act-4', type: 'security', message: 'Stealth verification key used for private pool transaction lookup', actor: 'sophia@polymaths.org', time: '5 hours ago', ip: '100.93.42.11' }
  ]);

  const filtered = activities.filter(act =>
    act.message.toLowerCase().includes(search.toLowerCase()) ||
    act.actor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Activity</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Historical record of user actions, deployments, and security incidents for {workspaceId}.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Filter workspace activity feed..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:text-zinc-100 dark:focus:border-zinc-600"
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Recent Activity Stream</h2>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {filtered.map(act => (
            <div key={act.id} className="flex items-start gap-4 p-5">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                act.type === 'deploy' ? 'bg-blue-500/10 text-blue-500' :
                act.type === 'security' ? 'bg-amber-500/10 text-amber-500' :
                'bg-zinc-100 dark:bg-zinc-850 text-zinc-500'
              }`}>
                {act.type === 'deploy' && <CheckCircle className="h-4 w-4" />}
                {act.type === 'security' && <ShieldAlert className="h-4 w-4" />}
                {act.type === 'creation' && <User className="h-4 w-4" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white leading-relaxed">{act.message}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-550">{act.actor}</span>
                  <span>•</span>
                  <span>IP: {act.ip}</span>
                  <span>•</span>
                  <span>{act.time}</span>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-zinc-450 text-xs">
              No matching activity records found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
