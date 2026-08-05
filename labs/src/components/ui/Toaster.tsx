import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

type ToastFn = (message: string, type?: ToastType) => void;

let emit: ((t: ToastItem) => void) | null = null;
let toastId = 0;

export function toast(message: string, type: ToastType = 'success') {
  emit?.({ id: ++toastId, type, message });
}

const ToastContext = createContext<ToastFn>(toast);

export function useToast(): ToastFn {
  return useContext(ToastContext);
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />,
  error: <XCircle className="h-4.5 w-4.5 text-rose-400" />,
  info: <Info className="h-4.5 w-4.5 text-sky-400" />,
};

const ring: Record<ToastType, string> = {
  success: 'border-emerald-500/40',
  error: 'border-rose-500/40',
  info: 'border-sky-500/40',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const push = useCallback((t: ToastItem) => {
    setToasts((prev) => [...prev.slice(-3), t]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== t.id));
      timers.current.delete(t.id);
    }, 3200);
    timers.current.set(t.id, timer);
  }, []);

  useEffect(() => {
    emit = push;
    return () => {
      emit = null;
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, [push]);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2.5 w-[min(92vw,340px)] pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -14, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 48, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border ${ring[t.type]} bg-zinc-900/95 backdrop-blur-md px-3.5 py-3 shadow-2xl shadow-black/60`}
            >
              <span className="mt-px shrink-0">{icons[t.type]}</span>
              <p className="text-[13px] text-zinc-100 leading-snug flex-1">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 p-0.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
