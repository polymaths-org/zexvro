import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { BlurText } from './BlurText';

const ease = [0.16, 1, 0.3, 1] as const;

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '') ||
  'https://qkuostruh3.execute-api.us-east-1.amazonaws.com';

export const Waitlist: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'joined' | 'already' | 'error'>('idle');
  const [error, setError] = useState('');

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
        body: JSON.stringify({ email: trimmed, source: 'landing' }),
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

      if (data.status === 'already_joined') {
        setStatus('already');
      } else {
        setStatus('joined');
      }
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
    <section
      id="waitlist"
      className="relative w-full py-28 md:py-36 px-6 md:px-12 bg-black border-t border-white/5 overflow-hidden"
    >
      <div className="absolute inset-0 bg-radial from-blue-950/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, filter: 'blur(28px)', y: 36, scale: 0.94 }}
          whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0, scale: 1 }}
          viewport={{ once: false, amount: 0.45 }}
          transition={{ duration: 1.35, ease }}
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
        </motion.div>

        <BlurText
          text="Get early access"
          animateBy="words"
          delay={120}
          direction="top"
          replay
          as="h2"
          className="font-pixel text-2xl sm:text-3xl md:text-4xl font-bold text-white justify-center mb-4 tracking-wide"
        />

        <motion.p
          initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: false }}
          transition={{ duration: 0.8, delay: 0.2, ease }}
          className="text-sm sm:text-base text-white/65 font-medium max-w-md leading-relaxed mb-10"
        >
          Join the waitlist — be first when ZEXVRO opens for builders.
        </motion.p>

        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false }}
          transition={{ duration: 0.7, delay: 0.28, ease }}
          className="w-full max-w-md flex flex-col sm:flex-row gap-3"
        >
          <input
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
              !done && (
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              )
            )}
          </button>
        </motion.form>

        {status === 'error' && error && (
          <p className="mt-4 text-sm text-red-400/90">{error}</p>
        )}
        {status === 'already' && (
          <p className="mt-4 text-sm text-white/50">This email is already on the waitlist.</p>
        )}
      </div>
    </section>
  );
};
