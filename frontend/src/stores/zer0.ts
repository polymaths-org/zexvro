import { create } from 'zustand';
import type {
  Zer0Employee, Zer0Payment, Zer0Proof, Zer0PoolState, Zer0Settings,
  Zer0Currency, Zer0PaymentStatus, Zer0ProofSystem,
} from './types';

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
  merkleDepth: 32,
  requireValidatorSig: true,
  paymentApprovalRequired: false,
  paymentWorkflow: 'manual',
  settlementMode: 'stellar',
  allowTransparentPayments: false,
  exportFormat: 'csv',
  proofRetryLimit: 3,
  webhookUrl: '',
  defaultCurrency: 'USDC',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  walletAddress: '',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: '',
  contractAddress: '',
};

interface Zer0State {
  employees: Zer0Employee[];
  payments: Zer0Payment[];
  proofs: Zer0Proof[];
  pool: Zer0PoolState;
  settings: Zer0Settings;

  // Employee CRUD
  addEmployee: (input: Omit<Zer0Employee, 'id' | 'createdAt' | 'updatedAt'>) => Zer0Employee;
  updateEmployee: (id: string, updates: Partial<Zer0Employee>) => void;
  removeEmployee: (id: string) => void;
  getEmployeesByProject: (projectId: string) => Zer0Employee[];

  // Payment CRUD
  createPayment: (input: Omit<Zer0Payment, 'id' | 'createdAt' | 'processedAt' | 'proofId' | 'txHash' | 'approvedBy'>) => Zer0Payment;
  updatePaymentStatus: (id: string, status: Zer0PaymentStatus, extra?: Partial<Zer0Payment>) => void;
  getPaymentsByProject: (projectId: string) => Zer0Payment[];

  // Proof CRUD
  createProof: (paymentId: string, projectId: string, proofSystem: Zer0ProofSystem) => Zer0Proof;
  updateProofStatus: (id: string, status: Zer0Proof['status'], extra?: Partial<Zer0Proof>) => void;
  getProofsByProject: (projectId: string) => Zer0Proof[];

  // Pool operations
  depositToPool: (currency: Zer0Currency, amount: number) => void;
  withdrawFromPool: (currency: Zer0Currency, amount: number) => boolean;
  processPayment: (paymentId: string) => void;

  // Settings
  updateSettings: (updates: Partial<Zer0Settings>) => void;
  resetSettings: () => void;
}

const INITIAL_EMPLOYEES: Zer0Employee[] = [];
const INITIAL_PAYMENTS: Zer0Payment[] = [];

export const useZer0Store = create<Zer0State>()(
  (set, get) => ({
    employees: INITIAL_EMPLOYEES,
    payments: INITIAL_PAYMENTS,
    proofs: [],
    pool: { ...DEFAULT_POOL },
    settings: { ...DEFAULT_SETTINGS },

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
      get().payments.filter(p => p.projectId === projectId),

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

    processPayment: (paymentId) => {
      const state = get();
      const payment = state.payments.find(p => p.id === paymentId);
      if (!payment) return;

      const hasFunds = (state.pool.balances[payment.currency] || 0) >= payment.amount;
      if (!hasFunds) {
        state.updatePaymentStatus(paymentId, 'failed');
        return;
      }

      state.withdrawFromPool(payment.currency, payment.amount);

      if (payment.shielded) {
        const proof = state.createProof(paymentId, payment.projectId, state.settings.proofSystem);
        state.updatePaymentStatus(paymentId, 'processing', { proofId: proof.id });
      } else {
        state.updatePaymentStatus(paymentId, 'processing');
      }
    },

    // ─── Settings ───
    updateSettings: (updates) =>
      set(s => ({ settings: { ...s.settings, ...updates } })),

    resetSettings: () =>
      set({ settings: { ...DEFAULT_SETTINGS } }),
  })
);
