import React from 'react';
import { motion } from 'motion/react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
}) => {
  const switchId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex items-start gap-3">
      <button
        id={switchId}
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex h-5 w-9 shrink-0 items-center rounded-full
          transition-colors duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black
          disabled:opacity-50 disabled:cursor-not-allowed
          ${checked ? 'bg-white' : 'bg-zinc-800 border border-zinc-700'}
        `}
      >
        <motion.span
          animate={{ x: checked ? 18 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`
            inline-block h-3.5 w-3.5 rounded-full transition-colors
            ${checked ? 'bg-black' : 'bg-zinc-400'}
          `}
        />
      </button>
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <label
              htmlFor={switchId}
              className="text-xs font-bold text-zinc-200 cursor-pointer"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>
          )}
        </div>
      )}
    </div>
  );
};
