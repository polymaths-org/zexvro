import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Zer0Employee, Zer0Payment, Zer0Proof, Zer0PoolState, Zer0Settings,
  Zer0Currency, Zer0PaymentStatus, Zer0ProofSystem, Zer0SecurityEvent,
  Zer0PrivacyPreset,
} from './types';
import { proofApi, payrollApi, stellar } from '../api/api';
import { shieldPayAmount as zkShieldPayAmount, planShieldPay, getNotes as getZkNotes } from '../api/privacyPool';
import { useWorkspaceStore } from './workspace';
import { usePaymentSession } from './paymentSession';
import { useStealthStore } from './stealth';
import { isStealthMetaAddress } from '../lib/stealth';

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
  privacyPreset: 'balanced',
  privacyDelaySec: 45,
  privacyJitterSec: 30,
  decoyDepositsEnabled: true,
  decoyDepositCount: 1,
  dailySpendLimitXlm: 500,
  batchDepositThenWithdraw: true,
  shieldedUnitsPerPay: 1,
  preferFreighterSigning: true,
  stealthPaymentsEnabled: true,
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
    case 'fast':
      // Just ZK proof + pool contract: no delay, no decoys, no stealth
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
      // Default production tradeoff
      return {
        privacyPreset: 'balanced',
        privacyDelaySec: 45,
        privacyJitterSec: 30,
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
        privacyDelaySec: 120,
        privacyJitterSec: 60,
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

    processPayment: async (paymentId) => {
      const state = get();
      const payment = state.payments.find(p => p.id === paymentId);
      if (!payment) return;
      const log = get().logSecurityEvent;
      const session = usePaymentSession.getState();

      // Already finished — do not re-open Freighter / re-settle
      if (payment.status === 'completed') {
        return;
      }

      // If already processing, re-surface the live popup instead of starting a second settle
      if (payment.status === 'processing') {
        if (session.session?.paymentId === paymentId) {
          session.openModal();
        }
        return;
      }

      if (payment.status === 'pending_approval') {
        log({ type: 'approval_required', message: 'Payment still awaiting approval', paymentId });
        return;
      }

      // Shielded: fund enough for multi-denom settled total (ceil via 1000/100/10/1 notes)
      const fundCurrency = payment.shielded ? 'XLM' : payment.currency;
      let needAmount = payment.amount;
      let planDesc: string | undefined;
      let etaSeconds: number | undefined;
      let totalSteps = 3;
      if (payment.shielded) {
        const plan = planShieldPay(payment.amount || 0);
        needAmount = plan.settledXlm;
        planDesc = plan.description;
        etaSeconds = plan.estimatedSeconds;
        totalSteps = Math.max(8, plan.totalNotes * 4 + plan.notes.length * 2);
      }

      // Open non-dismissible progress modal FIRST so the user always sees secure settle UX
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

      // Claim after modal so concurrent clicks re-open the same session
      state.updatePaymentStatus(paymentId, 'processing');

      if (!payment.shielded && !state.settings.allowTransparentPayments) {
        const msg = 'Public transfers are disabled in settings';
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: msg, paymentId });
        session.failSession(msg);
        return;
      }

      const hasFunds = (state.pool.balances[fundCurrency] || 0) >= needAmount;
      if (!hasFunds) {
        const msg = `Insufficient ${fundCurrency} in funding wallet (need ${needAmount})`;
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: msg, paymentId });
        session.failSession(msg);
        return;
      }

      const senderAddress = state.settings.walletAddress?.trim();
      if (!senderAddress) {
        const msg = 'No funding wallet';
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: 'No funding wallet configured', paymentId });
        session.failSession(msg);
        return;
      }

      // Long-term G… is optional when stealth meta will produce a one-time receive address
      const recipientAddress = payment.recipientWallet?.trim() || '';
      const employeeForMeta = payment.employeeId
        ? get().employees.find(e => e.id === payment.employeeId)
        : null;
      const metaForPayee = (
        payment.recipientStealthMeta
        || employeeForMeta?.stealthMetaAddress
        || (payment.employeeId ? useStealthStore.getState().employeeMeta[payment.employeeId] : '')
        || ''
      ).trim();
      const stealthCanCover =
        !!payment.shielded
        && !!state.settings.stealthPaymentsEnabled
        && !!metaForPayee
        && isStealthMetaAddress(metaForPayee);

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

          // ── Stealth: derive one-time receive address when enabled ──
          let settleTo = recipientAddress;
          let stealthRecordId: string | null = null;
          let stealthEphemeralPub: string | null = null;
          let stealthOneTime: string | null = null;
          let usedStealth = false;

          const employee = payment.employeeId
            ? get().employees.find(e => e.id === payment.employeeId)
            : null;
          const metaFromPayment = payment.recipientStealthMeta?.trim() || '';
          const metaFromEmployee = employee?.stealthMetaAddress?.trim() || '';
          const metaFromStore = payment.employeeId
            ? useStealthStore.getState().employeeMeta[payment.employeeId]
            : '';
          const metaCandidate = metaFromPayment || metaFromEmployee || metaFromStore || '';
          const wantStealth = !!state.settings.stealthPaymentsEnabled;

          if (wantStealth && metaCandidate && isStealthMetaAddress(metaCandidate)) {
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

          // ── Timing privacy: delay before settle (breaks deposit/withdraw timing) ──
          const baseDelay = Math.max(0, state.settings.privacyDelaySec || 0);
          const jitterMax = Math.max(0, state.settings.privacyJitterSec || 0);
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
              decoyCount: state.settings.decoyDepositsEnabled
                ? Math.max(0, state.settings.decoyDepositCount || 0)
                : 0,
              batchDepositThenWithdraw: !!state.settings.batchDepositThenWithdraw,
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
          }

          // Optional post-pay decoy deposit (browser path only; best-effort)
          if (state.settings.postPayDecoyEnabled) {
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
      set(s => ({ settings: { ...s.settings, ...updates } }));
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
      const mergedSettings = { ...DEFAULT_SETTINGS, ...(p.settings || {}) };
      if (typeof mergedSettings.preferFreighterSigning !== 'boolean') {
        mergedSettings.preferFreighterSigning = true;
      }
      // Apply signing preference immediately after rehydrate
      import('../api/privacyPool').then(m =>
        m.setForceFreighterSigning(!!mergedSettings.preferFreighterSigning),
      );
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
