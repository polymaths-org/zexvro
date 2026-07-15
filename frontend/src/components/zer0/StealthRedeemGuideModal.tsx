import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen, Check, Copy, ExternalLink, Ghost, Link2, Lock, X,
} from 'lucide-react';
import { buildWithdrawUrl, type IssuedClaim } from '../../lib/stealthClaim';
import { getExplorerAccountUrl, truncateKey } from '../../api/walletConnect';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copy:', text);
    return true;
  }
}

/**
 * Detailed, non-technical guide the payer shows after a stealth payment.
 * Includes PIN, claim code, withdraw link, and step-by-step for the payee.
 */
export default function StealthRedeemGuideModal({
  claim,
  recipientName,
  onClose,
}: {
  claim: IssuedClaim;
  recipientName?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | false>(false);
  const withdrawUrl = buildWithdrawUrl(claim.claimCode);
  const who = recipientName || 'them';

  const handleCopy = async (key: string, text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(key);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const shareMessage = [
    `You received a private payment${claim.amountXlm ? ` (~${claim.amountXlm} XLM)` : ''}.`,
    ``,
    `1) Open this link: ${withdrawUrl}`,
    `2) Enter PIN: ${claim.pin}`,
    `3) Paste your Stellar wallet address (starts with G)`,
    `4) Tap “Unlock & withdraw”`,
    ``,
    `Need a wallet? Install Freighter (freighter.app) or LOBSTR (lobstr.co), copy your G… address, then use the link.`,
    `You do NOT need any seed phrase for this.`,
  ].join('\n');

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0B0B0C]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-zinc-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-[#0B0B0C]/95">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                How {who} redeems this payment
              </h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Share the PIN + link. They never touch stealth secrets.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Credentials */}
          <div className="space-y-2 rounded-xl border border-violet-500/25 bg-violet-500/10 p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              <Lock className="h-3.5 w-3.5" />
              Give them these two things
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 dark:bg-zinc-950/50">
              <div>
                <p className="text-[10px] font-semibold uppercase text-zinc-400">Withdraw PIN</p>
                <p className="font-mono text-xl font-bold tracking-[0.25em] text-zinc-900 dark:text-white">
                  {claim.pin}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy('pin', claim.pin)}
                className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-bold dark:border-zinc-700"
              >
                {copied === 'pin' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-zinc-950/50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase text-zinc-400">Withdraw link</p>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-zinc-700 dark:text-zinc-200">
                    {withdrawUrl}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy('url', withdrawUrl)}
                  className="shrink-0 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-bold dark:border-zinc-700"
                >
                  {copied === 'url' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <details className="text-[10px] text-zinc-500">
              <summary className="cursor-pointer font-semibold text-zinc-600 dark:text-zinc-400">
                Advanced: raw claim code
              </summary>
              <div className="mt-1.5 flex items-start gap-2">
                <p className="min-w-0 flex-1 break-all font-mono text-[9px]">{claim.claimCode}</p>
                <button type="button" onClick={() => void handleCopy('code', claim.claimCode)} className="shrink-0">
                  {copied === 'code' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </details>
          </div>

          {/* Script for payer */}
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              Message you can copy to {who}
            </p>
            <pre className="whitespace-pre-wrap rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
              {shareMessage}
            </pre>
            <button
              type="button"
              onClick={() => void handleCopy('msg', shareMessage)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-[11px] font-bold text-white dark:bg-white dark:text-zinc-900"
            >
              {copied === 'msg' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copy full instructions
            </button>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">What they do</p>
            {[
              {
                t: 'Open the withdraw link',
                d: 'Works on phone or computer. No Zexvro login required.',
              },
              {
                t: 'Enter the 6-digit PIN',
                d: 'If the PIN is wrong, nothing moves. They can retry.',
              },
              {
                t: 'Paste their G… wallet address',
                d: 'From Freighter, LOBSTR, xBull, etc. Safe to share — not a password.',
              },
              {
                t: 'Tap Unlock & withdraw',
                d: 'Funds leave the one-time stealth address and land in their wallet automatically.',
              },
            ].map((s, i) => (
              <div key={s.t} className="flex gap-3 rounded-xl border border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-bold text-violet-600">
                  {i + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white">{s.t}</p>
                  <p className="text-[11px] text-zinc-500">{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
            <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Ghost className="h-3.5 w-3.5" /> Why this exists
            </p>
            <p className="mt-1">
              Stealth pays a fresh one-time address so their long-term wallet is not published on-chain as the payee.
              The PIN claim lets non-technical people redeem without importing secret keys or learning seed phrases.
            </p>
            <a
              href={getExplorerAccountUrl(claim.oneTimePublicKey, claim.network)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              One-time address {truncateKey(claim.oneTimePublicKey, 6, 4)} on explorer
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="border-t border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
