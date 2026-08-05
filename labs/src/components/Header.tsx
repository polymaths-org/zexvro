import React from 'react';
import { User } from '../types';
import { 
  Search, 
  Flame, 
  Trophy, 
  Github, 
  LogOut,
  ChevronDown
} from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
  user: User;
  onOpenLogin: () => void;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenLogin,
  onLogout,
  searchQuery,
  setSearchQuery,
}) => {
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

      {/* Center Search Bar */}
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
          <div className="relative group">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded-xl px-2.5 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="User menu"
              aria-haspopup="true"
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
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            </motion.button>

            {/* Dropdown menu */}
            <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2 hidden group-hover:block transition-all z-50" role="menu">
              <div className="px-3 py-2 border-b border-zinc-800">
                <p className="text-xs font-semibold text-zinc-100">{user.name}</p>
                <p className="text-[10px] text-zinc-400 font-mono truncate">{user.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-lg flex items-center gap-2 transition-colors mt-1 font-medium"
                role="menuitem"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Disconnect GitHub</span>
              </button>
            </div>
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
