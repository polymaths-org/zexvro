import React, { useState, useEffect } from 'react';
import { LogIn, ArrowLeft, MailCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LoginPage: React.FC = () => {
  const { navigate, sessionUser, signIn } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (sessionUser) navigate({ page: 'home' }, { replace: true });
  }, [sessionUser, navigate]);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,20}$/.test(clean)) {
      setError('Enter your username (3–20 chars: letters, numbers, - or _).');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setError('');
    signIn(clean);
    navigate({ page: 'home' });
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.includes('@')) {
      setError('Enter the email address on your account.');
      return;
    }
    setError('');
    setResetSent(true);
  };

  const inputCls =
    'w-full px-3 py-2 rounded-[6px] bg-[#0A0A0B] border border-[#27272A] text-sm text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:border-[#3B82F6] transition-colors';

  return (
    <div className="max-w-sm mx-auto px-4 pt-14 pb-20">
      <div className="text-center space-y-3 mb-8">
        <img
          src="/handshake-logo.png"
          alt="Handshake logo"
          className="w-12 h-12 rounded-[8px] object-cover mx-auto shadow-sm"
        />
        <div className="font-display font-bold uppercase tracking-[0.14em] text-sm text-[#FAFAFA]">
          Handshake
        </div>
        <p className="text-xs text-[#A1A1AA]">
          {mode === 'signin' ? 'Sign in to publish, fork, and star contracts.' : 'Reset your password.'}
        </p>
      </div>

      <div className="p-6 rounded-[8px] border border-[#27272A] bg-[#0A0A0B] space-y-4">
        {mode === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-username" className="text-xs font-medium text-[#A1A1AA]">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alex-dev"
                autoComplete="username"
                autoFocus
                className={`${inputCls} font-mono`}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-medium text-[#A1A1AA]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                  }}
                  className="text-[11px] text-[#3B82F6] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className={inputCls}
              />
            </div>
            {error && <p className="text-xs text-[#EF4444]">{error}</p>}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all active:scale-[0.99]"
            >
              <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Sign in</span>
            </button>
            <p className="text-[11px] text-[#52525B] text-center font-mono">
              Local demo auth — any password works. SSO lands with the registry API.
            </p>
          </form>
        ) : resetSent ? (
          <div className="text-center space-y-3 py-2">
            <div className="w-11 h-11 mx-auto rounded-[8px] bg-[#22C55E]/10 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E]">
              <MailCheck className="w-5 h-5" />
            </div>
            <p className="text-sm text-[#FAFAFA] font-medium">Check your inbox</p>
            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              If an account exists for <span className="text-[#FAFAFA] font-mono">{resetEmail}</span>, a reset
              link is on its way.
            </p>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setResetSent(false);
              }}
              className="text-xs text-[#3B82F6] hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to sign in</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="text-xs font-medium text-[#A1A1AA]">
                Account email
              </label>
              <input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@studio.dev"
                autoComplete="email"
                autoFocus
                className={inputCls}
              />
            </div>
            {error && <p className="text-xs text-[#EF4444]">{error}</p>}
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all active:scale-[0.99]"
            >
              Send reset link
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              className="w-full text-xs text-[#A1A1AA] hover:text-[#FAFAFA] inline-flex items-center justify-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to sign in</span>
            </button>
          </form>
        )}
      </div>

      <p className="text-xs text-[#71717A] text-center mt-6">
        New to Handshake?{' '}
        <button
          type="button"
          onClick={() => navigate({ page: 'signup' })}
          className="text-[#3B82F6] hover:underline font-medium"
        >
          Create an account
        </button>
      </p>
    </div>
  );
};
