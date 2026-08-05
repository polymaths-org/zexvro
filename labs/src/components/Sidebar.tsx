import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Terminal, 
  Compass, 
  Award, 
  PlusCircle, 
  ChevronRight,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
  UserCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { User, Lab } from '../types';

export type ActiveTab = 'dashboard' | 'catalog' | 'lab-runner' | 'student-progress' | 'admin-panel' | 'operations' | 'profile';

interface SidebarProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  user: User;
  activeLab: Lab | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onNavigate,
  user,
  activeLab,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'catalog' as ActiveTab,
      label: 'Explore Labs',
      icon: Compass,
    },
    {
      id: 'student-progress' as ActiveTab,
      label: 'Progress & Badges',
      icon: Award,
    },
    {
      id: 'profile' as ActiveTab,
      label: 'My Profile',
      icon: UserCircle,
    },
  ];

  const adminItems = [
    {
      id: 'admin-panel' as ActiveTab,
      label: 'Lab Builder & CMS',
      icon: PlusCircle,
      badge: 'CMS',
    },
    {
      id: 'operations' as ActiveTab,
      label: 'Operations',
      icon: BarChart3,
      badge: 'OPS',
    },
  ];

  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className={`${isCollapsed ? 'w-20' : 'w-64'} bg-black border-r border-zinc-800/80 flex flex-col justify-between shrink-0 min-h-[calc(100vh-57px)] transition-all duration-300`}
    >
      <div className="p-3 sm:p-4 space-y-5">
        {/* Collapse / Expand Control Bar */}
        <div className="flex items-center justify-between pb-1 border-b border-zinc-900">
          {!isCollapsed && (
            <span className="px-1 text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
              Navigation
            </span>
          )}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${isCollapsed ? 'mx-auto' : ''}`}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </motion.button>
        </div>

        {/* Active Lab Notice Banner */}
        {activeLab && (
          <motion.div 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate('lab-runner')}
            title={isCollapsed ? `Active: ${activeLab.title}` : undefined}
            role="button"
            aria-label={`Resume lab: ${activeLab.title}`}
            className={`cursor-pointer ${isCollapsed ? 'p-2 text-center' : 'p-3.5'} rounded-2xl border transition-all relative overflow-hidden group ${
              activeTab === 'lab-runner' 
                ? 'bg-zinc-900 border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                : 'bg-zinc-950 border-zinc-800 hover:border-zinc-500'
            }`}
          >
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-1">
                <span className="relative flex h-2 w-2 my-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <Terminal className="h-4 w-4 text-white animate-pulse" />
              </div>
            ) : (
              <>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">Active Lab</span>
              </div>
                <p className="text-xs font-bold text-zinc-100 line-clamp-1 group-hover:text-white">
                  {activeLab.title}
                </p>
                <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-400 font-mono">
                  <span>{activeLab.timeLimitMinutes ? `${activeLab.timeLimitMinutes}m` : 'Unlimited'} duration</span>
                  <span className="text-blue-accent font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                    Resume <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Primary Navigation Menu */}
        <nav className="space-y-1" aria-label="Primary navigation">
          {navItems.map((item, i) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <React.Fragment key={item.id}>
                {i > 0 && <div className="h-px bg-zinc-800/80" />}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onNavigate(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'} rounded-lg text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    isActive
                      ? 'bg-white text-black font-bold shadow-md'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                </motion.button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Active Lab Runner Nav Button if lab selected */}
        {activeLab && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('lab-runner')}
            title={isCollapsed ? 'Lab Workbench' : undefined}
            aria-label="Lab Workbench"
            className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              activeTab === 'lab-runner'
                ? 'bg-white text-black font-bold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <Terminal className={`h-4 w-4 shrink-0 ${activeTab === 'lab-runner' ? 'text-black' : 'text-white animate-pulse'}`} />
            {!isCollapsed && <span>Lab Workbench</span>}
          </motion.button>
        )}

        {/* Admin Navigation Section */}
        {user.role === 'admin' && (
          <nav className="space-y-1 pt-3 border-t border-zinc-800/80" aria-label="Admin navigation">
            {!isCollapsed && (
              <div className="px-3.5 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-white" />
                <span>Admin Workspace</span>
              </div>
            )}
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onNavigate(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    isActive
                      ? 'bg-zinc-100 text-black font-bold shadow-md'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-black' : 'text-zinc-300'}`} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isCollapsed && (
                    <span className="text-[10px] bg-zinc-900 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded-md font-mono font-bold">
                      {item.badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Footer Info Box */}
      <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950">
        <div className={`flex items-center ${isCollapsed ? 'justify-center p-2' : 'gap-3 p-3'} bg-zinc-900/80 border border-zinc-800 rounded-xl`}>
          <img src="/brand/logo.png" alt="ZEXVRO" className={`${isCollapsed ? 'h-7 w-7' : 'h-8 w-8'} object-contain shrink-0`} />
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-200">ZEXVRO LABS</p>
              <p className="text-[10px] text-zinc-500 font-mono truncate">Web3 Education Platform</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
