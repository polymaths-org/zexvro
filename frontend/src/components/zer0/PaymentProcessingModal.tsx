import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle, BookOpen, Check, CheckCircle2, Copy, ExternalLink, Loader2,
  Lock, Shield, X, Zap,
} from 'lucide-react';
import {
  isPaymentInFlight,
  paymentProgressPct,
  usePaymentSession,
  type PaymentSessionPhase,
} from '../../stores/paymentSession';
import { useZer0Store } from '../../stores/zer0';
import { useStealthStore } from '../../stores/stealth';
import { useStealthClaimsStore } from '../../stores/stealthClaims';
import { buildWithdrawUrl } from '../../lib/stealthClaim';
import { getExplorerTxUrl, getExplorerAccountUrl, truncateKey } from '../../api/walletConnect';
import StealthRedeemGuideModal from './StealthRedeemGuideModal';
import SettleCinema from './SettleCinema';

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
    blurb: 'On-chain settle finished. If this was stealth, funds are on a one-time address — not Freighter.',
  },
  error: {
    title: 'Payment failed',
    blurb: 'Nothing further will be charged for this attempt. You can retry from the ledger.',
  },
};

/**
 * Stable private-pay pipeline. Indices only ever increase in the UI
 * (backend labels can mention "fund"/"settle" out of order — we latch max).
 */
const PIPELINE = [
  { id: 'wake', label: 'Prover', hint: 'Starting the private prover' },
  { id: 'fund', label: 'Fund', hint: 'Moving funds into the pool path' },
  { id: 'deposit', label: 'Deposit', hint: 'Depositing into the privacy pool' },
  { id: 'prove', label: 'Prove', hint: 'Building the zero-knowledge proof' },
  { id: 'withdraw', label: 'Withdraw', hint: 'Sending to the recipient address' },
] as const;

/**
 * Map a status label → pipeline step 0..4.
 * Returns -1 when the label is ambiguous (UI keeps previous step).
 * Matching is ordered by specificity so "Server settle" does not jump to Withdraw.
 */
function inferPipelineStep(label: string, phase: PaymentSessionPhase): number {
  if (phase === 'done') return PIPELINE.length; // all complete
  if (phase === 'error') return -1;

  const l = (label || '').toLowerCase();

  // Explicit phase anchors (don't rely on free text)
  if (phase === 'starting') return 0;
  if (phase === 'waking') return 0;
  if (phase === 'finalizing') return 4;

  // --- Late stages first, but only with *specific* phrases ---

  // Done / withdraw complete
  if (
    /settle done|server settle done|paid \d|payment complete|withdraw \d|withdrawn|transfer out|accountmerge|sweep/.test(l)
  ) {
    return 4;
  }

  // Prove (must come before generic "settle")
  if (
    /\bprove\b|\bproof\b|rapidsnark|\bsnark\b|merkle|nullifier|groth|zk note|generating proof/.test(l)
  ) {
    return 3;
  }

  // Deposit (exclude post-pay / decoy after main path — still "deposit" stage is fine if mid-flight)
  if (/\bdeposit\b/.test(l)) {
    return 2;
  }

  // Fund / plan / create stealth account (before pool deposit)
  if (
    /\bfund\b|plan:|create.?account|stealth account|funding wallet|one-time address|stealth one-time|checking funding|checking recipient|preflight/.test(l)
  ) {
    return 1;
  }

  // Wake / worker
  if (
    /\bwak|worker|online|prover|connecting to private|ultra-fast private|starting private/.test(l)
  ) {
    return 0;
  }

  // Generic "server settle" / "settling" while job runs — stay mid-pipeline, never jump to Withdraw
  if (/server settle|settling|private settle|settle \d|running on worker|network hiccup/.test(l)) {
    return 2;
  }

  // Timing delay / privacy delay still pre-chain work
  if (/timing privacy|privacy delay|waiting \d+s/.test(l)) {
    return 1;
  }

  return -1; // unknown → keep previous
}

