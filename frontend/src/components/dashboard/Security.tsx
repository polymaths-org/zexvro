import React, { useState } from 'react';
import { 
  ShieldCheck, KeyRound, ScrollText, Play, ShieldAlert, CheckCircle2, 
  Trash2, X, Plus, Copy, AlertTriangle, Fingerprint, Eye, EyeOff 
} from 'lucide-react';
import { SecurityKey, AuditLog } from '../../types';
import { mockSecurityKeys, mockAuditLogs } from '../../data/mock';
import { motion, AnimatePresence } from 'motion/react';
import { copyText } from '../../lib/clipboard';

export default function Security() {
  const [keys, setKeys] = useState<SecurityKey[]>(mockSecurityKeys);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(mockAuditLogs);
  
  // New key generator state
  const [newKeyName, setNewKeyName] = useState('');
  const [showKeyGenerator, setShowKeyGenerator] = useState(false);
  const [generatedKeyValue, setGeneratedKeyValue] = useState('');
  const [copied, setCopied] = useState(false);

  // Toggle key visibility state
  const [visibleKeyId, setVisibleKeyId] = useState<string | null>(null);

  // Handle revoking key
  const handleRevokeKey = (keyId: string) => {
    if (confirm('Are you absolutely sure you want to revoke this API credential? This action is irreversible.')) {
      setKeys(prev => prev.map(k => {
        if (k.id === keyId) {
          return { ...k, status: 'revoked' };
        }
        return k;
      }));

      // Add audit log entry
      const revokedKeyName = keys.find(k => k.id === keyId)?.name || 'API Key';
      const newAudit: AuditLog = {
        id: `log-${Date.now()}`,
        timestamp: 'Just now',
        actor: 'Workspace',
        action: 'REVOKE_API_KEY',
        target: revokedKeyName,
        status: 'warning',
        ip: 'local'
      };
      setAuditLogs([newAudit, ...auditLogs]);
    }
  };

  // Handle generating new key
  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const rawKey = `zex_test_placeholder_${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
    
    const newKey: SecurityKey = {
      id: `key-${Date.now()}`,
      name: newKeyName,
      keyPrefix: rawKey,
      created: 'Just now',
      lastUsed: 'Never',
      status: 'active',
      owner: 'Workspace'
    };

    setKeys([newKey, ...keys]);
    setGeneratedKeyValue(`zex_test_placeholder_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`);
    setNewKeyName('');
    
    // Add audit log entry
    const newAudit: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: 'Just now',
      actor: 'Workspace',
      action: 'CREATE_API_KEY',
      target: newKeyName,
      status: 'success',
      ip: 'local'
    };
    setAuditLogs([newAudit, ...auditLogs]);
  };

  const copyToClipboard = async () => {
    const ok = await copyText(generatedKeyValue);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      window.prompt('Copy this value:', generatedKeyValue);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold font-heading tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-blue" />
          Security & Access Manager
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Manage API keys, secrets placeholders, audit logs, and human-to-agent access policies
        </p>
      </div>

      {/* Risk Indicators / Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'Audit policy',
            value: 'Draft',
            desc: 'Backend verification not connected',
            status: 'secure',
            color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5'
          },
          {
            title: 'Agent Access Policy',
            value: 'Draft',
            desc: 'Strict manual signature required',
            status: 'secure',
            color: 'text-brand-blue border-brand-blue/20 bg-brand-blue/5'
          },
          {
            title: 'Exposure Incidents',
            value: 'No data',
            desc: 'Incident stream is not connected',
            status: 'warning',
            color: 'text-amber-500 border-amber-500/20 bg-amber-500/5'
          }
        ].map((card) => (
          <div key={card.title} className={`p-4 rounded-lg border flex flex-col justify-between ${card.color}`}>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider block opacity-70">{card.title}</span>
            <div className="mt-3.5">
              <span className="text-xl font-bold font-heading">{card.value}</span>
              <p className="text-[10px] mt-0.5 opacity-80">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* API Keys and Secrets Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column (2 Cols Wide): API Key Management */}
        <div className="xl:col-span-2 p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-blue" />
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase font-mono">Platform API Keys</h3>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Provable credentials for node operations</p>
              </div>
            </div>

            <button
              onClick={() => setShowKeyGenerator(!showKeyGenerator)}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-200 font-mono text-[10px] font-bold hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              {showKeyGenerator ? 'Close' : 'Generate Key'}
            </button>
          </div>

          {/* Key Generator Form Expansion */}
          <AnimatePresence>
            {showKeyGenerator && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3.5 rounded bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 space-y-3"
              >
                <form onSubmit={handleGenerateKey} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-[9px] font-mono font-bold text-zinc-400 uppercase mb-1">Key Description name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Local development key"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded text-[10px] font-mono font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 cursor-pointer"
                  >
                    Generate
                  </button>
                </form>

                {generatedKeyValue && (
                  <div className="p-3.5 bg-brand-blue/5 border border-brand-blue/20 rounded font-mono text-[10.5px] text-zinc-800 dark:text-zinc-200 space-y-2">
                    <p className="text-[10px] text-brand-blue font-semibold uppercase">Key successfully generated! Copy it now (it will not be shown again):</p>
                    <div className="flex items-center justify-between gap-2 bg-zinc-950 p-2 rounded text-zinc-300 select-all border border-zinc-800">
                      <span className="truncate">{generatedKeyValue}</span>
                      <button 
                        onClick={copyToClipboard}
                        className="text-zinc-500 hover:text-white shrink-0"
                        title="Copy to clipboard"
                      >
                        {copied ? 'Copied!' : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Keys Table list */}
          {keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400 mb-3">
                <KeyRound className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No API keys created</p>
              <p className="text-[11px] text-zinc-400 mt-1">Generate your first key to authenticate workspace operations.</p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 font-mono text-zinc-400">
                  <th className="pb-2">Key Identifier</th>
                  <th className="pb-2">Prefix</th>
                  <th className="pb-2">Created</th>
                  <th className="pb-2">Last Used</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                    <td className="py-3 font-semibold text-zinc-900 dark:text-white">{k.name}</td>
                    <td className="py-3 text-zinc-500 dark:text-zinc-400 text-[10.5px]">
                      {visibleKeyId === k.id ? (
                        <span>{k.keyPrefix}</span>
                      ) : (
                        <span>zex_test_••••••••••••••</span>
                      )}
                    </td>
                    <td className="py-3 text-zinc-400 text-[10px]">{k.created}</td>
                    <td className="py-3 text-zinc-400 text-[10px]">{k.lastUsed}</td>
                    <td className="py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                        k.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {k.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          onClick={() => setVisibleKeyId(visibleKeyId === k.id ? null : k.id)}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          {visibleKeyId === k.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          disabled={k.status === 'revoked'}
                          onClick={() => handleRevokeKey(k.id)}
                          className={`p-1 rounded ${
                            k.status === 'active'
                              ? 'text-red-500 hover:bg-red-500/5'
                              : 'text-zinc-400 cursor-not-allowed opacity-50'
                          }`}
                          title="Revoke Credential"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Right Column: Security Policy Guidelines */}
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] h-fit space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <span className="text-xs font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">Access Control Rules</span>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 leading-normal">
              Permission policies will define what agents can read, propose, approve, and execute once backend integrations exist.
            </p>
          </div>

          <div className="space-y-3 text-xs font-mono">
            {[
              { rule: 'Repository changes', role: 'Human operator sign-off', val: 'REQUIRED' },
              { rule: 'Deployment approval', role: 'Human operator sign-off', val: 'REQUIRED' },
              { rule: 'Wallet policy changes', role: 'Workspace approval', val: 'Approval' },
              { rule: 'Telemetry read', role: 'Read-only agent', val: 'PLANNED' },
              { rule: 'Security scan proposal', role: 'Read-only agent', val: 'PLANNED' }
            ].map((rule) => (
              <div key={rule.rule} className="p-2.5 rounded bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                  <span className="truncate">{rule.rule}</span>
                  <span className={`text-[10px] font-bold ${
                    rule.val === 'REQUIRED' ? 'text-amber-500' : rule.val === 'Approval' ? 'text-purple-500' : 'text-zinc-500'
                  }`}>{rule.val}</span>
                </div>
                <p className="text-[9px] text-zinc-400">Authorized: {rule.role}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Audit Log timeline trail */}
      <div className="p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B] space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <ScrollText className="h-4 w-4 text-brand-blue" />
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase font-mono">Platform Audit Ledger</h3>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Cryptographically chained operations trail</p>
          </div>
        </div>

        <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
          {auditLogs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-4 text-xs font-mono border-b border-zinc-100 dark:border-zinc-850/30 pb-3 last:border-0 last:pb-0">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className={`p-1 rounded mt-0.5 shrink-0 ${
                  log.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  <Fingerprint className="h-3 w-3" />
                </span>
                <div className="min-w-0">
                  <span className="font-semibold text-zinc-900 dark:text-white block truncate">
                    {log.action} <span className="text-zinc-400 font-normal">targeted</span> <span className="text-brand-blue">@{log.target}</span>
                  </span>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Executor: @{log.actor} • IP: {log.ip}</p>
                </div>
              </div>
              <span className="text-[10px] text-zinc-400 shrink-0 whitespace-nowrap">{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
