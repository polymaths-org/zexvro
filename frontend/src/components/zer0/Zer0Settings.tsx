import { useState, useEffect } from 'react';
import {
  Settings, Shield, Wallet, Eye, AlertTriangle, Save, RotateCcw, CheckCircle2,
  Check, Loader2, X, Info, Server, Power, PowerOff, RefreshCw, Zap, Scale, Lock, SlidersHorizontal,
} from 'lucide-react';
import { useZer0Store, privacyPresetValues } from '../../stores/zer0';
import type { Zer0ProofSystem, Zer0Currency, Zer0PrivacyPreset } from '../../stores/types';
import { stellar, zkWorkerApi, type ZkWorkerStatus } from '../../api/api';
import {
  connectFreighter, connectAlbedo, connectXBull, isValidStellarPublicKey,
} from '../../api/walletConnect';
import {
  getContractRoot, getCommitmentCount, POOL_CONTRACT, DENOMINATION_XLM,
  isAutoSignEnabled, isTreasuryKeyConfigured, setForceFreighterSigning, getTreasuryPublicKey,
} from '../../api/privacyPool';
import { computePrivacyScore } from '../../lib/stealth';

const PRIVACY_PRESETS: Record<Zer0PrivacyPreset, {
  name: string;
  tagline: string;
  icon: typeof Zap;
  accent: string;
  ring: string;
  bullets: string[];
  wait: string;
}> = {
  fast: {
    name: 'Fast',
    tagline: 'ZK proof + pool only',
    icon: Zap,
    accent: 'text-amber-600 dark:text-amber-400',
    ring: 'border-amber-400 bg-amber-500/5 dark:border-amber-500/50',
    bullets: [
      'No timing delay or jitter',
      'No decoy deposits',
      'No stealth one-time receives',
      'Just proof generation + contract settle',
    ],
    wait: '~seconds',
  },
  balanced: {
    name: 'Balanced',
    tagline: 'Recommended default',
    icon: Scale,
    accent: 'text-blue-600 dark:text-blue-400',
    ring: 'border-blue-400 bg-blue-500/5 dark:border-blue-500/50',
    bullets: [
      '45s delay + 30s jitter',
      '1 pre-pay decoy note',
      'Batch deposit → delay → withdraw',
      'Stealth one-time receives on',
    ],
    wait: '~45–75s extra',
  },
  secured: {
    name: 'Secured',
    tagline: 'Max privacy knobs',
    icon: Lock,
    accent: 'text-violet-600 dark:text-violet-400',
    ring: 'border-violet-400 bg-violet-500/5 dark:border-violet-500/50',
    bullets: [
      '120s delay + 60s jitter',
      '3 pre-pay decoys + post-pay decoy',
      'Batch deposit → delay → withdraw',
      'Stealth one-time receives on',
    ],
    wait: '~2–3 min extra',
  },
  custom: {
    name: 'Custom',
    tagline: 'Tune every knob',
    icon: SlidersHorizontal,
    accent: 'text-zinc-700 dark:text-zinc-300',
    ring: 'border-zinc-400 bg-zinc-500/5 dark:border-zinc-500/50',
    bullets: [
      'Full control of delay & jitter',
      'Decoys, batching, stealth',
      'Use when presets don’t fit',
    ],
    wait: 'You decide',
  },
};

const PROOF_SYSTEMS: Record<Zer0ProofSystem, {
  name: string;
  tagline: string;
  features: string[];
  tradeoffs: string[];
  bestFor: string;
  active: boolean;
}> = {
  Groth16: {
    name: 'Groth16',
    tagline: 'Fast, compact proofs — production standard',
    features: [
      'Very small proofs (~130 bytes) — cheap to store on-chain',
      'Fast verification (~milliseconds) — low network fees',
      'Widely used in production privacy systems',
      'Works with our live Stellar privacy pool today',
    ],
    tradeoffs: [
      'Requires a one-time trusted setup ceremony',
      'Setup is circuit-specific (new circuit = new ceremony)',
    ],
    bestFor: 'Payroll & treasury at scale where speed and cost matter',
    active: true,
  },
  PLONK: {
    name: 'PLONK',
    tagline: 'Universal setup — flexible for evolving rules',
    features: [
      'One trusted setup can cover many different circuits',
      'Easier to update payment rules without re-running a full ceremony',
      'Still efficient for enterprise verification',
    ],
    tradeoffs: [
      'Larger proofs than Groth16 (~1–2 KB)',
      'Slightly higher verification cost',
      'Not wired to the live pool contract yet',
    ],
    bestFor: 'Teams that expect frequent policy or circuit changes',
    active: false,
  },
  Halo2: {
    name: 'Halo2',
    tagline: 'No trusted setup — maximum transparency',
    features: [
      'No trusted setup ceremony required',
      'Supports recursive proofs (proofs of proofs)',
      'Strong option when auditors require transparent setup',
    ],
    tradeoffs: [
      'Slower proof generation on the client',
      'Larger proofs and higher compute cost',
      'Not wired to the live pool contract yet',
    ],
    bestFor: 'Organizations that prioritize setup transparency over speed',
    active: false,
  },
};

