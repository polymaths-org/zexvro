import { useMemo, useState } from 'react';
import {
  Ghost, Shield, Copy, Check, Download, Upload, Eye, EyeOff,
  Plus, Trash2, KeyRound, Radar, AlertTriangle, Wallet,
} from 'lucide-react';
import { useStealthStore } from '../../stores/stealth';
import {
  generateStealthIdentity,
  isStealthMetaAddress,
  shortAddr,
  type StealthIdentity,
} from '../../lib/stealth';
import { copyText } from '../../lib/clipboard';
import { getExplorerAccountUrl, getExplorerTxUrl } from '../../api/walletConnect';
import { useZer0Store } from '../../stores/zer0';

export default function Zer0Stealth() {
  const horizonUrl = useZer0Store(s => s.settings.horizonUrl);
  const stealthPaymentsEnabled = useZer0Store(s => s.settings.stealthPaymentsEnabled);
  const updateSettings = useZer0Store(s => s.updateSettings);
  const stellarNet = (horizonUrl || '').includes('testnet') ? 'TESTNET' as const : 'PUBLIC' as const;
  const orgIdentity = useStealthStore(s => s.orgIdentity);
  const ensureOrgIdentity = useStealthStore(s => s.ensureOrgIdentity);
  const importedIdentities = useStealthStore(s => s.importedIdentities);
  const importIdentity = useStealthStore(s => s.importIdentity);
  const removeImportedIdentity = useStealthStore(s => s.removeImportedIdentity);
  const outbound = useStealthStore(s => s.outbound);
  const inbound = useStealthStore(s => s.inbound);
  const scanEphemeral = useStealthStore(s => s.scanEphemeral);

  const [showSecrets, setShowSecrets] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [ephInput, setEphInput] = useState('');
  const [scanSalt, setScanSalt] = useState('');
  const [scanMsg, setScanMsg] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const identity = orgIdentity;

  const copy = async (key: string, value: string) => {
    await copyText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  const handleEnsure = () => {
    ensureOrgIdentity('Org receive identity');
  };

  const handleNewIdentity = () => {
    const idn = generateStealthIdentity(`Identity ${new Date().toLocaleDateString()}`);
    importIdentity(idn);
  };

  const handleImport = () => {
    setImportError('');
    try {
      const raw = JSON.parse(importJson);
      if (!raw.metaAddress || !raw.scanSecretHex || !raw.spendPublicHex) {
        throw new Error('Need metaAddress, scanSecretHex, spendPublicHex');
      }
      if (!isStealthMetaAddress(raw.metaAddress)) {
        throw new Error('Invalid meta-address');
      }
      const idn: StealthIdentity = {
        metaAddress: raw.metaAddress,
        scanPublicHex: raw.scanPublicHex || '',
        spendPublicHex: raw.spendPublicHex,
        scanSecretHex: raw.scanSecretHex,
        spendSecretHex: raw.spendSecretHex || '',
        createdAt: raw.createdAt || Date.now(),
        label: raw.label || 'Imported',
      };
      importIdentity(idn);
      setImportJson('');
      setScanMsg(`Imported ${shortAddr(idn.metaAddress, 8)}`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid backup JSON');
    }
  };

  const handleScan = () => {
    setScanMsg('');
    const hex = ephInput.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      setScanMsg('Ephemeral public key must be 32-byte hex (64 chars).');
      return;
    }
    const found = scanEphemeral(hex, scanSalt.trim());
    if (found) {
      setScanMsg(`Recovered one-time wallet ${found.oneTimePublicKey}`);
      setEphInput('');
    } else {
      setScanMsg('No match against imported scan keys. Check ephemeral key / salt (payment id).');
    }
  };

  const exportIdentity = (idn: StealthIdentity) => {
    const blob = JSON.stringify({
      v: 1,
      label: idn.label,
      metaAddress: idn.metaAddress,
      scanSecretHex: idn.scanSecretHex,
      spendSecretHex: idn.spendSecretHex,
      spendPublicHex: idn.spendPublicHex,
      scanPublicHex: idn.scanPublicHex,
      createdAt: idn.createdAt,
    }, null, 2);
    void copy('export', blob);
  };

  const stats = useMemo(() => ({
    identities: importedIdentities.length + (orgIdentity ? 1 : 0),
    outbound: outbound.length,
    inbound: inbound.length,
  }), [importedIdentities, orgIdentity, outbound, inbound]);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Ghost className="h-5 w-5 text-violet-500" /> Stealth addresses
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            One-time receive keys — private pays withdraw to a fresh G… address, not a long-term wallet.
          </p>
        </div>
        <div className="flex gap-2 text-[10px] font-semibold">
          <span className="px-2 py-1 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400">{stats.identities} identities</span>
          <span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">{stats.outbound} sent</span>
          <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{stats.inbound} recovered</span>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 flex gap-2 text-[11px] text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <strong>Honest limits:</strong> the one-time G… address is still public on Stellar.
            Stealth hides the <em>long-term identity</em> of the payee; ZK pool hides the deposit↔withdraw link.
            First fund of a new account may still show a funder edge.
          </p>
          <p className="text-amber-700/80 dark:text-amber-400/80">
            Scan secrets never go on-chain. Share only the <code className="font-mono">z0st1…</code> meta-address with payers.
          </p>
        </div>
      </div>

      {/* One-click enable for private pays */}
      <section className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Enable stealth for private pays</h2>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
            Turns on one-time receives in Settings and ensures you have a meta-address.
            On <strong>Send payment</strong>, flip the stealth switch under Shield — or one-click setup per teammate under Team.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!stealthPaymentsEnabled) {
              updateSettings({ stealthPaymentsEnabled: true });
            }
            if (!orgIdentity) handleEnsure();
          }}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" />
          {orgIdentity && stealthPaymentsEnabled ? 'Stealth already on' : 'One-click enable'}
        </button>
      </section>

      {/* Org meta */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" /> Your meta-address
        </h2>
        {!identity ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">Generate a dual-key stealth identity to receive private payroll — one click.</p>
            <button
              type="button"
              onClick={handleEnsure}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Generate stealth identity
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-zinc-400 uppercase">Meta-address (share this)</label>
              <div className="mt-1 flex gap-2">
                <code className="flex-1 text-[11px] font-mono break-all rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-800 dark:text-zinc-200">
                  {identity.metaAddress}
                </code>
                <button
                  type="button"
                  onClick={() => copy('meta', identity.metaAddress)}
                  className="h-9 w-9 shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {copied === 'meta' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowSecrets(s => !s)}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300"
              >
                {showSecrets ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showSecrets ? 'Hide secrets' : 'Show scan secrets'}
              </button>
              <button
                type="button"
                onClick={() => exportIdentity(identity)}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300"
              >
                {copied === 'export' ? <Check className="h-3 w-3 text-emerald-500" /> : <Download className="h-3 w-3" />}
                Copy backup JSON
              </button>
            </div>
            {showSecrets && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2 text-[10px] font-mono text-red-700 dark:text-red-300 break-all">
                <div><span className="text-red-400">scanSecret</span> {identity.scanSecretHex}</div>
                <div><span className="text-red-400">spendSecret</span> {identity.spendSecretHex}</div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Scanner */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          <Radar className="h-3.5 w-3.5" /> Scan for payments
        </h2>
        <p className="text-[11px] text-zinc-500">
          After a private+stealth pay, the sender records an ephemeral public key (shown on the receipt / ledger).
          Paste it here with your scan keys imported to recover the one-time wallet secret.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            value={ephInput}
            onChange={e => setEphInput(e.target.value)}
            placeholder="Ephemeral public key (64 hex chars)"
            className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-xs font-mono outline-none focus:border-violet-500"
          />
          <input
            value={scanSalt}
            onChange={e => setScanSalt(e.target.value)}
            placeholder="Salt / payment id (optional)"
            className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-xs font-mono outline-none focus:border-violet-500"
          />
        </div>
        <button
          type="button"
          onClick={handleScan}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold"
        >
          <KeyRound className="h-3.5 w-3.5" /> Recover one-time wallet
        </button>
        {scanMsg && (
          <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-mono break-all">{scanMsg}</p>
        )}
      </section>

      {/* Import */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Import scan identity
          </h2>
          <button
            type="button"
            onClick={handleNewIdentity}
            className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline"
          >
            + New identity
          </button>
        </div>
        <textarea
          value={importJson}
          onChange={e => setImportJson(e.target.value)}
          rows={4}
          placeholder='Paste backup JSON from "Generate" on Wallets directory…'
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-3 text-[11px] font-mono outline-none focus:border-violet-500"
        />
        {importError && <p className="text-[11px] text-red-500">{importError}</p>}
        <button
          type="button"
          onClick={handleImport}
          className="h-9 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Import
        </button>

        {importedIdentities.length > 0 && (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg overflow-hidden">
            {importedIdentities.map(idn => (
              <li key={idn.metaAddress} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{idn.label || 'Identity'}</div>
                  <div className="font-mono text-[10px] text-zinc-400 truncate">{shortAddr(idn.metaAddress, 10)}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => exportIdentity(idn)} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeImportedIdentity(idn.metaAddress)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Outbound + inbound tables */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> Outbound stealth pays
          </h2>
        </div>
        {outbound.length === 0 ? (
          <p className="p-5 text-xs text-zinc-400">No stealth outbound records yet. Enable stealth in Settings and pay a teammate with a meta-address.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">One-time G…</th>
                  <th className="px-4 py-2">Ephemeral</th>
                  <th className="px-4 py-2 text-right">XLM</th>
                  <th className="px-4 py-2">Tx</th>
                  <th className="px-4 py-2">Secret</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {outbound.slice(0, 40).map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2 font-mono">
                      <a className="text-violet-600 dark:text-violet-400 hover:underline" href={getExplorerAccountUrl(r.oneTimePublicKey, stellarNet)} target="_blank" rel="noreferrer">
                        {shortAddr(r.oneTimePublicKey, 5)}
                      </a>
                    </td>
                    <td className="px-4 py-2 font-mono text-zinc-500">
                      <button type="button" onClick={() => copy(`eph-${r.id}`, r.ephemeralPublicHex)} className="hover:text-zinc-800 dark:hover:text-zinc-200">
                        {shortAddr(r.ephemeralPublicHex, 4)}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{r.amountXlm}</td>
                    <td className="px-4 py-2 font-mono text-zinc-500">
                      {r.txHash ? (
                        <a className="hover:underline" href={getExplorerTxUrl(r.txHash, stellarNet)} target="_blank" rel="noreferrer">
                          {shortAddr(r.txHash, 4)}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => copy(`out-sec-${r.id}`, r.oneTimeSecret)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:underline"
                        title="Copy one-time spend secret"
                      >
                        {copied === `out-sec-${r.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        Copy S…
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0A0A0B] overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Recovered inbound wallets</h2>
        </div>
        {inbound.length === 0 ? (
          <p className="p-5 text-xs text-zinc-400">Scan an ephemeral key to recover spendable one-time secrets here.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {inbound.map(r => (
              <li key={r.id} className="px-5 py-3 text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a className="font-mono font-semibold text-violet-600 dark:text-violet-400 hover:underline" href={getExplorerAccountUrl(r.oneTimePublicKey, stellarNet)} target="_blank" rel="noreferrer">
                    {r.oneTimePublicKey}
                  </a>
                  <button
                    type="button"
                    onClick={() => copy(`sec-${r.id}`, r.oneTimeSecret)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-zinc-800"
                  >
                    {copied === `sec-${r.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    Copy secret seed
                  </button>
                </div>
                <p className="text-[10px] text-zinc-400 font-mono break-all">S… seed: {showSecrets ? r.oneTimeSecret : `${r.oneTimeSecret.slice(0, 6)}…`}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
