import { useCallback, useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import {
  Coins,
  RefreshCw,
  Ticket,
  AlertTriangle,
  Flame,
  Snowflake,
  ShoppingCart,
  ExternalLink,
  Wallet,
  History,
  ArrowRight,
} from 'lucide-react';
import {
  workspaceApi,
  type CreditBalance,
  type CreditLedgerEvent,
} from '../../api/api';
import { useWorkspaceStore } from '../../stores/workspace';
import { useWorkspaceRbac } from '../../rbac/useWorkspaceRbac';
import RequirePermission, { AccessDenied } from '../../rbac/RequirePermission';
import { openNftCheckout } from '../../lib/nftCheckout';

type Pack = {
  id: string;
  name: string;
  zcrAmount: number;
  usdcPrice: string;
  description?: string;
  custom?: boolean;
  unitPriceUsdc?: number;
};

type CustomPricing = {
  enabled: boolean;
  min: number;
  max: number;
  unitPriceUsdc: number;
  note?: string;
};

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
  const [packs, setPacks] = useState<Pack[]>([]);
  const [customPricing, setCustomPricing] = useState<CustomPricing>({
    enabled: true,
    min: 50,
    max: 50_000,
    unitPriceUsdc: 0.05,
  });
  const [nftCollectionId, setNftCollectionId] = useState<string | null>(null);
  const [purchaseMode, setPurchaseMode] = useState('sandbox');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [promoStatus, setPromoStatus] = useState<string | null>(null);
  const [promoValid, setPromoValid] = useState<boolean | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [validateBusy, setValidateBusy] = useState(false);
  const [envBusy, setEnvBusy] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyMsg, setBuyMsg] = useState<string | null>(null);
  /** Step 1: pick ZCR amount · Step 2: confirm charge · then wallet popup */
  const [buyStep, setBuyStep] = useState<'select' | 'confirm'>('select');
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [pendingCustom, setPendingCustom] = useState<Pack | null>(null);
  const [customZcrInput, setCustomZcrInput] = useState('');

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [res, catalog] = await Promise.all([
        workspaceApi.getCredits(workspaceId),
        workspaceApi.listCreditPacks().catch(() => null),
      ]);
      setBalance(res.credits);
      setEnvironment(res.environment || 'testnet');
      setBurnsOnUse(!!res.burnsOnUse);
      setLedger(res.recent || []);
      if (catalog) {
        setPacks(catalog.packs || []);
        setNftCollectionId(catalog.nftCollectionId || null);
        setPurchaseMode(catalog.purchaseMode || 'sandbox');
        if (catalog.custom) {
          setCustomPricing({
            enabled: catalog.custom.enabled !== false,
            min: catalog.custom.min ?? 50,
            max: catalog.custom.max ?? 50_000,
            unitPriceUsdc: catalog.custom.unitPriceUsdc ?? 0.05,
            note: catalog.custom.note,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credits');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const validate = async () => {
    if (!workspaceId || !promoCode.trim()) return;
    setValidateBusy(true);
    setPromoMsg(null);
    setPromoStatus(null);
    setPromoValid(null);
    try {
      const res = await workspaceApi.validatePromo(workspaceId, promoCode.trim());
      setPromoValid(!!res.valid);
      setPromoStatus(res.status);
      setPromoMsg(res.message || (res.valid ? 'Valid' : 'Invalid'));
    } catch (err) {
      setPromoValid(false);
      setPromoStatus('error');
      setPromoMsg(err instanceof Error ? err.message : 'Validate failed');
    } finally {
      setValidateBusy(false);
    }
  };

  const redeem = async () => {
    if (!workspaceId || !promoCode.trim()) return;
    setPromoBusy(true);
    setPromoMsg(null);
    try {
      const check = await workspaceApi.validatePromo(workspaceId, promoCode.trim());
      setPromoValid(!!check.valid);
      setPromoStatus(check.status);
      if (!check.valid) {
        setPromoMsg(check.message || 'Promo cannot be redeemed');
        return;
      }
      const res = await workspaceApi.redeemPromo(workspaceId, promoCode.trim());
      setPromoMsg(
        `Redeemed +${res.tx?.amount ?? check.creditAmount ?? ''} ZCR. Balance: ${res.balance?.balance ?? '—'} ZCR`,
      );
      setPromoStatus('redeemed');
      setPromoValid(null);
      setPromoCode('');
      await load();
    } catch (err) {
      setPromoValid(false);
      setPromoMsg(err instanceof Error ? err.message : 'Redeem failed');
    } finally {
      setPromoBusy(false);
    }
  };

  const switchEnv = async (next: 'testnet' | 'mainnet') => {
    if (!workspace || !canWrite || !workspaceId) return;
    if (next === environment) return;
    if (next === 'mainnet') {
      const ok = window.confirm(
        'Switch to MAINNET?\n\nPlatform ZCR will burn when services are used. You can switch back to Testnet anytime.',
      );
      if (!ok) return;
    }
    setEnvBusy(true);
    setError(null);
    try {
      // Dedicated API — reliable even when ownerId ≠ Cognito username
      const res = await workspaceApi.setEnvironment(workspaceId, next);
      const env = (res.environment || next) as 'testnet' | 'mainnet';
      setEnvironment(env);
      setBurnsOnUse(env === 'mainnet');
      updateWorkspace(workspace.id, {
        settings: {
          ...workspace.settings,
          environment: env,
          defaultNetwork: env === 'mainnet' ? 'Stellar Mainnet' : 'Stellar Testnet',
        },
        environment: env,
      } as any);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch environment');
    } finally {
      setEnvBusy(false);
    }
  };

  const selectedPack =
    pendingCustom
    || packs.find(p => p.id === selectedPackId)
    || null;

  const quoteCustomZcr = (raw: string): Pack | null => {
    const n = Math.floor(Number(String(raw).replace(/,/g, '')));
    if (!Number.isFinite(n) || n <= 0) return null;
    if (n < customPricing.min || n > customPricing.max) return null;
    const exact = packs.find(p => p.zcrAmount === n);
    if (exact) return exact;
    const usdc = (n * customPricing.unitPriceUsdc).toFixed(2);
    return {
      id: `zcr_custom_${n}`,
      name: 'Custom',
      zcrAmount: n,
      usdcPrice: usdc,
      description: `Custom ${n.toLocaleString()} ZCR`,
      custom: true,
      unitPriceUsdc: customPricing.unitPriceUsdc,
    };
  };

  const goToConfirm = (packId: string) => {
    if (!canWrite) return;
    setPendingCustom(null);
    setSelectedPackId(packId);
    setBuyStep('confirm');
    setBuyMsg(null);
  };

  const applyCustomAmount = () => {
    const requested = Math.floor(Number(String(customZcrInput).replace(/,/g, '')));
    if (!Number.isFinite(requested) || requested <= 0) {
      setBuyMsg(`Enter a valid ZCR amount (${customPricing.min}–${customPricing.max.toLocaleString()}).`);
      return;
    }
    if (requested < customPricing.min || requested > customPricing.max) {
      setBuyMsg(
        `Custom amount must be between ${customPricing.min.toLocaleString()} and ${customPricing.max.toLocaleString()} ZCR.`,
      );
      return;
    }
    const pack = quoteCustomZcr(customZcrInput);
    if (!pack) {
      setBuyMsg(`Enter a valid ZCR amount (${customPricing.min}–${customPricing.max.toLocaleString()}).`);
      return;
    }
    setCustomZcrInput(String(pack.zcrAmount));
    if (pack.custom) {
      setPendingCustom(pack);
      setSelectedPackId(pack.id);
    } else {
      setPendingCustom(null);
      setSelectedPackId(pack.id);
    }
    setBuyStep('confirm');
    setBuyMsg(
      pack.custom
        ? `Custom ${pack.zcrAmount.toLocaleString()} ZCR · estimate $${pack.usdcPrice} (on-chain sale uses the Credit Pack primary price; ZCR granted = this amount).`
        : null,
    );
  };

  const startPayment = async () => {
    if (!workspaceId || !canWrite || !selectedPack) return;
    const pack = selectedPack;
    setBuyBusy(true);
    setBuyMsg(null);
    try {
      // Platform returns checkout URL + collection; never grants ZCR until chain confirms.
      const res = await workspaceApi.purchaseCreditPack(
        workspaceId,
        pack.custom
          ? { zcrAmount: pack.zcrAmount }
          : { packId: pack.id },
      );
      if (res.granted) {
        setBuyMsg(res.message || `+${res.pack?.zcrAmount ?? ''} ZCR added (sandbox)`);
        setBuyStep('select');
        setPendingCustom(null);
        await load();
        return;
      }

      const collectionId =
        res.nftCollectionId
        || nftCollectionId
        || (() => {
          try {
            if (res.nftCheckoutUrl) {
              return new URL(res.nftCheckoutUrl, window.location.origin).searchParams.get('collectionId');
            }
          } catch { /* ignore */ }
          return null;
        })();

      if (!collectionId) {
        setBuyMsg(
          res.message
            || 'NFT credit gateway is not configured. Credit Pack collection must be linked on the platform API.',
        );
        return;
      }

      const zcrAmount = res.pack?.zcrAmount ?? pack.zcrAmount;
      const packId = res.pack?.id ?? pack.id;
      let checkoutOrigin = window.location.origin;
      try {
        if (res.nftCheckoutUrl) {
          checkoutOrigin = new URL(res.nftCheckoutUrl, window.location.origin).origin;
        }
      } catch { /* same origin */ }

      setBuyMsg(
        `Opening wallet checkout… +${(zcrAmount ?? 0).toLocaleString()} ZCR after on-chain confirm.`,
      );
      openNftCheckout({
        collectionId,
        checkoutOrigin,
        workspaceId,
        zcrAmount,
        packId,
        onSuccess: (payload) => {
          const granted = payload.creditZcrAmount ?? zcrAmount;
          setBuyMsg(
            `Payment confirmed${granted ? ` · +${granted} ZCR` : ''}${payload.transactionHash ? ` · ${String(payload.transactionHash).slice(0, 10)}…` : ''}. Refreshing balance…`,
          );
          setBuyStep('select');
          setSelectedPackId(null);
          setPendingCustom(null);
          void load();
        },
        onError: (payload) => {
          setBuyMsg(payload.message || 'Checkout failed');
        },
        onClose: () => {
          void load();
        },
      });
    } catch (err) {
      setBuyMsg(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setBuyBusy(false);
    }
  };

  return (
    <RequirePermission
      permission="workspace.view"
      workspaceId={workspaceId}
      fallback={<AccessDenied title="Credits access required" />}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-5 dark:border-zinc-900">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">Workspace</p>
            <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Credits (ZCR)</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
              Platform currency for Zexvro services. Buy custom or pack amounts via wallet checkout, redeem promos, track burns.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
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

        <div className="grid gap-px border-y border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-3">
          <div className="bg-white p-5 dark:bg-[#0A0A0B]">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
              <Coins className="h-3.5 w-3.5" /> Balance
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-zinc-950 dark:text-white">
              {loading && !balance ? '—' : (balance?.balance ?? 0).toLocaleString()}
              <span className="ml-1.5 text-sm font-medium text-zinc-400">ZCR</span>
            </p>
            <p className="mt-1 text-[11px] text-zinc-400">Available for service use</p>
          </div>

          <div className="bg-white p-5 dark:bg-[#0A0A0B]">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
              {burnsOnUse ? (
                <Flame className="h-3.5 w-3.5 text-orange-500" />
              ) : (
                <Snowflake className="h-3.5 w-3.5 text-sky-500" />
              )}
              Burn gate
            </div>
            <p className="mt-3 text-lg font-semibold uppercase tracking-wide text-zinc-950 dark:text-white">
              {environment}
            </p>
            <p className="mt-1 text-[11px] text-zinc-400">
              {burnsOnUse ? 'Service use debits ZCR.' : 'Testnet — ZCR is not burned.'}
            </p>
            {canWrite ? (
              <div className="mt-3 inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-800">
                <button
                  type="button"
                  disabled={envBusy || environment === 'testnet'}
                  onClick={() => void switchEnv('testnet')}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40 ${
                    environment === 'testnet'
                      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Testnet
                </button>
                <button
                  type="button"
                  disabled={envBusy || environment === 'mainnet'}
                  onClick={() => void switchEnv('mainnet')}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40 ${
                    environment === 'mainnet'
                      ? 'bg-orange-500 text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Mainnet
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-zinc-500">Owner/Admin can switch.</p>
            )}
          </div>

          <div className="bg-white p-5 dark:bg-[#0A0A0B]">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
              <Wallet className="h-3.5 w-3.5" /> How to buy
            </div>
            <ol className="mt-3 space-y-1.5 text-[11px] text-zinc-500">
              <li className="flex gap-2"><span className="font-semibold text-zinc-700 dark:text-zinc-300">1</span> Pick pack or custom ZCR</li>
              <li className="flex gap-2"><span className="font-semibold text-zinc-700 dark:text-zinc-300">2</span> Confirm amount</li>
              <li className="flex gap-2"><span className="font-semibold text-zinc-700 dark:text-zinc-300">3</span> Pay with wallet (Freighter+)</li>
            </ol>
            <button
              type="button"
              onClick={() => {
                setBuyStep('select');
                document.getElementById('zcr-buy-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400"
            >
              Go to buy <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <Ticket className="h-3.5 w-3.5" /> Redeem promo
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={promoCode}
              onChange={e => {
                setPromoCode(e.target.value.toUpperCase());
                setPromoValid(null);
                setPromoStatus(null);
                setPromoMsg(null);
              }}
              placeholder="ZXR-…"
              disabled={!canWrite || promoBusy}
              className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 font-mono text-xs uppercase outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 sm:max-w-xs"
            />
            <button
              type="button"
              disabled={!canWrite || validateBusy || promoBusy || !promoCode.trim()}
              onClick={() => void validate()}
              className="rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200"
            >
              Check
            </button>
            <button
              type="button"
              disabled={!canWrite || promoBusy || !promoCode.trim()}
              onClick={() => void redeem()}
              className="rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
            >
              Redeem
            </button>
          </div>
          {promoMsg ? (
            <p
              className={`mt-2 text-[11px] ${
                promoValid === true || promoStatus === 'redeemed'
                  ? 'text-emerald-500'
                  : promoValid === false
                    ? 'text-amber-500'
                    : 'text-zinc-500'
              }`}
            >
              {promoStatus && promoStatus !== 'redeemed' ? (
                <span className="mr-1 font-mono uppercase opacity-80">[{promoStatus}]</span>
              ) : null}
              {promoMsg}
            </p>
          ) : null}
        </div>

        {/* Buy credits — select amount first, then Freighter charge */}
        <section id="zcr-buy-section" className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
              <ShoppingCart className="h-4 w-4" /> Buy credits
            </h2>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-400">
              <span className={buyStep === 'select' ? 'font-semibold text-zinc-700 dark:text-zinc-200' : ''}>1 · Amount</span>
              <span aria-hidden>→</span>
              <span className={buyStep === 'confirm' ? 'font-semibold text-zinc-700 dark:text-zinc-200' : ''}>2 · Pay</span>
              <span className="ml-2 normal-case tracking-normal text-zinc-500">
                {purchaseMode === 'nft' ? 'Wallet / Stellar' : 'Sandbox'}
              </span>
            </div>
          </div>
          <div className="p-5">
            {buyStep === 'select' ? (
              <>
                <p className="mb-4 text-xs text-zinc-500">
                  Choose a pack or enter any custom ZCR amount ({customPricing.min.toLocaleString()}–
                  {customPricing.max.toLocaleString()}). ZCR is granted after wallet payment confirms.
                  {nftCollectionId
                    ? ` Pack collection ${nftCollectionId.slice(0, 8)}…`
                    : ' Waiting for Credit Pack collection link.'}
                </p>
                {packs.length === 0 && !customPricing.enabled ? (
                  <p className="text-xs text-zinc-500">No packs available.</p>
                ) : (
                  <>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      Pack shortcuts
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {packs.map(pack => {
                        const isSelected = !pendingCustom && selectedPackId === pack.id;
                        return (
                          <button
                            key={pack.id}
                            type="button"
                            disabled={!canWrite}
                            onClick={() => goToConfirm(pack.id)}
                            className={`flex flex-col rounded-xl border p-4 text-left transition disabled:opacity-40 ${
                              isSelected
                                ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 dark:border-white dark:bg-zinc-900 dark:ring-white'
                                : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
                            }`}
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{pack.name}</p>
                            <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                              {pack.zcrAmount.toLocaleString()}
                              <span className="ml-1 text-sm font-medium text-zinc-400">ZCR</span>
                            </p>
                            <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              ${pack.usdcPrice} <span className="font-normal text-zinc-500">est.</span>
                            </p>
                            {pack.description ? (
                              <p className="mt-2 text-[11px] text-zinc-400">{pack.description}</p>
                            ) : null}
                            <span className="mt-3 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                              Select →
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {customPricing.enabled ? (
                      <div className="mt-5 rounded-lg border border-dashed border-zinc-200 p-4 dark:border-zinc-800">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                          Custom ZCR amount
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          Any amount from {customPricing.min.toLocaleString()} to{' '}
                          {customPricing.max.toLocaleString()} ZCR
                          {customPricing.unitPriceUsdc
                            ? ` · ~$${customPricing.unitPriceUsdc}/ZCR guide price`
                            : ''}
                          . Exact catalog amounts use the matching pack.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <input
                            type="number"
                            min={customPricing.min}
                            max={customPricing.max}
                            step={1}
                            value={customZcrInput}
                            onChange={e => setCustomZcrInput(e.target.value)}
                            placeholder={`e.g. ${Math.max(customPricing.min, 250)}`}
                            disabled={!canWrite}
                            className="h-9 w-36 rounded-lg border border-zinc-200 bg-white px-2.5 font-mono text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                          />
                          <button
                            type="button"
                            disabled={!canWrite || !customZcrInput.trim()}
                            onClick={applyCustomAmount}
                            className="rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200"
                          >
                            Use custom amount
                          </button>
                        </div>
                        {(() => {
                          const live = quoteCustomZcr(customZcrInput);
                          if (!live || !customZcrInput.trim()) return null;
                          return (
                            <p className="mt-2 text-[11px] text-zinc-500">
                              Preview: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{live.zcrAmount.toLocaleString()} ZCR</span>
                              {' · '}
                              ${live.usdcPrice} guide
                              {live.custom ? ' (custom)' : ` (${live.name} pack)`}
                            </p>
                          );
                        })()}
                      </div>
                    ) : null}
                  </>
                )}
              </>
            ) : selectedPack ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Payment summary
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-zinc-500">You receive</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                        {selectedPack.zcrAmount.toLocaleString()}
                        <span className="ml-1 text-sm font-medium text-zinc-400">ZCR</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {selectedPack.custom ? 'Custom amount' : `${selectedPack.name} pack`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Guide price</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                        ${selectedPack.usdcPrice}
                        <span className="ml-1 text-sm font-medium text-zinc-400">est.</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        Stellar wallet checkout · Freighter / Albedo / xBull / more
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
                    ZCR is added only after the on-chain purchase confirms — not when you open checkout.
                    Switch your wallet to the same network as the Credit Pack collection (Mainnet for live packs).
                    {selectedPack.custom
                      ? ' Custom grants use the amount you chose; the NFT sale price is whatever the pack collection owner set on-chain.'
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={buyBusy}
                    onClick={() => {
                      setBuyStep('select');
                      setPendingCustom(null);
                      setBuyMsg(null);
                    }}
                    className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200"
                  >
                    ← Change amount
                  </button>
                  <button
                    type="button"
                    disabled={!canWrite || buyBusy}
                    onClick={() => void startPayment()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
                  >
                    {buyBusy
                      ? 'Opening…'
                      : `Buy ${selectedPack.zcrAmount.toLocaleString()} ZCR with wallet`}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="text-xs text-sky-500"
                onClick={() => setBuyStep('select')}
              >
                Select an amount
              </button>
            )}
            {buyMsg ? (
              <p className={`mt-3 text-[11px] ${buyMsg.toLowerCase().includes('fail') || buyMsg.toLowerCase().includes('blocked') || buyMsg.toLowerCase().includes('not configured') ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {buyMsg}
              </p>
            ) : null}
            {nftCollectionId ? (
              <a
                href={`/nft/collections/${nftCollectionId}?workspaceId=${encodeURIComponent(workspaceId || '')}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-sky-500 hover:underline"
              >
                Open NFT credit pack collection <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </section>

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
              <History className="h-4 w-4 text-zinc-400" /> Recent ledger
            </h2>
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">{ledger.length} events</span>
          </div>
          {ledger.length === 0 ? (
            <div className="p-10 text-center text-xs text-zinc-500">
              No credit transactions yet. Buy a pack or redeem a promo to start the ledger.
            </div>
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
                      <td className="px-5 py-3 text-zinc-500">
                        {row.service}
                        {row.action ? `.${row.action}` : ''}
                      </td>
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
