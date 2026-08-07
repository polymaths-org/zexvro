import React, { useRef, useState } from 'react';
import { Loader2, Check, Save, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SaveButtonProps {
  // Returns true on success, false on failure. Resolves when the server has
  // acknowledged the write so the spinner/disabled state matches reality.
  onSave: () => Promise<boolean>;
  label?: string;
  variant?: 'primary' | 'compact';
  className?: string;
}

export const SaveButton: React.FC<SaveButtonProps> = ({ onSave, label = 'Save', variant = 'primary', className }) => {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const busyRef = useRef(false);

  const handleClick = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setState('saving');
    try {
      const ok = await onSave();
      if (ok) {
        setState('saved');
        setTimeout(() => {
          setState('idle');
          busyRef.current = false;
        }, 1600);
      } else {
        setState('error');
        setTimeout(() => {
          setState('idle');
          busyRef.current = false;
        }, 2200);
      }
    } catch {
      setState('error');
      setTimeout(() => {
        setState('idle');
        busyRef.current = false;
      }, 2200);
    }
  };

  const base =
    variant === 'primary'
      ? 'px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-lg'
      : 'px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl';

  const disabled = state !== 'idle';

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      disabled={disabled}
      className={`font-extrabold text-sm flex items-center justify-center gap-2 font-heading transition-colors ${
        disabled
          ? state === 'saving'
            ? 'bg-blue-800 cursor-wait opacity-80'
            : state === 'error'
              ? 'bg-red-700 opacity-90 cursor-not-allowed'
              : 'bg-emerald-600 opacity-90 cursor-default'
          : ''
      } ${base} ${className || ''}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === 'saving' && (
          <motion.span key="saving" className="flex items-center gap-2" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
          </motion.span>
        )}
        {state === 'saved' && (
          <motion.span key="saved" className="flex items-center gap-2" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Check className="h-4 w-4" /> Saved
          </motion.span>
        )}
        {state === 'error' && (
          <motion.span key="error" className="flex items-center gap-2" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <AlertTriangle className="h-4 w-4" /> Failed
          </motion.span>
        )}
        {state === 'idle' && (
          <motion.span key="idle" className="flex items-center gap-2" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Save className="h-4 w-4" /> {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};