import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes/router';
import { ensureBrandAssetsCached } from './lib/brandAssets';
import PaymentSessionHost from './components/zer0/PaymentSessionHost';
import './index.css';

// Brand assets only — never pull privacyPool / snarkjs / 7MB zkey on first paint.
void ensureBrandAssetsCached();

// Apply Freighter vs auto-sign preference immediately (tiny localStorage read, no snarkjs).
// Without this, deferred privacyPool load left forceFreighter=true and auto-sign looked broken.
try {
  const raw = localStorage.getItem('zexvro_zer0');
  if (raw) {
    const prefer = JSON.parse(raw)?.state?.settings?.preferFreighterSigning;
    if (typeof prefer === 'boolean') {
      // Dynamic import still needed for the setter; fire ASAP without waiting 2.5s.
      void import('./api/privacyPool').then((m) => {
        m.setForceFreighterSigning(prefer);
        m.syncSigningPreferenceFromStorage();
      });
    }
  }
} catch {
  /* ignore */
}

// Defer heavy Zer0 resume + ZK note sync until after the dashboard paints.
function scheduleIdleWork() {
  const run = () => {
    void import('./api/privacyPool').then((m) => {
      m.syncSigningPreferenceFromStorage();
      void m.syncNotesFromAws();
      m.prefetchZkArtifacts();
    });
    void import('./stores/zer0').then((m) => {
      try {
        m.reconcileStaleZer0State();
      } catch {
        /* ignore */
      }
    });
    void import('./lib/paymentResume').then((m) => {
      m.startPaymentResumeWatcher();
    });
  };
  if (typeof window === 'undefined') return;
  window.setTimeout(run, 2500);
}

scheduleIdleWork();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <PaymentSessionHost />
  </StrictMode>,
);
