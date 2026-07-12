import React, { useState, useEffect } from 'react';
import {
  Search, Menu, X, ChevronRight, User,
  HelpCircle, Sun, Moon, Settings, Send, ArrowUpRight, Sparkles, LogOut,
  Plus, Mail, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Subcomponents
import Overview from './components/dashboard/Overview';
import Projects from './components/dashboard/Projects';
import Deployments from './components/dashboard/Deployments';
import Services from './components/services/Services';
import AgentStudio from './components/dashboard/AgentStudio';
import Analytics from './components/dashboard/Analytics';
import Team from './components/dashboard/Team';
import Memory from './components/dashboard/Memory';
import Security from './components/dashboard/Security';
import SettingsView from './components/dashboard/Settings';
import AuthOverlay from './components/auth/AuthOverlay';
import CliActivation from './components/auth/CliActivation';
import { globalSignOut, type UserSession } from './auth/cognito';
import { buildAgentChatPayload } from './agent/settings';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080'
    : 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com');

// Mock Lists initial data
import {
  mockProjects,
  mockDeployments,
  mockServices,
  mockTeamMembers,
  mockMemoryEntries
} from './data/mock';
import { Project, Deployment, Service, TeamMember, MemoryEntry, ThemeType, DensityType } from './types';

const BRAND_MARK = '/brand/logo-transparent.png';
const BRAND_WORDMARK = '/brand/wordmark-transparent.png';
const MORPH_LOGO = '/morph/morph-logo.svg';
const MORPH_ILLUSTRATION = '/morph/morph-illustration-transparent.png';

const WORKSPACE_ROLES = ['Admin', 'Developer', 'Viewer'] as const;

type WorkspaceRole = typeof WORKSPACE_ROLES[number];

type WorkspaceInvite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: 'Pending';
  createdAt: number;
};

type Workspace = {
  id: string;
  name: string;
  plan: string;
  initials: string;
  status: string;
  detail: string;
  owner: string;
  invites: WorkspaceInvite[];
};

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
  const letters = parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  return letters || 'ZX';
}

function createWorkspaceId(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'workspace';
  return `${slug}-${Date.now().toString(36)}`;
}

function createDefaultWorkspace(session: UserSession | null): Workspace {
  const ownerName = getWorkspaceOwnerName(session);
  const name = `${ownerName}'s Workspace`;
  return {
    id: 'default',
    name,
    plan: 'Personal workspace',
    initials: makeWorkspaceInitials(name),
    status: 'Owner',
    detail: 'Agents, services, memory, and team invites',
    owner: ownerName,
    invites: [],
  };
}

function isUsableSession(value: unknown): value is UserSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<UserSession>;
  return (
    typeof session.username === 'string' &&
    typeof session.token === 'string' &&
    session.token.split('.').length === 3 &&
    !session.token.startsWith('prod_jwt_token_')
  );
}

const SECTION_LABELS: Record<string, string> = {
  overview: 'Overview',
  projects: 'Projects',
  deployments: 'Deployments',
  services: 'Services',
  agent: 'Agentic Operations',
  analytics: 'Analytics',
  team: 'Team',
  memory: 'Memory',
  security: 'Security',
  settings: 'Settings'
};

type WidgetMessage = {
  id: number;
  sender: 'user' | 'agent';
  text: string;
  time: string;
};

type CustomIconName =
  | 'overview'
  | 'projects'
  | 'deployments'
  | 'services'
  | 'agent'
  | 'analytics'
  | 'team'
  | 'memory'
  | 'security'
  | 'settings'
  | 'privacy'
  | 'transform'
  | 'trade'
  | 'auth'
  | 'nft'
  | 'depin';

type NavItem = {
  id: string;
  label: string;
  icon: CustomIconName;
};

function MorphIcon({ className = '' }: { className?: string }) {
  return (
    <img
      src={MORPH_LOGO}
      alt=""
      aria-hidden="true"
      className={`scale-95 object-contain invert dark:invert-0 ${className}`}
    />
  );
}

