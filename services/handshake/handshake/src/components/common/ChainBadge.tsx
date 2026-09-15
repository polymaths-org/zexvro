import React, { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { ChainType, NetworkType } from '../../types';
import { getChain } from '../../data/chains';

interface ChainBadgeProps {
  chain: ChainType;
  network: NetworkType;
  contractId?: string;
  truncateId?: boolean;
  showCopy?: boolean;
  showExplorer?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ChainBadge: React.FC<ChainBadgeProps> = ({
  chain,
  network,
  contractId,
  truncateId = true,
  showCopy = true,
  showExplorer = false,
  size = 'sm',
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [logoOk, setLogoOk] = useState(true);

  useEffect(() => {
    setLogoOk(true);
  }, [chain]);

  const meta = getChain(chain);
  const accent = meta?.accent ?? '#71717A';
  const chainName = meta?.name ?? chain;
  // Registry short label keeps the chain-explicit format (e.g. base:pubnet).
  const label = meta?.shortLabel ?? chain;

  const copyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contractId) return;
    navigator.clipboard.writeText(contractId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const formatId = (id: string) => {
    if (!truncateId) return id;
    if (id.length <= 14) return id;
    return `${id.slice(0, 6)}…${id.slice(-5)}`;
  };

  const getExplorerUrl = () => {
    if (!contractId) return '#';
    if (chain === 'stellar') {
      const net = network === 'testnet' ? 'testnet' : 'public';
      return `https://stellar.expert/explorer/${net}/contract/${contractId}`;
    }
    if (meta?.explorerAccount) {
      return `${meta.explorerAccount}/${contractId}`;
    }
    return '#';
  };

  const sizeClasses = size === 'sm' ? 'text-[11px] h-5' : size === 'md' ? 'text-xs h-6' : 'text-xs h-7';

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-[9999px] bg-[#111113] border border-[#27272A] px-2 py-0.5 select-none ${sizeClasses} ${className}`}
    >
      {/* Chain Pill */}
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-[9999px] border font-medium text-[10px] text-[#A1A1AA]"
        style={{ backgroundColor: `${accent}1A`, borderColor: `${accent}55` }}
        title={chainName}
      >
        {meta?.logo && logoOk ? (
          <img
            src={meta.logo}
            alt={`${chainName} logo`}
            className="w-3.5 h-3.5 rounded-full object-cover bg-[#0A0A0B]"
            onError={() => setLogoOk(false)}
          />
        ) : (
          <span
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold"
            style={{ backgroundColor: `${accent}33`, color: accent }}
          >
            {chainName.charAt(0).toUpperCase()}
          </span>
        )}
        {label}:{network}
      </span>

      {/* Contract ID if provided */}
      {contractId && (
        <span className="text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors" title={contractId}>
          {formatId(contractId)}
        </span>
      )}

      {/* Copy Button */}
      {contractId && showCopy && (
        <button
          type="button"
          onClick={copyToClipboard}
          className="p-0.5 text-[#71717A] hover:text-[#FAFAFA] transition-colors rounded hover:bg-[#18181B]"
          title="Copy contract ID"
          aria-label="Copy contract ID"
        >
          {copied ? <Check className="w-3 h-3 text-[#22C55E]" /> : <Copy className="w-3 h-3" />}
        </button>
      )}

      {/* Explorer Link */}
      {contractId && showExplorer && (
        <a
          href={getExplorerUrl()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-0.5 text-[#71717A] hover:text-[#3B82F6] transition-colors rounded hover:bg-[#18181B]"
          title="Open in Block Explorer"
          aria-label="Open in Block Explorer"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
};
