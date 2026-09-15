import React, { useState, useEffect, useRef } from 'react';

interface DropdownProps {
  /** Trigger content (rendered inside a button). */
  trigger: React.ReactNode;
  /** Panel content; receives a close() callback. */
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
  panelClassName?: string;
  triggerClassName?: string;
  ariaLabel?: string;
}

/**
 * Minimal custom dropdown (popover menu). Closes on outside click or
 * Escape. Prefer this over native <select> for filter/sort controls.
 */
export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  align = 'left',
  panelClassName = '',
  triggerClassName = '',
  ariaLabel = 'Open menu',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open ]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 z-30 rounded-[8px] border border-[#27272A] bg-[#111113] shadow-[0_12px_32px_rgba(0,0,0,0.55)] overflow-hidden ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};
