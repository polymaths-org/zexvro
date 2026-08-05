import React, { useRef, useState, useEffect } from 'react';
import { User } from '../types';
import { 
  Search, 
  Flame, 
  Trophy, 
  Github, 
  LogOut,
  ChevronDown,
  User as UserIcon,
  Settings,
  ShieldCheck,
  LayoutDashboard
} from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
  user: User;
  onOpenLogin: () => void;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  hideSearch?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenLogin,
  onLogout,
  searchQuery,
  setSearchQuery,
  hideSearch,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const MenuItem: React.FC<{
    onClick: () => void;
    icon: React.ReactNode;
    children: React.ReactNode;
    danger?: boolean;
  }> = ({ onClick, icon, children, danger }) => (
    <button
      onClick={() => {
        setMenuOpen(false);
        onClick();
      }}
      className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center gap-2 transition-colors font-medium ${
        danger ? 'text-red-300 hover:text-red-200 hover:bg-red-950/50' : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );

  return (
    <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-6 py-3 flex items-center justify-between">
      {/* ZEXVRO Brand */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => window.location.href = '#'} 
          className="flex items-center gap-3 group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg"
          aria-label="ZEXVRO Labs home"
        >
          <motion.img
            whileHover={{ opacity: 0.9 }}
            whileTap={{ scale: 0.97 }}
            src="/brand/logo.png"
            alt="ZEXVRO"
            className="w-9 h-9 object-contain"
          />
          <div className="flex items-center gap-2">
              <img
                src="/brand/wordmark.png"
                alt="ZEXVRO"
                className="h-5 object-contain w-auto group-hover:opacity-90 transition-opacity"
              />
              <span className="text-[10px] font-mono uppercase tracking-widest bg-zinc-900 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-md font-bold">
                LABS
              </span>
            </div>
        </button>
      </div>

      {/* Center Search Bar — hidden while running a lab to reduce distraction */}
      {!hideSearch && (
        <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search labs, Solidity, DeFi, NFTs, ZK-proofs, DAOs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search labs"
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-mono"
            />
          </div>
        </div>
      )}

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Streak & XP Display - Monochrome Style */}
        <div className="hidden sm:flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-mono">
          <div className="flex items-center gap-1.5 text-zinc-200" title="Daily Streak">
            <Flame className="h-4 w-4 text-white animate-pulse" />
            <span className="font-bold">{user.streakDays}d Streak</span>
          </div>
          <div className="h-3 w-[1px] bg-zinc-800" />
          <div className="flex items-center gap-1.5 text-white" title="Experience Points">
            <Trophy className="h-4 w-4 text-zinc-300" />
            <span className="font-bold">{user.xp.toLocaleString()} XP</span>
          </div>
        </div>

        {/* User / GitHub Login */}
        {user.githubConnected ? (
          <div className="relative" ref={menuRef}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setMenuOpen((o) => !o)}
              className={`flex items-center gap-2.5 bg-zinc-900 border rounded-xl px-2.5 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                menuOpen ? 'border-zinc-500' : 'border-zinc-700 hover:border-zinc-500'
              }`}
              aria-label="User menu"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-7 w-7 rounded-lg object-cover ring-1 ring-white/50 grayscale"
              />
              <div className="text-left hidden xl:block">
                <div className="text-xs font-semibold text-zinc-200 leading-tight">{user.name}</div>
                <div className="text-[10px] text-zinc-400 font-mono">@{user.username}</div>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </motion.button>

            {/* Dropdown menu */}
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="absolute right-0 top-full mt-2 w-64 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2 z-50"
                role="menu"
              >
                <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center gap-2.5">
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/40 grayscale"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-zinc-100 truncate">{user.name}</p>
                    <p className="text-[10px] text-zinc-400 font-mono truncate">{user.email || `@${user.username}`}</p>
                  </div>
                </div>

                <div className="pt-1.5">
                  <MenuItem icon={<LayoutDashboard className="h-3.5 w-3.5" />} onClick={() => (window.location.href = '#/dashboard')}>
                    Dashboard
                  </MenuItem>
                  <MenuItem icon={<UserIcon className="h-3.5 w-3.5" />} onClick={() => (window.location.href = '#/profile')}>
                    My profile
                  </MenuItem>
                  {user.role === 'admin' && (
                    <MenuItem icon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => (window.location.href = '#/admin/labs')}>
                      Admin panel
                    </MenuItem>
                  )}
                  <MenuItem icon={<Settings className="h-3.5 w-3.5" />} onClick={() => {}}>
                    Settings
                  </MenuItem>

                  <div className="border-t border-zinc-800 my-1.5" />
                  <MenuItem danger icon={<LogOut className="h-3.5 w-3.5" />} onClick={onLogout}>
                    Sign out
                  </MenuItem>
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onOpenLogin}
            className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md font-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Github className="h-4 w-4" />
            <span>Login GitHub</span>
          </motion.button>
        )}
      </div>
    </header>
  );
};
