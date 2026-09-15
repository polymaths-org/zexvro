import React, { useState } from 'react';
import {
  Search,
  Bell,
  Sun,
  Moon,
  Monitor,
  User,
  Settings,
  LogOut,
  Layers,
  Code,
  BookOpen,
  Check,
  Menu,
  X,
  Plus,
  Compass,
  House,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getAvatarForUser, prettyName } from '../../utils/avatar';

export const TopNav: React.FC = () => {
  const {
    route,
    navigate,
    theme,
    setTheme,
    setIsCommandPaletteOpen,
    sessionUser,
    signOut,
    notifications,
    markAllNotificationsRead,
    isSidebarOpen,
    toggleSidebar
  } = useApp();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const isContractsActive =
    route.page === 'browse' ||
    route.page.startsWith('contract-') ||
    route.page.startsWith('file-') ||
    route.page.startsWith('function-');
  const isStudioActive = route.page.startsWith('studio');

  const iconNavBtn = (active: boolean) =>
    `p-2 rounded-[6px] transition-all cursor-pointer ${
      active
        ? 'text-[#FAFAFA] bg-[#1A1A1E] border border-[#343D54] shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
        : 'text-[#8C93A3] hover:text-[#FAFAFA] hover:bg-[#161924] border border-transparent'
    }`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#232838] bg-[#0A0A0B]/95 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
      <div className="relative w-full mx-auto pl-1 pr-4 sm:pr-6 h-14 flex items-center justify-between gap-3">

        {/* Left: sidebar toggle + Handshake brand */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden lg:inline-flex p-2 rounded-[6px] text-[#8C93A3] hover:text-[#FAFAFA] hover:bg-[#161924] transition-colors"
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate({ page: 'home' })}
            className="flex items-center gap-2 text-left group cursor-pointer"
          >
            <img
              src="/handshake-logo.png"
              alt="Handshake logo"
              className="w-8 h-8 rounded-[6px] object-cover shadow-sm"
            />
            <span className="font-display font-bold uppercase tracking-[0.14em] text-[13px] text-[#FAFAFA] hidden sm:inline">
              Handshake
            </span>
          </button>
        </div>

        {/* Center Search — floating pill trigger, perfectly centered */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:block w-full max-w-md px-4 pointer-events-none">
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="pointer-events-auto w-full flex items-center justify-between gap-2 pl-4 pr-2 py-1.5 rounded-[8px] bg-[#131622]/80 backdrop-blur-md border border-white/10 hover:border-[#3B82F6]/50 text-xs font-mono text-[#71788A] transition-all cursor-pointer shadow-[0_8px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_8px_32px_rgba(59,130,246,0.18),inset_0_1px_0_rgba(255,255,255,0.06)] hover:text-[#9BA2B0]"
          >
            <div className="flex items-center gap-2.5 truncate">
              <Search className="w-3.5 h-3.5 text-[#71788A] shrink-0" />
              <span className="truncate">Search contracts, functions, AST, address…</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[6px] bg-[#1C202E] border border-[#2B3144] text-[10px] font-mono text-[#9BA2B0] shadow-xs shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: icon-only section nav + actions */}
        <div className="flex items-center gap-1 shrink-0">

          {/* Mobile search trigger */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="p-2 lg:hidden rounded-[6px] text-[#9BA2B0] hover:text-[#FAFAFA] hover:bg-[#181C2A] transition-colors"
            title="Search"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Icon-only section nav */}
          <nav className="hidden md:flex items-center gap-1 mr-1" aria-label="Sections">
            <button
              type="button"
              onClick={() => navigate({ page: 'home' })}
              className={iconNavBtn(route.page === 'home')}
              title="Home"
              aria-label="Home"
            >
              <House className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'explore' })}
              className={iconNavBtn(route.page === 'explore')}
              title="Explore"
              aria-label="Explore"
            >
              <Compass className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'browse' })}
              className={iconNavBtn(isContractsActive)}
              title="Contracts"
              aria-label="Contracts"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'studio-launcher' })}
              className={iconNavBtn(isStudioActive)}
              title="Studio"
              aria-label="Studio"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'collections' })}
              className={iconNavBtn(route.page === 'collections')}
              title="Collections"
              aria-label="Collections"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          </nav>

          {/* Create — expands with a dot-matrix sweep into the publish canvas */}
          <button
            type="button"
            onClick={() => navigate({ page: 'publish' })}
            className="group relative overflow-hidden hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold transition-all shadow-[0_1px_6px_rgba(59,130,246,0.45)] active:scale-95"
            title="Create new contract"
            aria-label="Create new contract"
          >
            <span className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true"
              style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
            <span className="absolute inset-0 bg-white/25 scale-x-0 group-hover:scale-x-100 group-active:scale-x-100 origin-left transition-transform duration-300" aria-hidden="true" />
            <Plus className="relative w-3.5 h-3.5 stroke-[2.5] transition-transform duration-300 group-hover:rotate-90" />
            <span className="relative">Create</span>
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsProfileOpen(false);
              }}
              className="relative p-2 rounded-[6px] text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B] transition-colors"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#3B82F6]" />
              )}
            </button>

            {/* Notification Dropdown */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-[8px] border border-[#27272A] bg-[#111113] p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#27272A]">
                  <span className="text-xs font-semibold text-[#FAFAFA]">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-[11px] text-[#3B82F6] hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        navigate({ page: 'notifications' });
                      }}
                      className="p-2 rounded-[6px] hover:bg-[#18181B] cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center justify-between text-[#71717A] text-[10px] font-mono mb-1">
                        <span className="uppercase text-[#A1A1AA]">{n.type}</span>
                        <span>{n.time}</span>
                      </div>
                      <p className="font-medium text-[#FAFAFA] line-clamp-1">{n.title}</p>
                      <p className="text-[#A1A1AA] text-[11px] line-clamp-2 mt-0.5">
                        {n.description}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="pt-2 mt-2 border-t border-[#27272A] text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      navigate({ page: 'notifications' });
                    }}
                    className="text-xs text-[#A1A1AA] hover:text-[#FAFAFA]"
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Avatar & Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsNotificationsOpen(false);
              }}
              className="flex items-center gap-1.5 p-0.5 rounded-full border border-[#27272A] hover:border-[#3F3F46] transition-colors"
              title="Account"
              aria-label="Account"
            >
              <img
                src={getAvatarForUser(sessionUser || 'guest')}
                alt={sessionUser || 'guest'}
                className="w-6 h-6 rounded-full object-cover"
              />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-[8px] border border-[#27272A] bg-[#111113] p-1.5 shadow-xl z-50 text-xs font-sans">
                <div className="px-2.5 py-2 border-b border-[#27272A] mb-1">
                  {sessionUser ? (
                    <>
                      <p className="font-medium text-[#FAFAFA]">{prettyName(sessionUser)}</p>
                      <p className="text-[#71717A] text-[11px]">@{sessionUser}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-[#FAFAFA]">Not signed in</p>
                      <p className="text-[#71717A] text-[11px]">Sign in to publish & fork</p>
                    </>
                  )}
                </div>

                {sessionUser ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate({ page: 'profile', username: sessionUser });
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA]"
                    >
                      <User className="w-3.5 h-3.5" />
                      Your Profile
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate({ page: 'settings' });
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA]"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Settings
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate({ page: 'login' });
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold mb-1"
                    >
                      <User className="w-3.5 h-3.5" />
                      Sign in
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate({ page: 'signup' });
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA] border border-[#27272A]"
                    >
                      <User className="w-3.5 h-3.5" />
                      Create account
                    </button>
                  </>
                )}

                <div className="border-t border-[#27272A] my-1" />

                <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-[#71717A]">
                  Theme
                </div>
                {(['dark', 'light', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[4px] hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA] capitalize"
                  >
                    <span className="flex items-center gap-2">
                      {t === 'dark' && <Moon className="w-3.5 h-3.5" />}
                      {t === 'light' && <Sun className="w-3.5 h-3.5" />}
                      {t === 'system' && <Monitor className="w-3.5 h-3.5" />}
                      {t}
                    </span>
                    {theme === t && <Check className="w-3.5 h-3.5 text-[#22C55E]" />}
                  </button>
                ))}

                <div className="border-t border-[#27272A] my-1" />

                {sessionUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      signOut();
                      navigate({ page: 'home' });
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] hover:bg-[#EF4444]/10 text-[#EF4444]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 md:hidden rounded-[6px] text-[#A1A1AA] hover:text-[#FAFAFA]"
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

        </div>
      </div>

      {/* Mobile Menu dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[#27272A] bg-[#0A0A0B] px-4 py-3 space-y-2">
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate({ page: 'publish' });
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-[6px] transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Create new contract
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate({ page: 'home' });
            }}
            className="w-full text-left px-3 py-2 text-sm text-[#FAFAFA] rounded hover:bg-[#18181B]"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate({ page: 'explore' });
            }}
            className="w-full text-left px-3 py-2 text-sm text-[#FAFAFA] rounded hover:bg-[#18181B]"
          >
            Explore
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate({ page: 'browse' });
            }}
            className="w-full text-left px-3 py-2 text-sm text-[#FAFAFA] rounded hover:bg-[#18181B]"
          >
            Contracts
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate({ page: 'studio-launcher' });
            }}
            className="w-full text-left px-3 py-2 text-sm text-[#FAFAFA] rounded hover:bg-[#18181B]"
          >
            Contract Studio
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate({ page: 'collections' });
            }}
            className="w-full text-left px-3 py-2 text-sm text-[#FAFAFA] rounded hover:bg-[#18181B]"
          >
            Collections
          </button>
        </div>
      )}
    </header>
  );
};
