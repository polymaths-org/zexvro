import { AlertCircle, Check, ChevronRight, KeyRound, Lock, Mail, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  confirmForgotPassword,
  confirmSignUp,
  forgotPassword,
  formatAuthError,
  persistSession,
  signInUser,
  signUpUser,
  type UserSession,
} from '../../auth/cognito';

const BRAND_MARK = '/brand/logo-transparent.png';
const BRAND_WORDMARK = '/brand/wordmark-transparent.png';
const AUTH_BACKGROUNDS = ['/backgrounds/cube.png', '/backgrounds/cube2.png'];

type AuthMode = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset';

interface AuthOverlayProps {
  onSuccess: (session: UserSession) => void;
}

export default function AuthOverlay({ onSuccess }: AuthOverlayProps) {
  const [backgroundImage] = useState(() => AUTH_BACKGROUNDS[Math.floor(Math.random() * AUTH_BACKGROUNDS.length)]);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isSignIn = mode === 'signin';
  const isSignUp = mode === 'signup';
  const isConfirm = mode === 'confirm';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  const setModeClean = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setMessage('');
    setCode('');
    if (nextMode !== 'reset') setPassword('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    const action = isSignIn
      ? 'signin'
      : isSignUp
        ? 'signup'
        : isConfirm
          ? 'confirm'
          : isForgot
            ? 'forgot'
            : isReset
              ? 'reset'
              : 'general';

    try {
      const cleanUsername = username.trim();
      const cleanEmail = email.trim();
      if (!cleanUsername) throw new Error('Enter a username.');
      if (cleanUsername.length < 3) throw new Error('Username must be at least 3 characters.');
      if (!/^[A-Za-z0-9_.=@+-]+$/.test(cleanUsername)) {
        throw new Error('Username can only use letters, numbers, and . _ - + @ =');
      }

      if (isSignIn) {
        if (!password) throw new Error('Enter your password.');
        const session = await signInUser(cleanUsername, password);
        persistSession(session);
        onSuccess(session);
        return;
      }

      if (isSignUp) {
        if (!cleanEmail) throw new Error('Enter your email.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          throw new Error('Enter a valid email address.');
        }
        if (!password) throw new Error('Choose a password.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
          throw new Error('Password needs letters and numbers.');
        }
        const result = await signUpUser(cleanUsername, cleanEmail, password);
        if (result.UserConfirmed) {
          setMessage('Account created. You can sign in now.');
          setMode('signin');
        } else {
          setMessage('We sent a code to your email. Enter it below to finish signup.');
          setMode('confirm');
        }
        return;
      }

      if (isConfirm) {
        if (!code.trim()) throw new Error('Enter the code from your email.');
        await confirmSignUp(cleanUsername, code.trim());
        setMessage('Email confirmed. You can sign in now.');
        setMode('signin');
        setCode('');
        return;
      }

      if (isForgot) {
        await forgotPassword(cleanUsername);
        setMessage('If that account exists, we emailed a reset code.');
        setMode('reset');
        return;
      }

      if (isReset) {
        if (!code.trim()) throw new Error('Enter the reset code from your email.');
        if (!password) throw new Error('Choose a new password.');
        if (password.length < 8) throw new Error('New password must be at least 8 characters.');
        if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
          throw new Error('Password needs letters and numbers.');
        }
        await confirmForgotPassword(cleanUsername, code.trim(), password);
        setMessage('Password updated. You can sign in now.');
        setMode('signin');
        setCode('');
        setPassword('');
      }
    } catch (err) {
      setError(formatAuthError(err, action));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050506] text-white font-sans">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,560px)]">
        <section className="relative hidden min-h-screen overflow-hidden border-r border-white/10 bg-black px-10 py-8 lg:flex lg:flex-col lg:justify-between">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-80"
            style={{ backgroundImage: `url(${backgroundImage})` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.10)_0%,rgba(0,0,0,0.04)_48%,rgba(0,0,0,0.34)_100%)]" aria-hidden="true" />
          <div className="relative z-10 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] shadow-[0_0_26px_rgba(255,255,255,0.08)]">
              <img src={BRAND_MARK} alt="ZEXVRO" className="h-8 w-8 object-contain" />
            </span>
            <img src={BRAND_WORDMARK} alt="ZEXVRO" className="h-5 max-w-[152px] object-contain" />
          </div>

          <div className="relative z-10 max-w-2xl">
            <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-white">
              Build quietly. Ship with proof.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-zinc-300">
              A workspace for agents, services, and operators to move from rough intent to verified execution.
            </p>
          </div>
        </section>

        <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-[430px]">
            <div className="mb-7 flex items-center justify-center gap-3 lg:hidden">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06]">
                <img src={BRAND_MARK} alt="ZEXVRO" className="h-8 w-8 object-contain" />
              </span>
              <img src={BRAND_WORDMARK} alt="ZEXVRO" className="h-5 max-w-[150px] object-contain" />
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">ZEXVRO Auth</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {isSignUp ? 'Create account' : isConfirm ? 'Confirm account' : isForgot ? 'Recover password' : isReset ? 'Set new password' : 'Sign in'}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {isSignIn && 'Sign in with your ZEXVRO account email or username.'}
                {isSignUp && 'Create a workspace account to access services and projects.'}
                {isConfirm && 'Enter the confirmation code sent to your email.'}
                {isForgot && 'We will email a reset code to recover your password.'}
                {isReset && 'Enter the reset code and choose a new password.'}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0B0D10]/95 p-5 shadow-2xl shadow-black/30">
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-sm font-semibold tracking-wide text-zinc-200">Workspace access</span>
                <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                  <KeyRound className="h-3 w-3" /> Secure
                </span>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold leading-relaxed text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {message && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-semibold leading-relaxed text-emerald-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase text-zinc-500">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="stellar_dev"
                      className="w-full rounded-md border border-white/10 bg-black/35 py-2.5 pl-9 pr-3 text-sm text-zinc-100 transition focus:border-white/40 focus:outline-none"
                    />
                  </div>
                </div>

                {isSignUp && (
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase text-zinc-500">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="dev@example.com"
                        className="w-full rounded-md border border-white/10 bg-black/35 py-2.5 pl-9 pr-3 text-sm text-zinc-100 transition focus:border-white/40 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {(isConfirm || isReset) && (
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase text-zinc-500">
                      Confirmation code
                    </label>
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                      className="w-full rounded-md border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-zinc-100 transition focus:border-white/40 focus:outline-none"
                    />
                  </div>
                )}

                {(isSignIn || isSignUp || isReset) && (
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase text-zinc-500">
                      {isReset ? 'New password' : 'Password'}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full rounded-md border border-white/10 bg-black/35 py-2.5 pl-9 pr-3 text-sm text-zinc-100 transition focus:border-white/40 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-xs font-bold uppercase text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>
                    {isLoading
                      ? 'Working'
                      : isSignUp
                        ? 'Create account'
                        : isConfirm
                          ? 'Confirm account'
                          : isForgot
                            ? 'Send reset code'
                            : isReset
                              ? 'Update password'
                              : 'Sign in'}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-5 space-y-2 border-t border-white/10 pt-3 text-center text-[11px] text-zinc-500">
                {isSignIn && (
                  <>
                    <button type="button" onClick={() => setModeClean('signup')} className="font-bold text-zinc-200 hover:text-white">
                      Create account
                    </button>
                    <span className="mx-2 text-zinc-700">/</span>
                    <button type="button" onClick={() => setModeClean('forgot')} className="font-bold text-zinc-200 hover:text-white">
                      Forgot password
                    </button>
                  </>
                )}
                {!isSignIn && (
                  <button type="button" onClick={() => setModeClean('signin')} className="font-bold text-zinc-200 hover:text-white">
                    Back to sign in
                  </button>
                )}
                {isSignUp && (
                  <>
                    <span className="mx-2 text-zinc-700">/</span>
                    <button type="button" onClick={() => setModeClean('confirm')} className="font-bold text-zinc-200 hover:text-white">
                      Already have a code
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="mt-5 text-center text-[10px] text-zinc-600">
              Secure workspace access · Stellar testnet ready
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
