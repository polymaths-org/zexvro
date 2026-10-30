import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { BlurText } from './BlurText';
import { joinWaitlist } from '../lib/waitlist';

const ease = [0.16, 1, 0.3, 1] as const;

// Standalone waitlist page at /waitlist: the landing's dark system with the email form centred.
export const WaitlistPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'joined' | 'already' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Join the waitlist | ZEXVRO';
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setStatus('loading');
    setError('');

    const result = await joinWaitlist(trimmed, 'waitlist-page');
    if (result.kind === 'error') {
      setStatus('error');
      setError(result.message);
      return;
    }
    setStatus(result.kind);
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
    <main className="relative flex min-h-[100svh] w-full flex-col items-center justify-center overflow-hidden bg-black px-6 py-16 text-white">
      <div className="absolute inset-0 bg-radial from-blue-950/20 via-transparent to-transparent pointer-events-none" />
      <div className="grain-overlay" />
      <div className="vignette" />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        <motion.a
          href="/"
          aria-label="ZEXVRO home"
          initial={{ opacity: 0, filter: 'blur(20px)', y: 24, scale: 0.96 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0, scale: 1 }}
          transition={{ duration: 1.1, ease }}
          className="mb-10 flex flex-col items-center gap-4"
        >
          <img
            src="/logo-transparent.png"
            alt=""
            className="h-12 w-12 sm:h-14 sm:w-14 object-contain drop-shadow-[0_0_30px_rgba(48,41,255,0.35)]"
          />
          <img
            src="/wordmark-transparent.png"
            alt="ZEXVRO"
            className="h-7 sm:h-9 md:h-11 object-contain opacity-95"
          />
        </motion.a>

        <BlurText
          text="Get early access"
          animateBy="words"
          delay={120}
          direction="top"
          replay
          as="h1"
          className="font-pixel text-2xl sm:text-3xl md:text-4xl font-bold text-white justify-center mb-4 tracking-wide"
        />

        <motion.p
          initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.2, ease }}
          className="text-sm sm:text-base text-white/65 font-medium max-w-md leading-relaxed mb-10"
        >
          Be first when ZEXVRO opens for builders.
        </motion.p>

        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.28, ease }}
          className="w-full max-w-md flex flex-col sm:flex-row gap-3"
        >
          <label htmlFor="waitlist-email" className="sr-only">
            Email address
          </label>
          <input
            id="waitlist-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            disabled={done || status === 'loading'}
            className="flex-1 rounded-full border border-white/15 bg-white/[0.06] px-5 py-3.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/35 transition-colors disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={done || status === 'loading'}
            className="group shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-6 py-3.5 text-sm font-bold transition-transform active:scale-95 hover:bg-white/90 disabled:opacity-80 disabled:active:scale-100"
          >
            {buttonLabel}
            {status === 'loading' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              !done && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>
        </motion.form>

        <div aria-live="polite" className="mt-4 min-h-[1.25rem] text-sm">
          {status === 'error' && error && <p className="text-red-400/90">{error}</p>}
          {status === 'already' && <p className="text-white/50">This email is already on the waitlist.</p>}
        </div>

        <a href="/" className="mt-16 text-xs text-white/40 transition-colors hover:text-white/70">
          Back to home
        </a>
      </div>
    </main>
  );
};
