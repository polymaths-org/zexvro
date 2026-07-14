import { Link, Outlet, useParams, useRouterState } from '@tanstack/react-router';
import {
  LayoutDashboard, Users, SendHorizontal, History, ShieldCheck,
  Settings, ChevronLeft, BookOpen, Banknote, Eye, Ghost,
} from 'lucide-react';

const ZER0_NAV = [
  { id: 'overview', path: 'zer0', label: 'Overview', icon: LayoutDashboard },
  { id: 'people', path: 'zer0/people', label: 'Team directory', icon: Users },
  { id: 'pay', path: 'zer0/pay', label: 'Send payment', icon: SendHorizontal },
  { id: 'payroll', path: 'zer0/payroll', label: 'Payroll runs', icon: Banknote },
  { id: 'history', path: 'zer0/history', label: 'Payment ledger', icon: History },
  { id: 'proofs', path: 'zer0/proofs', label: 'Payment proofs', icon: ShieldCheck },
  { id: 'stealth', path: 'zer0/stealth', label: 'Stealth addresses', icon: Ghost },
  { id: 'data-preview', path: 'zer0/data-preview', label: 'What stays private', icon: Eye },
  { id: 'settings', path: 'zer0/settings', label: 'Settings', icon: Settings },
] as const;

export default function Zer0Layout() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  // Determine active section from URL
  const pathParts = currentPath.split('/').filter(Boolean);
  const zer0Idx = pathParts.indexOf('zer0');
  const subSection = zer0Idx >= 0 ? pathParts[zer0Idx + 1] || 'overview' : 'overview';

  const basePath = projectId
    ? `/dashboard/w/${workspaceId}/p/${projectId}`
    : `/dashboard/w/${workspaceId}`;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] gap-0 -m-4 sm:-m-6">
      {/* Zer0 Sub-Sidebar */}
      <div className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-[#070708]/60 p-4 flex flex-col">
        {/* Back to project */}
        <Link
          to={`${basePath}/overview` as any}
          className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 mb-5 transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to {projectId ? 'Project' : 'Workspace'}
        </Link>

        {/* Brand */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">Payroll</h2>
          <p className="text-[10px] text-zinc-400 mt-0.5">Private & public disbursements</p>
        </div>

        {/* Nav Items */}
        <nav className="space-y-0.5 flex-1">
          {ZER0_NAV.map(item => {
            const Icon = item.icon;
            const active = item.id === 'overview'
              ? (!pathParts[zer0Idx + 1] || pathParts[zer0Idx + 1] === 'overview')
              : pathParts[zer0Idx + 1] === item.id;

            return (
              <Link
                key={item.id}
                to={`${basePath}/${item.path}` as any}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                  active
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/40'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? '' : 'opacity-60'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Docs link */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <Link
            to="/docs"
            className="flex items-center gap-2 text-[11px] font-medium text-blue-500 hover:text-blue-600 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Documentation
          </Link>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0 p-6 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
