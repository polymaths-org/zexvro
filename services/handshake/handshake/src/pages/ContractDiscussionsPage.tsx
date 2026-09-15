import React, { useState } from 'react';
import { MessageSquare, Plus, CheckCircle2, User, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getAvatarForUser } from '../utils/avatar';
import { SmartContract } from '../types';
import { ContractRepoLayout } from '../components/layout/ContractRepoLayout';

interface ContractDiscussionsPageProps {
  contract: SmartContract;
}

export const ContractDiscussionsPage: React.FC<ContractDiscussionsPageProps> = ({ contract }) => {
  const [discussions, setDiscussions] = useState(contract.discussions);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const handleCreateThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newDisc = {
      id: `disc-${Date.now()}`,
      title: newTitle,
      author: 'alex-dev',
      authorAvatar: getAvatarForUser('alex-dev'),
      time: 'Just now',
      repliesCount: 0,
      tags: ['integration'],
    };

    setDiscussions([newDisc, ...discussions]);
    setNewTitle('');
    setNewBody('');
    setShowNewThread(false);
  };

  return (
    <ContractRepoLayout contract={contract} activeTab="discussions">
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272A] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[#FAFAFA] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#3B82F6]" />
              Contract Discussions & Auditing Forum
            </h2>
            <p className="text-xs text-[#A1A1AA] font-mono mt-1">
              Ask questions about function invariants, share gas optimizations, or coordinate integration
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewThread(!showNewThread)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Discussion</span>
          </button>
        </div>

        {/* New Thread Form */}
        {showNewThread && (
          <form onSubmit={handleCreateThread} className="p-4 rounded-[8px] border border-[#3F3F46] bg-[#111113] space-y-3">
            <h3 className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider font-mono">
              Start a new discussion thread
            </h3>

            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title (e.g. Question on slippage invariant in swap)"
              className="w-full px-3 py-2 rounded-[6px] bg-[#0A0A0B] border border-[#27272A] text-xs text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:border-[#3B82F6]"
            />

            <textarea
              rows={3}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Describe your inquiry, invariant verification, or test case..."
              className="w-full px-3 py-2 rounded-[6px] bg-[#0A0A0B] border border-[#27272A] text-xs text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:border-[#3B82F6]"
            />

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowNewThread(false)}
                className="px-3 py-1.5 rounded bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1 px-3.5 py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post Thread</span>
              </button>
            </div>
          </form>
        )}

        {/* Discussions List */}
        <div className="rounded-[8px] border border-[#27272A] bg-[#0A0A0B] divide-y divide-[#18181B] overflow-hidden text-xs">
          {discussions.map((d) => (
            <div
              key={d.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#111113] transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <img
                  src={d.authorAvatar}
                  alt={d.author}
                  className="w-8 h-8 rounded-full object-cover border border-[#27272A] shrink-0"
                />
                <div>
                  <h4 className="text-sm font-semibold text-[#FAFAFA] hover:text-[#3B82F6] transition-colors">
                    {d.title}
                  </h4>
                  <div className="text-[11px] text-[#71717A] mt-1 font-mono flex items-center gap-2">
                    <span className="text-[#A1A1AA]">@{d.author}</span>
                    <span>•</span>
                    <span>{d.time}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                <div className="flex gap-1">
                  {d.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-[9999px] bg-[#18181B] border border-[#27272A] text-[#71717A]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-[#A1A1AA] bg-[#111113] px-2.5 py-1 rounded border border-[#27272A]">
                  <MessageSquare className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>{d.repliesCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </ContractRepoLayout>
  );
};
