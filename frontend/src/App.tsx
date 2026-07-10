import { lazy, Suspense } from 'react';

const MarketingPage = lazy(() => import('./marketing/MarketingPage'));
const DashboardApp = lazy(() => import('./DashboardApp'));

function AppFallback() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100" />
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const isActivationRoute = params.has('code') || params.has('activate');
  const isDashboardRoute = window.location.pathname.startsWith('/dashboard') || isActivationRoute;

  return (
    <Suspense fallback={<AppFallback />}>
      {isDashboardRoute ? <DashboardApp /> : <MarketingPage />}
    </Suspense>
  );
}
