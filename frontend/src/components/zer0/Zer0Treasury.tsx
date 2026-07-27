import { useCallback, useEffect, useState } from 'react';
import {
  Vault,
  RefreshCw,
  Copy,
  Check,
  Plus,
  ArrowDownToLine,
  Trash2,
  AlertTriangle,
  LoaderCircle,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import { stellar } from '../../api/api';
import {
  isAutoSignEnabled,
  isTreasuryKeyConfigured,
  getTreasuryPublicKey,
  setForceFreighterSigning,
  treasurySourceLabel,
} from '../../api/privacyPool';
import { useZer0Store } from '../../stores/zer0';
import {
  clearUserTreasury,
  generateUserTreasury,
  getUserTreasuryPublicKey,
  hasUserTreasury,
  importUserTreasurySecret,
  readUserTreasury,
  shortG,
  type UserTreasuryRecord,
} from '../../lib/userTreasury';

function networkLabel(horizonUrl?: string) {
  const u = (horizonUrl || '').toLowerCase();
  if (!u || u.includes('testnet') || u.includes('futurenet')) return 'Testnet';
  return 'Mainnet';
}

export default function Zer0Treasury() {
  const settings = useZer0Store(s => s.settings);
  const updateSettings = useZer0Store(s => s.updateSettings);

  const [record, setRecord] = useState<UserTreasuryRecord | null>(() => readUserTreasury());
  const [balance, setBalance] = useState<number | null>(null);
  const [fundingBalance, setFundingBalance] = useState<number | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [fundAmount, setFundAmount] = useState('12');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSecret, setImportSecret] = useState('');
  const [tick, setTick] = useState(0);

  const fundingWallet = (settings.walletAddress || '').trim();
  const fundingOk = /^G[A-Z2-7]{55}$/.test(fundingWallet);
  const treasuryG = record?.publicKey || getUserTreasuryPublicKey();
  const autoOn = !settings.preferFreighterSigning && isTreasuryKeyConfigured();
  const source = treasurySourceLabel();
  const net = networkLabel(settings.horizonUrl);
  const activeTreasuryG = getTreasuryPublicKey();

  const refresh = useCallback(async () => {
    setRecord(readUserTreasury());
    setLoadingBal(true);
    setErr(null);
    try {
      const g = readUserTreasury()?.publicKey;
      const horizon = settings.horizonUrl || 'https://horizon-testnet.stellar.org';
      const tasks: Promise<void>[] = [];
      if (g) {
        tasks.push(
          stellar.getPoolBalance(g, horizon).then((b) => {
            setBalance(b.XLM ?? 0);
          }).catch(() => setBalance(0)),
        );
      } else {
        setBalance(null);
      }
      if (fundingOk) {
        tasks.push(
          stellar.getPoolBalance(fundingWallet, horizon).then((b) => {
            setFundingBalance(b.XLM ?? 0);
          }).catch(() => setFundingBalance(null)),
        );
      } else {
        setFundingBalance(null);
      }
      await Promise.all(tasks);
    } finally {
      setLoadingBal(false);
      setTick((t) => t + 1);
    }
  }, [fundingOk, fundingWallet, settings.horizonUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copyG = async () => {
    if (!treasuryG) return;
    try {
      await navigator.clipboard.writeText(treasuryG);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setErr('Could not copy address');
    }
  };

  const onCreate = () => {
    setErr(null);
    setMsg(null);
    if (hasUserTreasury()) {
      const ok = window.confirm(
        'Replace your personal treasury key in this browser?\n\n'
          + 'Any XLM on the old address stays there — only this browser’s auto-approve key changes.',
      );
      if (!ok) return;
    }
    try {
      const next = generateUserTreasury();
      setRecord(next);
      setMsg(`Treasury created: ${shortG(next.publicKey)}. Fund it, then turn Auto-approve ON.`);
      void refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create treasury');
    }
  };

  const onImport = () => {
    setErr(null);
    setMsg(null);
    try {
      const next = importUserTreasurySecret(importSecret);
      setRecord(next);
      setImportSecret('');
      setImportOpen(false);
      setMsg(`Imported treasury ${shortG(next.publicKey)}.`);
      void refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed');
    }
  };

  const onClear = () => {
    if (!window.confirm('Remove personal treasury from this browser? Funds on-chain are not moved.')) return;
    clearUserTreasury();
    setRecord(null);
    setBalance(null);
    setMsg('Personal treasury removed from this browser.');
    setTick((t) => t + 1);
  };

  const onFund = async () => {
    setErr(null);
    setMsg(null);
    if (!fundingOk) {
      setErr('Connect a funding wallet first (Zer0 → Settings → Wallet).');
      return;
    }
    if (!treasuryG) {
      setErr('Create a personal treasury first.');
      return;
    }
    const amount = Number(fundAmount);
    if (!(amount > 0)) {
      setErr('Enter a positive XLM amount.');
      return;
    }
    setBusy(true);
    try {
      const res = await stellar.submitPayment(
        fundingWallet,
        treasuryG,
        amount,
        'XLM',
        settings.horizonUrl || 'https://horizon-testnet.stellar.org',
        'ZEXVRO treasury fund',
      );
      setMsg(`Funded treasury +${amount} XLM · tx ${res.txHash.slice(0, 10)}…`);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fund failed');
    } finally {
      setBusy(false);
    }
  };

  const enableAutoApprove = () => {
    if (!hasUserTreasury() && !isTreasuryKeyConfigured()) {
      setErr('Create and fund a personal treasury first.');
      return;
    }
    setForceFreighterSigning(false);
    updateSettings({ preferFreighterSigning: false });
    setMsg('Auto-approve ON — private pays use your personal treasury (no Freighter popups).');
    setTick((t) => t + 1);
  };

  const disableAutoApprove = () => {
    setForceFreighterSigning(true);
    updateSettings({ preferFreighterSigning: true });
    setMsg('Auto-approve OFF — Freighter will sign from your funding wallet.');
    setTick((t) => t + 1);
  };

  void tick; // force re-read of isAutoSignEnabled after toggles

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Zer0</p>
          <h1 className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-zinc-950 dark:text-white">
            <Vault className="h-5 w-5" /> Personal treasury
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Create a browser-local treasury wallet, fund it from Freighter once, then turn auto-approve on
            so future private pays skip Freighter popups. Secret never leaves this browser.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loadingBal}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingBal ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <p className="text-[11px] font-medium text-zinc-500">Network</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">{net}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <p className="text-[11px] font-medium text-zinc-500">Auto-approve</p>
          <p className={`mt-1 text-lg font-semibold ${autoOn || isAutoSignEnabled() ? 'text-emerald-600' : 'text-amber-600'}`}>
            {autoOn || isAutoSignEnabled() ? 'ON' : 'OFF'}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-400">
            Source: {source === 'personal' ? 'your treasury' : source === 'ops' ? 'ops fallback' : 'none'}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
          <p className="text-[11px] font-medium text-zinc-500">Treasury balance</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">
            {balance == null ? '—' : `${balance.toFixed(4)} XLM`}
          </p>
        </div>
      </div>

      {err && (
        <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">{err}</span>
        </div>
      )}
      {msg && (
        <div className="flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">{msg}</span>
        </div>
      )}

      {/* Create / manage */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">1 · Your treasury wallet</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Stored only in this browser’s localStorage. Clear site data removes the key (funds stay on-chain).
        </p>

        {treasuryG ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Public address</p>
              <p className="mt-1 break-all font-mono text-xs text-zinc-900 dark:text-zinc-100">{treasuryG}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyG()}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-[11px] font-medium dark:border-zinc-700"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={onCreate}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-[11px] font-medium dark:border-zinc-700"
                >
                  <Plus className="h-3 w-3" /> Replace
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2.5 py-1 text-[11px] font-medium text-red-600"
                >
                  <Trash2 className="h-3 w-3" /> Remove from browser
                </button>
              </div>
            </div>
            {activeTreasuryG && activeTreasuryG !== treasuryG && (
              <p className="text-[11px] text-amber-600">
                Active auto-approve key is {shortG(activeTreasuryG)} (ops fallback). Personal key is set but may need Auto-approve ON.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-zinc-900 px-4 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
            >
              <Plus className="h-3.5 w-3.5" /> Create personal treasury
            </button>
            <button
              type="button"
              onClick={() => setImportOpen((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-200 px-4 text-xs font-medium dark:border-zinc-700"
            >
              Import secret
            </button>
          </div>
        )}

        {importOpen && (
          <div className="mt-3 space-y-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
            <input
              type="password"
              value={importSecret}
              onChange={(e) => setImportSecret(e.target.value)}
              placeholder="S… secret seed (stays in this browser)"
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={onImport}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900"
            >
              Import
            </button>
          </div>
        )}
      </section>

      {/* Fund */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">2 · Fund from connected wallet</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Sends classic XLM from your Freighter funding wallet → personal treasury (creates account if new).
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-zinc-400">
              <Wallet className="h-3 w-3" /> From (Freighter)
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-800 dark:text-zinc-200">
              {fundingOk ? shortG(fundingWallet) : 'Not connected'}
            </p>
            <p className="mt-1 text-[11px] tabular-nums text-zinc-500">
              {fundingBalance == null ? '—' : `${fundingBalance.toFixed(4)} XLM`}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-zinc-400">
              <Vault className="h-3 w-3" /> To (treasury)
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-800 dark:text-zinc-200">
              {treasuryG ? shortG(treasuryG) : 'Create treasury first'}
            </p>
            <p className="mt-1 text-[11px] tabular-nums text-zinc-500">
              {balance == null ? '—' : `${balance.toFixed(4)} XLM`}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block text-xs text-zinc-600 dark:text-zinc-400">
            Amount (XLM)
            <input
              type="number"
              min={1}
              step="0.1"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="mt-1 h-9 w-32 rounded-md border border-zinc-200 bg-white px-2.5 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-950"
            />
          </label>
          <button
            type="button"
            disabled={busy || !treasuryG || !fundingOk}
            onClick={() => void onFund()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-4 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownToLine className="h-3.5 w-3.5" />}
            Fund treasury with Freighter
          </button>
        </div>
        <p className="mt-2 text-[10px] text-zinc-400">
          Tip: private pays need treasury balance ≥ pay amount + ~1.5 XLM reserve/fees (e.g. 10 XLM pay → fund ≥ 12 XLM).
        </p>
      </section>

      {/* Auto-approve */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">3 · Enable auto-approve</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          When ON, private ZK fund/deposit/withdraw are signed with your personal treasury — no Freighter windows.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={enableAutoApprove}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Turn auto-approve ON
          </button>
          <button
            type="button"
            onClick={disableAutoApprove}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-200 px-4 text-xs font-medium dark:border-zinc-700"
          >
            Use Freighter popups instead
          </button>
        </div>
      </section>
    </div>
  );
}
