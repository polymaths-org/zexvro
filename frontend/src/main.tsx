import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes/router';
import { syncNotesFromAws, syncSigningPreferenceFromStorage } from './api/privacyPool';
import './index.css';

// Restore ZK notes + Freighter vs auto-sign preference
syncSigningPreferenceFromStorage();
syncNotesFromAws();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
