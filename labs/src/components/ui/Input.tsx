import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  mono?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  mono = false,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-mono text-zinc-300 font-bold"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={`
            w-full bg-black border rounded-xl px-3.5 py-2 text-xs text-white
            placeholder-zinc-600
            focus:outline-none focus:border-white focus:ring-1 focus:ring-white
            transition-all
            ${mono ? 'font-mono' : ''}
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-red-700' : 'border-zinc-800'}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[11px] text-red-400 font-mono">{error}</p>
      )}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  mono?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  mono = false,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-mono text-zinc-300 font-bold"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`
          w-full bg-black border rounded-xl p-3 text-xs text-white
          placeholder-zinc-600
          focus:outline-none focus:border-white focus:ring-1 focus:ring-white
          transition-all resize-none
          ${mono ? 'font-mono' : ''}
          ${error ? 'border-red-700' : 'border-zinc-800'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-[11px] text-red-400 font-mono">{error}</p>
      )}
    </div>
  );
};
