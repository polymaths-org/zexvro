import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Zer0Employee, Zer0Payment, Zer0Proof, Zer0PoolState, Zer0Settings,
  Zer0Currency, Zer0PaymentStatus, Zer0ProofSystem, Zer0SecurityEvent,
} from './types';
import { proofApi, payrollApi, stellar } from '../api/api';
import { shieldPayAmount as zkShieldPayAmount, planShieldPay, getNotes as getZkNotes } from '../api/privacyPool';
import { useWorkspaceStore } from './workspace';

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
  privacyDelaySec: 0,
  privacyJitterSec: 0,
  decoyDepositsEnabled: false,
  decoyDepositCount: 0,
  dailySpendLimitXlm: 500,
  batchDepositThenWithdraw: true,
  shieldedUnitsPerPay: 1,
  preferFreighterSigning: true,
};

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
  processPayment: (paymentId: string) => void;
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

      // Prevent double-clicks / re-entry from opening endless Freighter windows
      if (payment.status === 'processing' || payment.status === 'completed') {
        return;
      }
      // Claim immediately so concurrent processPayment calls bail out
      if (payment.status !== 'pending_approval') {
        state.updatePaymentStatus(paymentId, 'processing');
      }

      if (payment.status === 'pending_approval') {
        log({ type: 'approval_required', message: 'Payment still awaiting approval', paymentId });
        return;
      }

      if (!payment.shielded && !state.settings.allowTransparentPayments) {
        const msg = 'Public transfers are disabled in settings';
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: msg, paymentId });
        return;
      }

      // Shielded: fund enough for multi-denom settled total (ceil via 1000/100/10/1 notes)
      const fundCurrency = payment.shielded ? 'XLM' : payment.currency;
      let needAmount = payment.amount;
      if (payment.shielded) {
        needAmount = planShieldPay(payment.amount || 0).settledXlm;
      }
      const hasFunds = (state.pool.balances[fundCurrency] || 0) >= needAmount;
      if (!hasFunds) {
        const msg = `Insufficient ${fundCurrency} in funding wallet (need ${needAmount})`;
        state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
        log({ type: 'payment_blocked', message: msg, paymentId });
        return;
      }

      const senderAddress = state.settings.walletAddress?.trim();
      if (!senderAddress) {
        state.updatePaymentStatus(paymentId, 'failed', { lastError: 'No funding wallet' });
        log({ type: 'payment_blocked', message: 'No funding wallet configured', paymentId });
        return;
      }

      const recipientAddress = payment.recipientWallet?.trim();
      if (!recipientAddress) {
        state.updatePaymentStatus(paymentId, 'failed', { lastError: 'No recipient wallet' });
        log({ type: 'payment_blocked', message: 'No recipient wallet', paymentId });
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

        const day = utcDayKey();
        const spentToday = state.dailySpend.day === day ? state.dailySpend.xlm : 0;
        const limit = state.settings.dailySpendLimitXlm || 0;
        if (limit > 0 && spentToday + settledXlm > limit) {
          const msg = `Daily private spend limit reached (${spentToday}/${limit} XLM). Blocked ${settledXlm} XLM payment.`;
          state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
          log({ type: 'limit_hit', message: msg, paymentId });
          return;
        }

        // Fund check uses settled (rounded-up) multi-denom total
        if ((state.pool.balances.XLM || 0) < settledXlm) {
          const msg = `Insufficient XLM in funding wallet (need ${settledXlm} for ${plan.description})`;
          state.updatePaymentStatus(paymentId, 'failed', { lastError: msg });
          log({ type: 'payment_blocked', message: msg, paymentId });
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
          const { lastTxHash, settledXlm: paid } = await zkShieldPayAmount({
            fromAddress: senderAddress,
            toAddress: recipientAddress,
            amountXlm: payment.amount,
            onProgress: (label, cur, total) => {
              log({
                type: 'batch_window',
                message: `[${cur}/${total}] ${label}`,
                paymentId,
              });
            },
          });

          const genTime = Date.now() - t0;
          const proofHash = `zk_${lastTxHash.slice(0, 16)}_n${noteCount}`;
          const vk = `vk_${Date.now().toString(16)}`;

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
          });
          log({
            type: 'payment_completed',
            message: `ZK paid ${paid} XLM (${plan.description}) to recipient`,
            paymentId,
          });
          await completeRun(lastTxHash, true, proof.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Shielded payment failed';
          console.error(`Shielded payment failed for ${paymentId}:`, msg);
          get().updateProofStatus(proof.id, 'failed');
          get().updatePaymentStatus(paymentId, 'failed', { lastError: msg });
          log({ type: 'payment_failed', message: msg, paymentId });
          try { await payrollApi.updateRun(paymentId, { workspaceId, status: 'failed' }); } catch {}
        }
      } else {
        state.updatePaymentStatus(paymentId, 'processing');
        await logRunStart(false);

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
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Transaction failed';
          console.error(`Transparent payment failed for ${paymentId}:`, msg);
          get().updatePaymentStatus(paymentId, 'failed', { lastError: msg });
          log({ type: 'payment_failed', message: msg, paymentId });
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
