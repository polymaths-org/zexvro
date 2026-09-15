import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'raised' | 'glow';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default:
        'bg-[#0A0A0B] border border-[#232734] shadow-[0_2px_8px_rgba(0,0,0,0.35)]',
      raised:
        'bg-[#111113] border border-[#2B3142] shadow-[0_4px_12px_rgba(0,0,0,0.45)]',
      glow:
        'bg-[#0A0A0B] border border-[#3B82F6]/30 shadow-[0_0_15px_rgba(59,130,246,0.12)]',
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-[8px] p-4 text-[#FAFAFA]', variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
