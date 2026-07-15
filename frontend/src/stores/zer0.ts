import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Zer0Employee, Zer0Payment, Zer0Proof, Zer0PoolState, Zer0Settings,
  Zer0Currency, Zer0PaymentStatus, Zer0ProofSystem, Zer0SecurityEvent,
  Zer0PrivacyPreset,
} from './types';
import { proofApi, payrollApi, stellar, zkWorkerApi } from '../api/api';
import { shieldPayAmount as zkShieldPayAmount, planShieldPay, getNotes as getZkNotes } from '../api/privacyPool';
import { useWorkspaceStore } from './workspace';
import { isPaymentInFlight, usePaymentSession } from './paymentSession';
import { useStealthStore } from './stealth';
import { useStealthClaimsStore } from './stealthClaims';
import { isStealthMetaAddress } from '../lib/stealth';
import { createStealthClaim, networkFromHorizon } from '../lib/stealthClaim';

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_POOL: Zer0PoolState = {
  balances: { USDC: 0, XLM: 0, EURC: 0 },
  totalDeposited: 0,
  totalWithdrawn: 0,
  totalPaymentsProcessed: 0,
  lastUpdated: Date.now(),
};

const DEFAULT_SETTINGS: Zer0Settings = {
  proofSystem: 'Groth16',
  complianceThreshold: 10000,
  merkleDepth: 20,
  requireValidatorSig: true,
  paymentApprovalRequired: false,
  enforceThresholdApproval: true,
  paymentWorkflow: 'manual',
  settlementMode: 'stellar',
  allowTransparentPayments: false,
  exportFormat: 'csv',
  proofRetryLimit: 3,
  webhookUrl: '',
  defaultCurrency: 'XLM',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  walletAddress: '',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org:443',
  contractAddress: 'CDQSV7I3FRQ6EBQOOE6MQSJHPCPQNHPWRK2G75DYYOOOGHDVIQGOZF4I',
  obfuscateOrgName: false,
  proxyOrgName: '',
  /** Default to Fast so demos don't sit on 45–75s timing delays. */
  privacyPreset: 'fast',
  privacyDelaySec: 0,
  privacyJitterSec: 0,
  decoyDepositsEnabled: false,
  decoyDepositCount: 0,
  dailySpendLimitXlm: 500,
  batchDepositThenWithdraw: false,
  shieldedUnitsPerPay: 1,
  preferFreighterSigning: true,
  stealthPaymentsEnabled: false,
  postPayDecoyEnabled: false,
};

/** Apply a privacy preset → concrete settle knobs (used by Settings UI). */
export function privacyPresetValues(
  preset: Exclude<Zer0PrivacyPreset, 'custom'>,
): Pick<
  Zer0Settings,
  | 'privacyPreset'
  | 'privacyDelaySec'
  | 'privacyJitterSec'
  | 'decoyDepositsEnabled'
  | 'decoyDepositCount'
  | 'batchDepositThenWithdraw'
  | 'stealthPaymentsEnabled'
  | 'postPayDecoyEnabled'
> {
  switch (preset) {
    case 'ultra_fast':
      // Absolute minimum: ZK settle only, skip every optional privacy hop
      return {
        privacyPreset: 'ultra_fast',
        privacyDelaySec: 0,
        privacyJitterSec: 0,
        decoyDepositsEnabled: false,
        decoyDepositCount: 0,
        batchDepositThenWithdraw: false,
        stealthPaymentsEnabled: false,
        postPayDecoyEnabled: false,
      };
    case 'fast':
      // ZK + pool only (same knobs as ultra; name kept for existing users)
      return {
        privacyPreset: 'fast',
        privacyDelaySec: 0,
        privacyJitterSec: 0,
        decoyDepositsEnabled: false,
        decoyDepositCount: 0,
        batchDepositThenWithdraw: false,
        stealthPaymentsEnabled: false,
        postPayDecoyEnabled: false,
      };
    case 'balanced':
      // Lighter than before — still stealth, short delay, one decoy
      return {
        privacyPreset: 'balanced',
        privacyDelaySec: 12,
        privacyJitterSec: 8,
        decoyDepositsEnabled: true,
        decoyDepositCount: 1,
        batchDepositThenWithdraw: true,
        stealthPaymentsEnabled: true,
        postPayDecoyEnabled: false,
      };
    case 'secured':
      // Max privacy profile we support in-app today
      return {
        privacyPreset: 'secured',
        privacyDelaySec: 90,
        privacyJitterSec: 45,
        decoyDepositsEnabled: true,
        decoyDepositCount: 3,
        batchDepositThenWithdraw: true,
        stealthPaymentsEnabled: true,
        postPayDecoyEnabled: true,
      };
  }
}

function utcDayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface Zer0State {
  employees: Zer0Employee[];
  payments: Zer0Payment[];
  proofs: Zer0Proof[];
  pool: Zer0PoolState;
  settings: Zer0Settings;
  securityEvents: Zer0SecurityEvent[];
  dailySpend: { day: string; xlm: number };

  addEmployee: (input: Omit<Zer0Employee, 'id' | 'createdAt' | 'updatedAt'>) => Zer0Employee;
  updateEmployee: (id: string, updates: Partial<Zer0Employee>) => void;
  removeEmployee: (id: string) => void;
  getEmployeesByProject: (projectId: string) => Zer0Employee[];

  createPayment: (input: Omit<Zer0Payment, 'id' | 'createdAt' | 'processedAt' | 'proofId' | 'txHash' | 'approvedBy'>) => Zer0Payment;
  updatePaymentStatus: (id: string, status: Zer0PaymentStatus, extra?: Partial<Zer0Payment>) => void;
  getPaymentsByProject: (projectId: string) => Zer0Payment[];

  createProof: (paymentId: string, projectId: string, proofSystem: Zer0ProofSystem) => Zer0Proof;
  updateProofStatus: (id: string, status: Zer0Proof['status'], extra?: Partial<Zer0Proof>) => void;
  getProofsByProject: (projectId: string) => Zer0Proof[];

  depositToPool: (currency: Zer0Currency, amount: number) => void;
  withdrawFromPool: (currency: Zer0Currency, amount: number) => boolean;
  processPayment: (paymentId: string) => Promise<void>;
  /**
   * Mark orphan Processing / Queued rows as failed (or heal proofs when pay already completed).
   * Safe to call often — only touches stale non-terminal rows.
   */
  reconcileStalePayments: (opts?: { maxAgeMs?: number; forceAll?: boolean }) => {
    paymentsFixed: number;
    proofsFixed: number;
  };
  logSecurityEvent: (event: Omit<Zer0SecurityEvent, 'id' | 'createdAt'>) => void;
  clearSecurityEvents: () => void;

  updateSettings: (updates: Partial<Zer0Settings>) => void;
  resetSettings: () => void;
}

