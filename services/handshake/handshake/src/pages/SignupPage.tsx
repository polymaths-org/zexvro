import React, { useState, useEffect } from 'react';
import { UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getAvatarForUser, prettyName } from '../utils/avatar';

export const SignupPage: React.FC = () => {
  const { navigate, sessionUser, signIn } = useApp();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionUser) navigate({ page: 'home' }, { replace: true });
  }, [sessionUser, navigate]);

  const clean = username.trim().toLowerCase();
  const usernameValid = /^[a-z0-9_-]{3,20}$/.test(clean);

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameValid) {
      setError('Username needs 3–20 chars: lowercase letters, numbers, - or _.');
      return;
    }
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password needs at least 8 characters.');
      return;
    }
    if (!agreed) {
      setError('Please accept the terms to continue.');
      return;
    }
    setError('');
    signIn(clean);
    navigate({ page: 'home' });
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
        <p className="text-xs text-[#A1A1AA]">Create your account to publish and fork contracts.</p>
      </div>

      <div className="p-6 rounded-[8px] border border-[#27272A] bg-[#0A0A0B]">
        {/* Live identicon preview */}
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#27272A]">
          <img
            src={getAvatarForUser(clean || 'new-dev')}
            alt="Profile preview"
            className="w-11 h-11 rounded-full object-cover border-2 border-[#3F3F46]"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#FAFAFA] truncate">
              {clean ? prettyName(clean) : 'Your name'}
            </div>
            <div className="text-[11px] text-[#71717A] font-mono truncate">
              @{clean || 'username'} · identicon updates as you type
            </div>
          </div>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="signup-username" className="text-xs font-medium text-[#A1A1AA]">
              Username
            </label>
            <input
              id="signup-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. soroban-fan"
              autoComplete="username"
              autoFocus
              className={`${inputCls} font-mono`}
            />
            {username && !usernameValid && (
              <p className="text-[11px] text-[#F59E0B]">3–20 chars: lowercase, numbers, - or _.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="signup-email" className="text-xs font-medium text-[#A1A1AA]">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.dev"
              autoComplete="email"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="signup-password" className="text-xs font-medium text-[#A1A1AA]">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-[#A1A1AA] cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-[#3B82F6]"
            />
            <span>
              I agree to the Terms and confirm I have rights to any source I publish.
            </span>
          </label>
          {error && <p className="text-xs text-[#EF4444]">{error}</p>}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-[6px] bg-[#FFFFFF] hover:bg-[#E4E4E7] text-[#050505] font-semibold text-xs transition-all active:scale-[0.99]"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create account</span>
          </button>
        </form>
      </div>

      <p className="text-xs text-[#71717A] text-center mt-6">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => navigate({ page: 'login' })}
          className="text-[#3B82F6] hover:underline font-medium"
        >
          Sign in
        </button>
      </p>
    </div>
  );
};