function CustomIcon({ name, className = '' }: { name: CustomIconName; className?: string }) {
  if (name === 'agent') return <MorphIcon className={className} />;

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
  };

  return (
    <svg className={`scale-[1.28] ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function NavIcon({ item, className = '' }: { item: NavItem; className?: string }) {
  return <CustomIcon name={item.icon} className={className} />;
}

function ScreenSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading screen">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
        <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-900 animate-shimmer" />
        <div className="mt-4 h-8 w-full max-w-lg rounded bg-zinc-200 dark:bg-zinc-900 animate-shimmer" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded bg-zinc-200 dark:bg-zinc-900 animate-shimmer" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-900 animate-shimmer" />
            <div className="mt-4 h-7 w-20 rounded bg-zinc-200 dark:bg-zinc-900 animate-shimmer" />
            <div className="mt-3 h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-900 animate-shimmer" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="h-72 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-900 animate-shimmer" />
            <div className="mt-6 space-y-3">
              <div className="h-12 rounded bg-zinc-200 dark:bg-zinc-900 animate-shimmer" />
              <div className="h-12 rounded bg-zinc-200 dark:bg-zinc-900 animate-shimmer" />
              <div className="h-12 rounded bg-zinc-200 dark:bg-zinc-900 animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardApp() {
  const [userSession, setUserSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('zexvro_user_session');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (isUsableSession(parsed)) return parsed;
      localStorage.removeItem('zexvro_user_session');
      return null;
    } catch {
      localStorage.removeItem('zexvro_user_session');
      return null;
    }
  });

  const [cliConnected, setCliConnected] = useState<boolean>(false);
  const [cliLastActive, setCliLastActive] = useState<number | null>(null);
  const [activationCode, setActivationCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('activate');
    if (code) {
      setActivationCode(code.toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (!userSession) return;

    const checkCliStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/memory`, {
          headers: {
            'Authorization': `Bearer ${userSession.token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.memory && data.memory.cli_connected) {
            setCliConnected(true);
            setCliLastActive(data.memory.cli_last_active);
          } else {
            setCliConnected(false);
          }
        }
      } catch (err) {
        console.error("Error checking CLI status:", err);
      }
    };

    checkCliStatus();
    const interval = setInterval(checkCliStatus, 5000);
    return () => clearInterval(interval);
  }, [userSession]);

  // Navigation & Shell states
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Brand and UX states
  const [theme, setTheme] = useState<ThemeType>('dark');
  const [isDarkActive, setIsDarkActive] = useState<boolean>(true);
  const [density, setDensity] = useState<DensityType>('comfortable');
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState<boolean>(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [newWorkspaceName, setNewWorkspaceName] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('Developer');
  const [workspaceNotice, setWorkspaceNotice] = useState<string>('');
  const [screenLoading, setScreenLoading] = useState<boolean>(false);

  // Sharing states so actions propagate across tabs
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [deployments, setDeployments] = useState<Deployment[]>(mockDeployments);
  const [services, setServices] = useState<Service[]>(mockServices);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(mockTeamMembers);
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>(mockMemoryEntries);

  // Modal control propagation
  const [openNewProjectModal, setOpenNewProjectModal] = useState(false);
  const [openInviteTeammateModal, setOpenInviteTeammateModal] = useState(false);
  const [openNewMemoryModal, setOpenNewMemoryModal] = useState(false);

  // Collapsible category accordion states (Cloudflare-style)
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    compute: true,
    services: true,
    intelligence: true,
    security: true,
    config: true
  });

  const [agentWidgetOpen, setAgentWidgetOpen] = useState<boolean>(false);
  const [widgetMessages, setWidgetMessages] = useState<WidgetMessage[]>([]);
  const [widgetInput, setWidgetInput] = useState('');
  const [widgetThinking, setWidgetThinking] = useState(false);
  const currentSectionLabel = SECTION_LABELS[activeTab] || activeTab;
  const assistantDockOpen = agentWidgetOpen && activeTab !== 'agent';
  const selectedWorkspace =
    workspaces.find(workspace => workspace.id === selectedWorkspaceId) ||
    workspaces[0] ||
    createDefaultWorkspace(userSession);
  const selectedWorkspaceInvites = selectedWorkspace.invites || [];

  useEffect(() => {
    if (!userSession) {
      setWorkspaces([]);
      setSelectedWorkspaceId('');
      return;
    }

    const savedWorkspaces = [createDefaultWorkspace(userSession)];

    setWorkspaces(savedWorkspaces);
    setSelectedWorkspaceId(previousId => (
      savedWorkspaces.some(workspace => workspace.id === previousId)
        ? previousId
        : savedWorkspaces[0].id
    ));
  }, [userSession?.username, userSession?.email]);

  const handleCreateWorkspace = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newWorkspaceName.trim();

    if (!name) {
      setWorkspaceNotice('Add a workspace name first.');
      return;
    }

    const workspace: Workspace = {
      id: createWorkspaceId(name),
      name,
      plan: 'Team workspace',
      initials: makeWorkspaceInitials(name),
      status: 'Active',
      detail: 'Team members, agents, and service operations',
      owner: getWorkspaceOwnerName(userSession),
      invites: [],
    };

    setWorkspaces(previous => [...previous, workspace]);
    setSelectedWorkspaceId(workspace.id);
    setNewWorkspaceName('');
    setWorkspaceNotice(`Created ${workspace.name}.`);
  };

  const handleInviteToWorkspace = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = inviteEmail.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setWorkspaceNotice('Enter a valid email invite.');
      return;
    }

    const invite: WorkspaceInvite = {
      id: createWorkspaceId(email),
      email,
      role: inviteRole,
      status: 'Pending',
      createdAt: Date.now(),
    };

    setWorkspaces(previous => previous.map(workspace => {
      if (workspace.id !== selectedWorkspace.id) return workspace;
      return {
        ...workspace,
        invites: [
          invite,
          ...workspace.invites.filter(existingInvite => existingInvite.email !== email),
        ],
      };
    }));

    setInviteEmail('');
    setWorkspaceNotice(`Invite added for ${email}.`);
  };

  const handleSendWidgetMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!widgetInput.trim()) return;

    const userMsg: WidgetMessage = {
      id: Date.now(),
      sender: 'user',
      text: widgetInput,
      time: 'Just now'
    };

    setWidgetMessages(prev => [...prev, userMsg]);
    const prompt = widgetInput;
    setWidgetInput('');
    setWidgetThinking(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAgentChatPayload(
          currentSectionLabel,
          [
            {
              role: 'user',
              content: `Current screen: ${currentSectionLabel}\n\n${prompt}`,
            },
          ],
        )),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error?.message || data.error || `Agent request failed with ${response.status}`);
      }
      setWidgetMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'agent',
        text: data.choices?.[0]?.message?.content || data.text || 'No response returned.',
        time: 'Just now'
      }]);
    } catch (err) {
      setWidgetMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'agent',
        text: err instanceof Error ? err.message : 'Agent request failed.',
        time: 'Just now'
      }]);
    } finally {
      setWidgetThinking(false);
    }
  };

  const toggleCat = (catId: string) => {
    setExpandedCats(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Theme configuration effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
      root.classList.remove('light');
      setIsDarkActive(true);
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      setIsDarkActive(false);
    }
  }, [theme]);

  // Keyboard shortcut for Command Menu (Cmd/Ctrl + K)
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

  useEffect(() => {
    setScreenLoading(true);
    const timer = window.setTimeout(() => setScreenLoading(false), reducedMotion ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [activeTab, reducedMotion]);

  useEffect(() => {
    if (sidebarCollapsed) setWorkspaceMenuOpen(false);
  }, [sidebarCollapsed]);

  // Filter commands for search
  const navigationItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'overview' },
    { id: 'projects', label: 'Projects', icon: 'projects' },
    { id: 'services', label: 'Services', icon: 'services' },
    { id: 'agent', label: 'Agentic Operations', icon: 'agent' },
    { id: 'analytics', label: 'Analytics', icon: 'analytics' },
    { id: 'team', label: 'Team', icon: 'team' },
    { id: 'memory', label: 'Memory', icon: 'memory' },
    { id: 'security', label: 'Security', icon: 'security' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  const filteredSearchItems = navigationItems.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const compactNavigationItems = navigationItems.filter(item => item.id !== 'overview');
  const sidebarCategories: Array<{ id: string; label: string; subItems: NavItem[] }> = [
    {
      id: 'compute',
      label: 'Compute',
      subItems: [
        { id: 'projects', label: 'Projects', icon: 'projects' },
      ],
    },
    {
      id: 'services',
      label: 'MVP Services',
      subItems: [
        { id: 'services', label: 'Privacy Pool', icon: 'privacy' },
        { id: 'services', label: 'Transformation', icon: 'transform' },
        { id: 'services', label: 'Trade Pipeline', icon: 'trade' },
        { id: 'services', label: 'Agent Auth', icon: 'auth' },
        { id: 'services', label: 'NFT Service', icon: 'nft' },
        { id: 'services', label: 'De-pin', icon: 'depin' },
      ],
    },
    {
      id: 'intelligence',
      label: 'Intelligence & Memory',
      subItems: [
        { id: 'agent', label: 'Agentic Operations', icon: 'agent' },
        { id: 'memory', label: 'Memory', icon: 'memory' },
      ],
    },
    {
      id: 'security',
      label: 'Security & Insights',
      subItems: [
        { id: 'security', label: 'Security', icon: 'security' },
        { id: 'analytics', label: 'Analytics', icon: 'analytics' },
        { id: 'team', label: 'Team', icon: 'team' },
      ],
    },
    {
      id: 'config',
      label: 'Config & Support',
      subItems: [
        { id: 'settings', label: 'Settings', icon: 'settings' },
      ],
    },
  ];

  if (!userSession) {
    return <AuthOverlay onSuccess={setUserSession} />;
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

  return (
    <div className={`min-h-screen font-sans antialiased text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-[#050505] transition-colors duration-200 ${
      density === 'compact' ? 'text-xs' : 'text-sm'
    }`}>
      {/* AI NOTE: This is the logged-in platform shell. Keep it practical: workspace setup, service readiness, memory, approvals, and security placeholders. */}
      {/* Platform Layout Grid */}
      <div className="flex min-h-screen">

        {/* 1. Persistent Left Sidebar (Desktop) */}
        <div className={`hidden md:block relative shrink-0 z-30 transition-[width] ${reducedMotion ? 'duration-0' : 'duration-300'} ease-[cubic-bezier(0.22,1,0.36,1)] h-screen sticky top-0 ${
          sidebarCollapsed ? 'w-[52px]' : 'w-[252px]'
        }`}>
          <aside className="hidden md:flex flex-col border-r border-zinc-200 dark:border-zinc-900 bg-white dark:bg-black select-none sticky top-0 h-screen overflow-y-auto overflow-x-hidden w-full h-full">
            {/* Sidebar Brand Top */}
            <div className={`h-14 shrink-0 border-b border-zinc-200 dark:border-zinc-900 flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start pl-5 pr-4'}`}>
              {sidebarCollapsed ? (
                <div className="flex h-full w-full items-center justify-center">
                  <img
                    src={BRAND_MARK}
                    alt="ZEXVRO Logo"
                    className="h-[34px] w-[34px] object-contain shrink-0 invert dark:invert-0"
                  />
                </div>
              ) : (
                <div className="flex h-full min-w-0 w-full items-center justify-start gap-2.5 pl-1">
                  <img
                    src={BRAND_MARK}
                    alt="ZEXVRO Logo"
                    className="h-[34px] w-[34px] object-contain shrink-0 invert dark:invert-0"
                  />
                  <img
                    src={BRAND_WORDMARK}
                    alt="ZEXVRO"
                    className="h-[18px] max-w-[148px] shrink-0 translate-y-[1px] object-contain object-left invert dark:invert-0"
                  />
                </div>
              )}
            </div>

            {/* Workspace Switcher & Search Bar */}
            {!sidebarCollapsed ? (
              <>
                <div className="relative mx-2 mt-2 mb-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setWorkspaceMenuOpen(prev => !prev)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 text-left transition hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-xs font-semibold text-brand-blue">
                        {selectedWorkspace.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{selectedWorkspace.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-zinc-400">
                          <span>{selectedWorkspace.plan}</span>
                          <span className="h-1 w-1 rounded-full bg-zinc-500" />
                          <span>{selectedWorkspace.status}</span>
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
                            {workspaces.map(workspace => {
                              const isCurrent = workspace.id === selectedWorkspaceId;
                              return (
                                <button
                                  key={workspace.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedWorkspaceId(workspace.id);
                                    setWorkspaceNotice('');
                                    setWorkspaceMenuOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition ${
                                    isCurrent
                                      ? 'bg-brand-blue/10 text-zinc-950 dark:text-white'
                                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900'
                                  }`}
                                >
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-blue/10 text-[10px] font-semibold text-brand-blue">
                                    {workspace.initials}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                      <span className="block truncate text-xs font-semibold">{workspace.name}</span>
                                      <span className="shrink-0 rounded border border-current/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-zinc-400">
                                        {workspace.status}
                                      </span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-[10px] text-zinc-400">{workspace.detail}</span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <form onSubmit={handleCreateWorkspace} className="space-y-2 border-b border-zinc-100 p-3 dark:border-zinc-900">
                            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                              <Plus className="h-3.5 w-3.5 text-brand-blue" />
                              <span>Create workspace</span>
                            </div>
                            <div className="flex gap-2">
                              <input
                                value={newWorkspaceName}
                                onChange={(event) => setNewWorkspaceName(event.target.value)}
                                placeholder="Workspace name"
                                className="h-9 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-blue dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                              />
                              <button
                                type="submit"
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-blue text-white transition hover:bg-brand-blue/90"
                                title="Create workspace"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </form>

                          <form onSubmit={handleInviteToWorkspace} className="space-y-2 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                                <Mail className="h-3.5 w-3.5 text-brand-blue" />
                                <span className="truncate">Invite to {selectedWorkspace.name}</span>
                              </div>
                              <span className="inline-flex items-center gap-1 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                <Users className="h-3 w-3" />
                                {selectedWorkspaceInvites.length}
                              </span>
                            </div>
                            <div className="space-y-2">
                              <input
                                value={inviteEmail}
                                onChange={(event) => setInviteEmail(event.target.value)}
                                placeholder="teammate@email.com"
                                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-blue dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                              />
                              <select
                                value={inviteRole}
                                onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}
                                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-800 outline-none transition focus:border-brand-blue dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                              >
                                {WORKSPACE_ROLES.map(role => (
                                  <option key={role} value={role}>{role}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="submit"
                              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-800 transition hover:border-brand-blue/50 hover:bg-brand-blue/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Add invite
                            </button>

                            {workspaceNotice && (
                              <p className="rounded-md bg-zinc-50 px-2.5 py-2 text-[10px] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                                {workspaceNotice}
                              </p>
                            )}

                            {selectedWorkspaceInvites.length > 0 && (
                              <div className="space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-900">
                                {selectedWorkspaceInvites.slice(0, 4).map(invite => (
                                  <div key={invite.id} className="flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-2.5 py-2 text-[10px] dark:bg-zinc-950">
                                    <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-200">{invite.email}</span>
                                    <span className="shrink-0 text-zinc-400">{invite.role}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Global Search shortcut block */}
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
              </>
            ) : (
              <div className="flex flex-col items-center gap-3.5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                {/* Search Button for collapsed view */}
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all cursor-pointer flex items-center justify-center shadow-sm"
                  title="Search Workspace (⌘K)"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            )}

          {/* Sidebar Navigation Areas */}
          {sidebarCollapsed ? (
            /* Compact flat list of core views with tooltips when collapsed */
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 flex flex-col items-center gap-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`p-2.5 rounded-lg transition-all cursor-pointer relative group ${
                  activeTab === 'overview'
                    ? 'bg-zinc-150/70 dark:bg-zinc-900 text-brand-blue'
                    : 'text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                }`}
              >
                <CustomIcon name="overview" className="h-5 w-5 shrink-0" />
                <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-100 text-[10px] font-medium tracking-wide opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-md font-sans">
                  Overview
                </div>
              </button>

              <div className="w-8 h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

              {compactNavigationItems.map((item, idx) => {
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={`${item.id}-${idx}`}
                    onClick={() => setActiveTab(item.id)}
                    className={`p-2.5 rounded-lg transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-zinc-150/70 dark:bg-zinc-900 text-brand-blue'
                        : 'text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                    }`}
                  >
                    <NavIcon item={item} className="h-5 w-5 shrink-0" />
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-100 text-[10px] font-medium tracking-wide opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-md font-sans">
                      {item.label}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Cloudflare-style hierarchical menu when expanded */
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-4">
              {/* Direct top-level link for Account Overview */}
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'overview'
                      ? 'bg-zinc-150/70 dark:bg-zinc-900 text-zinc-950 dark:text-white font-semibold'
                      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                  }`}
                >
                  <CustomIcon name="overview" className="h-5 w-5 shrink-0 text-brand-blue" />
                  <span>Overview</span>
                </button>
              </div>

              {/* Cloudflare categories */}
              {sidebarCategories.map((cat) => {
                const isExpanded = expandedCats[cat.id];
                const hasSubItems = cat.subItems.length > 0;
                return (
                  <div key={cat.id} className="space-y-1">
                    {hasSubItems ? (
                      <button
                        onClick={() => toggleCat(cat.id)}
                        className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer text-left font-sans"
                      >
                        <span>{cat.label}</span>
                        <ChevronRight className={`h-2.5 w-2.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                    ) : (
                      <div className="flex w-full items-center justify-between px-3 py-1 text-left font-sans text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        <span>{cat.label}</span>
                        <span className="rounded border border-zinc-200 px-1.5 py-0.5 text-[8px] font-medium normal-case tracking-normal text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
                          Planned
                        </span>
                      </div>
                    )}

                    <AnimatePresence initial={false}>
                      {hasSubItems && isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden space-y-0.5 pl-3 border-l border-zinc-100 dark:border-zinc-800 ml-3.5"
                        >
                          {cat.subItems.map((sub, sIdx) => {
                            // MVP services map to the shared Services screen until service-local routes exist.
                            // Other direct tabs highlight if tab matches.
                            const isSelected = activeTab === sub.id;
                            return (
                              <button
                                key={`${sub.label}-${sIdx}`}
                                onClick={() => setActiveTab(sub.id)}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold'
                                    : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30'
                                }`}
                              >
                                <NavIcon item={sub} className={`h-5 w-5 shrink-0 ${isSelected ? 'text-brand-blue' : 'text-zinc-400'}`} />
                                <span className="truncate">{sub.label}</span>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}

            {/* Support footer */}
            <div className="border-t border-zinc-100 dark:border-zinc-850/40 p-3 shrink-0">
            {!sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="group flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 text-left transition hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/30 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
                    <HelpCircle className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold leading-none text-zinc-855 dark:text-zinc-200">Need help?</span>
                    <span className="mt-1 block truncate text-[10px] text-zinc-400">Contact support</span>
                  </span>
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition group-hover:text-brand-blue" />
              </button>
            ) : (
              <div className="flex justify-center py-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue transition hover:bg-brand-blue/15"
                  title="Contact support"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Floating Collapse Trigger 50-50 on the right border of sidebar, placed aligned with the workspace owner/switcher section level */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden md:flex absolute top-[112px] -right-3 h-6 w-6 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 items-center justify-center cursor-pointer shadow-md hover:scale-105 transition-all duration-200 z-50"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {sidebarCollapsed ? (
              <path d="m9 18 6-6-6-6" />
            ) : (
              <path d="m15 18-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

        {/* 2. Main content container + Top command bar */}
        <div className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-200 ${assistantDockOpen ? 'lg:pr-[430px]' : ''}`}>

          {/* Top header bar */}
          <header className="h-14 border-b border-zinc-200 dark:border-zinc-900 bg-white dark:bg-black flex items-center justify-between px-4 sticky top-0 z-40 shrink-0">
            {/* Left side mobile menu trigger & title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-1.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-500 cursor-pointer"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>

              <div className="flex items-center gap-2.5">
                {/* Mobile-only Logo */}
                <img
                  src={BRAND_MARK}
                  alt="ZEXVRO Logo"
                  className="md:hidden h-6 w-6 object-contain shrink-0 invert dark:invert-0"
                />

                {/* Workspace breadcrumb with current section name */}
                <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400 hidden sm:inline">{selectedWorkspace.name}</span>
                  <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>
                  <span className="font-semibold text-zinc-900 dark:text-white capitalize tracking-tight px-2 py-0.5 rounded bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-800">
                    {currentSectionLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Right side operational controls */}
            <div className="flex items-center gap-2.5 relative">
              <button
                onClick={() => setActiveTab('settings')}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
              >
                <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                Support
              </button>

              {/* Search toggle for tablets/mobile */}
              <button
                onClick={() => setSearchOpen(true)}
                className="md:hidden p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
              >
                <Search className="h-4.5 w-4.5" />
              </button>

              {/* User Dropdown Button with Profile Settings & Theme Toggle */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1 px-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer text-xs font-medium transition-all"
                  title="User Profile & Settings"
                >
                  <User className="h-4 w-4 text-zinc-500" />
                  <span className="hidden sm:inline text-zinc-600 dark:text-zinc-400">Workspace</span>
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] shadow-lg z-50 py-1 text-xs">
                      {/* User Info Section */}
                      <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-900">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Current User</p>
                        <p className="font-semibold text-zinc-900 dark:text-white truncate mt-0.5">{userSession?.username || 'Workspace user'}</p>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">{userSession?.email || 'dev@zexvro.local'}</p>
                      </div>

                      {/* Menu Options */}
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setTheme(theme === 'dark' ? 'light' : 'dark');
                            setUserMenuOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            {isDarkActive ? <Sun className="h-3.5 w-3.5 text-zinc-500" /> : <Moon className="h-3.5 w-3.5 text-zinc-500" />}
                            Theme: {isDarkActive ? 'Light Mode' : 'Dark Mode'}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveTab('settings');
                            setUserMenuOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Settings className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Settings</span>
                        </button>

                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            globalSignOut(userSession?.token).finally(() => {
                              localStorage.removeItem('zexvro_user_session');
                              setUserSession(null);
                            });
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer transition-colors border-t border-zinc-100 dark:border-zinc-900 mt-1 pt-2"
                        >
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

          {/* Main Content Arena with full width to cover screens beautifully */}
          <main className="flex-1 p-4 sm:p-6 overflow-y-auto w-full">
            <div className="space-y-6">

              {/* Screen Tab Router Container with Motion transitions */}
              <div className="space-y-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
                  >
                    {screenLoading ? (
                      <ScreenSkeleton />
                    ) : activeTab === 'overview' && (
                      <Overview
                        setActiveTab={setActiveTab}
                        setOpenNewProjectModal={setOpenNewProjectModal}
                        setOpenInviteTeammateModal={setOpenInviteTeammateModal}
                        setOpenNewMemoryModal={setOpenNewMemoryModal}
                        isDark={isDarkActive}
                        services={services}
                        cliConnected={cliConnected}
                        cliLastActive={cliLastActive}
                      />
                    )}
                    {!screenLoading && activeTab === 'projects' && (
                      <Projects
                        projects={projects}
                        setProjects={setProjects}
                        openNewModal={openNewProjectModal}
                        setOpenNewModal={setOpenNewProjectModal}
                        setActiveTab={setActiveTab}
                      />
                    )}
                    {!screenLoading && activeTab === 'deployments' && (
                      <Deployments
                        deployments={deployments}
                        setDeployments={setDeployments}
                      />
                    )}
                    {!screenLoading && activeTab === 'services' && (
                      <Services
                        services={services}
                        setServices={setServices}
                      />
                    )}
                    {!screenLoading && activeTab === 'agent' && (
                      <AgentStudio
                        cliConnected={cliConnected}
                        cliLastActive={cliLastActive}
                      />
                    )}
                    {!screenLoading && activeTab === 'analytics' && (
                      <Analytics
                        isDark={isDarkActive}
                      />
                    )}
                    {!screenLoading && activeTab === 'team' && (
                      <Team
                        teamMembers={teamMembers}
                        setTeamMembers={setTeamMembers}
                        openInviteModal={openInviteTeammateModal}
                        setOpenInviteModal={setOpenInviteTeammateModal}
                      />
                    )}
                    {!screenLoading && activeTab === 'memory' && (
                      <Memory
                        memoryEntries={memoryEntries}
                        setMemoryEntries={setMemoryEntries}
                        openNewMemoryModal={openNewMemoryModal}
                        setOpenNewMemoryModal={setOpenNewMemoryModal}
                      />
                    )}
                    {!screenLoading && activeTab === 'security' && (
                      <Security />
                    )}
                    {!screenLoading && activeTab === 'settings' && (
                      <SettingsView
                        theme={theme}
                        setTheme={setTheme}
                        density={density}
                        setDensity={setDensity}
                        reducedMotion={reducedMotion}
                        setReducedMotion={setReducedMotion}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

            </div>
          </main>

        </div>
      </div>

      {/* 4. Responsive Mobile Navigation Sheets Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-black"
            ></motion.div>

            {/* Mobile Drawer panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-xs bg-white dark:bg-[#0A0A0B] border-r border-zinc-200 dark:border-zinc-800 p-5 flex flex-col justify-between"
            >
              <div className="space-y-5">
                {/* Brand close bar */}
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <img
                    src={BRAND_MARK}
                    alt="ZEXVRO Logo"
                    className="h-8 w-8 object-contain shrink-0 invert dark:invert-0"
                  />
                  <img
                    src={BRAND_WORDMARK}
                    alt="ZEXVRO"
                    className="h-4.5 object-contain max-w-[130px] invert dark:invert-0"
                  />
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200" title="Close menu">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Navigation links list */}
                <div className="space-y-1 text-xs">
                  {navigationItems.map((item) => {
                    const isSelected = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg font-semibold transition-all ${
                          isSelected
                            ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-white'
                            : 'text-zinc-400'
                        }`}
                      >
                        <NavIcon item={item} className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile support action */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('settings');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-left text-xs dark:border-zinc-800"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
                    <HelpCircle className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-zinc-800 dark:text-zinc-200">Need help?</span>
                    <span className="text-[10px] text-zinc-400">Contact support</span>
                  </span>
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Global Command Search Modal Menu (Cmd + K) */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSearchOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            ></motion.div>

            {/* Search Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="relative w-full max-w-lg overflow-hidden rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] shadow-2xl z-10 p-2"
            >
              {/* Search Input */}
              <div className="flex items-center gap-2 px-3 border-b border-zinc-100 dark:border-zinc-800 pb-2.5 pt-1.5">
                <Search className="h-4.5 w-4.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Type a screen or operation command..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => setSearchOpen(false)}
                  className="text-[10px] border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 hover:text-zinc-600"
                >
                  ESC
                </button>
              </div>

              {/* Suggestions */}
              <div className="mt-2.5 max-h-[220px] overflow-y-auto text-xs">
                {filteredSearchItems.length === 0 ? (
                  <p className="p-3 text-center text-zinc-400 text-[11px]">No matching screens or commands found.</p>
                ) : (
                  filteredSearchItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-md flex items-center justify-between group transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300">
                        <NavIcon item={item} className="h-5 w-5 text-zinc-400 group-hover:text-brand-blue" />
                        <span>Navigate to {item.label}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100">Jump ↵</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Docked Morph Assistant. It has no page backdrop, so the workspace stays visible and usable. */}
      {activeTab !== 'agent' && (
        <>
          <AnimatePresence>
            {agentWidgetOpen && (
              <motion.aside
                initial={{ x: 430 }}
                animate={{ x: 0 }}
                exit={{ x: 430 }}
                transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[430px] flex-col border-l border-white/10 bg-zinc-950/88 shadow-2xl shadow-black/30 backdrop-blur-xl"
                aria-label="Morph workspace assistant"
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
                    <button
                      onClick={() => {
                        setActiveTab('agent');
                        setAgentWidgetOpen(false);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/10 hover:text-white"
                      title="Open Agentic Operations"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setAgentWidgetOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/10 hover:text-white"
                      title="Close Morph Assistant"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3 text-sm text-zinc-200">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span>Page-aware workspace help</span>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                  {widgetMessages.length === 0 && !widgetThinking ? (
                    <div className="flex min-h-full flex-col justify-center">
                      <div className="mb-10 flex justify-center">
                        <img src={MORPH_ILLUSTRATION} alt="Morph assistant" className="h-36 w-36 object-contain" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-2xl font-semibold tracking-tight text-white">
                          Hello, workspace
                        </h4>
                        <p className="text-xl font-semibold text-zinc-400">
                          Ask Morph anything.
                        </p>
                      </div>
                      <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-500">
                        Messages are sent to the same opencode proxy as Agentic Operations.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 text-sm">
                      {widgetMessages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[88%] rounded-lg px-4 py-3 ${
                            msg.sender === 'user'
                              ? 'bg-violet-500 text-white'
                              : 'border border-white/10 bg-white/[0.05] text-zinc-100'
                          }`}>
                            <p className="whitespace-pre-line leading-6">{msg.text}</p>
                          </div>
                          <span className="mt-1 px-1 text-xs text-zinc-500">{msg.time}</span>
                        </div>
                      ))}
                      {widgetThinking && (
                        <div className="flex items-center gap-2 text-sm italic text-zinc-400">
                          <span className="flex gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400"></span>
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0.2s]"></span>
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0.4s]"></span>
                          </span>
                          Morph is preparing a safe proposal...
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-white/10 p-4">
                  <form onSubmit={handleSendWidgetMessage} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 shadow-inner">
                    <input
                      type="text"
                      value={widgetInput}
                      onChange={(e) => setWidgetInput(e.target.value)}
                      placeholder="Ask Morph"
                      className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!widgetInput.trim() || widgetThinking}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-500 text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Morph can make mistakes. Review proposals before approval.
                  </p>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {!agentWidgetOpen && (
            <button
              onClick={() => setAgentWidgetOpen(true)}
              className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center justify-center rounded-l-lg border-y border-l border-zinc-200 bg-white/85 px-2.5 py-3 shadow-lg shadow-zinc-950/10 backdrop-blur-md transition hover:pl-4 dark:border-white/10 dark:bg-black/70"
              title="Open Morph Assistant"
            >
              <img src={MORPH_LOGO} alt="Morph Assistant" className="h-6 w-6 shrink-0 object-contain invert dark:invert-0" />
            </button>
          )}
        </>
      )}

    </div>
  );
}
