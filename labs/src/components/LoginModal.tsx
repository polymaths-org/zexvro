import React, { useState } from 'react';
import { Github, X, Loader2, Mail, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';
import { signInWithGithub, signInWithGoogle, signInWithEmail, resolveUser } from '../lib/firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccessLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'social' | 'email'>('social');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const finish = async (fbUser: any) => {
    try {
      const { user } = await resolveUser(fbUser);
      onSuccessLogin(user);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not load your profile.');
      setLoading(false);
    }
  };

  const handleGithub = async () => {
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithGithub();
      await finish(cred.user);
    } catch (err: any) {
      setError(cleanAuthError(err));
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithGoogle();
      await finish(cred.user);
    } catch (err: any) {
      setError(cleanAuthError(err));
      setLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithEmail(email.trim(), password);
      await finish(cred.user);
    } catch (err: any) {
      setError(cleanAuthError(err));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn text-zinc-100">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-700 rounded-2xl p-6 sm:p-8 shadow-2xl overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex justify-center mb-5">
          <img src="/brand/logo.png" alt="ZEXVRO" className="h-14 w-14 object-contain" />
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-white tracking-tight font-heading">Sign in to ZEXVRO Labs</h2>
          <p className="text-xs text-zinc-400 mt-1.5">
            Continue with GitHub, Google, or email to access labs, track progress, and earn badges.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-zinc-900 border border-red-800 rounded-xl text-red-300 text-xs text-center font-mono">
            {error}
          </div>
        )}

        {mode === 'social' ? (
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGithub}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-200 text-black font-extrabold py-3.5 px-4 rounded-2xl border border-white shadow-lg transition-all font-heading"
            >
              <Github className="h-5 w-5 text-black" />
              <span className="text-sm">{loading ? 'Signing in...' : 'Continue with GitHub'}</span>
              {loading && <Loader2 className="h-4 w-4 text-zinc-500 animate-spin ml-auto" />}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3.5 px-4 rounded-2xl border border-zinc-700 transition-all font-heading"
            >
              <GoogleIcon />
              <span className="text-sm">Continue with Google</span>
            </motion.button>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px bg-zinc-800 flex-1" />
              <span className="text-[10px] font-mono text-zinc-500 uppercase">or</span>
              <div className="h-px bg-zinc-800 flex-1" />
            </div>

            <button
              onClick={() => setMode('email')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl border border-dashed border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-bold font-heading transition-all"
            >
              <Mail className="h-4 w-4" />
              Sign in with email
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-white"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-black font-extrabold py-3 px-4 rounded-2xl font-heading text-sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('social')}
              className="w-full text-xs font-mono text-zinc-500 hover:text-white font-bold py-1"
            >
              ← Back to social sign-in
            </button>
            <p className="text-[11px] text-zinc-600 font-mono text-center">
              Email sign-in requires Email/Password auth enabled in Firebase. Use it for accounts created here.
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
};

function cleanAuthError(err: any): string {
  const code = err?.code || '';
  if (code.includes('auth/popup-closed-by-user')) return 'Sign-in window was closed. Try again.';
  if (code.includes('auth/popup-blocked')) return 'Popup was blocked. Allow popups for this site.';
  if (code.includes('auth/account-exists-with-different-credential'))
    return 'An account with this email exists via a different provider.';
  if (code.includes('auth/unauthorized-domain'))
    return 'This domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.';
  if (code.includes('auth/wrong-password') || code.includes('auth/invalid-credential'))
    return 'Incorrect email or password.';
  if (code.includes('auth/user-not-found')) return 'No account found for that email.';
  if (code.includes('auth/email-already-in-use')) return 'That email is already in use. Sign in instead.';
  if (code.includes('auth/operation-not-allowed') || code.includes('auth/configuration-not-found'))
    return 'This sign-in method is not enabled in Firebase. Enable it under Authentication → Sign-in method.';
  return err?.message || 'Authentication failed. Please try again.';
}

const GoogleIcon: React.FC = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);
