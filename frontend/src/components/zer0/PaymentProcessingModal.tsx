import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle, Check, CheckCircle2, Copy, ExternalLink, Loader2,
  Lock, Radio, Shield, Sparkles, X, Zap,
} from 'lucide-react';
import {
  isPaymentInFlight,
  paymentProgressPct,
  usePaymentSession,
  type PaymentSessionPhase,
} from '../../stores/paymentSession';
import { useZer0Store } from '../../stores/zer0';
import { getExplorerTxUrl, truncateKey } from '../../api/walletConnect';

const PHASE_COPY: Record<PaymentSessionPhase, { title: string; blurb: string }> = {
  starting: {
    title: 'Preparing payment',
    blurb: 'Locking amount and opening a private settle session…',
  },
  waking: {
    title: 'Waking private prover',
    blurb: 'Cold start can take ~30–90s. Your payment is safe — nothing is double-spent.',
  },
  settling: {
    title: 'Settling on-chain',
    blurb: 'Fund → deposit → ZK prove → withdraw. Network traffic is normal; keep this open.',
  },
  finalizing: {
    title: 'Finalizing',
    blurb: 'Writing receipt and proof records…',
  },
  done: {
    title: 'Payment complete',
    blurb: 'Funds reached the recipient. Details below.',
  },
  error: {
    title: 'Payment failed',
    blurb: 'Nothing further will be charged for this attempt. You can retry from the ledger.',
  },
};

const PIPELINE = [
  { id: 'wake', match: /wak|worker|online/i, label: 'Prover' },
  { id: 'fund', match: /fund|plan:/i, label: 'Fund' },
  { id: 'deposit', match: /deposit/i, label: 'Deposit' },
  { id: 'prove', match: /prove|proof|rapidsnark|snark/i, label: 'Prove' },
  { id: 'withdraw', match: /withdraw|settle done|completed/i, label: 'Withdraw' },
] as const;

