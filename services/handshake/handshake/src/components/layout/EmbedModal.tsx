import React, { useState } from 'react';
import { X, Copy, Check, Code, Share2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const EmbedModal: React.FC = () => {
  const { isEmbedModalOpen, setIsEmbedModalOpen, embedContract } = useApp();
  const [activeTab, setActiveTab] = useState<'badge' | 'iframe' | 'card'>('badge');
  const [copied, setCopied] = useState(false);

  if (!isEmbedModalOpen || !embedContract) return null;

  const badgeUrl = `https://img.shields.io/badge/Handshake-${embedContract.name}-3B82F6?logo=stellar`;
  const contractLink = `https://handshake.zexvro.in/${embedContract.owner}/${embedContract.name}`;

  const markdownBadge = `[![Handshake](${badgeUrl})](${contractLink})`;
  const iframeSnippet = `<iframe src="https://handshake.zexvro.in/embed/${embedContract.contractId}?theme=dark" width="100%" height="320" frameborder="0" style="border-radius: 8px; border: 1px solid #27272A;"></iframe>`;
  const htmlBadge = `<a href="${contractLink}"><img src="${badgeUrl}" alt="Handshake Smart Contract" /></a>`;

  const getCodeSnippet = () => {
    if (activeTab === 'badge') return markdownBadge;
    if (activeTab === 'iframe') return iframeSnippet;
    return htmlBadge;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg rounded-[8px] border border-[#3F3F46] bg-[#0A0A0B] shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#27272A] mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#3B82F6]" />
            <h3 className="text-sm font-semibold text-[#FAFAFA]">Embed this Contract</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsEmbedModalOpen(false)}
            className="p-1 text-[#71717A] hover:text-[#FAFAFA] rounded hover:bg-[#18181B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#A1A1AA] mb-4">
          Share <span className="font-semibold text-[#FAFAFA] font-mono">{embedContract.name}</span> on your GitHub README, documentation, or blog with dynamic live stats and chain verification.
        </p>

        {/* Tab selector */}
        <div className="flex items-center gap-2 mb-3 border-b border-[#27272A] pb-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('badge')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'badge'
                ? 'bg-[#18181B] text-[#FAFAFA] border border-[#3F3F46]'
                : 'text-[#71717A] hover:text-[#FAFAFA]'
            }`}
          >
            Markdown Badge
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('iframe')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'iframe'
                ? 'bg-[#18181B] text-[#FAFAFA] border border-[#3F3F46]'
                : 'text-[#71717A] hover:text-[#FAFAFA]'
            }`}
          >
            Interactive iFrame
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('card')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'card'
                ? 'bg-[#18181B] text-[#FAFAFA] border border-[#3F3F46]'
                : 'text-[#71717A] hover:text-[#FAFAFA]'
            }`}
          >
            HTML Snippet
          </button>
        </div>

        {/* Preview box */}
        <div className="p-3 mb-3 rounded-[6px] bg-[#111113] border border-[#27272A]">
          <span className="text-[10px] font-mono text-[#71717A] uppercase block mb-1.5">Live Preview:</span>
          {activeTab === 'badge' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-[#3B82F6] text-white text-xs font-semibold">
              <span>Handshake</span>
              <span className="opacity-75">|</span>
              <span>{embedContract.name}</span>
            </div>
          )}
          {activeTab === 'iframe' && (
            <div className="p-2 text-xs font-mono text-[#A1A1AA] border border-dashed border-[#3F3F46] rounded text-center">
              [Embedded interactive contract card: {embedContract.contractId.slice(0, 10)}…]
            </div>
          )}
          {activeTab === 'card' && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-[#3B82F6] text-white text-xs font-semibold">
              <span>Verified Contract</span>
              <span className="opacity-75">|</span>
              <span>{embedContract.chain}:{embedContract.network}</span>
            </div>
          )}
        </div>

        {/* Code Snippet Box */}
        <div className="relative mb-4">
          <textarea
            readOnly
            value={getCodeSnippet()}
            rows={3}
            className="w-full p-2.5 rounded-[6px] bg-[#18181B] border border-[#27272A] font-mono text-xs text-[#FAFAFA] focus:outline-none resize-none select-all"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-[#27272A] hover:bg-[#3F3F46] text-xs font-mono text-[#FAFAFA] transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsEmbedModalOpen(false)}
            className="px-3 py-1.5 rounded-[6px] bg-[#18181B] hover:bg-[#27272A] text-xs text-[#FAFAFA] font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
