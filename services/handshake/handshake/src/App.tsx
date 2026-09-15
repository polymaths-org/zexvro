import React from 'react';
import { AnimatePresence } from 'motion/react';
import { Compass, Plus } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { TopNav } from './components/layout/TopNav';
import { Sidebar } from './components/layout/Sidebar';
import { CommandPalette } from './components/layout/CommandPalette';
import { EmbedModal } from './components/layout/EmbedModal';
import { DryRunModal } from './components/layout/DryRunModal';
import { AiExplainDrawer } from './components/layout/AiExplainDrawer';

// Pages
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { SearchPage } from './pages/SearchPage';
import { BrowsePage } from './pages/BrowsePage';
import { ContractOverviewPage } from './pages/ContractOverviewPage';
import { FileReaderPage } from './pages/FileReaderPage';
import { FunctionsIndexPage } from './pages/FunctionsIndexPage';
import { FunctionDeepReadPage } from './pages/FunctionDeepReadPage';
import { ContractHistoryPage } from './pages/ContractHistoryPage';
import { ContractForksPage } from './pages/ContractForksPage';
import { ContractDiscussionsPage } from './pages/ContractDiscussionsPage';
import { StudioLauncherPage } from './pages/StudioLauncherPage';
import { StudioWorkspacePage } from './pages/StudioWorkspacePage';
import { PublishWizardPage } from './pages/PublishWizardPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotificationsPage } from './pages/NotificationsPage';

// Shown on contract deep-links when the registry is empty.
const NoContractsEmpty: React.FC = () => {
  const { navigate } = useApp();
  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-16 pb-20">
      <div className="max-w-md mx-auto p-10 rounded-[8px] bg-[#0A0A0B] border border-[#27272A] text-center space-y-3">
        <div className="w-11 h-11 mx-auto rounded-[8px] bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6]">
          <Compass className="w-5 h-5" />
        </div>
        <p className="text-sm text-[#FAFAFA] font-medium">No contracts in the registry yet</p>
        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          This link points to a contract that isn't indexed. Publish it to make it discoverable.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => navigate({ page: 'publish' })}
            className="px-4 py-2 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Publish a contract</span>
          </button>
          <button
            type="button"
            onClick={() => navigate({ page: 'home' })}
            className="px-4 py-2 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] text-xs font-medium border border-[#27272A] transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
};

const CONTRACT_ROUTES = [
  'contract-overview',
  'file-browser',
  'file-reader',
  'functions-index',
  'function-detail',
  'function-deep-read',
  'history',
  'forks',
  'discussions'
];

const AppContent: React.FC = () => {
  const { route, contracts, isCommandPaletteOpen } = useApp();

  // Helper to find contract — pretty owner/name first, legacy chain/id after.
  const currentContract =
    contracts.find(
      (c) =>
        (route.owner &&
          route.contractName &&
          c.owner.toLowerCase() === route.owner.toLowerCase() &&
          c.name.toLowerCase() === route.contractName.toLowerCase()) ||
        (route.contractId &&
          ((c.chain === route.chain &&
            c.contractId.toLowerCase() === route.contractId.toLowerCase()) ||
            c.name.toLowerCase() === route.contractId.toLowerCase() ||
            c.id.toLowerCase() === route.contractId.toLowerCase()))
    ) || null;

  const renderCurrentPage = () => {
    // Contract deep-links with nothing indexed yet.
    if (CONTRACT_ROUTES.includes(route.page) && !currentContract) {
      return <NoContractsEmpty />;
    }
    const contract = currentContract as NonNullable<typeof currentContract>;
    switch (route.page) {
      case 'home':
        return <HomePage />;
      case 'explore':
        return <ExplorePage />;
      case 'search':
        return <SearchPage />;
      case 'browse':
        return <BrowsePage />;
      case 'contract-overview':
        return <ContractOverviewPage contract={contract} />;
      case 'file-browser':
      case 'file-reader':
        return (
          <FileReaderPage
            contract={contract}
            filePath={route.filePath}
            branch={route.branch}
          />
        );
      case 'functions-index':
        return <FunctionsIndexPage contract={contract} />;
      case 'function-deep-read':
      case 'function-detail':
        return (
          <FunctionDeepReadPage
            contract={contract}
            functionName={route.functionName || route.fnName || contract.functions[0]?.name || 'swap'}
          />
        );
      case 'history':
        return <ContractHistoryPage contract={contract} />;
      case 'forks':
        return <ContractForksPage contract={contract} />;
      case 'discussions':
        return <ContractDiscussionsPage contract={contract} />;
      case 'studio-launcher':
        return <StudioLauncherPage />;
      case 'studio':
      case 'studio-workspace':
        return <StudioWorkspacePage projectId={route.projectId || route.studioId || 'proj-1'} />;
      case 'publish':
        return <PublishWizardPage />;
      case 'profile':
        return <UserProfilePage username={route.username} />;
      case 'login':
        return <LoginPage />;
      case 'signup':
        return <SignupPage />;
      case '404':
        return <NotFoundPage />;
      case 'collections':
        return <CollectionsPage initialSlug={route.collectionSlug} />;
      case 'settings':
        return <SettingsPage />;
      case 'notifications':
        return <NotificationsPage />;
      default:
        return <HomePage />;
    }
  };

  const isStudioWorkspace = route.page === 'studio-workspace';
  // Auth screens stand alone: no sidebar, no footer.
  const minimalChrome = route.page === 'login' || route.page === 'signup';

  return (
    <div className="min-h-screen text-[#FAFAFA] flex flex-col font-sans selection:bg-[#3B82F6]/30 selection:text-white">
      {/* Backdrop: cool ambient glow under everything */}
      <div aria-hidden="true" className="app-ambient" />

      {/* Backdrop: film-grain noise over the glow */}
      <div aria-hidden="true" className="app-noise" />

      {/* Top Navigation */}
      <TopNav />

      {/* Sidebar + Main Page Body */}
      <div className="relative z-[1] flex flex-1 items-stretch">
        {!minimalChrome && <Sidebar />}
        <div className="flex-1 min-w-0">
          {renderCurrentPage()}
        </div>
      </div>

      {/* Global Modals & Drawers */}
      <AnimatePresence>
        {isCommandPaletteOpen && <CommandPalette />}
      </AnimatePresence>
      <EmbedModal />
      <DryRunModal />
      <AiExplainDrawer />

      {/* Sleek Minimal Dark Footer (Hidden in Studio Workspace to prevent taking up IDE vertical space) */}
      {!isStudioWorkspace && !minimalChrome && (
        <footer className="relative border-t border-[#27272A] bg-[#0A0A0B] py-8 text-xs font-mono text-[#71717A]">
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/handshake-logo.png"
                alt="Handshake logo"
                className="w-6 h-6 rounded-[4px] object-cover"
              />
              <span><span className="font-display font-bold uppercase tracking-[0.14em] text-[#FAFAFA]">Handshake</span> • Code-First Smart Contract Hub</span>
            </div>

            <div className="flex items-center gap-6">
              <span>Stellar Soroban</span>
              <span>EVM</span>
              <span>Base L2</span>
              <span>v0.9.4-alpha</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
