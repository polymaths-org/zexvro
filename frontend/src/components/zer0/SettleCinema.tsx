import type { PaymentSessionPhase } from '../../stores/paymentSession';

const STAGES = [
  { id: 'wake', short: 'Prover', title: 'Prover' },
  { id: 'fund', short: 'Fund', title: 'Fund' },
  { id: 'deposit', short: 'Deposit', title: 'Deposit' },
  { id: 'prove', short: 'Prove', title: 'Prove' },
  { id: 'withdraw', short: 'Withdraw', title: 'Withdraw' },
] as const;

/** Simple custom icons (no Lucide) */
function IconCheck({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLock({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconGhostAddr({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9.5C6 5.9 8.7 3 12 3s6 2.9 6 6.5V19l-2.2-1.4L13.5 19 12 17.7 10.5 19 8.2 17.6 6 19V9.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="10" r="1" fill="currentColor" />
      <circle cx="14.5" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function IconBolt({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 2L5 13h6l-1 9 9-13h-6l0-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlert({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

/** Standard circular loader */
function StandardLoader({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Clean settle progress for the payment popup.
 * Steps only move forward (parent passes a monotonic pipeIdx).
 */
export default function SettleCinema({
  pipeIdx,
  phase,
  shielded,
  stealth,
  label,
  stepHint,
  pct,
  totalSteps = 5,
}: {
  pipeIdx: number;
  phase: PaymentSessionPhase;
  shielded: boolean;
  stealth: boolean;
  label: string;
  /** Human-readable current step explanation */
  stepHint?: string;
  pct: number;
  totalSteps?: number;
}) {
  const done = phase === 'done';
  const error = phase === 'error';
  const inFlight = !done && !error;
  const stageCount = STAGES.length;
  // pipeIdx can be 0..stageCount (stageCount = all complete)
  const activeIdx = done
    ? stageCount
    : Math.max(0, Math.min(pipeIdx, stageCount - 1));
  const displayStep = done ? stageCount : activeIdx + 1;
  // Progress bar: base on step position, blend with backend pct so it still moves within a step
  const stepBase = done ? 100 : (activeIdx / stageCount) * 100;
  const within = done ? 0 : Math.min(18, Math.max(0, (pct / 100) * 18));
  const progress = done ? 100 : Math.max(6, Math.min(96, stepBase + within));

  const CoreIcon = error
    ? IconAlert
    : done
      ? IconCheck
      : shielded
        ? (stealth ? IconGhostAddr : IconLock)
        : IconBolt;

  const coreTone = error
    ? 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20'
    : done
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25'
      : 'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700';

  const currentTitle = done
    ? 'Complete'
    : error
      ? 'Failed'
      : STAGES[activeIdx]?.title || 'Working';

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3.5 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      {/* Center status */}
      <div className="mb-4 flex flex-col items-center gap-3">
        <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${coreTone}`}>
          {inFlight ? (
            <>
              <StandardLoader className="absolute h-14 w-14 text-zinc-400 dark:text-zinc-500" />
              <CoreIcon className="relative h-5 w-5" />
            </>
          ) : (
            <CoreIcon className="h-6 w-6" />
          )}
        </div>

        <div className="max-w-full px-2 text-center">
          {inFlight && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Step {displayStep} of {totalSteps} · {currentTitle}
            </p>
          )}
          <p className={`mt-1 text-xs font-semibold leading-snug ${
            error ? 'text-red-600 dark:text-red-400' : 'text-zinc-800 dark:text-zinc-100'
          }`}>
            {error ? label : done ? 'Payment settled successfully' : (stepHint || label)}
          </p>
          {inFlight && label && stepHint && label !== stepHint && (
            <p className="mt-1 max-w-full truncate font-mono text-[10px] text-zinc-400" title={label}>
              {label}
            </p>
          )}
          {inFlight && (
            <p className="mt-1 text-[10px] text-zinc-500">
              {shielded
                ? stealth
                  ? 'Private pool · stealth one-time path'
                  : 'Private pool path — steps only move forward'
                : 'Public Stellar payment'}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          <span>{inFlight ? 'Progress' : done ? 'Finished' : 'Status'}</span>
          <span className="tabular-nums text-zinc-500">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              error ? 'bg-red-500' : done ? 'bg-emerald-500' : 'bg-zinc-800 dark:bg-zinc-200'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Pipeline steps — complete / active / upcoming only (never go back) */}
      <div className="flex items-start justify-between gap-1">
        {STAGES.map((s, i) => {
          const complete = done || i < activeIdx;
          const active = !done && !error && i === activeIdx;
          return (
            <div key={s.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-300 ${
                  complete
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                }`}
              >
                {complete ? (
                  <IconCheck className="h-3 w-3" />
                ) : active ? (
                  <StandardLoader className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`w-full truncate text-center text-[9px] font-semibold uppercase tracking-wide ${
                  complete
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : active
                      ? 'text-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-400'
                }`}
              >
                {s.short}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
