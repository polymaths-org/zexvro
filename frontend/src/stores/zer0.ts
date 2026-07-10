import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

const INITIAL_EMPLOYEES: Zer0Employee[] = [
  {
    id: 'emp_1',
    projectId: 'proj_1',
    name: 'Alex Chen',
    email: 'alex@zexvro.dev',
    role: 'Lead Developer',
    department: 'Engineering',
    walletAddress: 'GC3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5P',
    salary: 4200,
    currency: 'USDC',
    frequency: 'monthly',
    status: 'active',
    startDate: Date.now() - 30 * 24 * 3600 * 1000,
    createdAt: Date.now() - 30 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 30 * 24 * 3600 * 1000,
  },
  {
    id: 'emp_2',
    projectId: 'proj_1',
    name: 'Sarah Kim',
    email: 'sarah@zexvro.dev',
    role: 'Security Engineer',
    department: 'Security',
    walletAddress: 'GB7N2L4OVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5P',
    salary: 3800,
    currency: 'USDC',
    frequency: 'monthly',
    status: 'active',
    startDate: Date.now() - 60 * 24 * 3600 * 1000,
    createdAt: Date.now() - 60 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 60 * 24 * 3600 * 1000,
  },
  {
    id: 'emp_3',
    projectId: 'proj_1',
    name: 'Marcus Webb',
    email: 'marcus@freelance.io',
    role: 'Contract UI Designer',
    department: 'Design',
    walletAddress: 'GCN84X9PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5P',
    salary: 2500,
    currency: 'USDC',
    frequency: 'one-time',
    status: 'active',
    startDate: Date.now() - 10 * 24 * 3600 * 1000,
    createdAt: Date.now() - 10 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 10 * 24 * 3600 * 1000,
  }
];

const INITIAL_PAYMENTS: Zer0Payment[] = [
  {
    id: 'pay_1',
    projectId: 'proj_1',
    employeeId: 'emp_1',
    recipientName: 'Alex Chen',
    recipientWallet: 'GC3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5P',
    amount: 4200,
    currency: 'USDC',
    type: 'payroll',
    status: 'completed',
    shielded: true,
    memo: 'June Payroll - Lead Dev',
    proofId: 'proof_1',
    txHash: '0xtx_alex_june_pay',
    createdAt: Date.now() - 10 * 24 * 3600 * 1000,
    processedAt: Date.now() - 10 * 24 * 3600 * 1000,
    approvedBy: 'paris',
  },
  {
    id: 'pay_2',
    projectId: 'proj_1',
    employeeId: 'emp_2',
    recipientName: 'Sarah Kim',
    recipientWallet: 'GB7N2L4OVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5P',
    amount: 3800,
    currency: 'USDC',
    type: 'payroll',
    status: 'completed',
    shielded: true,
    memo: 'June Payroll - Security',
    proofId: 'proof_2',
    txHash: '0xtx_sarah_june_pay',
    createdAt: Date.now() - 10 * 24 * 3600 * 1000,
    processedAt: Date.now() - 10 * 24 * 3600 * 1000,
    approvedBy: 'paris',
  },
  {
    id: 'pay_3',
    projectId: 'proj_1',
    employeeId: 'emp_3',
    recipientName: 'Marcus Webb',
    recipientWallet: 'GCN84X9PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5P',
    amount: 2500,
    currency: 'USDC',
    type: 'contractor',
    status: 'pending_approval',
    shielded: false,
    memo: 'UI Design Deliverables',
    proofId: null,
    txHash: null,
    createdAt: Date.now() - 2 * 24 * 3600 * 1000,
    processedAt: null,
    approvedBy: null,
  },
  {
    id: 'pay_4',
    projectId: 'proj_1',
    employeeId: null,
    recipientName: 'Lina Patel',
    recipientWallet: 'GB8J3K7PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5P',
    amount: 1800,
    currency: 'USDC',
    type: 'contractor',
    status: 'processing',
    shielded: true,
    memo: 'Branding Consultation',
    proofId: null,
    txHash: null,
    createdAt: Date.now() - 1 * 24 * 3600 * 1000,
    processedAt: null,
    approvedBy: null,
  },
  {
    id: 'pay_5',
    projectId: 'proj_1',
    employeeId: 'emp_1',
    recipientName: 'Alex Chen',
    recipientWallet: 'GC3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5P',
    amount: 500,
    currency: 'USDC',
    type: 'bonus',
    status: 'completed',
    shielded: true,
    memo: 'Q2 Performance Bonus',
    proofId: 'proof_3',
    txHash: '0xtx_alex_bonus',
    createdAt: Date.now() - 12 * 24 * 3600 * 1000,
    processedAt: Date.now() - 12 * 24 * 3600 * 1000,
    approvedBy: 'paris',
  },
  {
    id: 'pay_6',
    projectId: 'proj_1',
    employeeId: null,
    recipientName: 'Jordan Hayes',
    recipientWallet: 'GCY82P4PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5PVU6C3O5K5P',
    amount: 3500,
    currency: 'USDC',
    type: 'payroll',
    status: 'failed',
    shielded: false,
    memo: 'June Support Lead Salary',
    proofId: null,
    txHash: null,
    createdAt: Date.now() - 5 * 24 * 3600 * 1000,
    processedAt: null,
    approvedBy: null,
  }
];

export const useZer0Store = create<Zer0State>()(
  persist(
    (set, get) => ({
      employees: INITIAL_EMPLOYEES,
      payments: INITIAL_PAYMENTS,
      proofs: [],
      pool: { ...DEFAULT_POOL, balances: { USDC: 45000, XLM: 100000, EURC: 25000 } },
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

        // Deduct from pool
        state.withdrawFromPool(payment.currency, payment.amount);

        // Generate proof if shielded
        if (payment.shielded) {
          const proof = state.createProof(paymentId, payment.projectId, state.settings.proofSystem);

          // Simulate proof generation
          state.updateProofStatus(proof.id, 'generating');
          setTimeout(() => {
            const genTime = 800 + Math.random() * 1200;
            state.updateProofStatus(proof.id, 'verified', {
              generationTimeMs: Math.round(genTime),
              proofData: `0xproof_${Math.random().toString(16).slice(2, 18)}`,
              verificationKey: `0xvk_${Math.random().toString(16).slice(2, 10)}`,
              verifiedAt: Date.now(),
            });
            state.updatePaymentStatus(paymentId, 'completed', {
              proofId: proof.id,
              txHash: `0xtx_${Math.random().toString(16).slice(2, 16)}`,
              processedAt: Date.now(),
            });
            // Update pool counter
            set(s => ({
              pool: { ...s.pool, totalPaymentsProcessed: s.pool.totalPaymentsProcessed + 1 },
            }));
          }, 2000);

          state.updatePaymentStatus(paymentId, 'processing');
        } else {
          // Non-shielded: complete immediately
          const txHash = `0xtx_${Math.random().toString(16).slice(2, 16)}`;
          state.updatePaymentStatus(paymentId, 'completed', {
            txHash,
            processedAt: Date.now(),
          });
          set(s => ({
            pool: { ...s.pool, totalPaymentsProcessed: s.pool.totalPaymentsProcessed + 1 },
          }));
        }
      },

      // ─── Settings ───
      updateSettings: (updates) =>
        set(s => ({ settings: { ...s.settings, ...updates } })),

      resetSettings: () =>
        set({ settings: { ...DEFAULT_SETTINGS } }),
    }),
    { name: 'zexvro_zer0' }
  )
);
