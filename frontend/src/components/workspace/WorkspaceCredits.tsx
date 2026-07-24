import { useCallback, useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Coins, RefreshCw, Ticket, AlertTriangle, Flame, Snowflake } from 'lucide-react';
import {
  workspaceApi,
  type CreditBalance,
  type CreditLedgerEvent,
} from '../../api/api';
import { useWorkspaceStore } from '../../stores/workspace';
import { useWorkspaceRbac } from '../../rbac/useWorkspaceRbac';
import RequirePermission, { AccessDenied } from '../../rbac/RequirePermission';

export default function WorkspaceCredits() {
  const { workspaceId } = useParams({ strict: false });
  const workspace = useWorkspaceStore(s => s.workspaces.find(w => w.id === workspaceId));
  const updateWorkspace = useWorkspaceStore(s => s.updateWorkspace);
  const { can } = useWorkspaceRbac(workspaceId);
  const canWrite = can('workspace.settings.write');

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [environment, setEnvironment] = useState<'testnet' | 'mainnet'>('testnet');
  const [burnsOnUse, setBurnsOnUse] = useState(false);
  const [ledger, setLedger] = useState<CreditLedgerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [envBusy, setEnvBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await workspaceApi.getCredits(workspaceId);
      setBalance(res.credits);
      setEnvironment(res.environment || 'testnet');
      setBurnsOnUse(!!res.burnsOnUse);
      setLedger(res.recent || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credits');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const redeem = async () => {
    if (!workspaceId || !promoCode.trim()) return;
    setPromoBusy(true);
    setPromoMsg(null);
    try {
      const res = await workspaceApi.redeemPromo(workspaceId, promoCode.trim());
      setPromoMsg(`Redeemed +${res.tx?.amount ?? ''} ZCR. Balance: ${res.balance?.balance ?? '—'} ZCR`);
      setPromoCode('');
      await load();
    } catch (err) {
      setPromoMsg(err instanceof Error ? err.message : 'Redeem failed');
    } finally {
      setPromoBusy(false);
    }
  };

  const switchEnv = async (next: 'testnet' | 'mainnet') => {
    if (!workspace || !canWrite || !workspaceId) return;
    if (next === 'mainnet') {
      const ok = window.confirm(
        'Switch to MAINNET?\n\nPlatform ZCR will burn when services are used. Testnet never burns credits.',
      );
      if (!ok) return;
    }
    setEnvBusy(true);
    try {
      const networkLabel = next === 'mainnet' ? 'Stellar Mainnet' : 'Stellar Testnet';
      updateWorkspace(workspace.id, {
        settings: {
          ...workspace.settings,
          environment: next,
          defaultNetwork: networkLabel,
        },
      });
      setEnvironment(next);
      setBurnsOnUse(next === 'mainnet');
      await load();
    } finally {
      setEnvBusy(false);
    }
  };

  return (
    <RequirePermission
      permission="workspace.view"
      workspaceId={workspaceId}
      fallback={<AccessDenied title="Credits access required" />}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Credits (ZCR)</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Platform currency for Zexvro services. Burns only on mainnet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <Coins className="h-3.5 w-3.5" /> Balance
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
              {loading && !balance ? '—' : (balance?.balance ?? 0).toLocaleString()}
              <span className="ml-1.5 text-sm font-medium text-zinc-400">ZCR</span>
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {burnsOnUse ? <Flame className="h-3.5 w-3.5 text-orange-500" /> : <Snowflake className="h-3.5 w-3.5 text-sky-500" />}
              Environment
            </div>
            <p className="mt-3 text-lg font-semibold uppercase tracking-wide text-zinc-900 dark:text-white">
              {environment}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {burnsOnUse ? 'Service use debits ZCR.' : 'Testnet — ZCR is not burned.'}
            </p>
            {canWrite ? (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={envBusy || environment === 'testnet'}
                  onClick={() => void switchEnv('testnet')}
                  className="rounded-md border border-zinc-200 px-2.5 py-1 text-[11px] font-medium disabled:opacity-40 dark:border-zinc-700"
                >
                  Testnet
                </button>
                <button
                  type="button"
                  disabled={envBusy || environment === 'mainnet'}
                  onClick={() => void switchEnv('mainnet')}
                  className="rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
                >
                  Mainnet
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <Ticket className="h-3.5 w-3.5" /> Redeem promo
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={promoCode}
                onChange={e => setPromoCode(e.target.value.toUpperCase())}
                placeholder="LAUNCH100"
                disabled={!canWrite || promoBusy}
                className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 font-mono text-xs uppercase outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="button"
                disabled={!canWrite || promoBusy || !promoCode.trim()}
                onClick={() => void redeem()}
                className="rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
              >
                Redeem
              </button>
            </div>
            {promoMsg ? <p className="mt-2 text-[11px] text-zinc-500">{promoMsg}</p> : null}
            <p className="mt-2 text-[11px] text-zinc-400">
              Credit packs via NFT checkout land in a later top-up flow.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
          <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Recent ledger</h2>
          </div>
          {ledger.length === 0 ? (
            <div className="p-10 text-center text-xs text-zinc-500">No credit transactions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 text-zinc-400 dark:border-zinc-800">
                    <th className="px-5 py-3 font-semibold uppercase">Type</th>
                    <th className="px-5 py-3 font-semibold uppercase">Amount</th>
                    <th className="px-5 py-3 font-semibold uppercase">Service</th>
                    <th className="px-5 py-3 font-semibold uppercase">Env</th>
                    <th className="px-5 py-3 font-semibold uppercase">Balance after</th>
                    <th className="px-5 py-3 font-semibold uppercase text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {ledger.map(row => (
                    <tr key={row.id || row.sk} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                      <td className="px-5 py-3 font-medium text-zinc-900 dark:text-white">{row.type}</td>
                      <td className="px-5 py-3 font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
                        {row.type === 'consume' || row.type === 'consume_skipped' ? '−' : '+'}
                        {row.amount}
                      </td>
                      <td className="px-5 py-3 text-zinc-500">{row.service}{row.action ? `.${row.action}` : ''}</td>
                      <td className="px-5 py-3 font-mono uppercase text-zinc-400">{row.environment || '—'}</td>
                      <td className="px-5 py-3 font-mono tabular-nums text-zinc-500">{row.balanceAfter}</td>
                      <td className="px-5 py-3 text-right text-zinc-400">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </RequirePermission>
  );
}
