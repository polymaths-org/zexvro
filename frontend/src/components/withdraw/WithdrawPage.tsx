import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Copy, ExternalLink, Ghost, HelpCircle,
  Loader2, Lock, Shield, Wallet, BookOpen, ArrowRight,
} from 'lucide-react';
import {
  buildWithdrawUrl,
  isClaimCode,
  openStealthClaim,
  sweepOneTimeToAddress,
} from '../../lib/stealthClaim';
import { getExplorerTxUrl, isValidStellarPublicKey } from '../../api/walletConnect';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copy:', text);
    return true;
  }
}

function readClaimFromLocation(): string {
  try {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get('c') || sp.get('claim') || '';
    if (c) return c;
    if (window.location.hash.startsWith('#c=')) {
      return decodeURIComponent(window.location.hash.slice(3));
    }
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * Public, no-login withdraw page for non-technical payees.
 * Enter claim code + PIN + your wallet → funds sweep automatically.
 */
export default function WithdrawPage() {
  const [claimCode, setClaimCode] = useState('');
  const [pin, setPin] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    txHash: string;
    amountXlm: number;
    mode: string;
    network: 'TESTNET' | 'PUBLIC';
    oneTime: string;
  } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const pre = readClaimFromLocation();
    if (pre) setClaimCode(pre);
  }, []);

  const canSubmit = useMemo(() => {
    return (
      isClaimCode(claimCode)
      && /^\d{6}$/.test(pin.trim())
      && isValidStellarPublicKey(address.trim())
      && !busy
    );
  }, [claimCode, pin, address, busy]);

  const onWithdraw = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const opened = await openStealthClaim(claimCode, pin);
      const network = opened.meta.network || 'TESTNET';
      const sweep = await sweepOneTimeToAddress({
        oneTimeSecret: opened.oneTimeSecret,
        toAddress: address.trim(),
        network,
      });
      setResult({
        txHash: sweep.txHash,
        amountXlm: sweep.amountXlm,
        mode: sweep.mode,
        network,
        oneTime: opened.meta.oneTimePublicKey,
      });
    } catch (e: any) {
      setError(e?.message || 'Withdraw failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-[#050505] dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-[#0B0B0C]/80">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
              <Ghost className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">Zer0 Withdraw</p>
              <p className="text-[10px] text-zinc-500">Claim private payment · no app install</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Guide
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8 space-y-5">
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
            <div className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-white">Someone sent you a private payment</p>
              <p className="mt-1">
                You need two things they shared: a <strong>claim code</strong> (or this page link)
                and a <strong>6-digit PIN</strong>. Then paste your Stellar wallet address — we move the money there for you.
              </p>
              <p className="mt-1 text-zinc-500">
                You do <em>not</em> need a seed phrase, secret key, or Freighter import for this flow.
              </p>
            </div>
          </div>
        </div>

        {result ? (
          <div className="space-y-4 rounded-2xl border border-emerald-500/25 bg-white p-5 shadow-sm dark:border-emerald-500/20 dark:bg-[#0B0B0C]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-base font-bold">Money is in your wallet</h1>
                <p className="text-xs text-zinc-500">
                  ~{result.amountXlm.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM moved
                  ({result.mode === 'merge' ? 'full sweep' : result.mode})
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Transaction</p>
              <p className="mt-1 font-mono break-all text-zinc-800 dark:text-zinc-100">{result.txHash}</p>
              <a
                href={getExplorerTxUrl(result.txHash, result.network)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                View on Stellar explorer <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Open Freighter, LOBSTR, or any Stellar wallet with address{' '}
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{address.slice(0, 6)}…{address.slice(-4)}</span>
              {' '}to see your new balance. It can take a few seconds to appear.
            </p>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setPin('');
              }}
              className="w-full rounded-xl bg-zinc-900 py-3 text-xs font-bold text-white dark:bg-white dark:text-zinc-900"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#0B0B0C]">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                1. Claim code
              </label>
              <textarea
                value={claimCode}
                onChange={e => setClaimCode(e.target.value.trim())}
                rows={3}
                placeholder="z0w2.…"
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-[11px] outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <p className="mt-1 text-[10px] text-zinc-400">
                Starts with <span className="font-mono">z0w2.</span> (or older <span className="font-mono">z0w1.</span>) — often pre-filled from your link.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                2. Withdraw PIN
              </label>
              <input
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 digits"
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-center font-mono text-lg tracking-[0.35em] outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                3. Your Stellar wallet address
              </label>
              <input
                value={address}
                onChange={e => setAddress(e.target.value.trim())}
                placeholder="G… (56 characters)"
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-[12px] outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <p className="mt-1 text-[10px] text-zinc-400 leading-relaxed">
                In Freighter: click your account → copy address. In LOBSTR: Profile → copy public key.
                It always starts with <strong>G</strong>.
              </p>
            </div>

            {error && (
              <div className="flex gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void onWithdraw()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Moving funds…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Unlock & withdraw to my wallet
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <p className="text-center text-[10px] text-zinc-400">
              Runs entirely in your browser. We never upload your PIN or secret keys.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0B0B0C]">
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="flex w-full items-center gap-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200"
          >
            <HelpCircle className="h-4 w-4 text-violet-500" />
            Don&apos;t have a wallet yet? Open the beginner guide
          </button>
        </div>
      </main>

      {showGuide && (
        <RedeemGuideModal
          onClose={() => setShowGuide(false)}
          onCopyExample={async () => {
            const url = buildWithdrawUrl(claimCode || 'z0w2.example');
            await copyText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          copied={copied}
        />
      )}
    </div>
  );
}

function RedeemGuideModal({
  onClose,
  onCopyExample,
  copied,
}: {
  onClose: () => void;
  onCopyExample: () => void;
  copied: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-5 shadow-2xl sm:rounded-2xl dark:border-zinc-800 dark:bg-[#0B0B0C]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">How to get your money (beginner)</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">No crypto experience needed · ~5 minutes</p>
          </div>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-zinc-400 hover:text-zinc-700">
            Close
          </button>
        </div>

        <ol className="space-y-4 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-300">
          <li className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
            <p className="font-bold text-zinc-900 dark:text-white">1. Install a free Stellar wallet</p>
            <p className="mt-1">Pick one (phone or computer):</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li>
                <a className="text-blue-600 hover:underline" href="https://www.freighter.app/" target="_blank" rel="noreferrer">
                  Freighter
                </a>
                {' '}— browser extension (Chrome / Brave / Firefox)
              </li>
              <li>
                <a className="text-blue-600 hover:underline" href="https://lobstr.co/" target="_blank" rel="noreferrer">
                  LOBSTR
                </a>
                {' '}— iPhone / Android app
              </li>
              <li>
                <a className="text-blue-600 hover:underline" href="https://xbull.app/" target="_blank" rel="noreferrer">
                  xBull
                </a>
                {' '}— browser or mobile
              </li>
            </ul>
            <p className="mt-2 text-amber-700 dark:text-amber-400/90 text-[11px]">
              When the app shows a recovery phrase (12–24 words): write it on paper and store it offline.
              Never screenshot it or paste it into websites. You will <strong>not</strong> need it for this withdraw page.
            </p>
          </li>

          <li className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
            <p className="font-bold text-zinc-900 dark:text-white">2. Copy your public address</p>
            <p className="mt-1">
              Inside the wallet, find <strong>Receive</strong> or your account name and tap Copy.
              The address always starts with <span className="font-mono">G</span> and is 56 characters.
              This is safe to share — it is like your account number, not a password.
            </p>
          </li>

          <li className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
            <p className="font-bold text-zinc-900 dark:text-white">3. Use this withdraw page</p>
            <p className="mt-1">
              Paste the <strong>claim code</strong> (or open the link your payer sent), enter the
              <strong> 6-digit PIN</strong>, paste your <span className="font-mono">G…</span> address, then tap
              <em> Unlock & withdraw</em>.
            </p>
          </li>

          <li className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
            <p className="font-bold text-zinc-900 dark:text-white">4. Check your balance</p>
            <p className="mt-1">
              After success, open your wallet and pull to refresh. XLM should appear within a few seconds.
              You can also open the explorer link on the success screen.
            </p>
          </li>
        </ol>

        <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-[11px] text-zinc-600 dark:text-zinc-300">
          <p className="font-semibold text-violet-700 dark:text-violet-300">Words you can ignore</p>
          <p className="mt-1">
            <strong>Seed / secret / S… key / one-time address</strong> — advanced options for power users.
            The PIN flow handles that for you. If someone asks you to type a secret that starts with
            <span className="font-mono"> S</span> into a random chat, stop — that is a scam.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-violet-600 py-3 text-xs font-bold text-white hover:bg-violet-500"
        >
          Got it — back to withdraw
        </button>
        <button
          type="button"
          onClick={onCopyExample}
          className="mt-2 w-full text-[10px] text-zinc-400 hover:text-zinc-600"
        >
          {copied ? 'Copied' : 'Copy current page link'} <Copy className="inline h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
