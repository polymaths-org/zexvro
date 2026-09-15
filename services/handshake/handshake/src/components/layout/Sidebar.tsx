import React from 'react';
import {
  House,
  Compass,
  Layers,
  Code,
  BookOpen,
  User,
  Eye,
  Star,
  Plus,
  Settings
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Sidebar: React.FC = () => {
  const {
    route,
    navigate,
    contracts,
    likedContractIds,
    starredContractIds,
    sessionUser,
    isSidebarOpen
  } = useApp();

  const me = sessionUser || 'alex-dev';
  const myCount = contracts.filter((c) => c.owner === me).length;

  const isContractsActive =
    route.page === 'browse' ||
    route.page.startsWith('contract-') ||
    route.page.startsWith('file-') ||
    route.page.startsWith('function-');
  const isStudioActive = route.page.startsWith('studio');

  const itemCls = (active: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-1.5 rounded-[6px] text-xs transition-all cursor-pointer ${
      active
        ? 'sidebar-active text-[#FAFAFA] bg-[#1B1B1E] border border-[#3F3F46] shadow-[0_1px_2px_rgba(0,0,0,0.3)] font-medium'
        : 'text-[#8C93A3] hover:text-[#FAFAFA] hover:bg-[#141416] border border-transparent'
    }`;

  const sectionLabel = 'px-3 pt-4 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-[#71717A]';

  return (
    <aside
      className={`hidden lg:flex shrink-0 flex-col border-r sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden transition-[width,border-color,background-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
        isSidebarOpen
          ? 'w-60 border-[#27272A] bg-[#0A0A0B]'
          : 'w-0 border-transparent bg-transparent'
      }`}
      aria-hidden={!isSidebarOpen}
      inert={!isSidebarOpen}
    >
      <div
        className={`w-60 flex-1 overflow-y-auto pb-4 transition-[opacity,transform] motion-reduce:transition-none ${
          isSidebarOpen
            ? 'opacity-100 translate-x-0 duration-200 ease-out delay-100'
            : 'opacity-0 -translate-x-3 duration-150 ease-in pointer-events-none'
        }`}
      >
      <nav className="px-2 sidebar-nav" aria-label="Sidebar">
        <div className={sectionLabel}>Menu</div>
        <button type="button" onClick={() => navigate({ page: 'home' })} className={itemCls(route.page === 'home')}>
          <House className="w-3.5 h-3.5 shrink-0" />
          Home
        </button>
        <button type="button" onClick={() => navigate({ page: 'explore' })} className={itemCls(route.page === 'explore')}>
          <Compass className="w-3.5 h-3.5 shrink-0" />
          Explore
        </button>
        <button type="button" onClick={() => navigate({ page: 'browse' })} className={itemCls(isContractsActive)}>
          <Layers className="w-3.5 h-3.5 shrink-0" />
          Contracts
        </button>
        <button type="button" onClick={() => navigate({ page: 'studio-launcher' })} className={itemCls(isStudioActive)}>
          <Code className="w-3.5 h-3.5 shrink-0" />
          Studio
        </button>
        <button type="button" onClick={() => navigate({ page: 'collections' })} className={itemCls(route.page === 'collections')}>
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          Collections
        </button>

        <div className={sectionLabel}>Library</div>
        <button type="button" onClick={() => navigate({ page: 'profile', username: me })} className={itemCls(route.page === 'profile')}>
          <User className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">My Contracts</span>
          <span className="text-[10px] font-mono text-[#71717A]">{myCount}</span>
        </button>
        <button type="button" onClick={() => navigate({ page: 'browse' })} className={itemCls(false)}>
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">Watched</span>
          <span className="text-[10px] font-mono text-[#71717A]">{likedContractIds.length}</span>
        </button>
        <button type="button" onClick={() => navigate({ page: 'browse' })} className={itemCls(false)}>
          <Star className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left">Starred</span>
          <span className="text-[10px] font-mono text-[#71717A]">{starredContractIds.length}</span>
        </button>

        <div className={sectionLabel}>Workspace</div>
        <button type="button" onClick={() => navigate({ page: 'publish' })} className={itemCls(route.page === 'publish')}>
          <Plus className="w-3.5 h-3.5 shrink-0" />
          Publish Contract
        </button>
        <button type="button" onClick={() => navigate({ page: 'settings' })} className={itemCls(route.page === 'settings')}>
          <Settings className="w-3.5 h-3.5 shrink-0" />
          Settings
        </button>
      </nav>
      </div>
    </aside>
  );
};
