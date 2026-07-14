import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes/router';
import { prefetchZkArtifacts, syncNotesFromAws, syncSigningPreferenceFromStorage } from './api/privacyPool';
import './index.css';

// Restore ZK notes + Freighter vs auto-sign preference; warm Groth16 artifacts
syncSigningPreferenceFromStorage();
syncNotesFromAws();
prefetchZkArtifacts();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
