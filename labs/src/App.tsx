import React from 'react';
import { X, KeyRound, Lock } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { LabProgressSidebar } from './components/LabProgressSidebar';
import { LoginModal } from './components/LoginModal';
import { LabsProvider, useLabs } from './state/labs';
import { ToastProvider } from './components/ui/Toaster';
import { useRoute, Route } from './lib/router';

import { HomePage } from './pages/HomePage';
import { LabsPage } from './pages/LabsPage';
import { LabDetailsPage } from './pages/LabDetailsPage';
import { CertificatesPage } from './pages/CertificatesPage';
import { ProfilePage } from './pages/ProfilePage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { AdminPage } from './pages/AdminPage';
import { OperationsPage } from './pages/OperationsPage';
import { DevPage } from './pages/DevPage';
import { RunnerPage } from './pages/RunnerPage';
import { VerifyPage } from './pages/VerifyPage';
import { NotFoundPage } from './pages/NotFoundPage';

function routeToTab(route: Route): ActiveTab {
  switch (route.kind) {
    case 'home':
      return 'dashboard';
    case 'labs':
    case 'lab':
      return 'catalog';
    case 'labs-manage':
    case 'admin':
      return 'admin-panel';
    case 'certificates':
      return 'student-progress';
    case 'profile':
      return 'profile';
    case 'runner':
      return 'lab-runner';
    case 'operations':
      return 'operations';
    case 'dev':
      return 'dashboard';
    default:
      return 'dashboard';
  }
}

const AccessCodeModal: React.FC = () => {
  const { pendingLab, accessInput, setAccessInput, accessError, handleConfirmAccess, cancelPendingLab } = useLabs();
  if (!pendingLab) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-700 rounded-2xl p-6 relative shadow-2xl">
        <button
          onClick={cancelPendingLab}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-full bg-zinc-900"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center justify-center mb-4">
          <Lock className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-lg font-black text-white font-heading">Enter Access Code</h2>
        <p className="text-xs text-zinc-400 mt-1 mb-4">
          This lab is access-gated. Enter the code to open "{pendingLab.title}".
        </p>
        <input
          type="text"
          autoFocus
          value={accessInput}
          onChange={(e) => setAccessInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirmAccess()}
          placeholder="Access code"
          className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-white"
        />
        {accessError && <p className="text-xs text-red-400 mt-2 font-mono">{accessError}</p>}
        <button
          onClick={handleConfirmAccess}
          className="mt-4 w-full py-2.5 bg-white hover:bg-zinc-200 text-black font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 font-heading"
        >
          <KeyRound className="h-4 w-4" />
          Unlock Lab
        </button>
      </div>
    </div>
  );
};

function Shell() {
  const route = useRoute();
  const {
    user,
    activeLab,
    labProgress,
    isLoading,
    isLoginOpen,
    setIsLoginOpen,
    handleLogout,
    handleProgressChange,
    handleExitLab,
    goToTab,
    searchQuery,
    setSearchQuery,
    handleDemoLogin,
  } = useLabs();

  // Public certificate verification is fully standalone.
  if (route.kind === 'verify') {
    return <VerifyPage number={route.number} />;
  }

  // /dev is a bare under-maintenance page — no shell UI at all.
  if (route.kind === 'dev') {
    return <DevPage />;
  }

  const activeTab = routeToTab(route);
  const inRunner = route.kind === 'runner';

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-white selection:text-black">
      <Header
        user={user}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        hideSearch={inRunner}
      />

      <div className="flex flex-1 overflow-hidden">
        {inRunner && activeLab ? (
          <LabProgressSidebar
            lab={activeLab}
            progress={labProgress[activeLab.id]}
            onSelectPage={(pageId) => handleProgressChange(activeLab.id, { currentPageId: pageId })}
            onExitLab={handleExitLab}
          />
        ) : (
          <Sidebar
            activeTab={activeTab}
            onNavigate={goToTab}
            user={user}
            activeLab={activeLab}
          />
        )}

        <main className="flex-1 overflow-y-auto min-h-[calc(100vh-57px)] relative">
          {isLoading ? (
            <div className="p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
              <div className="h-44 bg-zinc-950 border border-zinc-800 rounded-3xl" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="h-64 bg-zinc-950 border border-zinc-800 rounded-3xl col-span-2" />
                <div className="h-64 bg-zinc-950 border border-zinc-800 rounded-3xl" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="h-48 bg-zinc-950 border border-zinc-800 rounded-2xl" />
                <div className="h-48 bg-zinc-950 border border-zinc-800 rounded-2xl" />
                <div className="h-48 bg-zinc-950 border border-zinc-800 rounded-2xl" />
              </div>
            </div>
          ) : (
            <>
              {route.kind === 'home' && <HomePage />}
              {route.kind === 'labs' && <LabsPage />}
              {route.kind === 'lab' && <LabDetailsPage slug={route.slug} />}
              {route.kind === 'certificates' && <CertificatesPage />}
              {route.kind === 'profile' && <ProfilePage />}
              {route.kind === 'public-profile' && <PublicProfilePage username={route.username} />}
              {route.kind === 'admin' && <AdminPage tab={route.tab} />}
              {route.kind === 'labs-manage' && <AdminPage tab="labs" />}
              {route.kind === 'operations' && <OperationsPage />}
              {route.kind === 'runner' && <RunnerPage labId={route.labId} />}
              {route.kind === 'not-found' && <NotFoundPage />}
            </>
          )}
        </main>
      </div>

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccessLogin={handleDemoLogin}
      />
      <AccessCodeModal />
    </div>
  );
}

export default function App() {
  return (
    <LabsProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </LabsProvider>
  );
}
