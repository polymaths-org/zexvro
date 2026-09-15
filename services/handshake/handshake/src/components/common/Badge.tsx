import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'purple' | 'blue' | 'success' | 'warning' | 'danger' | 'amber';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  const variantMap: Record<string, string> = {
    default: 'bg-[#18181B] text-[#A1A1AA] border border-[#27272A]',
    outline: 'border border-[#3F3F46] text-[#A1A1AA] bg-transparent',
    purple: 'bg-[#3B82F6]/10 text-[#60A5FA] border border-[#3B82F6]/30',
    blue: 'bg-[#3B82F6]/10 text-[#60A5FA] border border-[#3B82F6]/30',
    success: 'bg-[#22C55E]/10 text-[#4ADE80] border border-[#22C55E]/30',
    warning: 'bg-[#F59E0B]/10 text-[#FBBF24] border border-[#F59E0B]/30',
    amber: 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/40 font-medium',
    danger: 'bg-[#EF4444]/10 text-[#F87171] border border-[#EF4444]/30',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[9999px] font-sans font-medium tracking-tight leading-none whitespace-nowrap select-none ${sizeClasses} ${variantMap[variant] || variantMap.default} ${className}`}
    >
      {children}
    </span>
  );
};
