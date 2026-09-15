import React from 'react';
import { Bell, Check, Layers, GitFork, Star, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const NotificationsPage: React.FC = () => {
  const { notifications, markAllNotificationsRead, navigateToContract } = useApp();

  const getIcon = (type: string) => {
    switch (type) {
      case 'fork':
        return <GitFork className="w-4 h-4 text-[#3B82F6]" />;
      case 'star':
        return <Star className="w-4 h-4 text-[#F59E0B]" />;
      case 'discussion':
        return <MessageSquare className="w-4 h-4 text-[#3B82F6]" />;
      default:
        return <Layers className="w-4 h-4 text-[#22C55E]" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-6 text-xs font-sans">
      <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#FAFAFA] flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#3B82F6]" />
            Activity Notifications
          </h1>
          <p className="text-xs text-[#A1A1AA] font-mono mt-1">
            Forks, contract mentions, discussions, and verified audits on your code
          </p>
        </div>

        <button
          type="button"
          onClick={markAllNotificationsRead}
          className="px-3 py-1.5 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-xs font-mono text-[#FAFAFA] border border-[#27272A] transition-colors"
        >
          Mark all read
        </button>
      </div>

      <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] divide-y divide-[#18181B] overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="w-11 h-11 mx-auto rounded-[8px] bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6]">
              <Bell className="w-5 h-5" />
            </div>
            <p className="text-sm text-[#FAFAFA] font-medium">You're all caught up</p>
            <p className="text-xs text-[#A1A1AA]">Forks, stars, and discussion mentions will appear here.</p>
          </div>
        ) : (
          notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => {
              if (n.contractId) {
                navigateToContract('stellar', n.contractId);
              }
            }}
            className={`p-4 flex items-start justify-between gap-4 hover:bg-[#111113] cursor-pointer transition-colors ${
              !n.read ? 'bg-[#18181B]/40' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-[#111113] border border-[#27272A]">
                {getIcon(n.type)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-[#FAFAFA]">{n.title}</span>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                  )}
                </div>
                <p className="text-xs text-[#A1A1AA]">{n.description}</p>
                <span className="text-[11px] text-[#71717A] font-mono block">
                  {n.time}
                </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