function activePipelineIndex(label: string, phase: PaymentSessionPhase): number {
  if (phase === 'done') return PIPELINE.length;
  if (phase === 'waking' || phase === 'starting') return 0;
  for (let i = PIPELINE.length - 1; i >= 0; i--) {
    if (PIPELINE[i].match.test(label)) return i;
  }
  if (phase === 'finalizing') return PIPELINE.length - 1;
  return 1;
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r.toString().padStart(2, '0')}s` : `${r}s`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      window.prompt('Copy:', text);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Non-dismissible private/public payment progress modal.
 * Blocks close while settle is in flight; shows success details or error when done.
 */
export default function PaymentProcessingModal() {
  const session = usePaymentSession(s => s.session);
  const modalOpen = usePaymentSession(s => s.modalOpen);
  const dismissSession = usePaymentSession(s => s.dismissSession);
  const closeModalIfAllowed = usePaymentSession(s => s.closeModalIfAllowed);
  const payment = useZer0Store(s =>
    session ? s.payments.find(p => p.id === session.paymentId) : undefined,
  );

  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(0);

  const inFlight = isPaymentInFlight(session);

  // Live clock so the UI never feels frozen
  useEffect(() => {
    if (!modalOpen || !session || !inFlight) return;
    const id = window.setInterval(() => setTick(t => t + 1), 250);
    return () => window.clearInterval(id);
  }, [modalOpen, session?.paymentId, inFlight]);

  // Soft pulse for ambient animation
  useEffect(() => {
    if (!modalOpen || !inFlight) return;
    const id = window.setInterval(() => setPulse(p => p + 1), 900);
    return () => window.clearInterval(id);
  }, [modalOpen, inFlight]);

  // Block reload/close while processing
  useEffect(() => {
    if (!inFlight) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'A payment is still processing. Leaving may make status unclear until you return.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [inFlight]);

  // Block Escape while in flight
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inFlight) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        closeModalIfAllowed();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [modalOpen, inFlight, closeModalIfAllowed]);

  const pct = paymentProgressPct(session);
  const phase = session?.phase || 'starting';
  const copy = PHASE_COPY[phase];
  const elapsed = session ? Date.now() - session.startedAt : 0;
  // reference tick so eslint/react keep re-render for elapsed
  void tick;

  const pipeIdx = useMemo(
    () => (session ? activePipelineIndex(session.label, session.phase) : 0),
    [session?.label, session?.phase],
  );

  const network = useZer0Store(s => s.settings.horizonUrl || '');
  const isTestnet = network.includes('testnet');
  const txHash = session?.txHash || payment?.txHash || null;

  if (!modalOpen || !session) return null;

  const onBackdrop = () => {
    if (inFlight) return;
    closeModalIfAllowed();
  };

  const onClose = () => {
    if (inFlight) return;
    dismissSession();
  };

  const handleCopyTx = async () => {
    if (!txHash) return;
    const ok = await copyText(txHash);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  // Portal to <body> so layout sticky/overflow/stacking never hides the secure settle popup.
  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-processing-title"
      data-payment-processing-modal="true"
    >
      <div
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm"
        onClick={onBackdrop}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0B0B0C]">
        {/* Ambient top glow */}
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full blur-3xl transition-opacity duration-700 ${
            phase === 'done'
              ? 'bg-emerald-500/30 opacity-100'
              : phase === 'error'
                ? 'bg-red-500/25 opacity-100'
                : 'bg-violet-500/25 opacity-80'
          }`}
          style={{ transform: `translateX(-50%) scale(${1 + (pulse % 3) * 0.03})` }}
        />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                phase === 'done'
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : phase === 'error'
                    ? 'bg-red-500/15 text-red-500'
                    : 'bg-violet-500/15 text-violet-500'
              }`}
            >
              {phase === 'done' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : phase === 'error' ? (
                <AlertCircle className="h-5 w-5" />
              ) : session.shielded ? (
                <Lock className={`h-5 w-5 ${inFlight ? 'animate-pulse' : ''}`} />
              ) : (
                <Zap className={`h-5 w-5 ${inFlight ? 'animate-pulse' : ''}`} />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="payment-processing-title" className="text-sm font-bold text-zinc-900 dark:text-white">
                  {copy.title}
                </h2>
                {inFlight && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                    </span>
                    Live
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {copy.blurb}
              </p>
            </div>
          </div>
          {!inFlight && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="relative space-y-4 px-5 py-4">
          {/* Amount strip */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/80 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Sending</p>
              <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
                {session.amount.toLocaleString('en-US', { maximumFractionDigits: 4 })}{' '}
                <span className="text-sm font-semibold text-zinc-500">{session.currency}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">To</p>
              <p className="max-w-[140px] truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {session.recipientName}
              </p>
            </div>
          </div>

          {session.shielded && session.planDescription && (
            <p className="flex items-center gap-1.5 text-[11px] text-violet-600 dark:text-violet-400">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              Private pool route: {session.planDescription}
            </p>
          )}

          {/* Progress bar */}
          {phase !== 'error' && (
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                <span>{inFlight ? 'Progress' : phase === 'done' ? 'Finished' : 'Status'}</span>
                <span className="tabular-nums text-zinc-500">
                  {inFlight ? `${Math.round(pct)}% · ${formatElapsed(elapsed)}` : formatElapsed(elapsed)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    phase === 'done'
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-500'
                  }`}
                  style={{ width: `${phase === 'done' ? 100 : pct}%` }}
                >
                  {inFlight && (
                    <div className="h-full w-full animate-pulse bg-white/20" />
                  )}
                </div>
              </div>
              {/* Indeterminate shimmer strip when step stalls */}
              {inFlight && (
                <div className="relative mt-1 h-0.5 overflow-hidden rounded-full bg-transparent">
                  <div
                    className="absolute inset-y-0 w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-violet-400/50"
                    style={{
                      // fallback animation via transform in style if keyframes missing
                      animation: 'none',
                      transform: `translateX(${(pulse % 4) * 80}%)`,
                      transition: 'transform 0.9s ease-in-out',
                      width: '30%',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Pipeline chips */}
          {session.shielded && phase !== 'error' && (
            <div className="flex flex-wrap gap-1.5">
              {PIPELINE.map((p, i) => {
                const done = i < pipeIdx || phase === 'done';
                const active = i === pipeIdx && phase !== 'done';
                return (
                  <span
                    key={p.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all ${
                      done
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : active
                          ? 'bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/30 dark:text-violet-300'
                          : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500'
                    }`}
                  >
                    {done ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : active ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
                    )}
                    {p.label}
                  </span>
                );
              })}
            </div>
          )}

          {/* Live status line */}
          <div
            className={`rounded-xl border px-3.5 py-3 ${
              phase === 'error'
                ? 'border-red-500/20 bg-red-500/5'
                : phase === 'done'
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40'
            }`}
          >
            <div className="flex items-start gap-2">
              {inFlight ? (
                <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse text-violet-500" />
              ) : phase === 'done' ? (
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold leading-snug ${
                  phase === 'error' ? 'text-red-600 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-100'
                }`}>
                  {phase === 'error' ? (session.error || session.label) : session.label}
                </p>
                {inFlight && (
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                    If your connection drops, the worker may still finish the settle on-chain.
                    Re-open this app — we will show the latest status.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Scrolling activity log */}
          {session.log.length > 0 && phase !== 'done' && (
            <div className="max-h-28 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-2 font-mono text-[10px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
              {[...session.log].slice(-8).reverse().map((row, i) => (
                <div key={`${row.t}-${i}`} className={i === 0 ? 'text-zinc-700 dark:text-zinc-200' : ''}>
                  <span className="text-zinc-400 dark:text-zinc-600">
                    {new Date(row.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  {'  '}
                  {row.text}
                </div>
              ))}
            </div>
          )}

          {/* Success details */}
          {phase === 'done' && (
            <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3">
              {txHash && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Tx hash</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-100">
                      {truncateKey(txHash, 8, 6)}
                    </span>
                    <button type="button" onClick={handleCopyTx} className="p-0.5 text-zinc-400 hover:text-zinc-700">
                      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <a
                      href={getExplorerTxUrl(txHash, isTestnet ? 'TESTNET' : 'PUBLIC')}
                      target="_blank"
                      rel="noreferrer"
                      className="p-0.5 text-blue-500 hover:text-blue-600"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Settled in {formatElapsed(elapsed)}
                {session.shielded ? ' with zero-knowledge privacy.' : '.'}
              </p>
            </div>
          )}

          {inFlight && (
            <p className="text-center text-[10px] font-medium text-amber-700 dark:text-amber-400/90">
              Do not close this window until the payment finishes.
              Reload will warn you — the settle may still complete on the server.
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="relative flex gap-2 border-t border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          {inFlight ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 py-2.5 text-xs font-semibold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Processing — close disabled
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className={`w-full rounded-lg py-2.5 text-xs font-bold text-white transition ${
                phase === 'error'
                  ? 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {phase === 'error' ? 'Close' : 'Done — view details'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modal, document.body)
    : modal;
}
