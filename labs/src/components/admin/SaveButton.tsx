import React, { useRef, useState } from 'react';
import { Loader2, Check, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SaveButtonProps {
  onSave: (done: () => void) => void;
  label?: string;
  variant?: 'primary' | 'compact';
  className?: string;
}

export const SaveButton: React.FC<SaveButtonProps> = ({ onSave, label = 'Save', variant = 'primary', className }) => {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const busyRef = useRef(false);

  const handleClick = () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setState('saving');
    onSave(() => {
      setState('saved');
      setTimeout(() => {
        setState('idle');
        busyRef.current = false;
      }, 1600);
    });
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
        disabled ? `${state === 'saving' ? 'bg-blue-800 cursor-wait' : 'bg-emerald-600'} opacity-90` : ''
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
        {state === 'idle' && (
          <motion.span key="idle" className="flex items-center gap-2" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Save className="h-4 w-4" /> {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};