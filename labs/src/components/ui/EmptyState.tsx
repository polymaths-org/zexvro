import React from 'react';
import { Terminal, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './Button';

type EmptyStateVariant = 'empty' | 'error' | 'loading';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'empty',
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const defaultIcons: Record<EmptyStateVariant, React.ReactNode> = {
    empty: <Terminal className="h-10 w-10 text-zinc-600" />,
    error: <AlertCircle className="h-10 w-10 text-red-500/60" />,
    loading: <Loader2 className="h-10 w-10 text-zinc-500 animate-spin" />,
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="mb-4">{icon || defaultIcons[variant]}</div>
      <h3 className="text-base font-bold text-zinc-300 font-heading">{title}</h3>
      {description && (
        <p className="text-xs text-zinc-500 mt-1.5 max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <div className="mt-5">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
