import React, { useState } from 'react';
import { Shield, Check, X, RefreshCw } from 'lucide-react';

interface CliActivationProps {
  code: string;
  token: string;
  apiBaseUrl: string;
  onClose: () => void;
}

export default function CliActivation({ code, token, apiBaseUrl, onClose }: CliActivationProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'rejected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleAction = async (action: 'approve' | 'reject') => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const response = await fetch(`${apiBaseUrl}/auth/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_code: code,
          action: action
        })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setStatus(action === 'approve' ? 'success' : 'rejected');
      } else {
        throw new Error(data.error_description || data.error || 'Failed to authorize device.');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown network error.');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center relative z-10">
          <div className="mx-auto w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
            <Shield className="w-6 h-6 text-blue-500" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            Link CLI Device
          </h2>
          <p className="text-sm text-zinc-400 mb-8 max-w-sm mx-auto">
            A CLI agent is requesting authorization to link to your ZEXVRO account.
          </p>

          {status === 'idle' && (
            <>
              {/* Code Display */}
              <div className="bg-black/60 border border-zinc-900 rounded-lg p-5 mb-8 tracking-widest text-2xl font-mono text-white font-bold select-all select-none">
                {code}
              </div>

              <p className="text-xs text-zinc-500 mb-8 max-w-xs mx-auto">
                Approve to grant access to read/write workspace settings and query agent memory.
              </p>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleAction('reject')}
                  className="w-full py-3 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-medium text-zinc-350 hover:text-white transition-all cursor-pointer"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction('approve')}
                  className="w-full py-3 px-4 rounded-lg bg-white hover:bg-zinc-200 text-sm font-medium text-black transition-all cursor-pointer font-semibold shadow-lg hover:shadow-white/5"
                >
                  Approve
                </button>
              </div>
            </>
          )}

          {status === 'loading' && (
            <div className="py-12 flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-sm text-zinc-400">Processing authorization...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <Check className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Successfully Linked!</h3>
              <p className="text-sm text-zinc-400 mb-8 max-w-xs mx-auto">
                Your device has been authenticated. You can close this tab and return to the terminal.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-medium text-white transition-all cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {status === 'rejected' && (
            <div className="py-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Request Rejected</h3>
              <p className="text-sm text-zinc-400 mb-8 max-w-xs mx-auto">
                You denied authorization for this CLI device.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-medium text-white transition-all cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-rose-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Authorization Failed</h3>
              <p className="text-sm text-rose-400 mb-8 max-w-xs mx-auto">
                {errorMessage}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setStatus('idle')}
                  className="w-full py-3 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-medium text-zinc-300 transition-all cursor-pointer"
                >
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-medium text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
