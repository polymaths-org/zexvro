import React, { useState, useEffect } from 'react';
import {
  Search, Menu, X, ChevronRight, User,
  HelpCircle, Sun, Moon, Settings, Send, ArrowUpRight, Sparkles, LogOut,
  Plus, Mail, Users, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Outlet, useNavigate, useParams, Link, useRouterState } from '@tanstack/react-router';
import { useWorkspaceStore } from '../../stores/workspace';
import { useProjectStore } from '../../stores/project';
import { useUIStore } from '../../stores/ui';
import {
  clearStoredSession,
  ensureValidAccessToken,
  globalSignOut,
  isAccessTokenExpired,
  persistSession,
  readStoredSession,
  type UserSession,
} from '../../auth/cognito';
import { buildAgentChatPayload, loadAgentSettingsFromAWS } from '../../agent/settings';
import CliActivation from '../auth/CliActivation';
import PlatformBootup from '../PlatformBootup';
import { initializeAWSSync, pullFromAWS } from '../../stores/awsSync';
const IS_LOCAL_HOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (IS_LOCAL_HOST
    ? 'http://localhost:8080'
    : 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com');
const AGENT_CHAT_URL = IS_LOCAL_HOST ? '/api/agent/chat' : `${API_BASE_URL}/api/chat`;
const SHOULD_CHECK_CLI_STATUS =
  !IS_LOCAL_HOST ||
  API_BASE_URL.startsWith('http://localhost') ||
  API_BASE_URL.startsWith('http://127.0.0.1');

const BRAND_MARK = '/brand/logo-transparent.png';
const BRAND_WORDMARK = '/brand/wordmark-transparent.png';
const MORPH_LOGO = '/morph/morph-logo.svg';
const MORPH_ILLUSTRATION = '/morph/morph-illustration-transparent.png';

const WORKSPACE_ROLES = ['Admin', 'Developer', 'Viewer'] as const;
type WorkspaceRole = typeof WORKSPACE_ROLES[number];

function titleCaseName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getWorkspaceOwnerName(session: UserSession | null) {
  const source = session?.email || session?.username || 'Your';
  const handle = source.includes('@') ? source.split('@')[0] : source;
  const normalized = handle.replace(/[._-]+/g, ' ').trim();
  return normalized ? titleCaseName(normalized) : 'Your';
}

function makeWorkspaceInitials(name: string) {
  const parts = name.replace(/'s\b/gi, '').split(/[\s._-]+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'ZX';
}



type CustomIconName =
  | 'overview' | 'projects' | 'deployments' | 'services' | 'agent'
  | 'analytics' | 'team' | 'memory' | 'security' | 'settings'
  | 'privacy' | 'transform' | 'trade' | 'auth' | 'nft' | 'depin'
  | 'transactions' | 'payroll';

function CustomIcon({ name, className = '' }: { name: CustomIconName; className?: string }) {
  if (name === 'agent') {
    return (
      <img
        src={MORPH_LOGO}
        alt=""
        aria-hidden="true"
        className={`scale-95 object-contain invert dark:invert-0 ${className}`}
      />
    );
  }

  const common = 'fill-none stroke-current stroke-[1.8] stroke-linecap-round stroke-linejoin-round';
  const accent = 'fill-current stroke-none';
  const icons: Record<Exclude<CustomIconName, 'agent'>, React.ReactNode> = {
    overview: (
      <>
        <path className={common} d="M5 6.5h5.2v5.2H5zM13.8 6.5H19v3.8h-5.2zM5 15h5.2v2.5H5zM13.8 13.2H19v4.3h-5.2z" />
        <path className={common} d="M10.2 9.1h3.6M10.2 16.2h3.6" />
      </>
    ),
    projects: (
      <>
        <path className={common} d="M4.5 7.8h5.1l1.5 2h8.4v7.4H4.5z" />
        <path className={common} d="M7.5 13h5.8M7.5 15.4h3.6" />
      </>
    ),
    deployments: (
      <>
        <path className={common} d="M12 4.5 17.6 10l-3.3.6-.6 3.3L8.1 8.4zM6 16l-1.5 3.5L8 18M14.7 18l3.5 1.5L16.7 16" />
        <path className={common} d="M9.8 12.2 6.8 15.2M12.8 15.2l-3 3" />
      </>
    ),
    services: (
      <>
        <path className={common} d="M12 4.5 18.2 8v8L12 19.5 5.8 16V8z" />
        <path className={common} d="m5.8 8 6.2 3.5L18.2 8M12 11.5v8" />
        <path className={accent} d="M11 3.7h2v1.7h-2zM18.9 7.2h1.7v2h-1.7zM3.4 7.2h1.7v2H3.4z" />
      </>
    ),
    analytics: (
      <>
        <path className={common} d="M5 17.5h14M6.2 15.2l3-3.1 3 1.8 5-6.2" />
        <path className={common} d="M7 17.5v-3M12 17.5v-5M17 17.5v-8" />
      </>
    ),
    team: (
      <>
        <path className={common} d="M12 6.2a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8ZM6.8 9.2a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8ZM17.2 9.2a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8ZM8.2 17.7c.6-2.1 2-3.2 3.8-3.2s3.2 1.1 3.8 3.2" />
        <path className={common} d="M3.8 17.2c.4-1.5 1.3-2.3 2.7-2.3M17.5 14.9c1.4 0 2.3.8 2.7 2.3" />
      </>
    ),
    memory: (
      <>
        <path className={common} d="M8.2 7.2h7.6v9.6H8.2zM5.2 10.2h3M15.8 10.2h3M5.2 13.8h3M15.8 13.8h3" />
        <path className={common} d="M10.5 9.8h3M10.5 12h3M10.5 14.2h2" />
      </>
    ),
    security: (
      <>
        <path className={common} d="M12 4.5 18.2 7v5c0 3.8-2.4 6.2-6.2 7.5-3.8-1.3-6.2-3.7-6.2-7.5V7z" />
        <path className={common} d="m9.2 12.2 1.9 1.9 3.9-4.2" />
      </>
    ),
    settings: (
      <>
        <path className={common} d="M6 7.5h12M6 12h12M6 16.5h12" />
        <path className={common} d="M9 5.8v3.4M15 10.3v3.4M11.5 14.8v3.4" />
      </>
    ),
    privacy: (
      <>
        <path className={common} d="M7.2 10.5h9.6v7.2H7.2zM9 10.5V8.2a3 3 0 0 1 6 0v2.3" />
        <path className={common} d="M12 13.2v1.9" />
      </>
    ),
    transform: (
      <>
        <path className={common} d="M5.2 7.2h5.6v5.6H5.2zM13.2 11.2h5.6v5.6h-5.6z" />
        <path className={common} d="M11 8.2h2.6c1.6 0 2.5.8 2.5 2.4v.6M13 15.8h-2.6c-1.6 0-2.5-.8-2.5-2.4v-.6" />
      </>
    ),
    trade: (
      <>
        <path className={common} d="M6 8.2h9.5l-2-2.1M18 15.8H8.5l2 2.1" />
        <path className={common} d="M15.5 8.2 18 10.7M8.5 15.8 6 13.3" />
      </>
    ),
    auth: (
      <>
        <path className={common} d="M8.8 12.2a3 3 0 1 1 2.4 2.9L9 17.3H6.8v-2.2z" />
        <path className={common} d="M14.5 6.3c2 .5 3.5 2 4 4M14.4 9.3c.7.3 1.2.8 1.4 1.5" />
      </>
    ),
    nft: (
      <>
        <path className={common} d="M12 4.8 18.2 12 12 19.2 5.8 12z" />
        <path className={common} d="M8.9 12h6.2M12 8.4v7.2" />
      </>
    ),
    depin: (
      <>
        <path className={common} d="M12 12.2a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6ZM5.8 17.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM18.2 17.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
        <path className={common} d="m10.1 11.2-2.8 3.2M13.9 11.2l2.8 3.2M7.6 16h8.8" />
      </>
    ),
    transactions: (
      <>
        <path className={common} d="M12 4.5v15M17.5 7.5l-5.5 5-5.5-5" />
        <path className={common} d="M3 12h4l2-4 4 8 2-4h4" />
      </>
    ),
    payroll: (
      <>
        <path className={common} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle className={common} cx="9" cy="7" r="4" />
        <path className={common} d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  };

  return (
    <svg className={`scale-[1.28] ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function ScreenSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading screen" role="status">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
        <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
        <div className="mt-4 h-8 w-full max-w-lg rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
            <div className="mt-4 h-7 w-20 rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
            <div className="mt-3 h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="h-48 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
            <div className="mt-6 space-y-3">
              <div className="h-10 rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
              <div className="h-10 rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
              <div className="h-10 rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type WidgetMessage = {
  id: number;
  sender: 'user' | 'agent';
  text: string;
  time: string;
};

const SIDEBAR_CATEGORIES: Array<{
  id: string;
  label: string;
  items: Array<{ to: string; label: string; icon: CustomIconName }>;
}> = [
  {
    id: 'workspace-management',
    label: 'Workspace Management',
    items: [
      { to: 'overview', label: 'Overview', icon: 'overview' },
      { to: 'projects', label: 'Projects / Environments', icon: 'projects' },
      { to: 'team', label: 'Team', icon: 'team' },
      { to: 'audit', label: 'Audit Log', icon: 'security' },
      { to: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
  {
    id: 'zer0-service',
    label: 'Payroll',
    items: [
      { to: 'zer0', label: 'Overview', icon: 'privacy' },
      { to: 'zer0/people', label: 'Team directory', icon: 'team' },
      { to: 'zer0/payroll', label: 'Payroll runs', icon: 'payroll' },
      { to: 'zer0/pay', label: 'Send payment', icon: 'payroll' },
      { to: 'zer0/history', label: 'Payment ledger', icon: 'transactions' },
      { to: 'zer0/proofs', label: 'Payment proofs', icon: 'security' },
      { to: 'zer0/data-preview', label: 'What stays private', icon: 'security' },
      { to: 'zer0/settings', label: 'Payroll settings', icon: 'settings' },
    ],
  },
  {
    id: 'services',
    label: 'Service Catalog',
    items: [
      { to: 'services', label: 'Services Manager', icon: 'services' },
    ],
  },
  {
    id: 'agentic-operation',
    label: 'Agentic Operation',
    items: [
      { to: 'agent', label: 'Morph Agent', icon: 'agent' },
      { to: 'memory', label: 'Shared Memory', icon: 'memory' },
    ],
  },
  {
    id: 'security-section',
    label: 'Security & Insights',
    items: [
      { to: 'security', label: 'Security', icon: 'security' },
      { to: 'analytics', label: 'Analytics', icon: 'analytics' },
    ],
  },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { workspaceId } = useParams({ strict: false });
  const routerState = useRouterState();

  const { theme, density, reducedMotion, sidebarCollapsed, setTheme, toggleSidebar } = useUIStore();
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const isHydrated = useWorkspaceStore(s => s.isHydrated);
  const createWorkspace = useWorkspaceStore(s => s.createWorkspace);
  const selectWorkspace = useWorkspaceStore(s => s.selectWorkspace);
  const deleteWorkspace = useWorkspaceStore(s => s.deleteWorkspace);
  const addMember = useWorkspaceStore(s => s.addMember);

  const [userSession, setUserSession] = useState<UserSession | null>(() => readStoredSession());

  const [cliConnected, setCliConnected] = useState(false);
  const [cliLastActive, setCliLastActive] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('Developer');
  const [workspaceNotice, setWorkspaceNotice] = useState('');
  const [screenLoading, setScreenLoading] = useState(false);
  const [activationCode, setActivationCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('activate');
    return code ? code.toUpperCase() : null;
  });
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    'workspace-management': true, 'zer0-service': true, services: true, 'agentic-operation': true, 'security-section': true,
    'project-core': true, 'project-services': true, 'project-digital-assets': true, 'project-resource-gateway': true,
    'project-agentic': true, 'project-security': true, 'project-admin': true,
  });
  const [agentWidgetOpen, setAgentWidgetOpen] = useState(false);
  const [widgetMessages, setWidgetMessages] = useState<WidgetMessage[]>([]);
  const [widgetInput, setWidgetInput] = useState('');
  const [widgetThinking, setWidgetThinking] = useState(false);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const currentWorkspace = workspaces.find(w => w.id === workspaceId) || workspaces[0] || null;
  const currentPath = routerState.location.pathname;

  useEffect(() => {
    if (!userSession) return;
    loadAgentSettingsFromAWS();
  }, [userSession]);

  // Determine active section from URL
  const pathParts = currentPath.split('/').filter(Boolean);
  const isProjectRoute = pathParts.includes('p');
  const projectId = isProjectRoute ? pathParts[pathParts.indexOf('p') + 1] : null;
  const isNftProjectRoute = isProjectRoute && /\/nft(?:\/|$)/.test(currentPath);
  const isDepinProjectRoute = isProjectRoute && /\/depin(?:\/|$)/.test(currentPath);

  const projectStore = useProjectStore();
  const currentProject = projectStore.projects.find(p => p.id === projectId);

  const dynamicProjectCategories = React.useMemo(() => {
    const enabled = currentProject?.enabledServices || [];
    const serviceItems: Array<{ to: string; label: string; icon: CustomIconName }> = [];
    // Always expose primary surfaces on project routes so users can open them
    // even when the project was created without selecting services.
    const digitalAssetItems: Array<{ to: string; label: string; icon: CustomIconName }> = [
      { to: 'nft', label: 'NFT Collections', icon: 'nft' as const },
    ];
    const resourceGatewayItems: Array<{ to: string; label: string; icon: CustomIconName }> = [
      { to: 'depin', label: 'De-pin x402 Gateway', icon: 'depin' as const },
    ];
    if (enabled.includes('srv-privacy')) {
      serviceItems.push({ to: 'zer0', label: 'Payroll', icon: 'privacy' as const });
    }
    if (enabled.includes('srv-transformation')) {
      serviceItems.push({ to: 'transformation', label: 'Transformation Agent', icon: 'transform' as const });
    }
    if (enabled.includes('srv-trade')) {
      serviceItems.push({ to: 'trade', label: 'A-2-A Trade Pipeline', icon: 'trade' as const });
    }
    if (enabled.includes('srv-agent-auth')) {
      serviceItems.push({ to: 'agent-auth', label: 'Agent Authentication', icon: 'auth' as const });
    }
    serviceItems.push({ to: 'services', label: 'Services Manager', icon: 'services' as const });

    return [
      {
        id: 'project-core',
        label: 'Project Core',
        items: [
          { to: 'overview', label: 'Overview', icon: 'overview' as const },
          { to: 'executions', label: 'Executions & Runs', icon: 'deployments' as const },
        ],
      },
      {
        id: 'project-services',
        label: 'Services',
        items: serviceItems,
      },
      {
        id: 'project-digital-assets',
        label: 'Digital Assets',
        items: digitalAssetItems,
      },
      {
        id: 'project-resource-gateway',
        label: 'Resource Gateway',
        items: resourceGatewayItems,
      },
      {
        id: 'project-agentic',
        label: 'Agentic Operation',
        items: [
          { to: 'agent', label: 'Morph Agent', icon: 'agent' as const },
          { to: 'memory', label: 'Shared Memory', icon: 'memory' as const },
        ],
      },
      {
        id: 'project-security',
        label: 'Security & Insights',
        items: [
          { to: 'security', label: 'Security', icon: 'security' as const },
          { to: 'analytics', label: 'Analytics', icon: 'analytics' as const },
        ],
      },
      {
        id: 'project-admin',
        label: 'Project Admin',
        items: [
          { to: 'members', label: 'Members', icon: 'team' as const },
          { to: 'audit', label: 'Audit Log', icon: 'security' as const },
          { to: 'settings', label: 'Settings', icon: 'settings' as const },
        ],
      },
    ];
  }, [currentProject]);

  let activeSection = 'overview';
  if (isProjectRoute) {
    const projectIdx = pathParts.indexOf('p');
    activeSection = pathParts[projectIdx + 2] || 'overview';
  } else {
    const lastPart = pathParts[pathParts.length - 1];
    activeSection = lastPart === workspaceId ? 'overview' : lastPart;
  }

  const SECTION_LABELS: Record<string, string> = {
    nft: 'NFT',
    depin: 'De-pin',
    zer0: 'Zer0',
    'agent-auth': 'Agent Auth',
    overview: 'Overview',
    services: 'Services',
    settings: 'Settings',
    executions: 'Executions',
    members: 'Members',
    audit: 'Audit',
    agent: 'Agent',
    memory: 'Memory',
    security: 'Security',
    analytics: 'Analytics',
    transformation: 'Transformation',
    trade: 'Trade',
  };
  const currentSectionLabel =
    SECTION_LABELS[activeSection]
    || activeSection.charAt(0).toUpperCase() + activeSection.slice(1).replace(/-/g, ' ');
  const isSectionSelected = (target: string) => {
    if (target.includes('/')) {
      return currentPath.endsWith(`/${target}`);
    }
    return activeSection === target;
  };

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  // Keep Cognito access token fresh for NFT dashboard + API calls.
  useEffect(() => {
    if (!userSession) return;
    let cancelled = false;
    const sync = async () => {
      try {
        if (isAccessTokenExpired(userSession.token)) {
          await ensureValidAccessToken(userSession);
          const next = readStoredSession();
          if (!cancelled && next) setUserSession(next);
        }
      } catch {
        if (!cancelled) {
          clearStoredSession();
          setUserSession(null);
        }
      }
    };
    void sync();
    const interval = window.setInterval(() => {
      void sync();
    }, 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [userSession]);

  // CLI status check
  useEffect(() => {
    if (!userSession || !SHOULD_CHECK_CLI_STATUS) return;
    const check = async () => {
      try {
        let token = userSession.token;
        if (isAccessTokenExpired(token)) {
          token = await ensureValidAccessToken(userSession);
          const next = readStoredSession();
          if (next) setUserSession(next);
        }
        const response = await fetch(`${API_BASE_URL}/api/memory`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.memory?.cli_connected) {
            setCliConnected(true);
            setCliLastActive(data.memory.cli_last_active);
          } else {
            setCliConnected(false);
          }
        }
      } catch { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [userSession]);

  // Initialize AWS Sync listeners once on mount
  useEffect(() => {
    initializeAWSSync();
  }, []);

  // Load remote ZEXVRO state from AWS DynamoDB on login, with 10s periodic polling
  useEffect(() => {
    if (!userSession) return;
    pullFromAWS();
    const interval = setInterval(() => {
      pullFromAWS();
    }, 10000);
    return () => clearInterval(interval);
  }, [userSession]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Screen loading animation
  useEffect(() => {
    setScreenLoading(true);
    const timer = window.setTimeout(() => setScreenLoading(false), reducedMotion ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [currentPath, reducedMotion]);

  // Create default workspace if none exists
  useEffect(() => {
    if (isHydrated && workspaces.length === 0 && userSession) {
      const name = `${getWorkspaceOwnerName(userSession)}'s Workspace`;
      createWorkspace(name, userSession.username || userSession.email || 'user');
    }
  }, [isHydrated, workspaces.length, userSession]);

  const handleSendWidgetMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!widgetInput.trim()) return;
    const userMsg: WidgetMessage = { id: Date.now(), sender: 'user', text: widgetInput, time: 'Just now' };
    setWidgetMessages(prev => [...prev, userMsg]);
    const prompt = widgetInput;
    setWidgetInput('');
    setWidgetThinking(true);
    try {
      const response = await fetch(AGENT_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAgentChatPayload(
          currentSectionLabel,
          [{ role: 'user', content: `Current screen: ${currentSectionLabel}\n\n${prompt}` }],
        )),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || data.error || `Agent request failed with ${response.status}`);
      setWidgetMessages(prev => [...prev, {
        id: Date.now() + 1, sender: 'agent',
        text: data.choices?.[0]?.message?.content || data.text || 'No response returned.',
        time: 'Just now'
      }]);
    } catch (err) {
      setWidgetMessages(prev => [...prev, {
        id: Date.now() + 1, sender: 'agent',
        text: err instanceof Error ? err.message : 'Agent request failed.',
        time: 'Just now'
      }]);
    } finally {
      setWidgetThinking(false);
    }
  };

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) { setWorkspaceNotice('Add a workspace name first.'); return; }
    const exists = workspaces.some(w => w.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setWorkspaceNotice('A workspace with this name already exists.');
      return;
    }
    const ws = createWorkspace(name, userSession?.username || 'user');
    setNewWorkspaceName('');
    setWorkspaceNotice(`Created ${ws.name}.`);
    navigate({ to: '/dashboard/w/$workspaceId/overview', params: { workspaceId: ws.id } });
  };

  const handleDeleteWorkspace = (id: string) => {
    const workspace = workspaces.find(item => item.id === id);
    if (!workspace) return;
    if (workspaces.length <= 1) {
      setWorkspaceNotice('Create another workspace before deleting this one.');
      return;
    }
    const confirmed = window.confirm(`Delete "${workspace.name}"? This removes it from your workspace list.`);
    if (!confirmed) return;

    const nextWorkspace = workspaces.find(item => item.id !== id) || null;
    deleteWorkspace(id);
    setWorkspaceNotice(`Deleted ${workspace.name}.`);
    setWorkspaceMenuOpen(false);
    if (nextWorkspace) {
      selectWorkspace(nextWorkspace.id);
      navigate({ to: '/dashboard/w/$workspaceId/overview', params: { workspaceId: nextWorkspace.id } });
    } else {
      navigate({ to: '/dashboard' });
    }
  };

  const handleInviteToWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setWorkspaceNotice('Enter a valid email invite.'); return; }
    if (!currentWorkspace) return;
    addMember(currentWorkspace.id, {
      email, name: email.split('@')[0], role: inviteRole, status: 'invited',
    });
    setInviteEmail('');
    setWorkspaceNotice(`Invite added for ${email}.`);
  };

  const toggleCat = (catId: string) => {
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const makeNavTo = (section: string) => {
    if (!workspaceId) return '#';
    return `/dashboard/w/${workspaceId}/${section}`;
  };

  const makeProjectNavTo = (section: string) => {
    const pid = pathParts[pathParts.indexOf('p') + 1];
    if (!workspaceId || !pid) return '#';
    return `/dashboard/w/${workspaceId}/p/${pid}/${section}`;
  };

  const filteredSearchItems = SIDEBAR_CATEGORIES.flatMap(cat => cat.items).filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!userSession) {
    // Lazy import auth overlay
    const AuthOverlay = React.lazy(() => import('../auth/AuthOverlay'));

    return (
      <React.Suspense fallback={null}>
        <AuthOverlay onSuccess={(session) => {
          persistSession(session);
          setUserSession(session);
        }} />
      </React.Suspense>
    );
  }

  if (activationCode) {
    return (
      <CliActivation
        code={activationCode}
        token={userSession.idToken || userSession.token}
        apiBaseUrl={API_BASE_URL}
        onClose={() => {
          setActivationCode(null);
          const url = new URL(window.location.href);
          url.searchParams.delete('code');
          url.searchParams.delete('activate');
          window.history.replaceState({}, '', url.toString());
        }}
      />
    );
  }

  const assistantDockOpen = agentWidgetOpen && activeSection !== 'agent';

  return (
    <div className={`min-h-screen font-sans antialiased text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-[#050505] transition-colors duration-200 ${
      density === 'compact' ? 'text-xs' : 'text-sm'
    }`}>
      {/* One-time platform boot after login — never during CLI ?code= activation. */}
      <PlatformBootup active={Boolean(userSession) && !activationCode} />
      <div className="flex min-h-screen">

        {/* Desktop Sidebar */}
        <div className={`hidden md:block relative shrink-0 z-30 transition-[width] ${reducedMotion ? 'duration-0' : 'duration-300'} ease-[cubic-bezier(0.22,1,0.36,1)] h-screen sticky top-0 ${
          sidebarCollapsed ? 'w-[52px]' : 'w-[252px]'
        }`}>
          <aside className="hidden md:flex flex-col border-r border-zinc-200 dark:border-zinc-900 bg-white dark:bg-black select-none sticky top-0 h-screen overflow-y-auto overflow-x-hidden w-full h-full">
            {/* Brand */}
            <div className={`h-14 shrink-0 border-b border-zinc-200 dark:border-zinc-900 flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start pl-5 pr-4'}`}>
              <Link to="/dashboard" className="flex h-full items-center gap-2.5">
                <img src={BRAND_MARK} alt="ZEXVRO" className="h-[34px] w-[34px] object-contain shrink-0 invert dark:invert-0" />
                {!sidebarCollapsed && (
                  <img src={BRAND_WORDMARK} alt="ZEXVRO" className="h-[18px] max-w-[148px] shrink-0 translate-y-[1px] object-contain object-left invert dark:invert-0" />
                )}
              </Link>
            </div>

            {/* Workspace Switcher */}
            {/* Workspace Switcher / Back to Workspace */}
            {!sidebarCollapsed && currentWorkspace && (
              isProjectRoute ? (
                <div className="mx-2 mt-2 mb-2 shrink-0 space-y-2">
                  <Link
                    to="/dashboard/w/$workspaceId/overview"
                    params={{ workspaceId: currentWorkspace.id }}
                    className="w-full flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50 text-left transition"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-500/10 text-xs font-bold text-zinc-500">
                      ←
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-zinc-850 dark:text-zinc-200">Back to Main</span>
                      <span className="block truncate text-[10px] text-zinc-400 mt-0.5">{currentWorkspace.name}</span>
                    </span>
                  </Link>

                  {currentProject && (
                    <div className="rounded-lg border border-zinc-150/75 bg-blue-500/[0.03] p-2.5 dark:border-zinc-850 dark:bg-blue-500/[0.01]">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400">Project View</span>
                      <span className="block truncate text-xs font-bold text-zinc-900 dark:text-white mt-0.5" title={currentProject.name}>
                        {currentProject.name}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative mx-2 mt-2 mb-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setWorkspaceMenuOpen(prev => !prev)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 text-left transition hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-xs font-semibold text-blue-500">
                        {makeWorkspaceInitials(currentWorkspace.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{currentWorkspace.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-zinc-400">
                          <span>{currentWorkspace.plan}</span>
                        </span>
                      </span>
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${workspaceMenuOpen ? 'rotate-90' : ''}`} />
                    </span>
                  </button>

                  <AnimatePresence>
                    {workspaceMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl shadow-zinc-950/10 dark:border-zinc-800 dark:bg-[#0A0A0B] dark:shadow-black/30"
                      >
                        <div className="max-h-[72vh] overflow-y-auto">
                          <div className="border-b border-zinc-100 p-2 dark:border-zinc-900">
                            <div className="mb-1 flex items-center justify-between px-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Workspaces</span>
                              <span className="text-[10px] text-zinc-400">{workspaces.length}</span>
                            </div>
                            {workspaces.map(ws => {
                              const isCurrent = ws.id === workspaceId;
                              return (
                                <div
                                  key={ws.id}
                                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition ${
                                    isCurrent
                                      ? 'bg-blue-500/10 text-zinc-950 dark:text-white'
                                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      selectWorkspace(ws.id);
                                      setWorkspaceMenuOpen(false);
                                      navigate({ to: '/dashboard/w/$workspaceId/overview', params: { workspaceId: ws.id } });
                                    }}
                                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                                  >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-[10px] font-semibold text-blue-500">
                                      {makeWorkspaceInitials(ws.name)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-xs font-semibold">{ws.name}</span>
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteWorkspace(ws.id);
                                    }}
                                    disabled={workspaces.length <= 1}
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-350 transition hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-350"
                                    title={workspaces.length <= 1 ? 'Create another workspace before deleting this one' : `Delete ${ws.name}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          <form onSubmit={handleCreateWorkspace} className="space-y-2 border-b border-zinc-100 p-3 dark:border-zinc-900">
                            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                              <Plus className="h-3.5 w-3.5 text-blue-500" />
                              <span>Create workspace</span>
                            </div>
                            <div className="flex gap-2">
                              <input
                                value={newWorkspaceName}
                                onChange={(event) => setNewWorkspaceName(event.target.value)}
                                placeholder="Workspace name"
                                className="h-9 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                              />
                              <button type="submit" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-500 text-white transition hover:bg-blue-600" title="Create workspace">
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </form>

                          <form onSubmit={handleInviteToWorkspace} className="space-y-2 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                                <Mail className="h-3.5 w-3.5 text-blue-500" />
                                <span className="truncate">Invite to {currentWorkspace.name}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <input
                                value={inviteEmail}
                                onChange={(event) => setInviteEmail(event.target.value)}
                                placeholder="teammate@email.com"
                                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                              />
                              <select
                                value={inviteRole}
                                onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}
                                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-800 outline-none transition focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                              >
                                {WORKSPACE_ROLES.map(role => (
                                  <option key={role} value={role}>{role}</option>
                                ))}
                              </select>
                            </div>
                            <button type="submit" className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-800 transition hover:border-blue-500/50 hover:bg-blue-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                              <Mail className="h-3.5 w-3.5" />
                              Add invite
                            </button>
                            {workspaceNotice && (
                              <p className="rounded-md bg-zinc-50 px-2.5 py-2 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">{workspaceNotice}</p>
                            )}
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            )}

            {/* Search */}
            {!sidebarCollapsed ? (
              <div className="px-3 py-1.5 shrink-0">
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10 text-xs text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer text-left font-sans"
                >
                  <span className="flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    Search
                  </span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-sans">⌘K</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3.5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                <button onClick={() => setSearchOpen(true)} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all cursor-pointer flex items-center justify-center shadow-sm" title="Search (⌘K)">
                  <Search className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Navigation */}
            {sidebarCollapsed ? (
              <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 flex flex-col items-center gap-2">
                {workspaceId && (
                  isProjectRoute ? (
                    <>
                      {dynamicProjectCategories.map(cat =>
                        cat.items.map(item => {
                          const isSelected = isSectionSelected(item.to);
                          return (
                            <Link
                              key={item.label}
                              to={makeProjectNavTo(item.to) as any}
                              className={`p-2.5 rounded-lg transition-all cursor-pointer relative group ${isSelected ? 'bg-zinc-900 dark:bg-zinc-900 text-blue-500' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'}`}
                              title={item.label}
                            >
                              <CustomIcon name={item.icon} className="h-5 w-5 shrink-0" />
                            </Link>
                          );
                        })
                      )}
                    </>
                  ) : (
                    <>
                      <Link to="/dashboard/w/$workspaceId/overview" params={{ workspaceId }} className={`p-2.5 rounded-lg transition-all cursor-pointer relative group ${activeSection === 'overview' ? 'bg-zinc-900 dark:bg-zinc-900 text-blue-500' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'}`}>
                        <CustomIcon name="overview" className="h-5 w-5 shrink-0" />
                      </Link>
                      <div className="w-8 h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                      {SIDEBAR_CATEGORIES.map(cat =>
                        cat.items.map(item => (
                          <Link
                            key={item.label}
                            to={makeNavTo(item.to) as any}
                            className={`p-2.5 rounded-lg transition-all cursor-pointer relative group ${isSectionSelected(item.to) ? 'bg-zinc-900 text-blue-500' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'}`}
                            title={item.label}
                          >
                            <CustomIcon name={item.icon} className="h-5 w-5 shrink-0" />
                          </Link>
                        ))
                      )}
                    </>
                  )
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-4">
                {workspaceId && (
                  isProjectRoute ? (
                    <>
                      {dynamicProjectCategories.map(cat => {
                        const isExpanded = expandedCats[cat.id];
                        const hasItems = cat.items.length > 0;
                        return (
                          <div key={cat.id} className="space-y-1">
                            {hasItems ? (
                              <button onClick={() => toggleCat(cat.id)} className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer text-left font-sans">
                                <span>{cat.label}</span>
                                <ChevronRight className={`h-2.5 w-2.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            ) : (
                              <div className="flex w-full items-center justify-between px-3 py-1 text-left font-sans text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                <span>{cat.label}</span>
                              </div>
                            )}
                            <AnimatePresence initial={false}>
                              {hasItems && isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden space-y-0.5 pl-3 border-l border-zinc-100 dark:border-zinc-800 ml-3.5"
                                >
                                  {cat.items.map(sub => {
                                    const isSelected = isSectionSelected(sub.to);
                                    const to = makeProjectNavTo(sub.to);
                                    return (
                                      <Link
                                        key={sub.label}
                                        to={to as any}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${isSelected ? 'bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold' : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30'}`}
                                      >
                                        <CustomIcon name={sub.icon} className={`h-5 w-5 shrink-0 ${isSelected ? 'text-blue-500' : 'text-zinc-400'}`} />
                                        <span className="truncate">{sub.label}</span>
                                      </Link>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      <div className="space-y-0.5">
                        <Link to="/dashboard/w/$workspaceId/overview" params={{ workspaceId }} className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeSection === 'overview' ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-900/40'}`}>
                          <CustomIcon name="overview" className="h-5 w-5 shrink-0 text-blue-500" />
                          <span>Overview</span>
                        </Link>
                      </div>

                      {SIDEBAR_CATEGORIES.map(cat => {
                        const isExpanded = expandedCats[cat.id];
                        const hasItems = cat.items.length > 0;
                        return (
                          <div key={cat.id} className="space-y-1">
                            {hasItems ? (
                              <button onClick={() => toggleCat(cat.id)} className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer text-left font-sans">
                                <span>{cat.label}</span>
                                <ChevronRight className={`h-2.5 w-2.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            ) : (
                              <div className="flex w-full items-center justify-between px-3 py-1 text-left font-sans text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                <span>{cat.label}</span>
                                <span className="rounded border border-zinc-200 px-1.5 py-0.5 text-[8px] font-medium normal-case tracking-normal text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">Planned</span>
                              </div>
                            )}
                            <AnimatePresence initial={false}>
                              {hasItems && isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden space-y-0.5 pl-3 border-l border-zinc-100 dark:border-zinc-800 ml-3.5"
                                >
                                  {cat.items.map(sub => {
                                    const isSelected = isSectionSelected(sub.to);
                                    const to = makeNavTo(sub.to);
                                    return (
                                      <Link
                                        key={sub.label}
                                        to={to as any}
                                        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${isSelected ? 'bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold' : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30'}`}
                                      >
                                        <CustomIcon name={sub.icon} className={`h-5 w-5 shrink-0 ${isSelected ? 'text-blue-500' : 'text-zinc-400'}`} />
                                        <span className="truncate">{sub.label}</span>
                                      </Link>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </>
                  )
                )}
              </div>
            )}

            {/* Support footer */}
            <div className="border-t border-zinc-100 dark:border-zinc-850/40 p-3 shrink-0">
              {!sidebarCollapsed ? (
                currentWorkspace ? (
                  <Link to="/dashboard/w/$workspaceId/settings" params={{ workspaceId: currentWorkspace.id }} className="group flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 text-left transition hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                        <HelpCircle className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold leading-none text-zinc-855 dark:text-zinc-200">Need help?</span>
                        <span className="mt-1 block truncate text-[10px] text-zinc-400">Contact support</span>
                      </span>
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition group-hover:text-blue-500" />
                  </Link>
                ) : (
                  <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 text-left opacity-70 dark:border-zinc-800 dark:bg-zinc-950/30">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                      <HelpCircle className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold leading-none text-zinc-855 dark:text-zinc-200">Need help?</span>
                      <span className="mt-1 block truncate text-[10px] text-zinc-400">Contact support</span>
                    </span>
                  </span>
                </div>
                )
              ) : (
                <div className="flex justify-center py-1">
                  {currentWorkspace ? (
                    <Link to="/dashboard/w/$workspaceId/settings" params={{ workspaceId: currentWorkspace.id }} className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 transition hover:bg-blue-500/15" title="Contact support">
                      <HelpCircle className="h-4 w-4" />
                    </Link>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 opacity-70" title="Contact support">
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex absolute top-[112px] -right-3 h-6 w-6 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 items-center justify-center cursor-pointer shadow-md hover:scale-105 transition-all duration-200 z-50"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {sidebarCollapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
            </svg>
          </button>
        </div>

        {/* Main content area */}
        <div className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-200 ${assistantDockOpen ? 'lg:pr-[430px]' : ''}`}>
          {/* Top bar */}
          <header className="h-14 border-b border-zinc-200 dark:border-zinc-900 bg-white dark:bg-black flex items-center justify-between px-4 sticky top-0 z-40 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-1.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-500 cursor-pointer">
                <Menu className="h-4.5 w-4.5" />
              </button>
              <div className="flex items-center gap-2.5">
                <img src={BRAND_MARK} alt="ZEXVRO" className="md:hidden h-6 w-6 object-contain shrink-0 invert dark:invert-0" />
                <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                  {currentWorkspace && (
                    <>
                      <Link to="/dashboard/w/$workspaceId/overview" params={{ workspaceId: currentWorkspace.id }} className="font-semibold text-zinc-500 dark:text-zinc-400 hidden sm:inline hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">{currentWorkspace.name}</Link>
                      {isProjectRoute && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>
                          <span className="font-semibold text-zinc-900 dark:text-white capitalize tracking-tight px-2 py-0.5 rounded bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-800">Project</span>
                        </>
                      )}
                      <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>
                      <span className="font-semibold text-zinc-900 dark:text-white capitalize tracking-tight px-2 py-0.5 rounded bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-800">{currentSectionLabel}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 relative">
              {currentWorkspace && (
                <Link to="/dashboard/w/$workspaceId/settings" params={{ workspaceId: currentWorkspace.id }} className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white">
                  <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                  Support
                </Link>
              )}
              <button onClick={() => setSearchOpen(true)} className="md:hidden p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer">
                <Search className="h-4.5 w-4.5" />
              </button>
              <div className="relative">
                <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 p-1 px-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer text-xs font-medium transition-all" title="User Profile & Settings">
                  <User className="h-4 w-4 text-zinc-500" />
                  <span className="hidden sm:inline text-zinc-600 dark:text-zinc-400">Workspace</span>
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] shadow-lg z-50 py-1 text-xs">
                      <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-900">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Current User</p>
                        <p className="font-semibold text-zinc-900 dark:text-white truncate mt-0.5">{userSession?.username || 'Workspace user'}</p>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">{userSession?.email || 'dev@zexvro.local'}</p>
                      </div>
                      <div className="py-1">
                        <button onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setUserMenuOpen(false); }} className="w-full text-left px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 flex items-center justify-between cursor-pointer transition-colors">
                          <span className="flex items-center gap-2">
                            {isDark ? <Sun className="h-3.5 w-3.5 text-zinc-500" /> : <Moon className="h-3.5 w-3.5 text-zinc-500" />}
                            Theme: {isDark ? 'Light Mode' : 'Dark Mode'}
                          </span>
                        </button>
                        {currentWorkspace && (
                          <Link to="/dashboard/w/$workspaceId/settings" params={{ workspaceId: currentWorkspace.id }} onClick={() => setUserMenuOpen(false)} className="w-full text-left px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 flex items-center gap-2 cursor-pointer transition-colors">
                            <Settings className="h-3.5 w-3.5 text-zinc-500" />
                            <span>Settings</span>
                          </Link>
                        )}
                        <button onClick={() => { setUserMenuOpen(false); globalSignOut(userSession?.token).finally(() => { clearStoredSession(); setUserSession(null); }); }} className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer transition-colors border-t border-zinc-100 dark:border-zinc-900 mt-1 pt-2">
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Main content with router outlet */}
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto w-full">
            <div className="space-y-6">
              {!isHydrated ? (
                <ScreenSkeleton />
              ) : screenLoading ? (
                <ScreenSkeleton />
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentPath}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
                  >
                    <Outlet />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-black" />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-xs bg-white dark:bg-[#0A0A0B] border-r border-zinc-200 dark:border-zinc-800 p-5 flex flex-col justify-between"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <img src={BRAND_MARK} alt="ZEXVRO" className="h-8 w-8 object-contain shrink-0 invert dark:invert-0" />
                    <img src={BRAND_WORDMARK} alt="ZEXVRO" className="h-4.5 object-contain max-w-[130px] invert dark:invert-0" />
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-1 text-xs">
                  {workspaceId && (
                    isProjectRoute ? (
                      <>
                        {currentWorkspace && (
                          <Link
                            to="/dashboard/w/$workspaceId/overview"
                            params={{ workspaceId: currentWorkspace.id }}
                            onClick={() => setMobileMenuOpen(false)}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                          >
                            <span>← Back to {currentWorkspace.name}</span>
                          </Link>
                        )}
                        {dynamicProjectCategories.map(cat =>
                          cat.items.map(item => {
                            const isSelected = isSectionSelected(item.to);
                            return (
                              <Link
                                key={item.label}
                                to={makeProjectNavTo(item.to) as any}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg font-semibold transition-all ${isSelected ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-white' : 'text-zinc-400'}`}
                              >
                                <CustomIcon name={item.icon} className="h-5 w-5 shrink-0" />
                                <span>{item.label}</span>
                              </Link>
                            );
                          })
                        )}
                      </>
                    ) : (
                      <>
                        <Link to="/dashboard/w/$workspaceId/overview" params={{ workspaceId }} onClick={() => setMobileMenuOpen(false)} className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg font-semibold transition-all ${activeSection === 'overview' ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-white' : 'text-zinc-400'}`}>
                          <CustomIcon name="overview" className="h-5 w-5 shrink-0" />
                          <span>Overview</span>
                        </Link>
                        {SIDEBAR_CATEGORIES.map(cat =>
                          cat.items.map(item => (
                            <Link
                              key={item.label}
                              to={makeNavTo(item.to) as any}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg font-semibold transition-all ${isSectionSelected(item.to) ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-white' : 'text-zinc-400'}`}
                            >
                              <CustomIcon name={item.icon} className="h-5 w-5 shrink-0" />
                              <span>{item.label}</span>
                            </Link>
                          ))
                        )}
                      </>
                    )
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Command palette */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSearchOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }} className="relative w-full max-w-lg overflow-hidden rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] shadow-2xl z-10 p-2">
              <div className="flex items-center gap-2 px-3 border-b border-zinc-100 dark:border-zinc-800 pb-2.5 pt-1.5">
                <Search className="h-4.5 w-4.5 text-zinc-400" />
                <input type="text" placeholder="Type a screen or operation command..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none" autoFocus />
                <button onClick={() => setSearchOpen(false)} className="text-[10px] border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 hover:text-zinc-600">ESC</button>
              </div>
              <div className="mt-2.5 max-h-[220px] overflow-y-auto text-xs">
                {filteredSearchItems.length === 0 ? (
                  <p className="p-3 text-center text-zinc-400 text-[11px]">No matching screens or commands found.</p>
                ) : (
                  filteredSearchItems.map(item => (
                    <Link
                      key={item.label}
                      to={makeNavTo(item.to) as any}
                      onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                      className="w-full text-left p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-md flex items-center justify-between group transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300">
                        <CustomIcon name={item.icon} className="h-5 w-5 text-zinc-400 group-hover:text-blue-500" />
                        <span>Navigate to {item.label}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100">Jump ↵</span>
                    </Link>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Morph docked assistant */}
      {activeSection !== 'agent' && (
        <>
          <AnimatePresence>
            {agentWidgetOpen && (
              <motion.aside
                initial={{ x: 430 }}
                animate={{ x: 0 }}
                exit={{ x: 430 }}
                transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[430px] flex-col border-l border-white/10 bg-zinc-950/88 shadow-2xl shadow-black/30 backdrop-blur-xl"
              >
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <img src={MORPH_LOGO} alt="Morph" className="h-8 w-8 shrink-0 object-contain" />
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-white">Morph Assistant</h3>
                      <p className="truncate text-xs text-zinc-400">Context: {currentSectionLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { setAgentWidgetOpen(false); }} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/10 hover:text-white" title="Close">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                  {widgetMessages.length === 0 && !widgetThinking ? (
                    <div className="flex min-h-full flex-col justify-center">
                      <div className="mb-10 flex justify-center">
                        <img src={MORPH_ILLUSTRATION} alt="Morph" className="h-36 w-36 object-contain" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-2xl font-semibold tracking-tight text-white">Hello, workspace</h4>
                        <p className="text-xl font-semibold text-zinc-400">Ask Morph anything.</p>
                      </div>
                      <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-500">Messages are sent to the same opencode proxy as Agentic Operations.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 text-sm">
                      {widgetMessages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[88%] rounded-lg px-4 py-3 ${msg.sender === 'user' ? 'bg-violet-500 text-white' : 'border border-white/10 bg-white/[0.05] text-zinc-100'}`}>
                            <p className="whitespace-pre-line leading-6">{msg.text}</p>
                          </div>
                          <span className="mt-1 px-1 text-xs text-zinc-500">{msg.time}</span>
                        </div>
                      ))}
                      {widgetThinking && (
                        <div className="flex items-center gap-2 text-sm italic text-zinc-400">
                          <span className="flex gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0.2s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0.4s]" />
                          </span>
                          Morph is preparing a safe proposal...
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="shrink-0 border-t border-white/10 p-4">
                  <form onSubmit={handleSendWidgetMessage} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 shadow-inner">
                    <input type="text" value={widgetInput} onChange={(e) => setWidgetInput(e.target.value)} placeholder="Ask Morph" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none" />
                    <button type="submit" disabled={!widgetInput.trim() || widgetThinking} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-500 text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50" title="Send">
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">Morph can make mistakes. Review proposals before approval.</p>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {!agentWidgetOpen && (
            <button onClick={() => setAgentWidgetOpen(true)} className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center justify-center rounded-l-lg border-y border-l border-zinc-200 bg-white/85 px-2.5 py-3 shadow-lg shadow-zinc-950/10 backdrop-blur-md transition hover:pl-4 dark:border-white/10 dark:bg-black/70" title="Open Morph Assistant">
              <img src={MORPH_LOGO} alt="Morph" className="h-6 w-6 shrink-0 object-contain invert dark:invert-0" />
            </button>
          )}
        </>
      )}

    </div>
  );
}
