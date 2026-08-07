import React, { useState } from 'react';
import { Github, X, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';
import { signInWithGithub, signInWithGithubRedirect, isSafari, isIndexedDbUnavailableError, recoverWithReload, resolveUser } from '../lib/firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessLogin: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccessLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Redirect flow (Safari): the page navigates to GitHub and reloads signed
      // in, so there is no credential to resolve here — the session restores on boot.
      if (!cred) return;
      await finish(cred.user);
    } catch (err: any) {
      // Safari's IndexedDB can be wedged at click time too (sign-in writes
      // pending state to IDB before navigating). A single reload re-establishes
      // it and the user can just click again.
      if (isIndexedDbUnavailableError(err)) {
        recoverWithReload();
        return;
      }
      const code = err?.code || '';
      const popupBroke = [
        'auth/popup-blocked',
        'auth/cancelled-popup-request',
        'auth/network-request-failed',
        'auth/web-storage-unsupported',
        'auth/operation-not-allowed',
      ].includes(code);
      if (!isSafari() && popupBroke) {
        // Popup was blocked or Safari-style storage broke the handshake —
        // fall back to the full-page redirect so GitHub auth still works.
        try {
          await signInWithGithubRedirect();
          return;
        } catch (fallbackErr: any) {
          setError(cleanAuthError(fallbackErr));
          setLoading(false);
          return;
        }
      }
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
            Continue with GitHub to access labs, track progress, and earn badges.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-zinc-900 border border-red-800 rounded-xl text-red-300 text-xs text-center font-mono">
            {error}
          </div>
        )}

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

          {!loading && (
            <p className="text-[11px] text-zinc-600 font-mono text-center pt-1">
              Authentication is handled securely via GitHub OAuth.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

function cleanAuthError(err: any): string {
  const code = err?.code || '';
  if (code.includes('auth/popup-closed-by-user')) return 'Sign-in window was closed. Try again.';
  if (code.includes('auth/popup-blocked')) return 'Popup was blocked. Allow popups for this site.';
  if (code.includes('auth/web-storage-unsupported'))
    return 'Your browser is blocking the storage this sign-in needs. Try a different browser or enable third-party cookies.';
  if (code.includes('auth/account-exists-with-different-credential'))
    return 'An account with this email exists via a different provider.';
  if (code.includes('auth/unauthorized-domain'))
    return 'This domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.';
  return err?.message || 'Authentication failed. Please try again.';
}