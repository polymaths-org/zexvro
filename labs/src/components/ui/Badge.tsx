import React from 'react';

type BadgeVariant = 'default' | 'solid' | 'outline' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'bg-zinc-900 border border-zinc-700 text-zinc-300',
  solid:
    'bg-white border border-white text-black',
  outline:
    'bg-transparent border border-zinc-800 text-zinc-400',
  success:
    'bg-emerald-950 border border-emerald-800 text-emerald-300',
  warning:
    'bg-amber-950 border border-amber-800 text-amber-300',
  danger:
    'bg-red-950 border border-red-800 text-red-300',
};

export const StatusBadge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  icon,
  className = '',
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-md
        text-[10px] font-mono font-bold uppercase tracking-wide
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

export const Tag: React.FC<TagProps> = ({ children, className = '' }) => (
  <span
    className={`
      text-[10px] bg-black border border-zinc-800 text-zinc-400
      px-2 py-0.5 rounded-md font-mono
      ${className}
    `}
  >
    #{children}
  </span>
);
