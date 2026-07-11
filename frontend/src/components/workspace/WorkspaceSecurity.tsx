import { useState } from 'react';
import { ShieldCheck, Plus, Trash2, Copy, Check } from 'lucide-react';

type ApiKey = {
  id: string;
  name: string;
  key: string;
  createdAt: number;
  lastUsedAt: number | null;
};

type SecuritySettings = {
  requireMfaForAdmins: boolean;
  ownerOnlyTokens: boolean;
  requireDeploymentApproval: boolean;
  ipAllowlist: string;
};

function createTokenSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WorkspaceSecurity() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    requireMfaForAdmins: false,
    ownerOnlyTokens: true,
    requireDeploymentApproval: false,
    ipAllowlist: '',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const secret = createTokenSecret();
    const fullKey = `zx_live_${secret}`;
    const obfuscated = `zx_live_${secret.slice(0, 4)}...${secret.slice(-4)}`;

    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      key: obfuscated,
      createdAt: Date.now(),
      lastUsedAt: null,
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

  const toggleSetting = (key: keyof Omit<SecuritySettings, 'ipAllowlist'>) => {
    setSecuritySettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
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
              {keys.length === 0 && (
                <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                  No API or deploy tokens have been created for this workspace.
                </div>
              )}

              {keys.map(k => (
                <div key={k.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-3.5 dark:border-zinc-850/60 dark:bg-zinc-900/10">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">{k.name}</span>
                    <span className="text-[10px] font-mono text-zinc-500 mt-1 block tracking-wider">{k.key}</span>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                      <span>Created {formatDate(k.createdAt)}</span>
                      <span>•</span>
                      <span>Last used {k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never'}</span>
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
            <div className="space-y-3 mt-4 text-xs">
              {[
                ['requireMfaForAdmins', 'Require MFA for admins'],
                ['ownerOnlyTokens', 'Only owners can create tokens'],
                ['requireDeploymentApproval', 'Require deployment approval'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3">
                  <span className="text-zinc-650 dark:text-zinc-400">{label}</span>
                  <input
                    type="checkbox"
                    checked={securitySettings[key as keyof Omit<SecuritySettings, 'ipAllowlist'>]}
                    onChange={() => toggleSetting(key as keyof Omit<SecuritySettings, 'ipAllowlist'>)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
                  />
                </label>
              ))}

              <label className="block">
                <span className="mb-1.5 block text-zinc-650 dark:text-zinc-400">Allowed IP ranges</span>
                <textarea
                  value={securitySettings.ipAllowlist}
                  onChange={e => setSecuritySettings(prev => ({ ...prev, ipAllowlist: e.target.value }))}
                  placeholder="One CIDR range per line"
                  rows={4}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 flex gap-3 dark:border-zinc-800 dark:bg-[#080809]">
            <ShieldCheck className="h-5 w-5 text-zinc-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-zinc-900 dark:text-white block">Security Events</span>
              <span className="text-zinc-555 dark:text-zinc-350 mt-1 block">
                No security events have been recorded for this workspace.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
