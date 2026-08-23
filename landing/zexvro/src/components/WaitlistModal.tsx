import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Loader2, X } from 'lucide-react';
import { Glass } from './Glass';

const ease = [0.16, 1, 0.3, 1] as const;

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '') ||
  'https://qkuostruh3.execute-api.us-east-1.amazonaws.com';

type Props = { open: boolean; onClose: () => void };

export const WaitlistModal: React.FC<Props> = ({ open, onClose }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'joined' | 'already' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setStatus('loading');
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'landing-modal' }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        error_description?: string;
        error?: string;
      };

      if (!res.ok) {
        setStatus('error');
        setError(data.error_description || data.error || 'Something went wrong. Try again.');
        return;
      }

      setStatus(data.status === 'already_joined' ? 'already' : 'joined');
    } catch {
      setStatus('error');
      setError('Network error. Check your connection and try again.');
    }
  };

  const done = status === 'joined' || status === 'already';
  const buttonLabel =
    status === 'loading'
      ? 'Joining…'
      : status === 'joined'
        ? "You're on the list"
        : status === 'already'
          ? 'Already on the list'
          : 'Join waitlist';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Join the waitlist"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.94, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 16, scale: 0.96, filter: 'blur(8px)' }}
            transition={{ duration: 0.5, ease }}
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <Glass active radius={24} className="p-7 sm:p-8 bg-black/40">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.14] transition-colors"
              >
                <X size={15} />
              </button>

              <div className="flex flex-col items-center text-center">
                <img
                  src="/logo-transparent.png"
                  alt=""
                  className="h-10 w-10 object-contain drop-shadow-[0_0_24px_rgba(48,41,255,0.35)] mb-3"
                />
                <h2 className="font-pixel text-xl sm:text-2xl font-bold text-white tracking-wide mb-2">
                  Join the waitlist
                </h2>
                <p className="text-sm text-white/60 font-medium leading-relaxed mb-7 max-w-xs">
                  Be first when ZEXVRO opens for builders.
                </p>

                {done ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease }}
                    className="w-full flex flex-col items-center gap-4"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
                      <ArrowRight size={22} className="text-emerald-300 -rotate-45" />
                    </div>
                    <p className="text-sm text-white/70">
                      {status === 'already'
                        ? 'This email is already on the waitlist.'
                        : "You're in — we'll email you when it's your turn."}
                    </p>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-1 rounded-full bg-white text-black px-6 py-2.5 text-xs font-bold hover:bg-white/90 transition-colors"
                    >
                      Done
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={onSubmit} className="w-full flex flex-col gap-3">
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      disabled={status === 'loading'}
                      className="w-full rounded-full border border-white/15 bg-white/[0.06] px-5 py-3.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/35 transition-colors disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={status === 'loading'}
                      className="group inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-6 py-3.5 text-sm font-bold transition-transform active:scale-95 hover:bg-white/90 disabled:opacity-80 disabled:active:scale-100"
                    >
                      {buttonLabel}
                      {status === 'loading' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                      )}
                    </button>
                    {status === 'error' && error && (
                      <p className="text-sm text-red-400/90">{error}</p>
                    )}
                  </form>
                )}
              </div>
            </Glass>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
