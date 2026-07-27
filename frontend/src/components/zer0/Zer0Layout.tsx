import { Link, Outlet, useParams, useRouterState } from '@tanstack/react-router';
import {
  LayoutDashboard, Wallet, SendHorizontal, History, ShieldCheck,
  Settings, ChevronLeft, Banknote, Eye, Ghost, Vault, BookOpen,
} from 'lucide-react';
import { useZer0Store } from '../../stores/zer0';

const ZER0_NAV = [
  { id: 'overview', path: 'zer0', label: 'Overview', icon: LayoutDashboard },
  { id: 'people', path: 'zer0/people', label: 'Wallets directory', icon: Wallet },
  { id: 'treasury', path: 'zer0/treasury', label: 'Treasury', icon: Vault },
  { id: 'pay', path: 'zer0/pay', label: 'Send payment', icon: SendHorizontal },
  { id: 'payroll', path: 'zer0/payroll', label: 'Payment runs', icon: Banknote },
  { id: 'history', path: 'zer0/history', label: 'Payment ledger', icon: History },
  { id: 'proofs', path: 'zer0/proofs', label: 'Payment proofs', icon: ShieldCheck },
  { id: 'stealth', path: 'zer0/stealth', label: 'Stealth addresses', icon: Ghost },
  { id: 'data-preview', path: 'zer0/data-preview', label: 'What stays private', icon: Eye },
  { id: 'settings', path: 'zer0/settings', label: 'Settings', icon: Settings },
] as const;

function isMainnetHorizon(horizonUrl?: string) {
  if (!horizonUrl) return false;
  const u = horizonUrl.toLowerCase();
  return !u.includes('testnet') && !u.includes('futurenet');
}

export default function Zer0Layout() {
  const { workspaceId, projectId } = useParams({ strict: false });
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const horizonUrl = useZer0Store(s => s.settings.horizonUrl);
  const mainnet = isMainnetHorizon(horizonUrl);

  const pathParts = currentPath.split('/').filter(Boolean);
  const zer0Idx = pathParts.indexOf('zer0');

  const basePath = projectId
    ? `/dashboard/w/${workspaceId}/p/${projectId}`
    : `/dashboard/w/${workspaceId}`;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] gap-0 -m-4 sm:-m-6">
      {/* Zer0 product sidebar — full suite lives here only */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-[#070708]/80">
        <Link
          to={`${basePath}/overview` as any}
          className="mb-5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to {projectId ? 'Project' : 'Workspace'}
        </Link>

        <div className="mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold tracking-tight text-zinc-950 dark:text-white">Zer0</h2>
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                mainnet
                  ? 'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400'
                  : 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400'
              }`}
              title={mainnet ? 'Zer0 is using Stellar mainnet (real funds)' : 'Zer0 is using Stellar testnet (practice)'}
            >
              {mainnet ? 'Mainnet' : 'Testnet'}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-400">Wallets · private & public pays</p>
        </div>

        <nav className="flex-1 space-y-0.5">
          {ZER0_NAV.map(item => {
            const Icon = item.icon;
            const active = item.id === 'overview'
              ? (!pathParts[zer0Idx + 1] || pathParts[zer0Idx + 1] === 'overview')
              : pathParts[zer0Idx + 1] === item.id;

            return (
              <Link
                key={item.id}
                to={`${basePath}/${item.path}` as any}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-150 ${
                  active
                    ? 'bg-zinc-950 font-semibold text-white shadow-sm dark:bg-white dark:text-zinc-950'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? '' : 'opacity-60'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div
            className={`rounded-md border px-2.5 py-2 text-[10px] leading-4 ${
              mainnet
                ? 'border-orange-500/25 bg-orange-500/5 text-orange-700 dark:text-orange-300'
                : 'border-sky-500/25 bg-sky-500/5 text-sky-700 dark:text-sky-300'
            }`}
          >
            <span className="font-semibold uppercase tracking-wide">
              {mainnet ? 'Mainnet' : 'Testnet'}
            </span>
            <span className="mt-0.5 block opacity-90">
              {mainnet
                ? 'Real Stellar funds. Confirm amounts before signing.'
                : 'Practice network. Free test assets only.'}
            </span>
            <Link
              to={`${basePath}/zer0/settings` as any}
              className="mt-1.5 inline-block font-medium underline-offset-2 hover:underline"
            >
              Change in Settings →
            </Link>
          </div>
          <a
            href="/docs"
            className="flex items-center gap-2 text-[11px] font-medium text-blue-500 transition-colors hover:text-blue-600"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Documentation
          </a>
        </div>
      </aside>

      {/* Content — NFT-style horizontal rhythm */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
