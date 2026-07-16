import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IssuedClaim } from '../lib/stealthClaim';

interface StealthClaimsState {
  /** Claims issued by this browser (sender history) */
  issued: IssuedClaim[];
  addIssued: (claim: IssuedClaim) => void;
  markRedeemed: (claimId: string, txHash: string) => void;
  findByPaymentId: (paymentId: string) => IssuedClaim | undefined;
  findByOneTime: (oneTimePublicKey: string) => IssuedClaim | undefined;
}

export const useStealthClaimsStore = create<StealthClaimsState>()(
  persist(
    (set, get) => ({
      issued: [],

      addIssued: (claim) =>
        set(s => {
          // de-dupe by paymentId / oneTime
          const filtered = s.issued.filter(
            c => c.id !== claim.id
              && c.oneTimePublicKey !== claim.oneTimePublicKey
              && (!claim.paymentId || c.paymentId !== claim.paymentId),
          );
          return { issued: [claim, ...filtered].slice(0, 300) };
        }),

      markRedeemed: (claimId, txHash) =>
        set(s => ({
          issued: s.issued.map(c =>
            c.id === claimId
              ? { ...c, redeemedAt: Date.now(), redeemTxHash: txHash }
              : c,
          ),
        })),

      findByPaymentId: (paymentId) =>
        get().issued.find(c => c.paymentId === paymentId),

      findByOneTime: (oneTimePublicKey) =>
        get().issued.find(c => c.oneTimePublicKey === oneTimePublicKey),
    }),
    {
      name: 'zexvro_stealth_claims',
      partialize: (s) => ({ issued: s.issued }),
    },
  ),
);
