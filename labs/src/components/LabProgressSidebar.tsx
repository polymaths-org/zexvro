import React, { useState } from 'react';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Award,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Lab, LabRunProgress } from '../types';

interface LabProgressSidebarProps {
  lab: Lab;
  progress?: LabRunProgress;
  onSelectPage: (pageId: string) => void;
  onExitLab: () => void;
}

const formatTime = (seconds: number | null | undefined) => {
  if (seconds == null) return 'Unlimited';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const LabProgressSidebar: React.FC<LabProgressSidebarProps> = ({
  lab,
  progress,
  onSelectPage,
  onExitLab,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const pages = lab.pages && lab.pages.length > 0 ? lab.pages : [];
  const singleTasks = pages.length === 0 ? lab.tasks : [];

  const completedIds = progress?.completedTaskIds || [];
  const currentPageId = progress?.currentPageId || pages[0]?.id || null;

  const allTasks = pages.length
    ? pages.flatMap((p) => p.elements)
    : singleTasks;
  const verifiable = allTasks.filter((t) => (t.type || 'task') === 'task');
  const doneCount = verifiable.filter((t) => completedIds.includes(t.id)).length;
  const percent =
    verifiable.length === 0 ? 100 : Math.round((doneCount / verifiable.length) * 100);

  const isCurrentTask = (taskId: string) => {
    if (completedIds.includes(taskId)) return false;
    return verifiable.find((t) => !completedIds.includes(t.id))?.id === taskId;
  };

  const renderTask = (task: { id: string; title?: string; type?: string }, idx: number) => {
    const done = completedIds.includes(task.id);
    const current = isCurrentTask(task.id);
    return (
      <div
        key={task.id}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all ${
          done
            ? 'text-zinc-600 opacity-50'
            : current
            ? 'bg-blue-600/15 border border-blue-800/60 text-white'
            : 'text-zinc-400'
        }`}
      >
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        ) : current ? (
          <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 shrink-0 animate-pulse" />
        ) : (
          <Circle className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
        )}
        <span className={`truncate ${done ? 'line-through' : ''}`}>
          {task.title || `Step ${idx + 1}`}
        </span>
        {current && (
          <span className="ml-auto text-[9px] font-mono font-bold text-blue-400 uppercase shrink-0">
            now
          </span>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-72'} bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0 min-h-[calc(100vh-57px)] transition-all duration-300`}
    >
      {/* Top bar */}
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <button
            onClick={onExitLab}
            className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {!collapsed && <span>Exit Lab</span>}
          </button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg transition-all"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </motion.button>
        </div>

        {!collapsed && (
          <>
            {/* Lab header */}
            <div>
              <p className="text-[10px] font-mono font-bold text-blue-accent uppercase tracking-widest">
                {lab.category}
              </p>
              <h3 className="text-sm font-black text-white font-heading leading-snug mt-1">
                {lab.title}
              </h3>
            </div>

            {/* Progress + time */}
            <div className="bg-black border border-zinc-800 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Progress</span>
                <span className="text-xs font-mono font-bold text-white">{percent}%</span>
              </div>
              <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-sky-400 rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  <Clock className="h-3 w-3 text-blue-accent" /> Time
                </span>
                <span className={`text-sm font-mono font-bold ${progress?.timeLeftSeconds != null && progress.timeLeftSeconds < 60 ? 'text-red-400' : 'text-white'}`}>
                  {formatTime(progress?.timeLeftSeconds)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  <Zap className="h-3 w-3 text-blue-accent" /> Reward
                </span>
                <span className="text-xs font-mono font-bold text-blue-accent">+{lab.xpReward} XP</span>
              </div>
            </div>

            {/* Pages */}
            <div className="pt-1">
              <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-2">
                {pages.length > 0 ? `${pages.length} pages` : 'Steps'}
              </p>
              <div className="space-y-1">
                {pages.length === 0 ? (
                  <div className="space-y-1">
                    {singleTasks.filter((t) => (t.type || 'task') === 'task').map((t, i) => renderTask(t, i))}
                  </div>
                ) : (
                  pages.map((page, i) => {
                    const isActive = page.id === currentPageId;
                    const pageTasks = page.elements.filter((e) => (e.type || 'task') === 'task');
                    const pageDone = pageTasks.filter((t) => completedIds.includes(t.id)).length;
                    return (
                      <div key={page.id}>
                        <button
                          onClick={() => onSelectPage(page.id)}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                            isActive
                              ? 'bg-zinc-900 border-blue-800 text-white'
                              : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-mono font-black shrink-0 ${
                            isActive ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {i + 1}
                          </span>
                          <span className="truncate flex-1 text-left">{page.title || `Page ${i + 1}`}</span>
                          {pageTasks.length > 0 && (
                            <span className={`text-[10px] font-mono ${pageDone === pageTasks.length ? 'text-emerald-400' : 'text-zinc-500'}`}>
                              {pageDone}/{pageTasks.length}
                            </span>
                          )}
                          {isActive ? (
                            <ChevronDown className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                          )}
                        </button>

                        {/* Current page expands to show its tasks */}
                        {isActive && pageTasks.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden pl-7 mt-1 space-y-0.5 border-l border-zinc-800 ml-[11px]"
                          >
                            {pageTasks.map((t, idx) => renderTask(t, idx))}
                          </motion.div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom: badge preview */}
      {!collapsed && (
        <div className="mt-auto p-3 border-t border-zinc-800/80 bg-black">
          <div className="flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 rounded-xl p-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0">
              <Award className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-zinc-200 truncate">
                {lab.badgeName || 'ZEXVRO Skill Badge'}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono truncate">
                Earned on completion
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