export default function Zer0Settings() {
  const settings = useZer0Store(s => s.settings);
  const updateSettings = useZer0Store(s => s.updateSettings);
  const resetSettings = useZer0Store(s => s.resetSettings);
  const securityEvents = useZer0Store(s => s.securityEvents);
  const clearSecurityEvents = useZer0Store(s => s.clearSecurityEvents);
  const dailySpend = useZer0Store(s => s.dailySpend);

  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'wallet' | 'privacy' | 'security' | 'compliance'>('general');
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [simulatedBalance, setSimulatedBalance] = useState<{ XLM: number; USDC: number } | null>(null);
  const [connectedProvider, setConnectedProvider] = useState<string | null>(null);
  const [poolOnChainInfo, setPoolOnChainInfo] = useState<{ root: string; count: number } | null>(null);
  const [poolInfoLoading, setPoolInfoLoading] = useState(false);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofDraft, setProofDraft] = useState<Zer0ProofSystem>(local.proofSystem);
  const [zkWorker, setZkWorker] = useState<ZkWorkerStatus | null>(null);
  const [zkWorkerLoading, setZkWorkerLoading] = useState(false);
  const [zkWorkerAction, setZkWorkerAction] = useState<'start' | 'stop' | null>(null);
  const [zkWorkerError, setZkWorkerError] = useState<string | null>(null);

  const refreshZkWorker = async () => {
    setZkWorkerLoading(true);
    setZkWorkerError(null);
    try {
      const st = await zkWorkerApi.status();
      setZkWorker(st);
    } catch (e) {
      setZkWorkerError(e instanceof Error ? e.message : 'Failed to load prover status');
    } finally {
      setZkWorkerLoading(false);
    }
  };

  const startZkWorker = async () => {
    setZkWorkerAction('start');
    setZkWorkerError(null);
    try {
      const st = await zkWorkerApi.start();
      setZkWorker(st);
      // Poll a few times while EC2 boots
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 4000));
        const next = await zkWorkerApi.status();
        setZkWorker(next);
        if (next.online || next.state === 'running') break;
      }
    } catch (e) {
      setZkWorkerError(e instanceof Error ? e.message : 'Failed to start prover');
    } finally {
      setZkWorkerAction(null);
    }
  };

  const stopZkWorker = async () => {
    setZkWorkerAction('stop');
    setZkWorkerError(null);
    try {
      const st = await zkWorkerApi.stop();
      setZkWorker(st);
      await new Promise(r => setTimeout(r, 2000));
      const next = await zkWorkerApi.status();
      setZkWorker(next);
    } catch (e) {
      setZkWorkerError(e instanceof Error ? e.message : 'Failed to stop prover');
    } finally {
      setZkWorkerAction(null);
    }
  };

  useEffect(() => {
    setLocal({ ...settings });
  }, [settings.walletAddress, settings.horizonUrl, settings.contractAddress, settings.proofSystem]);

  useEffect(() => {
    if (activeTab === 'security') {
      refreshZkWorker();
    }
  }, [activeTab]);

  useEffect(() => {
    if (local.walletAddress?.trim()) {
      setWalletLoading(true);
      stellar.getPoolBalance(local.walletAddress.trim(), local.horizonUrl)
        .then(b => setSimulatedBalance({ XLM: b.XLM || 0, USDC: b.USDC || 0 }))
        .catch(() => setSimulatedBalance(null))
        .finally(() => setWalletLoading(false));
    } else {
      setSimulatedBalance(null);
    }
  }, [local.walletAddress, local.horizonUrl]);

  useEffect(() => {
    if (local.contractAddress?.trim()) {
      setPoolInfoLoading(true);
      Promise.all([getContractRoot(), getCommitmentCount()])
        .then(([root, count]) => setPoolOnChainInfo({ root, count }))
        .catch(() => setPoolOnChainInfo(null))
        .finally(() => setPoolInfoLoading(false));
    }
  }, [local.contractAddress]);

  const hasChanges = JSON.stringify(local) !== JSON.stringify(settings);

  const applyPrivacyPreset = (preset: Zer0PrivacyPreset) => {
    if (preset === 'custom') {
      setLocal(l => ({ ...l, privacyPreset: 'custom' }));
      return;
    }
    setLocal(l => ({ ...l, ...privacyPresetValues(preset) }));
  };

  /** Any manual knob tweak flips the profile to Custom so Save keeps free-form values. */
  const setPrivacyKnob = <K extends keyof typeof local>(key: K, value: (typeof local)[K]) => {
    setLocal(l => ({ ...l, [key]: value, privacyPreset: 'custom' as Zer0PrivacyPreset }));
  };

  const handleSave = async () => {
    // Re-assert preset values on save so Fast/Balanced/Secured stay exact
    const preset = local.privacyPreset || 'balanced';
    const payload = preset === 'custom'
      ? local
      : { ...local, ...privacyPresetValues(preset) };
    setLocal(payload);
    updateSettings(payload);
    setForceFreighterSigning(!!payload.preferFreighterSigning);
    if (payload.walletAddress?.trim()) {
      try {
        const balances = await stellar.getPoolBalance(payload.walletAddress.trim(), payload.horizonUrl);
        useZer0Store.setState(state => ({
          pool: {
            ...state.pool,
            balances: {
              USDC: Number(balances.USDC || 0),
              XLM: Number(balances.XLM || 0),
              EURC: Number(balances.EURC || 0),
            },
            lastUpdated: Date.now(),
          },
        }));
      } catch {}
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const connectWallet = async (provider: 'Freighter' | 'Albedo' | 'xBull') => {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const net = local.horizonUrl.includes('testnet') ? 'TESTNET' : 'PUBLIC';
      const conn = provider === 'Freighter'
        ? await connectFreighter(net)
        : provider === 'Albedo'
          ? await connectAlbedo(net)
          : await connectXBull(net);
      const next = { ...local, walletAddress: conn.publicKey };
      setLocal(next);
      setConnectedProvider(provider);
      updateSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setWalletError(err.message || `${provider} connection failed`);
    } finally {
      setWalletLoading(false);
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'wallet' as const, label: 'Wallet', icon: Wallet },
    { id: 'privacy' as const, label: 'Privacy', icon: Shield },
    { id: 'security' as const, label: 'Security', icon: AlertTriangle },
    { id: 'compliance' as const, label: 'Compliance', icon: Eye },
  ];

  const denomXlm = DENOMINATION_XLM;
  const selectedProof = PROOF_SYSTEMS[local.proofSystem];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Settings</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Payroll privacy and wallet preferences — designed for finance teams.
          </p>
        </div>
        <button onClick={handleSave}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition shadow-sm ${
            saved ? 'bg-emerald-600 text-white' : hasChanges ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600'
          }`}>
          {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}>
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#0A0A0B]">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Default Currency</label>
                <select value={local.defaultCurrency}
                  onChange={e => setLocal(l => ({ ...l, defaultCurrency: e.target.value as Zer0Currency }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                  <option value="XLM">XLM (native Stellar)</option>
                  <option value="USDC">USDC</option>
                  <option value="EURC">EURC</option>
                </select>
                <p className="text-[10px] text-zinc-400 mt-1">Shielded pool currently settles in XLM units of {denomXlm} XLM each.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Timezone</label>
                <input value={local.timezone} onChange={e => setLocal(l => ({ ...l, timezone: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                  Payroll policy
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Workspace rules for how money is allowed to move. Save changes after toggling.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Require payment approval</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        local.paymentApprovalRequired
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {local.paymentApprovalRequired ? 'On' : 'Off'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      When on, a second admin must approve before funds leave the workspace.
                      Use for dual-control payroll and larger one-off transfers.
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => setLocal(l => ({ ...l, paymentApprovalRequired: !l.paymentApprovalRequired }))}
                    className={`relative h-5 w-9 rounded-full transition-colors shrink-0 mt-0.5 ${local.paymentApprovalRequired ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${local.paymentApprovalRequired ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Allow transparent (public) payments</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        local.allowTransparentPayments
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {local.allowTransparentPayments ? 'On' : 'Off'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      When <strong>off</strong>, every pay must use the privacy pool (recommended for salary).
                      When <strong>on</strong>, admins can still send fully public Stellar transfers (amount + parties visible on explorers).
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => setLocal(l => ({ ...l, allowTransparentPayments: !l.allowTransparentPayments }))}
                    className={`relative h-5 w-9 rounded-full transition-colors shrink-0 mt-0.5 ${local.allowTransparentPayments ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${local.allowTransparentPayments ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5 uppercase tracking-wider">Network</label>
              <div className="flex gap-2 mb-2">
                <button type="button"
                  onClick={() => setLocal(l => ({
                    ...l,
                    horizonUrl: 'https://horizon-testnet.stellar.org',
                    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
                  }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    local.horizonUrl.includes('testnet')
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                  Testnet (practice)
                </button>
                <button type="button"
                  onClick={() => setLocal(l => ({
                    ...l,
                    horizonUrl: 'https://horizon.stellar.org',
                    sorobanRpcUrl: 'https://mainnet.stellar.org',
                  }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    !local.horizonUrl.includes('testnet')
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                  Mainnet (real funds)
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                {local.horizonUrl.includes('testnet')
                  ? 'Testnet uses free test money — safe for demos.'
                  : 'Mainnet moves real assets. Double-check amounts before signing.'}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block uppercase tracking-wider">Company funding wallet</label>
              {local.walletAddress ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Check className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                        Connected {connectedProvider && `via ${connectedProvider}`}
                      </span>
                      <span className="font-mono text-[11px] break-all block mt-0.5 text-zinc-600 dark:text-zinc-400">{local.walletAddress}</span>
                      {walletLoading ? (
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1.5 mt-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" /> Checking balance…
                        </span>
                      ) : simulatedBalance ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mt-1.5">
                          {simulatedBalance.XLM.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
                          {simulatedBalance.USDC > 0 && ` · ${simulatedBalance.USDC.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => {
                      const next = { ...local, walletAddress: '' };
                      setLocal(next);
                      setConnectedProvider(null);
                      updateSettings(next);
                    }}
                    className="h-8 px-3 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:text-red-500 dark:border-zinc-800 dark:text-zinc-400 shrink-0">
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(['Freighter', 'Albedo', 'xBull'] as const).map(p => (
                      <button key={p} type="button" disabled={walletLoading} onClick={() => connectWallet(p)}
                        className="h-11 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-bold flex items-center justify-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                        {walletLoading && connectedProvider === p ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4 text-blue-500" />}
                        {p}
                      </button>
                    ))}
                  </div>
                  {walletError && (
                    <div className="text-xs font-semibold text-rose-600 bg-rose-500/10 rounded-lg p-3">{walletError}</div>
                  )}
                  <div className="flex gap-2">
                    <input value={local.walletAddress}
                      onChange={e => {
                        const val = e.target.value;
                        setLocal(l => ({ ...l, walletAddress: val }));
                        setWalletError(val && !isValidStellarPublicKey(val) ? 'Invalid Stellar address (must start with G, 56 chars)' : null);
                      }}
                      placeholder="Or paste public key G…"
                      className="h-10 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-mono outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                    <button type="button"
                      disabled={!local.walletAddress || !!walletError}
                      onClick={() => { updateSettings(local); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                      className="h-10 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 disabled:opacity-40 shrink-0">
                      Save Wallet
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-blue-200/60 bg-blue-500/5 dark:border-blue-500/20 p-4 space-y-2">
              <h3 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="h-4 w-4" /> How private payroll works
              </h3>
              <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc pl-4">
                <li>Money goes into a shared pool in fixed units (1000 / 100 / 10 / 1 XLM notes).</li>
                <li>Explorers show pool transfers — not “employer paid employee $X” as one linked payment.</li>
                <li>A zero-knowledge proof proves the payee is entitled to withdraw without revealing which deposit.</li>
                <li>Pick a <strong>privacy profile</strong> (Fast / Balanced / Secured) or unlock <strong>Custom</strong> knobs (delay, decoys, stealth).</li>
              </ul>
              <p className="text-[10px] text-zinc-400">
                Signing mode is under <strong>Security → Transaction signing</strong>. Click <strong>Save Changes</strong> after choosing a profile.
              </p>
            </div>

            {/* Privacy presets */}
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                  Privacy profile
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Pick a preset for every private pay. <strong>Fast</strong> is ZK + contract only;
                  <strong> Balanced</strong> / <strong>Secured</strong> add delay, decoys, and stealth.
                  Choose <strong>Custom</strong> to tune knobs yourself.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                {(['fast', 'balanced', 'secured', 'custom'] as Zer0PrivacyPreset[]).map((id) => {
                  const p = PRIVACY_PRESETS[id];
                  const Icon = p.icon;
                  const active = (local.privacyPreset || 'balanced') === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => applyPrivacyPreset(id)}
                      className={`text-left rounded-xl border p-3.5 transition relative ${
                        active
                          ? p.ring + ' shadow-sm'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-950/40'
                      }`}
                    >
                      {active && (
                        <span className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <div className={`flex items-center gap-1.5 ${p.accent}`}>
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-sm font-bold text-zinc-900 dark:text-white">{p.name}</span>
                      </div>
                      <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">{p.tagline}</p>
                      <ul className="mt-2 space-y-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        {p.bullets.map((b) => (
                          <li key={b} className="leading-snug">· {b}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                        Extra wait · {p.wait}
                      </p>
                    </button>
                  );
                })}
              </div>
              {(local.privacyPreset || 'balanced') === 'fast' && (
                <div className="rounded-lg border border-amber-200/70 dark:border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200/90 leading-relaxed">
                  <strong>Fast</strong> still uses the privacy pool + Groth16 ZK proof on the contract — it just skips
                  timing delay, decoys, and stealth. Pays settle as quickly as the chain + prover allow.
                </div>
              )}
            </div>

            {/* Live privacy score */}
            {(() => {
              const score = computePrivacyScore({
                shielded: true,
                stealthEnabled: !!local.stealthPaymentsEnabled,
                privacyDelaySec: local.privacyDelaySec || 0,
                privacyJitterSec: local.privacyJitterSec || 0,
                decoyDepositsEnabled: !!local.decoyDepositsEnabled || !!local.postPayDecoyEnabled,
                decoyDepositCount:
                  (local.decoyDepositsEnabled ? Math.max(0, local.decoyDepositCount || 0) : 0)
                  + (local.postPayDecoyEnabled ? 1 : 0),
                anonymitySetSize: poolOnChainInfo?.count || 0,
                preferRelayer: false,
              });
              const gradeColor =
                score.grade === 'A+' || score.grade === 'A' ? 'text-emerald-600 dark:text-emerald-400'
                : score.grade === 'B' ? 'text-blue-600 dark:text-blue-400'
                : score.grade === 'C' ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400';
              const presetLabel = PRIVACY_PRESETS[(local.privacyPreset || 'balanced') as Zer0PrivacyPreset]?.name || 'Balanced';
              return (
                <div className="rounded-xl border border-violet-200/60 dark:border-violet-500/20 bg-violet-500/5 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
                      Privacy score (live) · {presetLabel}
                    </h3>
                    <span className={`text-lg font-black tabular-nums ${gradeColor}`}>
                      {score.score}<span className="text-xs font-bold ml-1">/ 100 · {score.grade}</span>
                    </span>
                  </div>
                  <ul className="text-[10px] text-zinc-600 dark:text-zinc-400 space-y-1 list-disc pl-4">
                    {score.factors.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    Updates when you change presets or custom knobs. Transparent pays always score near zero.
                  </p>
                </div>
              );
            })()}

            {/* ── Customization: core privacy knobs ── */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    {(local.privacyPreset || 'balanced') === 'custom' ? 'Custom knobs' : 'Preset knobs (preview)'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {(local.privacyPreset || 'balanced') === 'custom'
                      ? 'Tune delay, decoys, batching, and stealth. Stronger privacy is usually slower and costs more pool notes.'
                      : `Showing values for ${PRIVACY_PRESETS[(local.privacyPreset || 'balanced') as Zer0PrivacyPreset].name}. Edit any control to switch to Custom.`}
                  </p>
                </div>
                {(local.privacyPreset || 'balanced') !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => applyPrivacyPreset('custom')}
                    className="shrink-0 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Unlock custom
                  </button>
                )}
              </div>

              {/* Stealth */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Stealth one-time receives</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        local.stealthPaymentsEnabled
                          ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {local.stealthPaymentsEnabled ? 'On' : 'Off'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      When a teammate has a <code className="font-mono text-[10px]">z0st1…</code> meta-address, private pays settle to a
                      <strong> fresh G… address</strong> each time — not their long-term wallet. Breaks “always the same employee wallet” linkage.
                      Generate metas under <strong>Team</strong> or <strong>Stealth</strong>.
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => setPrivacyKnob('stealthPaymentsEnabled', !local.stealthPaymentsEnabled)}
                    className={`relative h-5 w-9 rounded-full transition-colors shrink-0 mt-0.5 ${local.stealthPaymentsEnabled ? 'bg-violet-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${local.stealthPaymentsEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Batch deposit then withdraw */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Batch: deposit all → delay → withdraw</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        local.batchDepositThenWithdraw
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {local.batchDepositThenWithdraw ? 'On' : 'Off'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      Deposit every pool note first, wait once (see timing delay), then withdraw. Recommended.
                      Off = each note deposit+withdraw back-to-back (faster, weaker timing privacy).
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => setPrivacyKnob('batchDepositThenWithdraw', !local.batchDepositThenWithdraw)}
                    className={`relative h-5 w-9 rounded-full transition-colors shrink-0 mt-0.5 ${local.batchDepositThenWithdraw ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${local.batchDepositThenWithdraw ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Timing privacy */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Timing privacy delay</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        (local.privacyDelaySec || 0) > 0
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {(local.privacyDelaySec || 0) > 0 ? 'On' : 'Off'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      Wait after deposits before any withdraw so deposit and settle times don’t line up on explorers.
                      Higher = stronger privacy, slower pays. Use <strong>0</strong> to turn off.
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => {
                      const off = (local.privacyDelaySec || 0) > 0;
                      setLocal(l => ({
                        ...l,
                        privacyPreset: 'custom',
                        privacyDelaySec: off ? 0 : 45,
                        privacyJitterSec: off ? 0 : Math.max(l.privacyJitterSec || 0, 30),
                      }));
                    }}
                    className={`relative h-5 w-9 rounded-full transition-colors shrink-0 mt-0.5 ${(local.privacyDelaySec || 0) > 0 ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${(local.privacyDelaySec || 0) > 0 ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>

                {(local.privacyDelaySec || 0) > 0 && (
                  <div className="grid sm:grid-cols-2 gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Base delay (seconds)</label>
                      <input
                        type="number" min={0} max={600} step={5}
                        value={local.privacyDelaySec || 0}
                        onChange={e => setPrivacyKnob('privacyDelaySec', Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {[15, 30, 45, 60, 120].map(v => (
                          <button key={v} type="button"
                            onClick={() => setPrivacyKnob('privacyDelaySec', v)}
                            className={`h-6 px-2 rounded text-[10px] font-bold border ${
                              (local.privacyDelaySec || 0) === v
                                ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                                : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                            }`}>
                            {v}s
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Random jitter (0…N seconds)</label>
                      <input
                        type="number" min={0} max={300} step={5}
                        value={local.privacyJitterSec || 0}
                        onChange={e => setPrivacyKnob('privacyJitterSec', Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                      <p className="text-[10px] text-zinc-400 mt-1.5">
                        Actual wait = base + random(0…jitter). Example: {local.privacyDelaySec || 0}–{(local.privacyDelaySec || 0) + (local.privacyJitterSec || 0)}s.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Pre-pay decoy deposits */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Pre-pay decoy deposits</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        local.decoyDepositsEnabled
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {local.decoyDepositsEnabled ? 'On' : 'Off'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      Before settling, deposit extra pool notes that are <strong>not</strong> withdrawn with this pay.
                      Grows the anonymity set so real payroll deposits blend with decoys. Costs extra XLM + time.
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => setLocal(l => ({
                      ...l,
                      privacyPreset: 'custom',
                      decoyDepositsEnabled: !l.decoyDepositsEnabled,
                      decoyDepositCount: !l.decoyDepositsEnabled ? Math.max(1, l.decoyDepositCount || 1) : l.decoyDepositCount,
                    }))}
                    className={`relative h-5 w-9 rounded-full transition-colors shrink-0 mt-0.5 ${local.decoyDepositsEnabled ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${local.decoyDepositsEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>
                {local.decoyDepositsEnabled && (
                  <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Decoy notes per private pay</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number" min={1} max={10} step={1}
                        value={Math.max(1, local.decoyDepositCount || 1)}
                        onChange={e => setPrivacyKnob('decoyDepositCount', Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                        className="h-9 w-24 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                      {[1, 2, 3, 5].map(v => (
                        <button key={v} type="button"
                          onClick={() => setPrivacyKnob('decoyDepositCount', v)}
                          className={`h-8 px-2.5 rounded-lg text-[10px] font-bold border ${
                            (local.decoyDepositCount || 0) === v
                              ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                              : 'border-zinc-200 dark:border-zinc-700 text-zinc-500'
                          }`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Post-pay decoy */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Post-pay decoy deposit</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        local.postPayDecoyEnabled
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {local.postPayDecoyEnabled ? 'On' : 'Off'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      After a private settle, leave one extra <strong>1 XLM</strong> note in the pool (not withdrawn).
                      Best-effort on the browser path; may be skipped if settle runs fully on the server.
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => setPrivacyKnob('postPayDecoyEnabled', !local.postPayDecoyEnabled)}
                    className={`relative h-5 w-9 rounded-full transition-colors shrink-0 mt-0.5 ${local.postPayDecoyEnabled ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${local.postPayDecoyEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Org name obfuscation */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Hide company name on labels</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        local.obfuscateOrgName
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {local.obfuscateOrgName ? 'On' : 'Off'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      Use a neutral alias in internal previews and exports. The public ledger never stores your company name either way.
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => setLocal(l => ({ ...l, obfuscateOrgName: !l.obfuscateOrgName }))}
                    className={`relative h-5 w-9 rounded-full transition-colors shrink-0 mt-0.5 ${local.obfuscateOrgName ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${local.obfuscateOrgName ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>
                {local.obfuscateOrgName && (
                  <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Public alias</label>
                    <input value={local.proxyOrgName}
                      onChange={e => setLocal(l => ({ ...l, proxyOrgName: e.target.value }))}
                      placeholder="e.g. Payroll Desk"
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                  </div>
                )}
              </div>
            </div>

            {/* Proof system picker */}
            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Privacy proof protocol</label>
              <p className="text-[11px] text-zinc-500 mb-2 leading-relaxed">
                Cryptographic system used to prove a withdraw is valid without revealing which deposit. Groth16 is live on the pool today.
              </p>
              <button type="button"
                onClick={() => { setProofDraft(local.proofSystem); setProofModalOpen(true); }}
                className="w-full text-left rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition group">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white block">{selectedProof.name}</span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5">{selectedProof.tagline}</span>
                    <span className="text-[10px] text-zinc-400 block mt-2">Click to compare protocols and choose one</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline shrink-0">Change</span>
                </div>
              </button>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Pool status</h3>
              {poolInfoLoading ? (
                <span className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </span>
              ) : poolOnChainInfo ? (
                <div className="grid sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-zinc-400 block">Pool contract</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300 break-all">{local.contractAddress || POOL_CONTRACT}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Deposits in pool (anonymity set)</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{poolOnChainInfo.count}</span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">Larger set = stronger privacy for everyone</span>
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-zinc-400">Connect a wallet and save to load pool status.</span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">Transaction signing (debug)</h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Choose how private ZK transactions are signed. Use Freighter popups when debugging failures;
                use auto-sign for multi-XLM pays without dozens of confirms (testnet ops key only).
              </p>
              <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <div className="min-w-0 pr-3">
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                    {(local.preferFreighterSigning ?? true) ? 'Freighter popups ON' : 'Freighter popups OFF (auto-sign)'}
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    {(local.preferFreighterSigning ?? true)
                      ? 'Every fund / deposit / withdraw asks Freighter — best for debugging'
                      : isTreasuryKeyConfigured()
                        ? 'Treasury key signs in the background — no Freighter windows'
                        : 'Auto-sign needs VITE_TREASURY_SECRET in .env (not configured)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !(local.preferFreighterSigning ?? true);
                    setLocal(l => ({ ...l, preferFreighterSigning: next }));
                    setForceFreighterSigning(next);
                    updateSettings({ preferFreighterSigning: next });
                  }}
                  className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${
                    (local.preferFreighterSigning ?? true) ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    (local.preferFreighterSigning ?? true) ? 'left-[18px]' : 'left-0.5'
                  }`} />
                </button>
              </div>
              <div className={`text-[10px] font-semibold rounded-lg px-3 py-2 ${
                isAutoSignEnabled()
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}>
                Active mode: {isAutoSignEnabled() ? 'Auto-sign (no popups)' : 'Freighter popups'}
                {isTreasuryKeyConfigured() ? ' · treasury key present' : ' · no treasury key'}
              </div>
              {isAutoSignEnabled() && getTreasuryPublicKey() && (
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Auto-sign spends from treasury{' '}
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{getTreasuryPublicKey()}</span>
                  {' '}— Settings wallet is ignored for private pays while auto-sign is on.
                </p>
              )}
            </div>

            {/* RapidSNARK / EC2 prover power control */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5" /> ZK prover worker (EC2)
                  </h3>
                  <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">
                    Turn the RapidSNARK prove machine <strong>ON</strong> before private payroll testing,
                    then <strong>OFF</strong> when done so you are not charged for idle compute.
                    (Stopped EC2 may still bill a little for EBS disk.)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refreshZkWorker()}
                  disabled={zkWorkerLoading || !!zkWorkerAction}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 text-[10px] font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <RefreshCw className={`h-3 w-3 ${zkWorkerLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <div className={`rounded-lg px-3 py-2.5 text-[11px] border ${
                zkWorker?.online
                  ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-800 dark:text-emerald-400'
                  : zkWorker?.configured
                    ? 'border-amber-500/25 bg-amber-500/5 text-amber-800 dark:text-amber-400'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400'
              }`}>
                {zkWorkerLoading && !zkWorker ? (
                  <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Checking status…</span>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold uppercase tracking-wide">
                        {zkWorker?.online ? 'Online' : zkWorker?.configured ? 'Offline' : 'Not configured'}
                      </span>
                      <span className="text-[10px] opacity-80">
                        state: {zkWorker?.state || '—'}
                        {zkWorker?.provider ? ` · ${zkWorker.provider}` : ''}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed opacity-90">
                      {zkWorker?.message || 'Deploy Lambda env ZK_WORKER_INSTANCE_ID (+ optional ZK_PROVER_URL) to enable.'}
                    </p>
                    {zkWorker?.instanceId && (
                      <p className="mt-1 font-mono text-[10px] opacity-70">instance: {zkWorker.instanceId}</p>
                    )}
                    {zkWorker?.publicIp && (
                      <p className="mt-0.5 font-mono text-[10px] opacity-70">ip: {zkWorker.publicIp}</p>
                    )}
                    {zkWorker?.proverUrl && (
                      <p className="mt-0.5 font-mono text-[10px] opacity-70 break-all">prover: {zkWorker.proverUrl}</p>
                    )}
                  </>
                )}
              </div>

              {zkWorkerError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-600 dark:text-red-400">
                  {zkWorkerError}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startZkWorker}
                  disabled={!!zkWorkerAction || zkWorkerLoading || (zkWorker?.online === true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {zkWorkerAction === 'start' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                  {zkWorkerAction === 'start' ? 'Starting…' : 'Turn ON'}
                </button>
                <button
                  type="button"
                  onClick={stopZkWorker}
                  disabled={!!zkWorkerAction || zkWorkerLoading || zkWorker?.state === 'stopped' || zkWorker?.state === 'unconfigured'}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-bold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                >
                  {zkWorkerAction === 'stop' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PowerOff className="h-3.5 w-3.5" />}
                  {zkWorkerAction === 'stop' ? 'Stopping…' : 'Turn OFF'}
                </button>
              </div>

              <p className="text-[10px] text-zinc-400 leading-relaxed">
                Private pay prefers this worker when online (fast RapidSNARK path). If offline/unconfigured,
                the app falls back to browser snarkjs (slower). After testing, hit <strong>Turn OFF</strong>.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
              <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">Daily private spend limit</h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Caps how much XLM can leave via private (shielded) payroll per UTC day.
                Each private payment is one pool unit ({denomXlm} XLM). Set <strong>0</strong> for no limit.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">Limit (XLM / day)</label>
                  <input
                    type="number"
                    min={0}
                    step={denomXlm}
                    value={local.dailySpendLimitXlm ?? 100}
                    onChange={e => setLocal(l => ({
                      ...l,
                      dailySpendLimitXlm: Math.max(0, parseFloat(e.target.value) || 0),
                    }))}
                    className="h-10 w-40 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pb-0.5">
                  {[0, 1000, 5000, 10000, 25000, 50000].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setLocal(l => ({ ...l, dailySpendLimitXlm: v }))}
                      className={`h-8 px-2.5 rounded-lg text-[10px] font-bold border transition ${
                        (local.dailySpendLimitXlm ?? 100) === v
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                      }`}
                    >
                      {v === 0 ? 'Off' : `${v} XLM`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 px-3 py-2">
                Today (UTC): <strong className="text-zinc-800 dark:text-zinc-200">
                  {(dailySpend?.day === new Date().toISOString().slice(0, 10) ? dailySpend.xlm : 0).toLocaleString()}
                </strong>
                {' / '}
                <strong className="text-zinc-800 dark:text-zinc-200">
                  {(local.dailySpendLimitXlm ?? 100) === 0 ? '∞' : (local.dailySpendLimitXlm ?? 100).toLocaleString()}
                </strong>
                {' XLM used'}
                {(local.dailySpendLimitXlm ?? 100) > 0 && (
                  <span className="text-zinc-400">
                    {' '}· up to {Math.floor((local.dailySpendLimitXlm ?? 100) / denomXlm)} private unit pays/day
                  </span>
                )}
              </div>
            </div>

            {securityEvents.length > 0 && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Security log</span>
                  <button type="button" onClick={() => clearSecurityEvents()}
                    className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                    Clear
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {securityEvents.slice(0, 20).map(ev => (
                    <div key={ev.id} className="px-4 py-2 text-[10px]">
                      <span className="text-zinc-400 font-mono">{new Date(ev.createdAt).toLocaleString()}</span>
                      <span className="mx-1.5 text-zinc-300">·</span>
                      <span className="font-semibold text-zinc-600 dark:text-zinc-400">{ev.type}</span>
                      <p className="text-zinc-500 mt-0.5">{ev.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-2">
                <p><strong className="text-zinc-800 dark:text-zinc-200">What auditors see on explorers:</strong> pool deposits and withdrawals of fixed unit size ({denomXlm} XLM). They do not see a single “salary amount” linking company → employee.</p>
                <p><strong className="text-zinc-800 dark:text-zinc-200">What finance keeps internally:</strong> full payment history, employee, amount, and tx hashes in ZEXVRO (AWS + your export).</p>
                <p><strong className="text-zinc-800 dark:text-zinc-200">View keys (coming):</strong> optional decrypt keys for auditors without making amounts public on-chain.</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Review threshold ($)</label>
              <input type="number" min="0" value={local.complianceThreshold}
                onChange={e => setLocal(l => ({ ...l, complianceThreshold: parseInt(e.target.value) || 0 }))}
                className="h-10 w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
              <p className="text-[10px] text-zinc-400 mt-1">Payments above this USD-equivalent can require extra approval.</p>
            </div>
            <div className="p-4 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10">
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Reset settings
              </h3>
              <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mb-3">
                Restores defaults. Payment history and employees are kept.
              </p>
              <button onClick={() => {
                if (confirm('Reset all Zer0 settings to defaults?')) {
                  resetSettings();
                  setLocal({ ...useZer0Store.getState().settings });
                }
              }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-300 dark:border-red-800 text-xs font-semibold text-red-600 dark:text-red-400">
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-4 py-3 shadow-lg">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
            {local.walletAddress
              ? `Wallet: ${local.walletAddress.slice(0, 8)}…${local.walletAddress.slice(-6)}`
              : 'No wallet connected'}
          </p>
          <p className="text-[10px] text-zinc-500">
            {hasChanges ? 'Unsaved changes' : saved ? 'All changes saved' : 'Up to date'}
          </p>
        </div>
        <button onClick={handleSave}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold shrink-0 ${
            saved ? 'bg-emerald-600 text-white' : hasChanges ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
          }`}>
          {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Proof system modal */}
      {proofModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setProofModalOpen(false)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Choose privacy proof protocol</h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">Compare options. No recommendation — pick what fits your policy.</p>
              </div>
              <button type="button" onClick={() => setProofModalOpen(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="h-4 w-4 text-zinc-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {(Object.keys(PROOF_SYSTEMS) as Zer0ProofSystem[]).map(key => {
                const p = PROOF_SYSTEMS[key];
                const selected = proofDraft === key;
                return (
                  <button key={key} type="button" onClick={() => setProofDraft(key)}
                    className={`w-full text-left rounded-xl border p-4 transition ${
                      selected
                        ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/30'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-900 dark:text-white">{p.name}</span>
                          {p.active ? (
                            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Live on pool</span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-500/15 text-zinc-500">Coming soon</span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{p.tagline}</p>
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected ? 'border-blue-500 bg-blue-500' : 'border-zinc-300 dark:border-zinc-600'
                      }`}>
                        {selected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </div>
                    <div className="mt-3 grid sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Features</p>
                        <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1 list-disc pl-3.5">
                          {p.features.map(f => <li key={f}>{f}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Trade-offs</p>
                        <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1 list-disc pl-3.5">
                          {p.tradeoffs.map(f => <li key={f}>{f}</li>)}
                        </ul>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-3"><span className="font-semibold text-zinc-600 dark:text-zinc-400">Typical use:</span> {p.bestFor}</p>
                  </button>
                );
              })}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <button type="button" onClick={() => setProofModalOpen(false)}
                className="h-9 px-4 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Cancel
              </button>
              <button type="button"
                onClick={() => {
                  setLocal(l => ({ ...l, proofSystem: proofDraft }));
                  setProofModalOpen(false);
                }}
                className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500">
                Use {PROOF_SYSTEMS[proofDraft].name}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
