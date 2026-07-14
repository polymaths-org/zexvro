import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PaymentSessionPhase =
  | 'starting'
  | 'waking'
  | 'settling'
  | 'finalizing'
  | 'done'
  | 'error';

export type PaymentSessionLog = {
  t: number;
  text: string;
};

export type PaymentSession = {
  paymentId: string;
  recipientName: string;
  amount: number;
  currency: string;
  shielded: boolean;
  phase: PaymentSessionPhase;
  label: string;
  step: number;
  totalSteps: number;
  log: PaymentSessionLog[];
  jobIds: string[];
  startedAt: number;
  updatedAt: number;
  error?: string | null;
  txHash?: string | null;
  planDescription?: string;
  /** Only true on terminal states so modal can be dismissed */
  dismissible: boolean;
  /** Soft ETA in seconds (display only) */
  etaSeconds?: number;
};

type PaymentSessionState = {
  session: PaymentSession | null;
  /** In-tab only: modal open even if user navigates */
  modalOpen: boolean;
  startSession: (input: {
    paymentId: string;
    recipientName: string;
    amount: number;
    currency: string;
    shielded: boolean;
    planDescription?: string;
    etaSeconds?: number;
    totalSteps?: number;
  }) => void;
  updateProgress: (input: {
    paymentId?: string;
    label: string;
    step?: number;
    totalSteps?: number;
    phase?: PaymentSessionPhase;
  }) => void;
  addJobId: (jobId: string, paymentId?: string) => void;
  setPhase: (phase: PaymentSessionPhase, extra?: Partial<PaymentSession>) => void;
  completeSession: (input: { txHash?: string | null; label?: string }) => void;
  failSession: (error: string) => void;
  dismissSession: () => void;
  openModal: () => void;
  closeModalIfAllowed: () => void;
};

const MAX_LOG = 40;

function pushLog(log: PaymentSessionLog[], text: string): PaymentSessionLog[] {
  const next = [...log, { t: Date.now(), text }];
  return next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next;
}

function inferPhase(label: string): PaymentSessionPhase | null {
  const l = label.toLowerCase();
  if (l.includes('waking') || l.includes('waiting for zk') || l.includes('worker')) return 'waking';
  if (l.includes('final') || l.includes('complete run') || l.includes('done @')) return 'finalizing';
  if (
    l.includes('fund')
    || l.includes('deposit')
    || l.includes('prove')
    || l.includes('withdraw')
    || l.includes('settle')
    || l.includes('plan:')
  ) {
    return 'settling';
  }
  return null;
}

export const usePaymentSession = create<PaymentSessionState>()(
  persist(
    (set, get) => ({
      session: null,
      modalOpen: false,

      startSession: (input) => {
        const now = Date.now();
        const session: PaymentSession = {
          paymentId: input.paymentId,
          recipientName: input.recipientName,
          amount: input.amount,
          currency: input.currency,
          shielded: input.shielded,
          phase: 'starting',
          label: input.shielded ? 'Starting private settle…' : 'Submitting payment…',
          step: 0,
          totalSteps: input.totalSteps || (input.shielded ? 12 : 3),
          log: [{ t: now, text: input.shielded ? 'Private payment queued' : 'Payment queued' }],
          jobIds: [],
          startedAt: now,
          updatedAt: now,
          error: null,
          txHash: null,
          planDescription: input.planDescription,
          dismissible: false,
          etaSeconds: input.etaSeconds,
        };
        set({ session, modalOpen: true });
      },

      updateProgress: ({ paymentId, label, step, totalSteps, phase }) => {
        const cur = get().session;
        if (!cur) return;
        if (paymentId && cur.paymentId !== paymentId) return;
        const nextPhase = phase || inferPhase(label) || cur.phase;
        set({
          session: {
            ...cur,
            label,
            step: typeof step === 'number' ? step : cur.step,
            totalSteps: typeof totalSteps === 'number' ? totalSteps : cur.totalSteps,
            phase: nextPhase === 'done' || nextPhase === 'error' ? cur.phase : nextPhase,
            log: pushLog(cur.log, label),
            updatedAt: Date.now(),
            dismissible: false,
          },
          modalOpen: true,
        });
      },

      addJobId: (jobId, paymentId) => {
        const cur = get().session;
        if (!cur || !jobId) return;
        if (paymentId && cur.paymentId !== paymentId) return;
        if (cur.jobIds.includes(jobId)) return;
        set({
          session: {
            ...cur,
            jobIds: [...cur.jobIds, jobId],
            updatedAt: Date.now(),
            log: pushLog(cur.log, `Worker job ${jobId.slice(0, 12)}…`),
          },
        });
      },

      setPhase: (phase, extra) => {
        const cur = get().session;
        if (!cur) return;
        set({
          session: {
            ...cur,
            ...extra,
            phase,
            updatedAt: Date.now(),
            dismissible: phase === 'done' || phase === 'error',
          },
          modalOpen: true,
        });
      },

      completeSession: ({ txHash, label }) => {
        const cur = get().session;
        if (!cur) return;
        const text = label || 'Payment completed';
        set({
          session: {
            ...cur,
            phase: 'done',
            label: text,
            step: cur.totalSteps,
            txHash: txHash || cur.txHash,
            error: null,
            dismissible: true,
            updatedAt: Date.now(),
            log: pushLog(cur.log, text),
          },
          modalOpen: true,
        });
      },

      failSession: (error) => {
        const cur = get().session;
        if (!cur) return;
        set({
          session: {
            ...cur,
            phase: 'error',
            label: 'Payment failed',
            error,
            dismissible: true,
            updatedAt: Date.now(),
            log: pushLog(cur.log, error),
          },
          modalOpen: true,
        });
      },

      dismissSession: () => {
        const cur = get().session;
        if (cur && !cur.dismissible) return;
        set({ session: null, modalOpen: false });
      },

      openModal: () => set({ modalOpen: true }),

      closeModalIfAllowed: () => {
        const cur = get().session;
        if (cur && !cur.dismissible) return;
        set({ modalOpen: false, session: cur?.phase === 'done' || cur?.phase === 'error' ? null : cur });
      },
    }),
    {
      name: 'zexvro_payment_session',
      partialize: (s) => ({
        // Keep session across reload so we can resume / show "still processing"
        session: s.session
          ? {
              ...s.session,
              // Re-open modal on reload if still in flight
            }
          : null,
        modalOpen: s.session
          ? !s.session.dismissible || s.session.phase === 'done' || s.session.phase === 'error'
          : false,
      }),
    },
  ),
);

/** True while settle must not be interrupted by navigation/reload UX. */
export function isPaymentInFlight(session: PaymentSession | null | undefined): boolean {
  if (!session) return false;
  return !session.dismissible && session.phase !== 'done' && session.phase !== 'error';
}

export function paymentProgressPct(session: PaymentSession | null | undefined): number {
  if (!session) return 0;
  if (session.phase === 'done') return 100;
  if (session.totalSteps <= 0) return 8;
  const raw = (session.step / session.totalSteps) * 100;
  // Keep bar moving a little even early so it never feels frozen
  return Math.max(4, Math.min(96, raw));
}
