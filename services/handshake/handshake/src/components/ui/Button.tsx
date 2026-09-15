import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'graphite' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'sm', isLoading, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium font-mono text-xs transition-all duration-150 rounded-[6px] select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

    const variants = {
      primary:
        'bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] border border-[#FFFFFF] shadow-[0_1px_2px_rgba(0,0,0,0.4)]',
      secondary:
        'bg-[#18181B] hover:bg-[#1F1F23] text-[#FAFAFA] border border-[#2B303E] hover:border-[#3E4558] shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
      graphite:
        'bg-[#1A1A1E] hover:bg-[#222226] text-[#FAFAFA] border border-[#373E4F] hover:border-[#4D566D] shadow-[0_1px_2px_rgba(0,0,0,0.4)]',
      outline:
        'bg-transparent hover:bg-[#161821] text-[#9BA2B0] hover:text-[#FAFAFA] border border-[#2B303D] hover:border-[#3E4558]',
      ghost:
        'bg-transparent hover:bg-[#1C202A]/80 text-[#9BA2B0] hover:text-[#FAFAFA] border border-transparent',
      danger:
        'bg-[#DC2626] hover:bg-[#EF4444] text-white border border-[#EF4444]/40 shadow-[0_1px_2px_rgba(0,0,0,0.4)]',
    };

    const sizes = {
      xs: 'px-2 py-1 text-[11px] gap-1.5 h-6',
      sm: 'px-2.5 py-1.5 text-xs gap-2 h-7.5',
      md: 'px-3.5 py-2 text-xs gap-2 h-9',
      lg: 'px-5 py-2.5 text-sm gap-2.5 h-11',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
