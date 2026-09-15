import React from 'react';
import { getLanguage } from '../../data/languages';

interface LanguageBadgeProps {
  language: string;
  size?: 'xs' | 'sm';
  showLabel?: boolean;
  className?: string;
}

/**
 * Smart-contract language mark: official single-color logo where we have
 * one (Rust, Solidity — rendered inverted for dark UI), colored letter
 * tile otherwise.
 */
export const LanguageBadge: React.FC<LanguageBadgeProps> = ({
  language,
  size = 'xs',
  showLabel = true,
  className = '',
}) => {
  const meta = getLanguage(language);
  const box = size === 'xs' ? 'w-4 h-4' : 'w-5 h-5';
  const text = size === 'xs' ? 'text-[11px]' : 'text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {meta?.logo ? (
        <img
          src={meta.logo}
          alt={`${meta.short} logo`}
          title={language}
          className={`${box} object-contain invert`}
        />
      ) : (
        <span
          title={language}
          className={`${box} rounded-[4px] flex items-center justify-center text-[10px] font-bold font-mono shrink-0`}
          style={{ backgroundColor: `${meta?.color ?? '#71717A'}22`, color: meta?.color ?? '#A1A1AA' }}
        >
          {meta?.letter ?? language.charAt(0).toUpperCase()}
        </span>
      )}
      {showLabel && <span className={`${text} text-[#A1A1AA]`}>{meta?.short ?? language}</span>}
    </span>
  );
};
