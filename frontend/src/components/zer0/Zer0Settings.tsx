import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import {
  Settings, Shield, Wallet, Eye, AlertTriangle, Save, RotateCcw, CheckCircle2, Workflow
} from 'lucide-react';
import { useZer0Store } from '../../stores/zer0';
import type { Zer0ProofSystem, Zer0Currency } from '../../stores/types';

export default function Zer0Settings() {
  const { projectId } = useParams({ strict: false });
  const settings = useZer0Store(s => s.settings);
  const updateSettings = useZer0Store(s => s.updateSettings);
  const resetSettings = useZer0Store(s => s.resetSettings);

  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'privacy' | 'wallet' | 'workflow' | 'compliance' | 'danger'>('general');

  const hasChanges = JSON.stringify(local) !== JSON.stringify(settings);

  const handleSave = () => {
    updateSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (confirm('Reset all Zer0 settings to defaults? This cannot be undone.')) {
      resetSettings();
      setLocal({ ...useZer0Store.getState().settings });
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'privacy', label: 'Privacy Pool', icon: Shield },
    { id: 'wallet', label: 'Wallet & Network', icon: Wallet },
    { id: 'workflow', label: 'Workflows', icon: Workflow },
    { id: 'compliance', label: 'Compliance', icon: Eye },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Settings</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Configure your Zer0 privacy pool and payroll preferences.</p>
        </div>
        {hasChanges && (
          <button onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-sm">
            {saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#0A0A0B]">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Default Currency</label>
                <select value={local.defaultCurrency} onChange={e => setLocal(l => ({ ...l, defaultCurrency: e.target.value as Zer0Currency }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                  <option value="USDC">USDC</option><option value="XLM">XLM</option><option value="EURC">EURC</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Timezone</label>
                <input value={local.timezone} onChange={e => setLocal(l => ({ ...l, timezone: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">Require Payment Approval</span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">Payments need admin approval before processing</span>
              </div>
              <button type="button" onClick={() => setLocal(l => ({ ...l, paymentApprovalRequired: !l.paymentApprovalRequired }))}
                className={`relative h-5 w-9 rounded-full transition-colors ${local.paymentApprovalRequired ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${local.paymentApprovalRequired ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-6">
            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">ZK Proof System</label>
              <select value={local.proofSystem} onChange={e => setLocal(l => ({ ...l, proofSystem: e.target.value as Zer0ProofSystem }))}
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                <option value="Groth16">Groth16 — Fast verification, trusted setup (~130 byte proofs)</option>
                <option value="PLONK">PLONK — Universal setup, ideal for evolving circuits</option>
                <option value="Halo2">Halo2 — Recursive proofs, no trusted setup required</option>
              </select>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Merkle Tree Depth</label>
                <input type="number" min="8" max="64" value={local.merkleDepth}
                  onChange={e => setLocal(l => ({ ...l, merkleDepth: parseInt(e.target.value) || 32 }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Supports up to {Math.pow(2, local.merkleDepth || 32).toLocaleString()} shielded deposits
                </span>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Compliance Threshold ($)</label>
                <input type="number" min="0" value={local.complianceThreshold}
                  onChange={e => setLocal(l => ({ ...l, complianceThreshold: parseInt(e.target.value) || 0 }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Payments above this amount require dual-key validation
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">Require Validator Signature</span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">Enforce decentralized key share validation for large transactions</span>
              </div>
              <button type="button" onClick={() => setLocal(l => ({ ...l, requireValidatorSig: !l.requireValidatorSig }))}
                className={`relative h-5 w-9 rounded-full transition-colors ${local.requireValidatorSig ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${local.requireValidatorSig ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="space-y-6">
            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Pool Wallet Address (Stellar Public Key)</label>
              <input value={local.walletAddress} onChange={e => setLocal(l => ({ ...l, walletAddress: e.target.value }))}
                placeholder="G... (Your organization's Stellar public key)"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-mono outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Horizon Server URL</label>
              <input value={local.horizonUrl} onChange={e => setLocal(l => ({ ...l, horizonUrl: e.target.value }))}
                placeholder="https://horizon-testnet.stellar.org"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-mono outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Soroban RPC URL</label>
              <input value={local.sorobanRpcUrl} onChange={e => setLocal(l => ({ ...l, sorobanRpcUrl: e.target.value }))}
                placeholder="https://soroban-testnet.stellar.org:443"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-mono outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Privacy Pool Contract Address</label>
              <input value={local.contractAddress} onChange={e => setLocal(l => ({ ...l, contractAddress: e.target.value }))}
                placeholder="Contract ID on Soroban"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-mono outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
            </div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Payment Workflow</label>
                <select value={local.paymentWorkflow} onChange={e => setLocal(l => ({ ...l, paymentWorkflow: e.target.value as any }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                  <option value="manual">Manual review and processing</option>
                  <option value="approval">Approval gate before processing</option>
                  <option value="auto">Auto-process eligible payments</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Settlement Mode</label>
                <select value={local.settlementMode} onChange={e => setLocal(l => ({ ...l, settlementMode: e.target.value as any }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                  <option value="stellar">Stellar wallet settlement</option>
                  <option value="manual_review">Manual settlement review</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">History Export Format</label>
                <select value={local.exportFormat} onChange={e => setLocal(l => ({ ...l, exportFormat: e.target.value as any }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Proof Retry Limit</label>
                <input type="number" min="0" max="10" value={local.proofRetryLimit}
                  onChange={e => setLocal(l => ({ ...l, proofRetryLimit: parseInt(e.target.value, 10) || 0 }))}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1.5">Payment Webhook URL</label>
              <input value={local.webhookUrl} onChange={e => setLocal(l => ({ ...l, webhookUrl: e.target.value }))}
                placeholder="https://your-system.example.com/zexvro/webhooks/payments"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-mono outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">Allow Transparent Payments</span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">Permit non-shielded payments when a recipient or chain does not support privacy proofs</span>
              </div>
              <button type="button" onClick={() => setLocal(l => ({ ...l, allowTransparentPayments: !l.allowTransparentPayments }))}
                className={`relative h-5 w-9 rounded-full transition-colors ${local.allowTransparentPayments ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${local.allowTransparentPayments ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500 leading-relaxed">
              Zer0 supports compliance-mode auditing via symmetric <strong>View Keys</strong>. When an auditor or accounting team provides the View Key,
              they can decrypt transaction recipients and amounts without exposing them on the public block explorer.
            </p>
            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-950/10">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> View Key management will be available once the Soroban contract is deployed.
              </span>
              <span className="text-[10px] text-amber-700/70 dark:text-amber-500/70 block mt-1">
                Configure your wallet and contract address in the Wallet tab first.
              </span>
            </div>
          </div>
        )}

        {activeTab === 'danger' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10">
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">Reset All Settings</h3>
              <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mb-3">
                This will reset all Zer0 configuration to defaults. Your payment history and employee data will NOT be affected.
              </p>
              <button onClick={handleReset}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-300 dark:border-red-800 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/30 transition">
                <RotateCcw className="h-3 w-3" /> Reset Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
