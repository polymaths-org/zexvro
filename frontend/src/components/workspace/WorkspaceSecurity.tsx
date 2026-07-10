import { useState } from 'react';
import { KeyRound, ShieldAlert, Plus, Trash2, Copy, Check } from 'lucide-react';

type ApiKey = {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
};

export default function WorkspaceSecurity() {
  const [keys, setKeys] = useState<ApiKey[]>([
    { id: 'key-1', name: 'CLI Agent Deployment Token', key: 'zx_live_a928...3b1d', created: '10 days ago', lastUsed: '3 hours ago' },
    { id: 'key-2', name: 'GitHub Action Builder Sync', key: 'zx_live_f891...f3b5', created: '1 month ago', lastUsed: '5 days ago' }
  ]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const randomHex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const fullKey = `zx_live_${randomHex}`;
    const obfuscated = `zx_live_${randomHex.slice(0, 4)}...${randomHex.slice(-4)}`;

    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      key: obfuscated,
      created: 'Just now',
      lastUsed: 'Never'
    };

    setKeys(prev => [...prev, newKey]);
    setGeneratedKey(fullKey);
    setNewKeyName('');
  };

  const handleDeleteKey = (id: string) => {
    setKeys(prev => prev.filter(k => k.id !== id));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Security</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage API keys, authorization tokens, and audit platform connection permissions.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Token Generator */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">API & Deploy Tokens</h2>

            <form onSubmit={handleCreateKey} className="flex gap-2 mb-6">
              <input
                type="text"
                required
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Token label (e.g. staging-payout-pipeline)"
                className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Create Key
              </button>
            </form>

            {generatedKey && (
              <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <span className="text-emerald-800 dark:text-emerald-400 font-bold block mb-1">New Token Created!</span>
                <span className="text-zinc-500 dark:text-zinc-400 block mb-2">Copy this key now. You will not be able to view it again.</span>
                <div className="flex items-center justify-between rounded bg-zinc-950 p-2.5 font-mono text-zinc-100">
                  <span className="break-all">{generatedKey}</span>
                  <button
                    onClick={() => handleCopy(generatedKey, 'new')}
                    className="p-1 text-zinc-400 hover:text-white shrink-0 ml-2"
                  >
                    {copiedId === 'new' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {keys.map(k => (
                <div key={k.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-3.5 dark:border-zinc-850/60 dark:bg-zinc-900/10">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">{k.name}</span>
                    <span className="text-[10px] font-mono text-zinc-500 mt-1 block tracking-wider">{k.key}</span>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                      <span>Created {k.created}</span>
                      <span>•</span>
                      <span>Last used {k.lastUsed}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteKey(k.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security Overview */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Security Checklist</h2>
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-650 dark:text-zinc-400">Multi-Factor Auth (MFA)</span>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                  Enabled
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-650 dark:text-zinc-400">Single Sign-On (SSO)</span>
                <span className="text-zinc-400">Disabled</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-650 dark:text-zinc-400">IP Safeguard Whitelist</span>
                <span className="text-zinc-400">0 active hosts</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-amber-800 dark:text-amber-400 block">Security Alert</span>
              <span className="text-zinc-555 dark:text-zinc-350 mt-1 block">
                Two API deployments were initiated from unverified IPv6 addresses. Verify your active runners in logs.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