const INITIAL_EMPLOYEES: Zer0Employee[] = [];
const INITIAL_PAYMENTS: Zer0Payment[] = [];

export const useZer0Store = create<Zer0State>()(
  persist(
  (set, get) => ({
    employees: INITIAL_EMPLOYEES,
    payments: INITIAL_PAYMENTS,
    proofs: [],
    pool: { ...DEFAULT_POOL },
    settings: { ...DEFAULT_SETTINGS },
    securityEvents: [],
    dailySpend: { day: utcDayKey(), xlm: 0 },

    // ─── Employees ───
    addEmployee: (input) => {
      const now = Date.now();
      const employee: Zer0Employee = { ...input, id: createId('emp'), createdAt: now, updatedAt: now };
      set(s => ({ employees: [...s.employees, employee] }));
      return employee;
    },

    updateEmployee: (id, updates) =>
      set(s => ({
        employees: s.employees.map(e =>
          e.id === id ? { ...e, ...updates, updatedAt: Date.now() } : e
        ),
      })),

    removeEmployee: (id) =>
      set(s => ({
        employees: s.employees.map(e =>
          e.id === id ? { ...e, status: 'terminated' as const, updatedAt: Date.now() } : e
        ),
      })),

    getEmployeesByProject: (projectId) =>
      get().employees.filter(e => e.projectId === projectId),

    // ─── Payments ───
    createPayment: (input) => {
      const payment: Zer0Payment = {
        ...input,
        id: createId('pay'),
        proofId: null,
        txHash: null,
        lastError: null,
        approvedBy: null,
        createdAt: Date.now(),
        processedAt: null,
      };
      set(s => ({ payments: [payment, ...s.payments] }));
      return payment;
    },

    updatePaymentStatus: (id, status, extra = {}) =>
      set(s => ({
        payments: s.payments.map(p =>
          p.id === id ? { ...p, status, ...extra } : p
        ),
      })),

    getPaymentsByProject: (projectId) =>
      get().payments.filter(p =>
        !p.projectId || p.projectId === projectId,
      ),

    // ─── Proofs ───
    createProof: (paymentId, projectId, proofSystem) => {
      const proof: Zer0Proof = {
        id: createId('proof'),
        projectId,
        paymentId,
        proofSystem,
        status: 'queued',
        verificationKey: null,
        proofData: null,
        generationTimeMs: null,
        createdAt: Date.now(),
        verifiedAt: null,
      };
      set(s => ({ proofs: [proof, ...s.proofs] }));
      return proof;
    },

    updateProofStatus: (id, status, extra = {}) =>
      set(s => ({
        proofs: s.proofs.map(p =>
          p.id === id ? { ...p, status, ...extra } : p
        ),
      })),

    getProofsByProject: (projectId) =>
      get().proofs.filter(p => p.projectId === projectId),

    // ─── Pool ───
    depositToPool: (currency, amount) =>
      set(s => ({
        pool: {
          ...s.pool,
          balances: { ...s.pool.balances, [currency]: (s.pool.balances[currency] || 0) + amount },
          totalDeposited: s.pool.totalDeposited + amount,
          lastUpdated: Date.now(),
        },
      })),

    withdrawFromPool: (currency, amount) => {
      const current = get().pool.balances[currency] || 0;
      if (current < amount) return false;
      set(s => ({
        pool: {
          ...s.pool,
          balances: { ...s.pool.balances, [currency]: s.pool.balances[currency] - amount },
          totalWithdrawn: s.pool.totalWithdrawn + amount,
          lastUpdated: Date.now(),
        },
      }));
      return true;
    },

    logSecurityEvent: (event) => {
      const row: Zer0SecurityEvent = {
        ...event,
        id: createId('sec'),
        createdAt: Date.now(),
      };
      set(s => ({ securityEvents: [row, ...s.securityEvents].slice(0, 100) }));
    },

    clearSecurityEvents: () => set({ securityEvents: [] }),

    reconcileStalePayments: (opts = {}) => {
      const maxAgeMs = opts.maxAgeMs ?? 90_000; // 90s without progress → stale
      const forceAll = !!opts.forceAll;
      const now = Date.now();
      const live = usePaymentSession.getState().session;
      const liveInFlight =
        live && isPaymentInFlight(live) ? live.paymentId : null;

      let paymentsFixed = 0;
      let proofsFixed = 0;

      const payments = get().payments.map((p) => {
        // Heal: completed pay but still "processing" shouldn't happen — keep completed
        if (p.status === 'completed') return p;

        const age = now - (p.processedAt || p.createdAt || 0);
        const isLive = liveInFlight === p.id;

        if (p.status === 'processing' || p.status === 'approved') {
          // Never kill a payment that currently owns the live settle modal
          if (isLive && !forceAll) return p;
          if (!forceAll && age < maxAgeMs) return p;

          // If we already have a txHash, treat as completed (resume edge case)
          if (p.txHash) {
            paymentsFixed += 1;
            return {
              ...p,
              status: 'completed' as const,
              processedAt: p.processedAt || now,
              lastError: null,
            };
          }

          paymentsFixed += 1;
          return {
            ...p,
            status: 'failed' as const,
            lastError:
              p.lastError
              || (p.status === 'approved'
                ? 'Approved but never settled — click Retry to run again.'
                : 'Settle interrupted or stuck (marked failed automatically). Retry from the ledger.'),
          };
        }
        return p;
      });

      const paymentsById = new Map(payments.map(p => [p.id, p]));

      const proofs = get().proofs.map((pr) => {
        if (pr.status === 'verified' || pr.status === 'failed') return pr;

        const pay = pr.paymentId ? paymentsById.get(pr.paymentId) : undefined;
        const age = now - (pr.createdAt || 0);
        const isLive = !!(pay && liveInFlight === pay.id);

        // Payment already completed → mark proof verified for books
        if (pay?.status === 'completed') {
          proofsFixed += 1;
          return {
            ...pr,
            status: 'verified' as const,
            proofData: pr.proofData || (pay.txHash ? `zk_${pay.txHash.slice(0, 16)}_healed` : `zk_healed_${pr.id.slice(-8)}`),
            verificationKey: pr.verificationKey || (pay.stealth ? 'stealth_healed' : 'vk_healed'),
            verifiedAt: pr.verifiedAt || now,
            generationTimeMs: pr.generationTimeMs ?? Math.max(0, (pay.processedAt || now) - (pr.createdAt || now)),
          };
        }

        // Payment failed / cancelled → fail the proof
        if (pay && (pay.status === 'failed' || pay.status === 'cancelled')) {
          proofsFixed += 1;
          return {
            ...pr,
            status: 'failed' as const,
            proofData: pr.proofData,
          };
        }

        // Orphan queued/generating with no live settle
        if ((pr.status === 'queued' || pr.status === 'generating') && !isLive) {
          if (!forceAll && age < maxAgeMs) return pr;
          // No payment, or payment not in-flight → stale
          if (!pay || pay.status !== 'processing') {
            proofsFixed += 1;
            return {
              ...pr,
              status: 'failed' as const,
              proofData: pr.proofData,
            };
          }
        }

        return pr;
      });

      if (paymentsFixed > 0 || proofsFixed > 0) {
        set({ payments, proofs });
        get().logSecurityEvent({
          type: 'batch_window',
          message: `Reconciled stale rows: ${paymentsFixed} payment(s), ${proofsFixed} proof(s)`,
        });
      }

      return { paymentsFixed, proofsFixed };
    },

    processPayment: async (paymentId) => {
      const state = get();
      const payment = state.payments.find(p => p.id === paymentId);
      if (!payment) {
        usePaymentSession.getState().failSession('Payment not found — refresh and try again.');
        return;
      }
      const log = get().logSecurityEvent;
      const session = usePaymentSession.getState();

      // Already finished — re-open receipt if we still have a session, else no-op
      if (payment.status === 'completed') {
        if (session.session?.paymentId === paymentId) session.openModal();
        return;
      }

      // If already processing: re-open live popup when still in flight; otherwise unstick + retry
      if (payment.status === 'processing') {
        const live = session.session;
        if (live?.paymentId === paymentId && isPaymentInFlight(live)) {
          session.openModal();
          return;
        }
        // Orphaned "processing" (reload / lost session) — allow a clean retry
        state.updatePaymentStatus(paymentId, 'failed', {
          lastError: 'Previous settle was interrupted. Retrying…',
        });
      }

      // Re-read after possible unstick (stale `payment` object may still say processing)
      const freshStatus = get().payments.find(p => p.id === paymentId)?.status;
      if (freshStatus === 'pending_approval' || payment.status === 'pending_approval') {
        log({ type: 'approval_required', message: 'Payment still awaiting approval', paymentId });
        usePaymentSession.getState().failSession(
          'This payment still needs approval before it can settle.',
        );
        return;
      }

      // Shielded: fund enough for multi-denom settled total (ceil via 1000/100/10/1 notes)
      const fundCurrency = payment.shielded ? 'XLM' : payment.currency;
      let needAmount = payment.amount;
      let planDesc: string | undefined;
      let etaSeconds: number | undefined;
      let totalSteps = payment.shielded ? 12 : 3;

      // Open non-dismissible progress modal FIRST (public, private ZK, stealth)
      // so planning errors still show in the popup instead of failing silently.
      session.startSession({
        paymentId,
        recipientName: payment.recipientName,
        amount: needAmount,
        currency: fundCurrency,
        shielded: !!payment.shielded,
        planDescription: planDesc,
        etaSeconds,
        totalSteps,
      });

      try {
        if (payment.shielded) {
          const plan = planShieldPay(payment.amount || 0);
          needAmount = plan.settledXlm;
          planDesc = plan.description;
          etaSeconds = plan.estimatedSeconds;
          totalSteps = Math.max(8, plan.totalNotes * 4 + plan.notes.length * 2);
          session.updateProgress({
            paymentId,
            label: `Plan: ${plan.description}`,
            phase: 'settling',
            step: 1,
            totalSteps,
          });
        }
      } catch (planErr) {
        const msg = planErr instanceof Error ? planErr.message : 'Could not plan private payment';
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        session.failSession(msg);
        return;
      }

      // Claim after modal so concurrent clicks re-open the same session
      state.updatePaymentStatus(paymentId, 'processing');

      if (!payment.shielded && !state.settings.allowTransparentPayments) {
        const msg = 'Public transfers are disabled in settings';
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: msg, paymentId });
        session.failSession(msg);
        return;
      }

      const senderAddress = state.settings.walletAddress?.trim() || '';
      if (!senderAddress) {
        const msg = 'No funding wallet configured. Open Payroll → Settings → Wallet and connect Freighter / Albedo / xBull.';
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: msg, paymentId });
        session.failSession(msg);
        return;
      }
      if (!stellar.isValidPublicKey(senderAddress)) {
        const msg = `Funding wallet is not a valid Stellar address (need G…, 56 chars). Got: ${senderAddress.slice(0, 12)}…`;
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: msg, paymentId });
        session.failSession(msg);
        return;
      }

      // Long-term G… is optional when stealth meta will produce a one-time receive address.
      // Per-payment useStealth wins over workspace stealthPaymentsEnabled.
      const recipientAddress = payment.recipientWallet?.trim() || '';
      const employeeForMeta = payment.employeeId
        ? get().employees.find(e => e.id === payment.employeeId)
        : null;
      const wantStealthForPay =
        payment.useStealth === true
        || (payment.useStealth !== false && !!state.settings.stealthPaymentsEnabled);
      const metaForPayee = (
        payment.recipientStealthMeta
        || (wantStealthForPay
          ? (employeeForMeta?.stealthMetaAddress
            || (payment.employeeId ? useStealthStore.getState().employeeMeta[payment.employeeId] : '')
            || '')
          : '')
        || ''
      ).trim();
      const stealthCanCover =
        !!payment.shielded
        && wantStealthForPay
        && !!metaForPayee
        && isStealthMetaAddress(metaForPayee);

      if (recipientAddress && !stellar.isValidPublicKey(recipientAddress)) {
        const msg = `Recipient wallet is invalid (need G…, 56 characters). Got: ${recipientAddress.slice(0, 12) || '(empty)'}…`;
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: msg, paymentId });
        session.failSession(msg);
        return;
      }

      if (!recipientAddress && !stealthCanCover) {
        const msg = payment.shielded
          ? 'No recipient wallet (and no stealth meta-address). Add a G… wallet or set up stealth for this payee.'
          : 'No recipient wallet';
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: msg, paymentId });
        session.failSession(msg);
        return;
      }

      const workspaceId = useWorkspaceStore.getState().currentWorkspaceId || 'default';
      const horizonUrl = state.settings.horizonUrl || 'https://horizon-testnet.stellar.org';

      // ── Preflight: re-read wallets from Horizon BEFORE any settle work ──
      session.updateProgress({
        paymentId,
        label: 'Checking funding wallet on Stellar…',
        phase: 'starting',
        step: 0,
      });
      try {
        const funder = await stellar.accountExists(senderAddress, horizonUrl);
        if (!funder.exists) {
          const msg = `Funding wallet ${senderAddress.slice(0, 6)}… is not funded on this network. `
            + (horizonUrl.includes('testnet')
              ? 'Use Friendbot / “Fund from faucet” on testnet, then retry.'
              : 'Send XLM to the funding wallet, then retry.');
          state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
          log({ type: 'payment_blocked', message: msg, paymentId });
          session.failSession(msg);
          return;
        }
        // Prefer live Horizon balance over stale UI pool cache
        if (funder.balances) {
          const live = funder.balances[fundCurrency as 'XLM' | 'USDC' | 'EURC'] ?? funder.balances.XLM;
          if ((live || 0) < needAmount) {
            const msg = `Insufficient ${fundCurrency} on-chain (have ${live}, need ${needAmount}). Top up the funding wallet.`;
            state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
            log({ type: 'payment_blocked', message: msg, paymentId });
            session.failSession(msg);
            return;
          }
          useZer0Store.setState(s => ({
            pool: {
              ...s.pool,
              balances: {
                USDC: funder.balances!.USDC,
                XLM: funder.balances!.XLM,
                EURC: funder.balances!.EURC,
              },
              lastUpdated: Date.now(),
            },
          }));
        }

        if (recipientAddress && !stealthCanCover) {
          session.updateProgress({
            paymentId,
            label: 'Checking recipient wallet…',
            phase: 'starting',
          });
          const dest = await stellar.accountExists(recipientAddress, horizonUrl);
          if (!dest.exists && fundCurrency !== 'XLM') {
            const msg = `Recipient ${recipientAddress.slice(0, 6)}… does not exist on Stellar. `
              + `Create/fund it with XLM first, then send ${fundCurrency}.`;
            state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
            session.failSession(msg);
            return;
          }
          if (!dest.exists && !payment.shielded && fundCurrency === 'XLM' && needAmount < 1) {
            const msg = 'Recipient wallet is new — public XLM pays need at least 1 XLM to create the account.';
            state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
            session.failSession(msg);
            return;
          }
        }
      } catch (preErr) {
        const msg = preErr instanceof Error
          ? `Wallet preflight failed: ${preErr.message}`
          : 'Wallet preflight failed (Horizon unreachable).';
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: msg, paymentId });
        session.failSession(msg);
        return;
      }

      // Soft pool-cache check (Horizon already validated above)
      const hasFunds = (get().pool.balances[fundCurrency] || 0) >= needAmount;
      if (!hasFunds) {
        const msg = `Insufficient ${fundCurrency} in funding wallet (need ${needAmount})`;
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: msg, paymentId });
        session.failSession(msg);
        return;
      }

      const logRunStart = async (shielded: boolean) => {
        try {
          await payrollApi.createRun({
            workspaceId,
            runId: paymentId,
            projectId: payment.projectId,
            type: payment.type,
            lineItems: [{
              employeeId: payment.employeeId,
              name: payment.recipientName,
              email: '',
              amount: payment.amount,
              currency: payment.currency,
              walletAddress: recipientAddress,
              status: 'processing',
              shielded,
              projectId: payment.projectId,
              type: payment.type,
              memo: payment.memo || '',
            }],
            totalAmount: payment.amount,
            status: 'processing',
            memo: payment.memo || '',
          });
        } catch (e) {
          console.error('Failed to log payment start to backend:', e);
        }
      };

      const completeRun = async (txHash: string, shielded: boolean, proofId?: string | null) => {
        const linkedProofId = proofId || useZer0Store.getState().payments.find(p => p.id === paymentId)?.proofId || null;
        try {
          await payrollApi.updateRun(paymentId, {
            workspaceId,
            projectId: payment.projectId,
            status: 'completed',
            proofId: linkedProofId,
            lineItems: [{
              employeeId: payment.employeeId,
              name: payment.recipientName,
              email: '',
              amount: payment.amount,
              currency: payment.currency,
              walletAddress: recipientAddress,
              status: 'completed',
              shielded,
              projectId: payment.projectId,
              type: payment.type,
              memo: payment.memo || '',
              proofId: linkedProofId,
            }],
            txHash,
            processedAt: Date.now(),
            type: payment.type,
            memo: payment.memo || '',
          });
        } catch (e) {
          // create may have failed earlier — try create as completed
          try {
            await payrollApi.createRun({
              workspaceId,
              runId: paymentId,
              projectId: payment.projectId,
              type: payment.type,
              proofId: linkedProofId,
              lineItems: [{
                employeeId: payment.employeeId,
                name: payment.recipientName,
                email: '',
                amount: payment.amount,
                currency: payment.currency,
                walletAddress: recipientAddress,
                status: 'completed',
                shielded,
                projectId: payment.projectId,
              }],
              totalAmount: payment.amount,
              status: 'completed',
              txHash,
              processedAt: Date.now(),
            });
          } catch (e2) {
            console.error('Failed to complete payment logs:', e, e2);
          }
        }
      };

      if (payment.shielded) {
        const { estimateFreighterPromptsForAmount, isAutoSignEnabled } = await import('../api/privacyPool');
        const plan = planShieldPay(payment.amount || 0);
        const settledXlm = plan.settledXlm;
        const noteCount = plan.totalNotes;
        const estimatedPrompts = estimateFreighterPromptsForAmount(payment.amount || 0);
        log({
          type: 'batch_window',
          message: `ZK multi-denom: ${plan.description} (${isAutoSignEnabled() ? 'auto-sign' : `~${estimatedPrompts} Freighter confirms`})`,
          paymentId,
        });
        session.updateProgress({
          paymentId,
          label: `Plan: ${plan.description}`,
          phase: 'settling',
          step: 1,
          totalSteps,
        });

        const day = utcDayKey();
        const spentToday = state.dailySpend.day === day ? state.dailySpend.xlm : 0;
        const limit = state.settings.dailySpendLimitXlm || 0;
        if (limit > 0 && spentToday + settledXlm > limit) {
          const msg = `Daily private spend limit reached (${spentToday}/${limit} XLM). Blocked ${settledXlm} XLM payment.`;
          state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
          log({ type: 'limit_hit', message: msg, paymentId });
          session.failSession(msg);
          return;
        }

        // Fund check uses settled (rounded-up) multi-denom total
        if ((state.pool.balances.XLM || 0) < settledXlm) {
          const msg = `Insufficient XLM in funding wallet (need ${settledXlm} for ${plan.description})`;
          state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
          log({ type: 'payment_blocked', message: msg, paymentId });
          session.failSession(msg);
          return;
        }

        const proof = state.createProof(paymentId, payment.projectId, state.settings.proofSystem);
        state.updatePaymentStatus(paymentId, 'processing', { proofId: proof.id });
        await logRunStart(true);
        get().updateProofStatus(proof.id, 'generating');
        try {
          await proofApi.create({
            id: proof.id,
            projectId: payment.projectId,
            paymentId,
            status: 'queued',
            proofSystem: state.settings.proofSystem,
          });
        } catch {}

        try {
          const t0 = Date.now();
          session.updateProgress({
            paymentId,
            label: 'Connecting to private settle worker…',
            phase: 'waking',
            step: 2,
          });

          // ── Stealth: only when THIS payment asked for it (not just workspace default) ──
          let settleTo = recipientAddress;
          let stealthRecordId: string | null = null;
          let stealthEphemeralPub: string | null = null;
          let stealthOneTime: string | null = null;
          let usedStealth = false;

          const employee = payment.employeeId
            ? get().employees.find(e => e.id === payment.employeeId)
            : null;
          // Per-payment flag is authoritative. false = never stealth, even if employee has meta.
          const wantStealth =
            payment.useStealth === true
            || (payment.useStealth !== false && !!state.settings.stealthPaymentsEnabled);

          // Only pull employee/store meta when stealth is actually wanted for this pay
          const metaFromPayment = payment.recipientStealthMeta?.trim() || '';
          const metaFromEmployee = wantStealth ? (employee?.stealthMetaAddress?.trim() || '') : '';
          const metaFromStore = wantStealth && payment.employeeId
            ? (useStealthStore.getState().employeeMeta[payment.employeeId] || '')
            : '';
          const metaCandidate = wantStealth
            ? (metaFromPayment || metaFromEmployee || metaFromStore || '')
            : '';

          if (!wantStealth) {
            log({
              type: 'batch_window',
              message: 'Stealth off for this payment — settling to long-term wallet',
              paymentId,
            });
          } else if (metaCandidate && isStealthMetaAddress(metaCandidate)) {
            try {
              const record = useStealthStore.getState().prepareOutbound({
                metaAddress: metaCandidate,
                amountXlm: settledXlm,
                paymentId,
                note: payment.recipientName,
              });
              settleTo = record.oneTimePublicKey;
              stealthRecordId = record.id;
              stealthEphemeralPub = record.ephemeralPublicHex;
              stealthOneTime = record.oneTimePublicKey;
              usedStealth = true;
              log({
                type: 'batch_window',
                message: `Stealth: one-time receive ${record.oneTimePublicKey.slice(0, 8)}… (long-term wallet not used on withdraw)`,
                paymentId,
              });
              session.updateProgress({
                paymentId,
                label: 'Stealth one-time address derived…',
                phase: 'settling',
              });
            } catch (e) {
              console.warn('[stealth] derive failed, falling back to long-term wallet', e);
              log({
                type: 'batch_window',
                message: 'Stealth derive failed — using long-term wallet',
                paymentId,
              });
            }
          } else if (wantStealth && !metaCandidate) {
            log({
              type: 'batch_window',
              message: 'Stealth on, but payee has no meta-address — using long-term wallet',
              paymentId,
            });
          }

          if (!settleTo) {
            const msg = 'No settle destination: add a recipient G… wallet or a valid stealth meta-address.';
            state.updatePaymentStatus(paymentId, 'failed', { lastError: msg, proofId: proof.id });
            get().updateProofStatus(proof.id, 'failed');
            log({ type: 'payment_blocked', message: msg, paymentId });
            session.failSession(msg);
            return;
          }

          if (!stellar.isValidPublicKey(settleTo)) {
            const msg = `Settle destination is not a valid Stellar G… address: ${String(settleTo).slice(0, 12)}…`;
            state.updatePaymentStatus(paymentId, 'failed', { lastError: msg, proofId: proof.id });
            get().updateProofStatus(proof.id, 'failed');
            session.failSession(msg);
            return;
          }

          // Per-payment privacy overrides (details "View more") win over workspace settings
          const ov = payment.privacyOverrides || null;
          const effDelay = ov?.privacyDelaySec ?? state.settings.privacyDelaySec ?? 0;
          const effJitter = ov?.privacyJitterSec ?? state.settings.privacyJitterSec ?? 0;
          const effDecoyOn = ov?.decoyDepositsEnabled ?? !!state.settings.decoyDepositsEnabled;
          const effDecoyCount = ov?.decoyDepositCount ?? state.settings.decoyDepositCount ?? 0;
          const effBatch = ov?.batchDepositThenWithdraw ?? !!state.settings.batchDepositThenWithdraw;
          const effPostDecoy = ov?.postPayDecoyEnabled ?? !!state.settings.postPayDecoyEnabled;

          // Worker preflight only when multi-note + no auto-sign (single-note 1 XLM skips this hop)
          const isUltraFast =
            (effDelay === 0 && !effDecoyOn && !effPostDecoy && !usedStealth)
            || (
              !ov
              && (
                state.settings.privacyPreset === 'ultra_fast'
                || state.settings.privacyPreset === 'fast'
              )
            );
          if (!isUltraFast && noteCount > 2) {
            session.updateProgress({
              paymentId,
              label: 'Checking private settle worker…',
              phase: 'waking',
            });
            try {
              const { isAutoSignEnabled: autoSignOn } = await import('../api/privacyPool');
              if (!autoSignOn()) {
                let workerOk = false;
                try {
                  const st = await zkWorkerApi.status();
                  workerOk = !!(st && (st as any).online !== false && (st as any).status !== 'stopped');
                  const s = String((st as any)?.status || (st as any)?.state || '').toLowerCase();
                  if (s.includes('run') || s.includes('ready') || s.includes('online') || s.includes('active')) {
                    workerOk = true;
                  }
                  if ((st as any)?.online === false || s.includes('stop') || s.includes('offline')) {
                    workerOk = false;
                  }
                } catch {
                  workerOk = false;
                }
                if (!workerOk) {
                  session.updateProgress({
                    paymentId,
                    label: 'ZK worker may be offline — attempting settle…',
                    phase: 'waking',
                  });
                }
              }
            } catch {
              /* non-fatal */
            }
          } else {
            session.updateProgress({
              paymentId,
              label: isUltraFast ? 'Ultra-fast private settle…' : 'Starting private settle…',
              phase: 'settling',
            });
          }

          // Stealth one-time G… must exist before pool withdraw (SAC transfer fails on uncreated accounts)
          if (usedStealth && stealthOneTime) {
            session.updateProgress({
              paymentId,
              label: 'Creating stealth receive account on Stellar…',
              phase: 'settling',
            });
            try {
              const ensured = await stellar.ensureAccount(senderAddress, stealthOneTime, horizonUrl, 1.5);
              if (ensured.created) {
                log({
                  type: 'batch_window',
                  message: `Funded stealth one-time account ${stealthOneTime.slice(0, 8)}… (createAccount)`,
                  paymentId,
                });
                session.updateProgress({
                  paymentId,
                  label: 'Stealth account created — continuing private settle…',
                  phase: 'settling',
                });
              } else {
                session.updateProgress({
                  paymentId,
                  label: 'Stealth account already on-chain…',
                  phase: 'settling',
                });
              }
            } catch (fundErr) {
              const msg = fundErr instanceof Error
                ? `Could not create stealth receive account: ${fundErr.message}`
                : 'Could not create stealth receive account';
              state.updatePaymentStatus(paymentId, 'failed', { lastError: msg, proofId: proof.id });
              get().updateProofStatus(proof.id, 'failed');
              log({ type: 'payment_failed', message: msg, paymentId });
              session.failSession(msg);
              return;
            }
          } else if (settleTo) {
            // Non-stealth private pay: ensure long-term destination exists (create with min reserve)
            try {
              const dest = await stellar.accountExists(settleTo, horizonUrl);
              if (!dest.exists) {
                session.updateProgress({
                  paymentId,
                  label: 'Recipient wallet missing — creating on Stellar…',
                  phase: 'settling',
                });
                await stellar.ensureAccount(senderAddress, settleTo, horizonUrl, 1.5);
              }
            } catch (fundErr) {
              const msg = fundErr instanceof Error
                ? `Recipient account setup failed: ${fundErr.message}`
                : 'Recipient account setup failed';
              state.updatePaymentStatus(paymentId, 'failed', { lastError: msg, proofId: proof.id });
              get().updateProofStatus(proof.id, 'failed');
              session.failSession(msg);
              return;
            }
          }

          // ── Timing privacy: delay before settle (breaks deposit/withdraw timing) ──
          const baseDelay = Math.max(0, effDelay);
          const jitterMax = Math.max(0, effJitter);
          const jitter = jitterMax > 0 ? Math.floor(Math.random() * (jitterMax + 1)) : 0;
          const delaySec = baseDelay + jitter;
          if (delaySec > 0) {
            log({
              type: 'delay_applied',
              message: `Timing privacy: waiting ${delaySec}s before settle (${baseDelay}+${jitter} jitter)`,
              paymentId,
            });
            const deadline = Date.now() + delaySec * 1000;
            while (Date.now() < deadline) {
              const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
              session.updateProgress({
                paymentId,
                label: `Timing privacy delay… ${left}s remaining`,
                phase: 'settling',
              });
              await sleep(Math.min(1000, deadline - Date.now()));
            }
          }

          const { lastTxHash, settledXlm: paid } = await zkShieldPayAmount({
            fromAddress: senderAddress,
            toAddress: settleTo,
            amountXlm: payment.amount,
            privacy: {
              delaySec: 0, // already applied above (pre-settle)
              decoyCount: effDecoyOn ? Math.max(0, effDecoyCount || 0) : 0,
              batchDepositThenWithdraw: !!effBatch,
            },
            onProgress: (label, cur, total) => {
              log({
                type: 'batch_window',
                message: `[${cur}/${total}] ${label}`,
                paymentId,
              });
              usePaymentSession.getState().updateProgress({
                paymentId,
                label,
                step: cur,
                totalSteps: total,
              });
            },
            onJobId: (jobId) => {
              usePaymentSession.getState().addJobId(jobId, paymentId);
            },
          });

          if (stealthRecordId) {
            useStealthStore.getState().attachTxHash(stealthRecordId, lastTxHash);
            // Mint PIN claim BEFORE completeSession so the popup can show PIN + link
            const outbound = useStealthStore.getState().outbound.find(r => r.id === stealthRecordId);
            if (outbound?.oneTimeSecret) {
              session.updateProgress({
                paymentId,
                label: 'Creating withdraw PIN for recipient…',
                phase: 'finalizing',
              });
              try {
                const claim = await createStealthClaim({
                  oneTimeSecret: outbound.oneTimeSecret,
                  oneTimePublicKey: outbound.oneTimePublicKey,
                  amountXlm: paid,
                  note: payment.recipientName,
                  paymentId,
                  network: networkFromHorizon(state.settings.horizonUrl || ''),
                });
                useStealthClaimsStore.getState().addIssued(claim);
                log({
                  type: 'batch_window',
                  message: `Stealth withdraw PIN ready (PIN ${claim.pin})`,
                  paymentId,
                });
              } catch (claimErr) {
                console.warn('[stealth] claim mint failed (non-fatal):', claimErr);
                log({
                  type: 'batch_window',
                  message: 'PIN claim mint failed — use ledger Advanced secret if needed',
                  paymentId,
                });
              }
            }
          }

          // Optional post-pay decoy deposit (browser path only; best-effort)
          if (effPostDecoy && !isUltraFast) {
            try {
              session.updateProgress({
                paymentId,
                label: 'Post-pay decoy deposit (anonymity set)…',
                phase: 'finalizing',
              });
              const { deposit: zkDeposit, usePool, POOL_TIERS } = await import('../api/privacyPool');
              const tier1 = POOL_TIERS.find(t => t.xlm === 1) || POOL_TIERS[POOL_TIERS.length - 1];
              usePool(tier1);
              await zkDeposit(senderAddress, tier1.stroops);
              log({
                type: 'decoy_sent',
                message: `Decoy deposit ${tier1.xlm} XLM left in pool (not withdrawn)`,
                paymentId,
              });
            } catch (e) {
              console.warn('[decoy] post-pay decoy failed (non-fatal):', e);
            }
          }

          session.updateProgress({
            paymentId,
            label: 'Finalizing receipt & proof…',
            phase: 'finalizing',
            step: totalSteps - 1,
          });

          const genTime = Date.now() - t0;
          const proofHash = `zk_${lastTxHash.slice(0, 16)}_n${noteCount}${usedStealth ? '_st' : ''}`;
          const vk = usedStealth
            ? `stealth_eph_${(stealthEphemeralPub || '').slice(0, 16)}`
            : `vk_${Date.now().toString(16)}`;

          get().updateProofStatus(proof.id, 'verified', {
            proofData: proofHash,
            verificationKey: vk,
            generationTimeMs: genTime,
            verifiedAt: Date.now(),
          });

          try {
            await proofApi.update(proof.id, {
              status: 'verified',
              proofData: proofHash,
              verificationKey: vk,
              generationTimeMs: genTime,
              verifiedAt: Date.now(),
              projectId: payment.projectId,
              paymentId,
              proofSystem: state.settings.proofSystem,
            });
          } catch {}

          set(s => {
            const d = utcDayKey();
            const prev = s.dailySpend.day === d ? s.dailySpend.xlm : 0;
            return {
              pool: {
                ...s.pool,
                balances: { ...s.pool.balances, XLM: Math.max(0, s.pool.balances.XLM - paid) },
                totalPaymentsProcessed: s.pool.totalPaymentsProcessed + 1,
                lastUpdated: Date.now(),
              },
              dailySpend: { day: d, xlm: prev + paid },
            };
          });

          get().updatePaymentStatus(paymentId, 'completed', {
            txHash: lastTxHash,
            processedAt: Date.now(),
            amount: paid,
            stealth: usedStealth,
            stealthOneTimeAddress: stealthOneTime,
            stealthEphemeralPub,
          });
          log({
            type: 'payment_completed',
            message: usedStealth
              ? `ZK+stealth paid ${paid} XLM (${plan.description}) → one-time ${stealthOneTime?.slice(0, 8)}…`
              : `ZK paid ${paid} XLM (${plan.description}) to recipient`,
            paymentId,
          });
          await completeRun(lastTxHash, true, proof.id);
          usePaymentSession.getState().completeSession({
            txHash: lastTxHash,
            label: usedStealth
              ? `Paid ${paid} XLM privately + stealth (${plan.description})`
              : `Paid ${paid} XLM privately (${plan.description})`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Shielded payment failed';
          console.error(`Shielded payment failed for ${paymentId}:`, msg);
          get().updateProofStatus(proof.id, 'failed');
          get().updatePaymentStatus(paymentId, 'failed', { lastError: msg });
          log({ type: 'payment_failed', message: msg, paymentId });
          usePaymentSession.getState().failSession(msg);
          try { await payrollApi.updateRun(paymentId, { workspaceId, status: 'failed' }); } catch {}
        }
      } else {
        state.updatePaymentStatus(paymentId, 'processing');
        await logRunStart(false);
        session.updateProgress({
          paymentId,
          label: 'Submitting public Stellar payment…',
          phase: 'settling',
          step: 1,
        });

        try {
          const result = await stellar.submitPayment(
            senderAddress, recipientAddress, payment.amount, payment.currency, horizonUrl, undefined,
          );

          try {
            const newBalances = await stellar.getPoolBalance(senderAddress, horizonUrl);
            useZer0Store.setState(s => ({
              pool: {
                ...s.pool,
                balances: {
                  USDC: Number.isFinite(newBalances.USDC) ? newBalances.USDC : s.pool.balances.USDC,
                  XLM: Number.isFinite(newBalances.XLM) ? newBalances.XLM : s.pool.balances.XLM,
                  EURC: Number.isFinite(newBalances.EURC) ? newBalances.EURC : s.pool.balances.EURC,
                },
                totalPaymentsProcessed: s.pool.totalPaymentsProcessed + 1,
                lastUpdated: Date.now(),
              },
            }));
          } catch {}

          get().updatePaymentStatus(paymentId, 'completed', { txHash: result.txHash, processedAt: Date.now() });
          log({ type: 'payment_completed', message: `Public transfer ${payment.amount} ${payment.currency}`, paymentId });
          await completeRun(result.txHash, false);
          usePaymentSession.getState().completeSession({
            txHash: result.txHash,
            label: `Paid ${payment.amount} ${payment.currency}`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Transaction failed';
          console.error(`Transparent payment failed for ${paymentId}:`, msg);
          get().updatePaymentStatus(paymentId, 'failed', { lastError: msg });
          log({ type: 'payment_failed', message: msg, paymentId });
          usePaymentSession.getState().failSession(msg);
          try { await payrollApi.updateRun(paymentId, { workspaceId, status: 'failed' }); } catch {}
        }
      }
    },

    updateSettings: (updates) => {
      set(s => {
        const next = { ...s.settings, ...updates };
        // Normalize currency so bad/missing values never wipe a saved default
        if (updates.defaultCurrency !== undefined) {
          const c = String(updates.defaultCurrency || '').toUpperCase();
          next.defaultCurrency =
            c === 'USDC' || c === 'EURC' || c === 'XLM'
              ? (c as Zer0Currency)
              : s.settings.defaultCurrency || 'XLM';
        }
        return { settings: next };
      });
      if (typeof updates.preferFreighterSigning === 'boolean') {
        import('../api/privacyPool').then(m => m.setForceFreighterSigning(updates.preferFreighterSigning!));
      }
    },

    resetSettings: () =>
      set({ settings: { ...DEFAULT_SETTINGS } }),
  }),
  {
    name: 'zexvro_zer0',
    partialize: (state) => ({
      settings: state.settings,
      proofs: state.proofs,
      payments: state.payments,
      employees: state.employees,
      pool: state.pool,
      securityEvents: state.securityEvents,
      dailySpend: state.dailySpend,
    }),
    merge: (persisted, current) => {
      const p = (persisted || {}) as Partial<Zer0State>;
      const rawSettings = { ...(p.settings || {}) } as Partial<Zer0Settings>;
      // Preserve user default currency across reloads (do not let DEFAULT overwrite a saved value)
      const savedCurrency = String(rawSettings.defaultCurrency || '').toUpperCase();
      const mergedSettings: Zer0Settings = {
        ...DEFAULT_SETTINGS,
        ...rawSettings,
        defaultCurrency:
          savedCurrency === 'USDC' || savedCurrency === 'EURC' || savedCurrency === 'XLM'
            ? (savedCurrency as Zer0Currency)
            : DEFAULT_SETTINGS.defaultCurrency,
      };
      if (typeof mergedSettings.preferFreighterSigning !== 'boolean') {
        mergedSettings.preferFreighterSigning = true;
      }
      // Apply signing preference immediately after rehydrate
      import('../api/privacyPool').then(m =>
        m.setForceFreighterSigning(!!mergedSettings.preferFreighterSigning),
      );
      // After rehydrate, clear orphan Processing / Queued rows from prior sessions
      queueMicrotask(() => {
        try {
          useZer0Store.getState().reconcileStalePayments({ maxAgeMs: 60_000 });
        } catch (e) {
          console.warn('[zer0] reconcile after rehydrate failed', e);
        }
      });
      return {
        ...current,
        ...p,
        settings: mergedSettings,
        securityEvents: p.securityEvents || [],
        dailySpend: p.dailySpend || { day: utcDayKey(), xlm: 0 },
      };
    },
  },
  )
);

/** Boot helper — also called from main.tsx */
export function reconcileStaleZer0State() {
  try {
    return useZer0Store.getState().reconcileStalePayments({ maxAgeMs: 60_000 });
  } catch {
    return { paymentsFixed: 0, proofsFixed: 0 };
  }
}
