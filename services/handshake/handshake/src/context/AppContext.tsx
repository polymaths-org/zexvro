import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SmartContract, ContractFunction, StudioProject, NotificationItem } from '../types';
import { seedContracts } from '../data/seedContracts';
import { parseRouteFromUrl, buildUrlFromRoute } from '../utils/router';
import { subscribeHandshakeContracts } from '../spacetime/handshakeClient';

export interface RouteState {
  page:
    | 'home'
    | 'explore'
    | 'search'
    | 'browse' 
    | 'contract-overview' 
    | 'file-browser' 
    | 'file-reader' 
    | 'functions-index' 
    | 'function-detail' 
    | 'function-deep-read'
    | 'history' 
    | 'forks' 
    | 'discussions' 
    | 'studio-launcher' 
    | 'studio' 
    | 'studio-workspace'
    | 'studio-tests' 
    | 'publish' 
    | 'profile' 
    | 'login'
    | 'signup'
    | 'settings' 
    | 'notifications' 
    | 'collections' 
    | '404';
  chain?: string;
  contractId?: string;
  /** Pretty contract identity: canonical URLs render as /owner/contractName. */
  owner?: string;
  contractName?: string;
  branch?: string;
  filePath?: string;
  fnName?: string;
  functionName?: string;
  studioId?: string;
  projectId?: string;
  username?: string;
  collectionSlug?: string;
  searchQuery?: string;
}

interface AppContextType {
  route: RouteState;
  navigate: (newRoute: Partial<RouteState>, options?: { replace?: boolean }) => void;
  navigateToContract: (chain: string, contractId: string, subTab?: string) => void;
  navigateToFunction: (chain: string, contractId: string, fnName: string) => void;
  navigateToStudio: (studioId: string, filePath?: string, line?: number) => void;
  theme: 'dark' | 'light' | 'system';
  setTheme: (t: 'dark' | 'light' | 'system') => void;
  /** Local demo session. Null = signed out. Defaults to the demo account. */
  sessionUser: string | null;
  signIn: (username: string) => void;
  signOut: () => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isEmbedModalOpen: boolean;
  setIsEmbedModalOpen: (open: boolean) => void;
  embedContract: SmartContract | null;
  setEmbedContract: (contract: SmartContract | null) => void;
  isAiExplainOpen: boolean;
  setIsAiExplainOpen: (open: boolean) => void;
  activeExplainFunction: { contract: SmartContract; fn: ContractFunction } | null;
  openAiExplain: (contract: SmartContract, fn: ContractFunction) => void;
  isDryRunOpen: boolean;
  setIsDryRunOpen: (open: boolean) => void;
  activeDryRun: { contract: SmartContract; fn: ContractFunction } | null;
  openDryRun: (contract: SmartContract, fn: ContractFunction) => void;
  contracts: SmartContract[];
  setContracts: React.Dispatch<React.SetStateAction<SmartContract[]>>;
  likedContractIds: string[];
  toggleLikeContract: (id: string) => void;
  starredContractIds: string[];
  toggleStarContract: (id: string) => void;
  notifications: NotificationItem[];
  markAllNotificationsRead: () => void;
  activeStudioLine?: number;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  studioProjects: StudioProject[];
  setStudioProjects: React.Dispatch<React.SetStateAction<StudioProject[]>>;
  activeStudioProject: StudioProject | null;
  setActiveStudioProject: (proj: StudioProject | null) => void;
  forkContractToStudio: (contract: SmartContract) => void;
  addNewContract: (contract: SmartContract) => void;
}

const AppContext = createContext<AppContextType | null>(null);

