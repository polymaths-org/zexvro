import React from 'react';
import { motion } from 'motion/react';

type CardVariant = 'default' | 'interactive' | 'highlighted';

interface CardProps {
  variant?: CardVariant;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-zinc-950 border border-zinc-800',
  interactive:
    'bg-zinc-950 border border-zinc-800 hover:border-zinc-500 cursor-pointer',
  highlighted:
    'bg-zinc-950 border border-white shadow-[0_0_15px_rgba(255,255,255,0.08)]',
};

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  children,
  className = '',
  onClick,
  padding = 'md',
}) => {
  const Wrapper = variant === 'interactive' ? motion.div : 'div';
  const motionProps =
    variant === 'interactive'
      ? { whileHover: { y: -4 }, whileTap: { scale: 0.99 } }
      : {};

  return (
    <Wrapper
      onClick={onClick}
      className={`
        rounded-2xl transition-all overflow-hidden
        ${variantClasses[variant]}
        ${paddingClasses[padding]}
        ${className}
      `}
      {...(motionProps as any)}
    >
      {children}
    </Wrapper>
  );
};
