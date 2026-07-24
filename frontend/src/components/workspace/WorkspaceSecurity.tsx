import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';
import { useParams } from '@tanstack/react-router';
import { copyText } from '../../lib/clipboard';

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

const DEFAULT_SETTINGS: SecuritySettings = {
  requireMfaForAdmins: false,
  ownerOnlyTokens: true,
  requireDeploymentApproval: false,
  ipAllowlist: '',
};

function storageKey(workspaceId: string | undefined, suffix: string) {
  return `zexvro.security.${workspaceId || 'local'}.${suffix}`;
}

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

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function WorkspaceSecurity() {
  const { workspaceId } = useParams({ strict: false });
  const keysKey = storageKey(workspaceId, 'tokens');
  const settingsKey = storageKey(workspaceId, 'settings');

  const [keys, setKeys] = useState<ApiKey[]>(() => loadJson(keysKey, []));
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(() =>
    loadJson(settingsKey, DEFAULT_SETTINGS),
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  useEffect(() => {
    setKeys(loadJson(keysKey, []));
    setSecuritySettings(loadJson(settingsKey, DEFAULT_SETTINGS));
    setGeneratedKey(null);
  }, [keysKey, settingsKey]);

  useEffect(() => {
    try {
      localStorage.setItem(keysKey, JSON.stringify(keys));
    } catch { /* ignore quota */ }
  }, [keys, keysKey]);

  useEffect(() => {
    try {
      localStorage.setItem(settingsKey, JSON.stringify(securitySettings));
    } catch { /* ignore quota */ }
  }, [securitySettings, settingsKey]);

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const secret = createTokenSecret();
    const fullKey = `zx_local_${secret}`;
    const obfuscated = `zx_local_${secret.slice(0, 4)}...${secret.slice(-4)}`;

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

  const handleCopy = async (text: string, id: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } else {
      window.prompt('Copy this value:', text);
    }
  };

  const toggleSetting = (key: keyof Omit<SecuritySettings, 'ipAllowlist'>) => {
    setSecuritySettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Security</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Local draft for API tokens and policy checklists. Not platform-backed yet.
        </p>
      </div>

      <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Browser-only · not enforced by the API</p>
          <p className="mt-1 text-amber-800/80 dark:text-amber-200/70">
            Tokens and checklist toggles stay in this browser&apos;s localStorage for this workspace.
            They do not authorize Morph, Gate, or deploy APIs until a security backend ships.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Local draft tokens</h2>

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
                <Plus className="h-4 w-4" /> Create draft
              </button>
            </form>

            {generatedKey && (
              <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <span className="text-emerald-800 dark:text-emerald-400 font-bold block mb-1">Draft token created</span>
                <span className="text-zinc-500 dark:text-zinc-400 block mb-2">
                  Copy now if you need it for notes. This value is not accepted by ZEXVRO APIs.
                </span>
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
                  No draft tokens for this workspace in this browser.
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
                      <span>Local only</span>
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

        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#080809]">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Policy checklist (local)</h2>
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
                <span className="mb-1.5 block text-zinc-650 dark:text-zinc-400">Allowed IP ranges (notes)</span>
                <textarea
                  value={securitySettings.ipAllowlist}
                  onChange={e => setSecuritySettings(prev => ({ ...prev, ipAllowlist: e.target.value }))}
                  placeholder="One CIDR range per line — not enforced yet"
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
                No platform security event stream is connected. Use Audit Log for workspace activity when available.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