/** Pages whose URLs carry a contract identity (pretty /owner/name). */
const CONTRACT_PAGES = new Set([
  'contract-overview',
  'file-browser',
  'file-reader',
  'functions-index',
  'function-detail',
  'function-deep-read',
  'history',
  'forks',
  'discussions',
]);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Parse initial route from location hash or pathname on load
  const [route, setRoute] = useState<RouteState>(() => {
    return parseRouteFromUrl();
  });

  const [theme, setThemeState] = useState<'dark' | 'light' | 'system'>(() => {
    const saved = localStorage.getItem('hshk_theme');
    return (saved as 'dark' | 'light' | 'system') || 'dark';
  });

  const [sessionUser, setSessionUser] = useState<string | null>(() => {
    return localStorage.getItem('hshk_session') || 'alex-dev';
  });

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return localStorage.getItem('hshk_sidebar') !== 'closed';
  });
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [embedContract, setEmbedContract] = useState<SmartContract | null>(null);
  const [isAiExplainOpen, setIsAiExplainOpen] = useState(false);
  const [activeExplainFunction, setActiveExplainFunction] = useState<{ contract: SmartContract; fn: ContractFunction } | null>(null);
  const [isDryRunOpen, setIsDryRunOpen] = useState(false);  const [activeDryRun, setActiveDryRun] = useState<{ contract: SmartContract; fn: ContractFunction } | null>(null);
  const [activeStudioLine, setActiveStudioLine] = useState<number | undefined>(undefined);

  // Live registry: SpacetimeDB is source of truth; seedContracts only for offline fallback.
  // Optimized: BTree indexes on chain/network/owner/name give O(log n) browse,
  // client-side free-text filter over subscribed set (< few K rows, no server scan).
  // Clean: start empty so no dummy flash — live subscription fills it.
  const [contracts, setContracts] = useState<SmartContract[]>(() => {
    const off = (import.meta.env.VITE_SPACETIMEDB_HANDSHAKE_DB as string | undefined) === "off";
    return off ? seedContracts : [];
  });
  const [likedContractIds, setLikedContractIds] = useState<string[]>([]);
  const [starredContractIds, setStarredContractIds] = useState<string[]>([]);
  const [handshakeLive, setHandshakeLive] = useState(false);

  // Subscribe to SpacetimeDB handshake_contract — live replaces seeds; empty DB = honest empty (no dummy)
  useEffect(() => {
    const offEnv = (import.meta.env.VITE_SPACETIMEDB_HANDSHAKE_DB as string | undefined) === "off";
    if (offEnv) return;
    const sub = subscribeHandshakeContracts(
      (live, _stats) => {
        setContracts(live); // live may be [] → honest empty, no dummy
        setHandshakeLive(true);
      },
      () => {
        // onError — keep seeds as offline fallback only
        setHandshakeLive(false);
      }
    );
    return () => sub.disconnect();
  }, []);

  const [studioProjects, setStudioProjects] = useState<StudioProject[]>(() => {
    try {
      const saved = localStorage.getItem('hshk_studio_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [activeStudioProject, setActiveStudioProject] = useState<StudioProject | null>(null);

  // Save studio projects
  useEffect(() => {
    try {
      localStorage.setItem('hshk_studio_v1', JSON.stringify(studioProjects));
    } catch {}
  }, [studioProjects]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem('hshk_theme', theme);
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  // Sync browser back/forward and hash changes
  useEffect(() => {
    const handleUrlChange = () => {
      const parsed = parseRouteFromUrl();
      setRoute(parsed);
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Update document title based on route
  useEffect(() => {
    const p = route.page;
    if (p === 'home') {
      document.title = 'Handshake';
    } else if (p === 'explore') {
      document.title = 'Handshake • Code-First Smart Contract Registry';
    } else if (p === 'browse') {
      document.title = route.searchQuery ? `Search: "${route.searchQuery}" • Handshake` : 'Browse Verified Contracts • Handshake';
    } else if (p === 'search') {
      document.title = route.searchQuery ? `"${route.searchQuery}" • Search • Handshake` : 'Search • Handshake';
    } else if (p === 'contract-overview' || p === 'functions-index' || p === 'function-deep-read' || p === 'function-detail' || p === 'history' || p === 'forks' || p === 'discussions' || p === 'file-reader') {
      const targetName = route.contractName || route.contractId || 'Contract';
      const sub = p === 'functions-index' ? 'Functions' : p.includes('function') ? `fn ${route.functionName || route.fnName || ''}` : p;
      document.title = `${targetName} (${sub}) • Handshake`;
    } else if (p === 'studio-launcher' || p === 'studio-workspace' || p === 'studio') {
      document.title = 'Soroban Studio IDE • Handshake';
    } else if (p === 'publish') {
      document.title = 'Publish & Verify Contract • Handshake';
    } else if (p === 'collections') {
      document.title = 'Curated Contract Collections • Handshake';
    } else if (p === 'profile') {
      document.title = `@${route.username || 'developer'} • Handshake`;
    } else if (p === 'login') {
      document.title = 'Sign in • Handshake';
    } else if (p === 'signup') {
      document.title = 'Create account • Handshake';
    } else if (p === '404') {
      document.title = 'Page not found • Handshake';
    } else if (p === 'notifications') {
      document.title = 'Notifications • Handshake';
    } else if (p === 'settings') {
      document.title = 'Settings • Handshake';
    }
  }, [route]);

  const navigate = useCallback((newRoute: Partial<RouteState>, options?: { replace?: boolean }) => {
    setRoute((prev) => {
      const merged: RouteState = {
        ...prev,
        ...newRoute,
      };

      // Normalize function and studio properties
      if (newRoute.functionName) merged.fnName = newRoute.functionName;
      if (newRoute.fnName) merged.functionName = newRoute.fnName;
      if (newRoute.projectId) merged.studioId = newRoute.projectId;
      if (newRoute.studioId) merged.projectId = newRoute.studioId;

      // Map alias pages
      if (merged.page === 'function-detail') merged.page = 'function-deep-read';
      if (merged.page === 'studio') merged.page = 'studio-workspace';

      // Enrich contract routes with owner/name so URLs render pretty.
      // Helpers clear stale owner/name when retargeting (see below).
      if (
        CONTRACT_PAGES.has(merged.page) &&
        merged.chain && merged.contractId &&
        !(merged.owner && merged.contractName)
      ) {
        const hit = contracts.find(
          (c) =>
            c.chain === merged.chain &&
            c.contractId.toLowerCase() === String(merged.contractId).toLowerCase()
        );
        if (hit) {
          merged.owner = hit.owner;
          merged.contractName = hit.name;
        }
      }

      // Build target hash URL
      const targetHash = buildUrlFromRoute(merged);

      if (window.location.hash !== targetHash) {
        if (options?.replace) {
          window.history.replaceState(null, '', targetHash);
        } else {
          window.history.pushState(null, '', targetHash);
        }
      }

      return merged;
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [contracts]);

  // Contract pages render pretty URLs (/owner/name); everything else here
  // resolves through the legacy chain+contractId identity.
  const navigateToContract = useCallback((chain: string, contractId: string, subTab: string = 'overview') => {
    const retarget = { chain, contractId, owner: undefined, contractName: undefined };
    if (subTab === 'functions') {
      navigate({ page: 'functions-index', ...retarget });
    } else if (subTab === 'history') {
      navigate({ page: 'history', ...retarget });
    } else if (subTab === 'forks') {
      navigate({ page: 'forks', ...retarget });
    } else if (subTab === 'discussions') {
      navigate({ page: 'discussions', ...retarget });
    } else {
      navigate({ page: 'contract-overview', ...retarget });
    }
  }, [navigate]);

  const navigateToFunction = useCallback((chain: string, contractId: string, fnName: string) => {
    navigate({ page: 'function-deep-read', chain, contractId, owner: undefined, contractName: undefined, fnName, functionName: fnName });
  }, [navigate]);

  const navigateToStudio = useCallback((studioId: string, filePath?: string, line?: number) => {
    setActiveStudioLine(line);
    navigate({ page: 'studio-workspace', studioId, projectId: studioId, filePath: filePath || 'src/lib.rs' });
  }, [navigate]);

  // Keyboard shortcut: Cmd+K / Ctrl+K toggles the quick-find palette.
  // Escape closes the palette, modals, and drawers.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsEmbedModalOpen(false);
        setIsAiExplainOpen(false);
        setIsDryRunOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const forkContractToStudio = (contract: SmartContract) => {
    // Generate new studio session with full contract files
    const newStudioId = `fork-${contract.id}-${Date.now().toString().slice(-4)}`;
    const newProj: StudioProject = {
      id: newStudioId,
      name: `fork-${contract.name}`,
      chain: contract.chain,
      network: contract.network,
      contractIdMock: contract.contractId,
      language: 'Rust (Soroban)',
      files: contract.files.map((f) => ({
        path: f.path,
        name: f.name,
        content: f.content,
        language: f.name.endsWith('.rs') ? 'rust' : f.name.endsWith('.toml') ? 'toml' : 'text',
      })),
      activeFilePath: contract.files[0]?.path || 'src/lib.rs',
      openTabs: [contract.files[0]?.path || 'src/lib.rs'],
      compilerStatus: 'idle',
      lastSaved: 'Just now',
    };

    setStudioProjects((prev) => [newProj, ...prev]);
    setActiveStudioProject(newProj);
    navigateToStudio(newStudioId, newProj.activeFilePath, 1);
  };

  const addNewContract = (newC: SmartContract) => {
    setContracts((prev) => [newC, ...prev]);
  };

  const toggleLikeContract = (id: string) => {
    setLikedContractIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const toggleStarContract = (id: string) => {
    setStarredContractIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      try {
        localStorage.setItem('hshk_sidebar', prev ? 'closed' : 'open');
      } catch {}
      return !prev;
    });
  };

  const signIn = (username: string) => {
    const clean = username.trim().toLowerCase();
    if (!clean) return;
    setSessionUser(clean);
    try {
      localStorage.setItem('hshk_session', clean);
    } catch {}
  };

  const signOut = () => {
    setSessionUser(null);
    try {
      localStorage.removeItem('hshk_session');
    } catch {}
  };
  const openAiExplain = (contract: SmartContract, fn: ContractFunction) => {
    setActiveExplainFunction({ contract, fn });
    setIsAiExplainOpen(true);
  };

  const openDryRun = (contract: SmartContract, fn: ContractFunction) => {
    setActiveDryRun({ contract, fn });
    setIsDryRunOpen(true);
  };

  return (
    <AppContext.Provider
      value={{
        route,
        navigate,
        navigateToContract,
        navigateToFunction,
        navigateToStudio,
        theme,
        setTheme: setThemeState,
        sessionUser,
        signIn,
        signOut,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isEmbedModalOpen,
        setIsEmbedModalOpen,
        embedContract,
        setEmbedContract,
        isAiExplainOpen,
        setIsAiExplainOpen,
        activeExplainFunction,
        openAiExplain,
        isDryRunOpen,
        setIsDryRunOpen,
        activeDryRun,
        openDryRun,
        contracts,
        setContracts,
        likedContractIds,
        toggleLikeContract,
        starredContractIds,
        toggleStarContract,
        notifications,
        markAllNotificationsRead,
        activeStudioLine,
        isSidebarOpen,
        toggleSidebar,
        studioProjects,
        setStudioProjects,
        activeStudioProject,
        setActiveStudioProject,
        forkContractToStudio,
        addNewContract,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