/** Friendly line under the raw backend label */
function humanStepHint(step: number, phase: PaymentSessionPhase, shielded: boolean): string {
  if (phase === 'done') return 'All steps finished';
  if (phase === 'error') return 'Stopped — you can retry from the ledger';
  if (!shielded) return 'Submitting public Stellar payment';
  if (step < 0 || step >= PIPELINE.length) return 'Working…';
  return PIPELINE[step].hint;
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
  const settings = useZer0Store(s => s.settings);
  const outbound = useStealthStore(s => s.outbound);

  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState<string | false>(false);
  const [showRedeemGuide, setShowRedeemGuide] = useState(false);
  /** Monotonic pipeline cursor — never jumps backward when labels re-match earlier stages */
  const [pipeHighWater, setPipeHighWater] = useState(0);
  const [pipePaymentId, setPipePaymentId] = useState<string | null>(null);
  const issuedClaims = useStealthClaimsStore(s => s.issued);

  const inFlight = isPaymentInFlight(session);

  // Live clock so the UI never feels frozen
  useEffect(() => {
    if (!modalOpen || !session || !inFlight) return;
    const id = window.setInterval(() => setTick(t => t + 1), 250);
    return () => window.clearInterval(id);
  }, [modalOpen, session?.paymentId, inFlight]);

  // Reset step latch when a new payment starts
  useEffect(() => {
    if (!session?.paymentId) return;
    if (session.paymentId !== pipePaymentId) {
      setPipePaymentId(session.paymentId);
      setPipeHighWater(0);
    }
  }, [session?.paymentId, pipePaymentId]);

  // Advance pipeline only forward based on label/phase
  useEffect(() => {
    if (!session) return;
    if (session.phase === 'done') {
      setPipeHighWater(PIPELINE.length);
      return;
    }
    const inferred = inferPipelineStep(session.label, session.phase);
    if (inferred < 0) return;
    setPipeHighWater(prev => Math.max(prev, Math.min(inferred, PIPELINE.length - 1)));
  }, [session?.label, session?.phase, session?.paymentId]);

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

  // Stable index for UI (0..4 active, 5 = all done)
  const pipeIdx = session?.phase === 'done' ? PIPELINE.length : pipeHighWater;
  const stepHint = session
    ? humanStepHint(pipeIdx, session.phase, !!session.shielded)
    : '';

  const isTestnet = (settings?.horizonUrl || '').includes('testnet');
  const explorerNet = isTestnet ? 'TESTNET' : 'PUBLIC';
  const txHash = session?.txHash || payment?.txHash || null;
  const stealthOneTime = payment?.stealthOneTimeAddress || null;
  const stealthEph = payment?.stealthEphemeralPub || null;
  const usedStealth = !!payment?.stealth && !!stealthOneTime;
  const outboundMatch = useMemo(() => {
    if (!session?.paymentId) return null;
    return outbound.find(r => r.paymentId === session.paymentId)
      || (stealthOneTime ? outbound.find(r => r.oneTimePublicKey === stealthOneTime) : null)
      || null;
  }, [outbound, session?.paymentId, stealthOneTime]);

  const issuedClaim = useMemo(() => {
    if (!session?.paymentId && !stealthOneTime) return null;
    return issuedClaims.find(c =>
      (session?.paymentId && c.paymentId === session.paymentId)
      || (stealthOneTime && c.oneTimePublicKey === stealthOneTime),
    ) || null;
  }, [issuedClaims, session?.paymentId, stealthOneTime]);

  if (!modalOpen || !session) return null;

  const onBackdrop = () => {
    if (inFlight) return;
    closeModalIfAllowed();
  };

  const onClose = () => {
    if (inFlight) return;
    dismissSession();
  };

  const handleCopy = async (key: string, text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(key);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleCopyTx = async () => {
    if (!txHash) return;
    await handleCopy('tx', txHash);
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
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
        onClick={onBackdrop}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0B0B0C]">
        {/* Header */}
        <div className="relative flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                phase === 'done'
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : phase === 'error'
                    ? 'bg-red-500/15 text-red-500'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
              }`}
            >
              {phase === 'done' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : phase === 'error' ? (
                <AlertCircle className="h-5 w-5" />
              ) : session.shielded ? (
                <Lock className="h-5 w-5" />
              ) : (
                <Zap className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="payment-processing-title" className="text-sm font-bold text-zinc-900 dark:text-white">
                  {copy.title}
                </h2>
                {inFlight && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <Loader2 className="h-3 w-3 animate-spin" />
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

        <div className="relative space-y-3.5 px-5 py-4">
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
            <p className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              Private pool route: {session.planDescription}
            </p>
          )}

          {/* Clean settle progress (standard loader + steps — monotonic, no jump-back) */}
          {(session.shielded || inFlight || phase === 'done') && phase !== 'error' && (
            <SettleCinema
              pipeIdx={pipeIdx}
              phase={phase}
              shielded={!!session.shielded}
              stealth={!!usedStealth || !!(payment?.stealth)}
              label={session.label}
              stepHint={stepHint}
              pct={phase === 'done' ? 100 : pct}
              totalSteps={PIPELINE.length}
            />
          )}

          {phase !== 'error' && (
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              <span>{inFlight ? 'Elapsed' : phase === 'done' ? 'Finished' : 'Status'}</span>
              <span className="tabular-nums text-zinc-500">
                {inFlight ? formatElapsed(elapsed) : formatElapsed(elapsed)}
              </span>
            </div>
          )}

          {phase === 'error' && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-snug text-red-600 dark:text-red-400">
                    {session.error || session.label}
                  </p>
                </div>
              </div>
            </div>
          )}

          {session.log.length > 0 && phase !== 'done' && phase !== 'error' && (
            <div className="max-h-24 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50/60 px-3 py-2 font-mono text-[10px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
              {[...session.log].slice(-6).reverse().map((row, i) => (
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
                      {copied === 'tx' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <a
                      href={getExplorerTxUrl(txHash, explorerNet)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-0.5 text-blue-500 hover:text-blue-600"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {usedStealth && stealthOneTime && (
                <div className="mt-1 space-y-2 rounded-lg border border-violet-500/25 bg-violet-500/10 p-3">
                  <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                    Stealth pay — funds are NOT in Freighter
                  </p>
                  <p className="text-[10px] leading-relaxed text-violet-800/80 dark:text-violet-200/80">
                    Withdraw went to a fresh one-time address. Share the PIN + withdraw link with the recipient —
                    they paste their wallet address and claim without learning seed secrets.
                  </p>

                  {issuedClaim ? (
                    <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-white/60 p-2.5 dark:bg-zinc-950/40">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Withdraw PIN</span>
                          <p className="font-mono text-lg font-bold tracking-[0.2em] text-zinc-900 dark:text-white">
                            {issuedClaim.pin}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopy('pin', issuedClaim.pin)}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-bold dark:border-zinc-700"
                        >
                          {copied === 'pin' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Withdraw link</span>
                          <p className="font-mono text-[9px] break-all text-zinc-700 dark:text-zinc-200">
                            {buildWithdrawUrl(issuedClaim.claimCode)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopy('wurl', buildWithdrawUrl(issuedClaim.claimCode))}
                          className="shrink-0 p-0.5 text-zinc-400 hover:text-zinc-700"
                        >
                          {copied === 'wurl' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRedeemGuide(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 py-2 text-[11px] font-bold text-white hover:bg-violet-500"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Instructions — how they redeem
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-amber-700 dark:text-amber-300">
                      PIN claim is generating… reopen from Payment ledger if it does not appear.
                    </p>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">One-time address</span>
                      <p className="font-mono text-[10px] break-all text-zinc-800 dark:text-zinc-100">{stealthOneTime}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => void handleCopy('ota', stealthOneTime)} className="p-0.5 text-zinc-400 hover:text-zinc-700">
                        {copied === 'ota' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                      <a
                        href={getExplorerAccountUrl(stealthOneTime, explorerNet)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-0.5 text-blue-500 hover:text-blue-600"
                        title="Open on explorer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <details className="text-[10px] text-zinc-500">
                    <summary className="cursor-pointer font-semibold text-zinc-600 dark:text-zinc-400">
                      Advanced (tech) — secrets & scan keys
                    </summary>
                    <div className="mt-2 space-y-2">
                      {outboundMatch?.oneTimeSecret && (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Spend secret (S…)</span>
                            <p className="font-mono text-[10px] break-all text-amber-700 dark:text-amber-300">
                              {outboundMatch.oneTimeSecret}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCopy('sec', outboundMatch.oneTimeSecret)}
                            className="shrink-0 p-0.5 text-zinc-400 hover:text-zinc-700"
                          >
                            {copied === 'sec' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      )}
                      {stealthEph && (
                        <p className="text-[10px] text-zinc-500">
                          Scan key (ephemeral): <span className="font-mono break-all">{stealthEph}</span>
                          {' · '}salt = payment id <span className="font-mono">{session.paymentId}</span>
                        </p>
                      )}
                    </div>
                  </details>
                </div>
              )}

              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Settled in {formatElapsed(elapsed)}
                {session.shielded ? ' with zero-knowledge privacy.' : '.'}
                {usedStealth ? ' Stealth destination above.' : ''}
              </p>
            </div>
          )}

          {inFlight && (
            <p className="text-center text-[10px] font-medium text-zinc-500">
              Do not close this window until the payment finishes.
              Reload will warn you — the settle may still complete on the server.
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="relative flex gap-2 border-t border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          {inFlight ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 py-2.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
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

  return (
    <>
      {typeof document !== 'undefined' ? createPortal(modal, document.body) : modal}
      {showRedeemGuide && issuedClaim && (
        <StealthRedeemGuideModal
          claim={issuedClaim}
          recipientName={session.recipientName}
          onClose={() => setShowRedeemGuide(false)}
        />
      )}
    </>
  );
}
