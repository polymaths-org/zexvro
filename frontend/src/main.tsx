import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes/router';
import { prefetchZkArtifacts, syncNotesFromAws, syncSigningPreferenceFromStorage } from './api/privacyPool';
import { startPaymentResumeWatcher } from './lib/paymentResume';
import PaymentSessionHost from './components/zer0/PaymentSessionHost';
import './index.css';

// Restore ZK notes + Freighter vs auto-sign preference; warm Groth16 artifacts
syncSigningPreferenceFromStorage();
syncNotesFromAws();
prefetchZkArtifacts();
// Re-open processing modal + resume worker job poll after reload
startPaymentResumeWatcher();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    {/* Global secure-settle popup — outside router layout stacking */}
    <PaymentSessionHost />
  </StrictMode>,
);
