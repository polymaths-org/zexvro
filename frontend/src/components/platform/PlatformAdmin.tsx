import { useCallback, useEffect, useState } from 'react';
import { Shield, RefreshCw, Ticket, Coins, BarChart3, AlertTriangle } from 'lucide-react';
import { platformApi, type PromoCode } from '../../api/api';

export default function PlatformAdmin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof platformApi.analytics>> | null>(null);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [grantWs, setGrantWs] = useState('');
  const [grantAmount, setGrantAmount] = useState('100');
  const [grantMsg, setGrantMsg] = useState<string | null>(null);

  const [promoForm, setPromoForm] = useState({ code: '', creditAmount: '100', maxRedemptions: '', note: '' });
  const [promoMsg, setPromoMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await platformApi.me();
      setAllowed(!!me.platformAdmin);
      if (!me.platformAdmin) {
        setLoading(false);
        return;
      }
      const [a, p] = await Promise.all([platformApi.analytics(), platformApi.listPromos()]);
      setAnalytics(a);
      setPromos(p.promos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform admin');
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const doGrant = async () => {
    setGrantMsg(null);
    try {
      const res = await platformApi.grantCredits({
        workspaceId: grantWs.trim(),
        amount: parseInt(grantAmount, 10) || 0,
        reason: 'founder_grant',
      });
      setGrantMsg(`Granted. New balance: ${res.balance?.balance ?? '—'} ZCR`);
      await load();
    } catch (err) {
      setGrantMsg(err instanceof Error ? err.message : 'Grant failed');
    }
  };

  const createPromo = async () => {
    setPromoMsg(null);
    try {
      await platformApi.createPromo({
        code: promoForm.code.trim().toUpperCase(),
        creditAmount: parseInt(promoForm.creditAmount, 10) || 0,
        maxRedemptions: promoForm.maxRedemptions ? parseInt(promoForm.maxRedemptions, 10) : null,
        note: promoForm.note,
      });
      setPromoMsg('Promo created');
      setPromoForm({ code: '', creditAmount: '100', maxRedemptions: '', note: '' });
      await load();
    } catch (err) {
      setPromoMsg(err instanceof Error ? err.message : 'Create failed');
    }
  };

  if (loading && allowed === null) {
    return <div className="p-8 text-sm text-zinc-500">Checking founder access…</div>;
  }

  if (allowed === false) {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-10 text-center">
        <Shield className="mx-auto h-10 w-10 text-zinc-300" />
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Platform access denied</h1>
        <p className="text-sm text-zinc-500">
          This control plane is restricted to Zexvro founders (platform super-admins).
        </p>
        {error ? <p className="text-xs text-amber-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Platform control plane</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Founder analytics, ZCR grants, and promotional codes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium dark:border-zinc-800 dark:bg-zinc-950"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<BarChart3 className="h-3.5 w-3.5" />} label="Workspaces" value={analytics?.workspaceCount ?? '—'} />
        <Stat icon={<Coins className="h-3.5 w-3.5" />} label="ZCR in circulation" value={analytics?.totalZcrInCirculation ?? '—'} />
        <Stat
          icon={<SnowflakeIcon />}
          label="Testnet / Mainnet"
          value={`${analytics?.environmentCounts?.testnet ?? 0} / ${analytics?.environmentCounts?.mainnet ?? 0}`}
        />
        <Stat icon={<Ticket className="h-3.5 w-3.5" />} label="Active promos" value={analytics?.activePromoCount ?? '—'} />
      </div>
      {analytics?.note ? <p className="text-[11px] text-zinc-400">{analytics.note}</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <Coins className="h-4 w-4" /> Grant ZCR
          </h2>
          <div className="mt-4 space-y-3">
            <input
              value={grantWs}
              onChange={e => setGrantWs(e.target.value)}
              placeholder="workspaceId"
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950"
            />
            <input
              value={grantAmount}
              onChange={e => setGrantAmount(e.target.value)}
              type="number"
              min={1}
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-800 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={() => void doGrant()}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              Grant
            </button>
            {grantMsg ? <p className="text-[11px] text-zinc-500">{grantMsg}</p> : null}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <Ticket className="h-4 w-4" /> Create promo code
          </h2>
          <div className="mt-4 space-y-3">
            <input
              value={promoForm.code}
              onChange={e => setPromoForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="CODE"
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 font-mono text-xs uppercase dark:border-zinc-800 dark:bg-zinc-950"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={promoForm.creditAmount}
                onChange={e => setPromoForm(f => ({ ...f, creditAmount: e.target.value }))}
                type="number"
                min={1}
                placeholder="ZCR amount"
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-800 dark:bg-zinc-950"
              />
              <input
                value={promoForm.maxRedemptions}
                onChange={e => setPromoForm(f => ({ ...f, maxRedemptions: e.target.value }))}
                type="number"
                min={1}
                placeholder="Max redemptions (opt)"
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
            <input
              value={promoForm.note}
              onChange={e => setPromoForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Internal note"
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-800 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={() => void createPromo()}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              Create promo
            </button>
            {promoMsg ? <p className="text-[11px] text-zinc-500">{promoMsg}</p> : null}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Promo codes</h2>
        </div>
        {promos.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">No promos yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-400 dark:border-zinc-800">
                  <th className="px-5 py-3 font-semibold uppercase">Code</th>
                  <th className="px-5 py-3 font-semibold uppercase">ZCR</th>
                  <th className="px-5 py-3 font-semibold uppercase">Redeemed</th>
                  <th className="px-5 py-3 font-semibold uppercase">Status</th>
                  <th className="px-5 py-3 font-semibold uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {promos.map(p => (
                  <tr key={p.code}>
                    <td className="px-5 py-3 font-mono font-semibold text-zinc-900 dark:text-white">{p.code}</td>
                    <td className="px-5 py-3 tabular-nums">{p.creditAmount}</td>
                    <td className="px-5 py-3 tabular-nums text-zinc-500">
                      {p.redeemedCount ?? 0}
                      {p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : ''}
                    </td>
                    <td className="px-5 py-3 uppercase text-zinc-500">{p.status}</td>
                    <td className="px-5 py-3 text-right">
                      {p.status === 'active' ? (
                        <button
                          type="button"
                          className="text-[11px] font-medium text-amber-600"
                          onClick={() => void platformApi.disablePromo(p.code).then(load)}
                        >
                          Disable
                        </button>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#080809]">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}

function SnowflakeIcon() {
  return <span className="text-[10px]">⇄</span>;
}
