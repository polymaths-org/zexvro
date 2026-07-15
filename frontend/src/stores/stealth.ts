import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  generateStealthIdentity,
  createStealthPayment,
  recoverStealthPayment,
  type StealthIdentity,
  type StealthPaymentRecord,
} from '../lib/stealth';

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface StealthState {
  /** Workspace/org stealth identity (optional default) */
  orgIdentity: StealthIdentity | null;
  /** Per-employee meta-addresses (employeeId → meta) */
  employeeMeta: Record<string, string>;
  /** Outbound stealth payment records (sender side) */
  outbound: StealthPaymentRecord[];
  /** Imported identities for scanning (payee side) */
  importedIdentities: StealthIdentity[];
  /** Recovered inbound one-time wallets */
  inbound: StealthPaymentRecord[];

  ensureOrgIdentity: (label?: string) => StealthIdentity;
  setEmployeeMeta: (employeeId: string, metaAddress: string) => void;
  clearEmployeeMeta: (employeeId: string) => void;
  importIdentity: (identity: StealthIdentity) => void;
  removeImportedIdentity: (metaAddress: string) => void;

  /** Build a one-time destination for a payment; stores outbound record. */
  prepareOutbound: (args: {
    metaAddress: string;
    amountXlm: number;
    paymentId?: string;
    note?: string;
  }) => StealthPaymentRecord;

  attachTxHash: (recordId: string, txHash: string) => void;

  /** Try recover against all imported identities using an ephemeral pubkey. */
  scanEphemeral: (ephemeralPublicHex: string, salt?: string) => StealthPaymentRecord | null;
}

export const useStealthStore = create<StealthState>()(
  persist(
    (set, get) => ({
      orgIdentity: null,
      employeeMeta: {},
      outbound: [],
      importedIdentities: [],
      inbound: [],

      ensureOrgIdentity: (label = 'Payroll receive identity') => {
        const existing = get().orgIdentity;
        if (existing) return existing;
        const identity = generateStealthIdentity(label);
        set({ orgIdentity: identity });
        // Also import so org can scan its own receives
        const imported = get().importedIdentities;
        if (!imported.some(i => i.metaAddress === identity.metaAddress)) {
          set({ importedIdentities: [...imported, identity] });
        }
        return identity;
      },

      setEmployeeMeta: (employeeId, metaAddress) =>
        set(s => ({
          employeeMeta: { ...s.employeeMeta, [employeeId]: metaAddress.trim() },
        })),

      clearEmployeeMeta: (employeeId) =>
        set(s => {
          const next = { ...s.employeeMeta };
          delete next[employeeId];
          return { employeeMeta: next };
        }),

      importIdentity: (identity) =>
        set(s => {
          if (s.importedIdentities.some(i => i.metaAddress === identity.metaAddress)) {
            return s;
          }
          return { importedIdentities: [...s.importedIdentities, identity] };
        }),

      removeImportedIdentity: (metaAddress) =>
        set(s => ({
          importedIdentities: s.importedIdentities.filter(i => i.metaAddress !== metaAddress),
        })),

      prepareOutbound: ({ metaAddress, amountXlm, paymentId, note }) => {
        const derived = createStealthPayment(metaAddress, paymentId || '');
        const record: StealthPaymentRecord = {
          id: id('stp'),
          paymentId,
          metaAddress,
          ephemeralPublicHex: derived.ephemeralPublicHex,
          oneTimePublicKey: derived.oneTimePublicKey,
          oneTimeSecret: derived.oneTimeSecret,
          amountXlm,
          createdAt: Date.now(),
          note,
        };
        set(s => ({ outbound: [record, ...s.outbound].slice(0, 200) }));
        return record;
      },

      attachTxHash: (recordId, txHash) =>
        set(s => ({
          outbound: s.outbound.map(r => (r.id === recordId ? { ...r, txHash } : r)),
          inbound: s.inbound.map(r => (r.id === recordId ? { ...r, txHash } : r)),
        })),

      scanEphemeral: (ephemeralPublicHex, salt = '') => {
        const identities = get().importedIdentities;
        for (const idn of identities) {
          try {
            const rec = recoverStealthPayment({
              scanSecretHex: idn.scanSecretHex,
              spendPublicHex: idn.spendPublicHex,
              ephemeralPublicHex,
              salt,
            });
            const record: StealthPaymentRecord = {
              id: id('sin'),
              metaAddress: idn.metaAddress,
              ephemeralPublicHex,
              oneTimePublicKey: rec.oneTimePublicKey,
              oneTimeSecret: rec.oneTimeSecret,
              amountXlm: 0,
              createdAt: Date.now(),
              note: idn.label || 'Recovered stealth wallet',
            };
            set(s => {
              if (s.inbound.some(x => x.oneTimePublicKey === record.oneTimePublicKey)) {
                return s;
              }
              return { inbound: [record, ...s.inbound].slice(0, 200) };
            });
            return record;
          } catch {
            // try next identity
          }
        }
        return null;
      },
    }),
    {
      name: 'zexvro_stealth',
      partialize: (s) => ({
        orgIdentity: s.orgIdentity,
        employeeMeta: s.employeeMeta,
        outbound: s.outbound,
        importedIdentities: s.importedIdentities,
        inbound: s.inbound,
      }),
    },
  ),
);
