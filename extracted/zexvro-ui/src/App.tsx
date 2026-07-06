import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, FolderKanban, Rocket, Blocks, Bot, 
  ChartNoAxesCombined, Users, Brain, ShieldCheck, Settings,
  Radio, Lock, KeyRound, Sparkles,
  Search, Menu, X, ChevronRight, User, 
  HelpCircle, Sun, Moon, RefreshCw 
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

export default function App() {
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
  const [widgetMessages, setWidgetMessages] = useState([
    {
      id: 1,
      sender: 'agent',
      text: 'I can help review setup tasks, summarize memory entries, prepare service checklists, and flag actions that need approval. No backend actions are connected yet.',
      time: 'Just now'
    }
  ]);
  const [widgetInput, setWidgetInput] = useState('');
  const [widgetThinking, setWidgetThinking] = useState(false);

  const handleSendWidgetMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!widgetInput.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: widgetInput,
      time: 'Just now'
    };

    setWidgetMessages(prev => [...prev, userMsg]);
    const prompt = widgetInput;
    setWidgetInput('');
    setWidgetThinking(true);

    setTimeout(() => {
      let reply = "I can draft the next UI or service setup step, but I will keep it as a proposal until a developer approves it.";
      if (prompt.toLowerCase().includes('audit') || prompt.toLowerCase().includes('log')) {
        reply = "I would review memory entries, blockers, and security notes first. Current rule: do not paste raw logs into memory; summarize decisions and handoffs.";
      } else if (prompt.toLowerCase().includes('transform') || prompt.toLowerCase().includes('trigger')) {
        reply = "Transformation is not connected to a backend yet. I can prepare a migration checklist and mark the action as needing approval.";
      } else if (prompt.toLowerCase().includes('help') || prompt.toLowerCase().includes('hello')) {
        reply = "Useful commands for this prototype: review setup state, create a service checklist, prepare a memory note, or open the security policy draft.";
      }

      setWidgetMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'agent',
        text: reply,
        time: 'Just now'
      }]);
      setWidgetThinking(false);
    }, 1200);
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

  // Filter commands for search
  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'deployments', label: 'Deployments', icon: Rocket },
    { id: 'services', label: 'Services', icon: Blocks },
    { id: 'agent', label: 'Agent Studio', icon: Bot },
    { id: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const filteredSearchItems = navigationItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <div className={`h-14 shrink-0 border-b border-zinc-200 dark:border-zinc-900 flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start px-4'}`}>
              {sidebarCollapsed ? (
                <div className="w-full flex items-center justify-center pt-2">
                  <img 
                    src={BRAND_MARK} 
                    alt="ZEXVRO Logo" 
                    className="h-[34px] w-[34px] object-contain shrink-0 invert dark:invert-0"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 min-w-0 w-full justify-start pt-2 pl-0.5">
                  <img 
                    src={BRAND_MARK} 
                    alt="ZEXVRO Logo" 
                    className="h-9 w-9 object-contain shrink-0 invert dark:invert-0"
                  />
                  <img 
                    src={BRAND_WORDMARK} 
                    alt="ZEXVRO" 
                    className="h-[22px] object-contain max-w-[130px] shrink-0 mt-0.5 invert dark:invert-0"
                  />
                </div>
              )}
            </div>

            {/* Workspace Switcher & Search Bar */}
            {!sidebarCollapsed ? (
              <>
                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 m-2 rounded-lg shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate font-sans">ZEXVRO Workspace</span>
                      <span className="text-[10px] text-zinc-400 font-sans">Prototype</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold bg-brand-blue/10 text-brand-blue uppercase tracking-wide">Testnet</span>
                  </div>
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
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-zinc-900 dark:bg-zinc-800 text-white dark:text-zinc-100 text-[10px] font-medium tracking-wide opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-md font-sans">
                  Overview
                </div>
              </button>
              
              <div className="w-8 h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

              {[
                { id: 'projects', label: 'Projects', icon: FolderKanban },
                { id: 'deployments', label: 'Deployments', icon: Rocket },
                { id: 'services', label: 'Services', icon: Blocks },
                { id: 'agent', label: 'Agent Studio', icon: Bot },
                { id: 'memory', label: 'Memory', icon: Brain },
                { id: 'security', label: 'Security', icon: ShieldCheck },
                { id: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
                { id: 'team', label: 'Team', icon: Users },
                { id: 'settings', label: 'Settings', icon: Settings }
              ].map((item, idx) => {
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
                    <item.icon className="h-4 w-4 shrink-0" />
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
                  <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-brand-blue" />
                  <span>Overview</span>
                </button>
              </div>

              {/* Cloudflare categories */}
              {[
                {
                  id: 'compute',
                  label: 'Compute & Deploy',
                  subItems: [
                    { id: 'projects', label: 'Projects', icon: FolderKanban },
                    { id: 'deployments', label: 'Deployments', icon: Rocket },
                  ]
                },
                {
                  id: 'services',
                  label: 'MVP Services',
                  subItems: [
                    { id: 'services', label: 'Privacy Pool', icon: Lock },
                    { id: 'services', label: 'Transformation', icon: Brain },
                    { id: 'services', label: 'Trade Pipeline', icon: RefreshCw },
                    { id: 'services', label: 'Agent Auth', icon: KeyRound },
                    { id: 'services', label: 'NFT Service', icon: Blocks },
                    { id: 'services', label: 'De-pin', icon: Radio },
                  ]
                },
                {
                  id: 'intelligence',
                  label: 'Intelligence & Memory',
                  subItems: [
                    { id: 'agent', label: 'Agent Studio', icon: Bot },
                    { id: 'memory', label: 'Memory', icon: Brain },
                  ]
                },
                {
                  id: 'security',
                  label: 'Security & Insights',
                  subItems: [
                    { id: 'security', label: 'Security', icon: ShieldCheck },
                    { id: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
                    { id: 'team', label: 'Team', icon: Users },
                  ]
                },
                {
                  id: 'config',
                  label: 'Config & Support',
                  subItems: [
                    { id: 'settings', label: 'Settings', icon: Settings }
                  ]
                }
              ].map((cat) => {
                const isExpanded = expandedCats[cat.id];
                return (
                  <div key={cat.id} className="space-y-1">
                    <button
                      onClick={() => toggleCat(cat.id)}
                      className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer text-left font-sans"
                    >
                      <span>{cat.label}</span>
                      <ChevronRight className={`h-2.5 w-2.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
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
                            const SubIcon = sub.icon || Blocks;
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
                                <SubIcon className={`h-3 w-3 shrink-0 ${isSelected ? 'text-brand-blue' : 'text-zinc-400'}`} />
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

            {/* Pinned workspace footer */}
            <div className="border-t border-zinc-100 dark:border-zinc-850/40 p-3 shrink-0">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-2.5 px-1 py-0.5">
                <div className="h-7 w-7 rounded-full bg-brand-blue/10 text-brand-blue font-bold flex items-center justify-center text-xs shrink-0">
                  ZX
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-zinc-855 dark:text-zinc-200 truncate leading-none">Workspace</span>
                  <span className="text-[10px] text-zinc-400 truncate block mt-1">Local prototype</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-1">
                <div className="h-7 w-7 rounded-full bg-brand-blue/10 text-brand-blue font-bold flex items-center justify-center text-xs shrink-0">
                  ZX
                </div>
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
        <div className="flex-1 flex flex-col min-w-0">
          
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
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400 hidden sm:inline">ZEXVRO</span>
                  <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>
                  <span className="font-semibold text-zinc-900 dark:text-white capitalize tracking-tight px-2 py-0.5 rounded bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-150 dark:border-zinc-800">
                    {activeTab === 'agent' ? 'Agent Studio' : activeTab === 'services' ? 'Services' : activeTab === 'memory' ? 'Memory' : activeTab === 'security' ? 'Security' : activeTab === 'analytics' ? 'Analytics' : activeTab === 'team' ? 'Team' : activeTab}
                  </span>
                </div>
              </div>
            </div>

            {/* Right side operational controls */}
            <div className="flex items-center gap-2.5 relative">
              <button
                onClick={() => setAgentWidgetOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
              >
                <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
                Ask AI
              </button>

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
                  className="flex items-center gap-2 p-1 px-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer text-xs font-mono font-medium transition-all"
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
                        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Current User</p>
                        <p className="font-semibold text-zinc-900 dark:text-white truncate mt-0.5">Workspace user</p>
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">Workspace: ZEXVRO Prototype</p>
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
                      <AgentStudio />
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
                        className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg font-mono font-semibold transition-all ${
                          isSelected
                            ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-white'
                            : 'text-zinc-400'
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Profile info */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex items-center gap-3 text-xs font-mono">
                <div className="h-7 w-7 rounded-full bg-brand-blue/10 text-brand-blue font-bold flex items-center justify-center">
                  ZX
                </div>
                <div>
                  <span className="block font-bold text-zinc-800 dark:text-zinc-200">Workspace</span>
                  <span className="text-[10px] text-zinc-400">Local prototype</span>
                </div>
              </div>
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
                  className="text-[10px] font-mono border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 hover:text-zinc-600"
                >
                  ESC
                </button>
              </div>

              {/* Suggestions */}
              <div className="mt-2.5 max-h-[220px] overflow-y-auto font-mono text-xs">
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
                        <item.icon className="h-4 w-4 text-zinc-400 group-hover:text-brand-blue" />
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

      {/* 5. Sliding Agent Widget Sheet (Drawer) with Backdrop Blur */}
      <AnimatePresence>
        {agentWidgetOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop with blurring effect */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAgentWidgetOpen(false)}
              className="absolute inset-0 bg-black/25 dark:bg-black/55 backdrop-blur-md"
            ></motion.div>

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
              className="relative w-full max-w-md h-full border-l border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] shadow-2xl p-6 flex flex-col z-10"
            >
              {/* Header inside the drawer */}
              <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-850 pb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-brand-purple/10 text-brand-purple">
                    <Brain className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-955 dark:text-white font-mono">ZEXVRO Assistant</h3>
                    <p className="text-[10px] text-zinc-400 font-mono">Prototype • approval-first</p>
                  </div>
                </div>
                <button 
                  onClick={() => setAgentWidgetOpen(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 rounded-md font-medium cursor-pointer transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  Dismiss
                </button>
              </div>

              {/* Dynamic interactive assistant sheet. Keep actions mocked until backend approval flows exist. */}
              <div className="flex-1 mt-5 rounded-lg border border-brand-purple/15 bg-zinc-50/20 dark:bg-zinc-950/20 p-4 space-y-4 flex flex-col min-h-0">
                <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-850 pb-2.5 shrink-0">
                  <span className="text-[10px] font-semibold text-brand-purple uppercase tracking-wider flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-purple"></span>
                    Workspace Assistant
                  </span>
                  <span className="text-[9px] font-mono text-zinc-400">Local mock</span>
                </div>

                {/* Message history - Scrollable */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                  {widgetMessages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-2.5 rounded-lg max-w-[90%] ${
                        msg.sender === 'user' 
                          ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-tr-none' 
                          : 'bg-brand-purple/5 border border-brand-purple/15 text-zinc-800 dark:text-zinc-200 rounded-tl-none'
                      }`}>
                        <p className="leading-relaxed whitespace-pre-line text-[11px]">{msg.text}</p>
                      </div>
                      <span className="text-[9px] text-zinc-400 mt-0.5 px-1">{msg.time}</span>
                    </div>
                  ))}

                  {widgetThinking && (
                    <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 italic text-[10px] pl-1">
                      <span className="flex gap-1">
                        <span className="h-1 w-1 bg-zinc-400 rounded-full animate-bounce"></span>
                        <span className="h-1 w-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                        <span className="h-1 w-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      </span>
                      Assistant is preparing a safe proposal...
                    </div>
                  )}
                </div>

                {/* Suggestion Quick Chips */}
                <div className="flex flex-wrap gap-1.5 pb-1 shrink-0">
                  {[
                    { label: 'Review memory', text: 'Audit recent memory entries' },
                    { label: 'Setup plan', text: 'Create a service setup checklist' }
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => {
                        setWidgetInput(chip.text);
                      }}
                      className="px-2 py-1 rounded bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-150 dark:border-zinc-800 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 transition-all cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Chat input form */}
                <form onSubmit={handleSendWidgetMessage} className="flex gap-1.5 shrink-0 pt-1">
                  <input
                    type="text"
                    value={widgetInput}
                    onChange={(e) => setWidgetInput(e.target.value)}
                    placeholder="Instruct agent..."
                    className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-150 placeholder-zinc-400 focus:outline-none focus:border-brand-purple transition-all"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded bg-brand-purple text-white text-xs font-semibold hover:bg-brand-purple/90 transition-all cursor-pointer"
                  >
                    Send
                  </button>
                </form>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Right Agent Tab Trigger (Brain) */}
      <button
        onClick={() => setAgentWidgetOpen(!agentWidgetOpen)}
        className="fixed right-0 bottom-12 z-40 rounded-l-lg border-y border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] text-brand-purple hover:text-brand-purple/80 hover:bg-zinc-50 dark:hover:bg-zinc-900 p-2.5 shadow-md hover:pl-3.5 transition-all cursor-pointer flex items-center justify-center"
        title={agentWidgetOpen ? "Collapse ZEXVRO Assistant" : "Expand ZEXVRO Assistant"}
      >
        <Brain className="h-4.5 w-4.5 text-brand-purple shrink-0" />
      </button>

    </div>
  );
}
