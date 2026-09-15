import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Upload,
  Link2,
  Radar,
  FileCode2,
  Fingerprint,
  Rocket,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  Sparkles,
  FilePlus2,
  PackageOpen,
  Github,
  Info,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getAvatarForUser } from '../utils/avatar';
import { CHAINS, getChain, type ChainMeta } from '../data/chains';
import { ChainType, NetworkType, SmartContract, ContractFunction } from '../types';
import { publishViaHandshake } from '../spacetime/handshakeClient';
import { PublishIntro } from '../components/publish/PublishIntro';

// ---------------------------------------------------------------------------
// Helpers — validation, import, extraction, hashing
// ---------------------------------------------------------------------------

const EVM_CHAIN_IDS: Record<string, number> = {
  ethereum: 1, base: 8453, arbitrum: 42161, optimism: 10, polygon: 137,
  bnb: 56, avalanche: 43114, gnosis: 100, linea: 59144, scroll: 534352,
  blast: 81457, mantle: 5000, zksync: 324, celo: 42220, sonic: 146,
  berachain: 80094, sei: 1329, filecoin: 314,
};

function validateAddress(chainId: string, addr: string): { ok: boolean; hint: string } {
  const v = addr.trim();
  if (!v) return { ok: false, hint: 'Paste the on-chain address first.' };
  const meta = getChain(chainId);
  const fam = meta?.family ?? 'evm';
  if (chainId === 'stellar') {
    if (/^C[A-Z2-7]{55}$/.test(v)) return { ok: true, hint: 'Valid Soroban contract ID (C… · 56 chars).' };
    return { ok: false, hint: 'Stellar contract IDs look like C… + 55 base32 chars (56 total).' };
  }
  if (fam === 'evm') {
    if (/^0x[0-9a-fA-F]{40}$/.test(v)) return { ok: true, hint: 'Valid EVM address (0x + 40 hex).' };
    return { ok: false, hint: 'EVM addresses are 0x + 40 hex characters.' };
  }
  if (chainId === 'solana') {
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return { ok: true, hint: 'Valid Solana address (base58).' };
    return { ok: false, hint: 'Solana addresses are base58, 32–44 chars.' };
  }
  if (v.length < 8) return { ok: false, hint: 'Address looks too short for this chain.' };
  if (/\s/.test(v)) return { ok: false, hint: 'Addresses never contain spaces.' };
  return { ok: true, hint: 'Format accepted — on-chain check runs on import.' };
}

async function fetchWithTimeout(url: string, ms = 9000, init?: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    window.clearTimeout(t);
  }
}

type ImportResult =
  | { ok: true; source: string; note: string; contractName?: string; compilerVersion?: string; license?: string }
  | { ok: false; note: string };

// Blockscout v2 hosts (keyless, CORS-open) per chain + network tier.
function blockscoutHost(chainId: string, network: string): string | null {
  const test = network === 'testnet' || network === 'sepolia';
  const m: Record<string, [string, string]> = {
    ethereum: ['eth.blockscout.com', 'sepolia.blockscout.com'],
    base: ['base.blockscout.com', 'base-sepolia.blockscout.com'],
    arbitrum: ['arbitrum.blockscout.com', 'arbitrum-sepolia.blockscout.com'],
    optimism: ['optimism.blockscout.com', 'optimism-sepolia.blockscout.com'],
    polygon: ['polygon.blockscout.com', 'polygon-amoy.blockscout.com'],
    gnosis: ['gnosis.blockscout.com', 'gnosis-chiado.blockscout.com'],
    avalanche: ['avalanche.blockscout.com', 'avalanche-fuji.blockscout.com'],
    linea: ['linea.blockscout.com', 'linea-sepolia.blockscout.com'],
    scroll: ['scroll.blockscout.com', 'scroll-sepolia.blockscout.com'],
    blast: ['blast.blockscout.com', 'blast-sepolia.blockscout.com'],
    celo: ['celo.blockscout.com', 'celo-alfajores.blockscout.com'],
    filecoin: ['filecoin.blockscout.com', 'filecoin-calibration.blockscout.com'],
  };
  const pair = m[chainId];
  return pair ? (test ? pair[1] : pair[0]) : null;
}

// Sourcify chain IDs per network tier (fallback: proves verified status).
function sourcifyChainId(chainId: string, network: string): number | null {
  const test = network === 'testnet' || network === 'sepolia';
  const m: Record<string, [number, number | null]> = {
    ethereum: [1, 11155111], base: [8453, 84532], arbitrum: [42161, 421614],
    optimism: [10, 11155420], polygon: [137, 80002], bnb: [56, 97],
    avalanche: [43114, 43113], gnosis: [100, 10200], linea: [59144, 59141],
    scroll: [534352, 534351], blast: [81457, 168587773], celo: [42220, 44787],
    sei: [1329, 1328], filecoin: [314, 314159], zksync: [324, 300],
    mantle: [5000, 5003], berachain: [80094, 80069], sonic: [146, 57054],
  };
  const pair = m[chainId] ?? (EVM_CHAIN_IDS[chainId] !== undefined ? [EVM_CHAIN_IDS[chainId], null] : undefined);
  if (!pair) return null;
  return test ? (pair[1] ?? pair[0]) : pair[0];
}

async function importFromOnChain(chainId: string, network: string, address: string): Promise<ImportResult> {
  const addr = address.trim();
  const meta = getChain(chainId);
  const fam = meta?.family ?? 'evm';

  // --- EVM: Blockscout v2 (keyless source) → Sourcify (verified-status proof) ---
  if (fam === 'evm') {
    const host = blockscoutHost(chainId, network);
    if (host) {
      try {
        const res = await fetchWithTimeout(`https://${host}/api/v2/smart-contracts/${encodeURIComponent(addr)}`);
        if (res.ok) {
          const j = (await res.json()) as any;
          const main: string = typeof j?.source_code === 'string' ? j.source_code : '';
          const extra: Array<{ file_path?: string; source_code?: string }> = Array.isArray(j?.additional_sources) ? j.additional_sources : [];
          const extraSrc = extra.map((f) => `// File: ${f?.file_path ?? 'unknown'}\n${f?.source_code ?? ''}`).join('\n\n');
          const combined = [main, extraSrc].filter((s) => s.trim().length > 0).join('\n\n');
          if (combined.trim().length > 40) {
            return {
              ok: true,
              source: combined.slice(0, 120000),
              note: `Verified source pulled from ${host}${j?.name ? ` — ${j.name}` : ''}${extra.length > 0 ? ` (+${extra.length} files)` : ''}. Review before publishing.`,
              contractName: typeof j?.name === 'string' && j.name ? j.name : undefined,
              compilerVersion: typeof j?.compiler_version === 'string' && j.compiler_version ? j.compiler_version : undefined,
              license: typeof j?.license_type === 'string' && j.license_type && j.license_type.toLowerCase() !== 'none' ? j.license_type : undefined,
            };
          }
          // Address exists but no source (unverified / proxy without impl)
          return { ok: false, note: `Address exists on ${host} but has no verified source (unverified or proxy). Paste the code or continue as unverified.` };
        }
      } catch {
        /* fall through to Sourcify */
      }
    }
    // Fallback: Sourcify match status (proves verification, links out)
    const chainNum = sourcifyChainId(chainId, network);
    if (chainNum) {
      try {
        const res = await fetchWithTimeout(`https://sourcify.dev/server/v2/contract/${chainNum}/${encodeURIComponent(addr)}`);
        if (res.ok) {
          const j = (await res.json()) as any;
          if (j?.creationMatch || j?.runtimeMatch) {
            return { ok: false, note: `Verified on Sourcify (${j.creationMatch ?? j.runtimeMatch}) but source fetch needs the repo — open sourcify.dev to copy it, or paste below.` };
          }
        }
      } catch {
        /* offline */
      }
    }
    return { ok: false, note: 'No verified source found for this address on the public indexers — paste code, link the repo, or continue as unverified.' };
  }

  // --- Stellar: direct Soroban RPC existence check (CORS-open, no relay, ~1s).
  // Reads the contract's instance ledger entry — the same ground truth wallets use.
  // Both networks are checked in parallel so "flip the switch" is a fact, not a guess.
  if (chainId === 'stellar') {
    const hash = contractHashFromStrkey(addr);
    if (!hash) {
      return { ok: false, note: 'Checksum failed — this looks like a typo, not a real contract ID. Recheck it or publish as a draft.' };
    }
    const nets = [
      { key: 'public' as const, label: 'pubnet', rpc: 'https://mainnet.sorobanrpc.com' },
      { key: 'testnet' as const, label: 'testnet', rpc: 'https://soroban-testnet.stellar.org' },
    ];
    const selected = network === 'testnet' ? nets[1] : nets[0];
    const other = network === 'testnet' ? nets[0] : nets[1];
    const probe = async (rpc: string): Promise<number | null> => {
      try {
        const res = await fetchWithTimeout(rpc, 10000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLedgerEntries', params: { keys: [stellarInstanceKeyB64(hash)] } }),
        });
        if (!res.ok) return null;
        const j = (await res.json()) as any;
        if (j?.error) return null;
        const entries = j?.result?.entries;
        return Array.isArray(entries) ? entries.length : null;
      } catch {
        return null;
      }
    };
    const [onSelected, onOther] = await Promise.all([probe(selected.rpc), probe(other.rpc)]);
    if (onSelected !== null && onSelected > 0) {
      return {
        ok: true,
        source: '',
        note: `Found on Stellar ${selected.label} (instance entry live on-ledger). Contract bytecode holds no source — paste it below or link the repo.`,
      };
    }
    if (onOther !== null && onOther > 0) {
      return { ok: false, note: `Not on ${selected.label} — but FOUND on ${other.label}. Flip the network switch above and import again.` };
    }
    if (onSelected === null && onOther === null) {
      return { ok: false, note: 'Stellar RPCs unreachable from your browser right now — address checksum is valid, continue manually.' };
    }
    return { ok: false, note: `Not found on Stellar ${selected.label} — flip the network switch, or keep it as a draft until it deploys.` };
  }

  // --- Other chains: honest manual path ---
  try {
    await fetchWithTimeout('https://api.github.com/zen', 4000);
  } catch {
    return { ok: false, note: 'You appear offline — paste the source manually, it will sync on publish.' };
  }
  return { ok: false, note: 'Auto-import is not wired for this chain yet — paste source or import from a file/URL.' };
}

function extractFunctions(source: string, language: string): ContractFunction[] {
  const mk = (name: string, sig: string, i: number): ContractFunction => ({
    id: `fn-auto-${i}-${name}`,
    name,
    signature: sig.length > 140 ? sig.slice(0, 140) : sig,
    visibility: 'public',
    isStateChanging: true,
    requiresAuth: false,
    gasEstimate: 8500,
    gasRating: 'A',
    storageWrites: 0,
    storageReads: 1,
    eventsEmitted: [],
    docExcerpt: `${name} — auto-detected from source.`,
    fullDocs: `${sig} — detected by the publish wizard. Edit after forking if the signature needs prose.`,
    sourceLines: [1, 3],
    sourceSlice: sig,
    arguments: [],
    returns: 'unknown',
    errors: [],
    stateAccess: [],
    securityNotes: [],
  });
  const found: Array<{ name: string; sig: string }> = [];
  const push = (re: RegExp, build: (m: RegExpExecArray) => { name: string; sig: string }) => {
    let m: RegExpExecArray | null;
    const guard = 60;
    let n = 0;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(source)) && n < guard) {
      n += 1;
      try {
        found.push(build(m));
      } catch { /* skip odd match */ }
    }
  };
  const lang = language.toLowerCase();
  if (lang.includes('solidity') || lang.includes('vyper')) {
    push(/function\s+([A-Za-z0-9_]+)\s*\(([^)]{0,160})\)/g, (m) => ({ name: m[1], sig: `function ${m[1]}(${m[2]})` }));
  } else if (lang.includes('move')) {
    push(/(?:public\s+)?(?:entry\s+)?fun\s+([A-Za-z0-9_]+)\s*(\([^)]{0,160}\))/g, (m) => ({ name: m[1], sig: `fun ${m[1]}${m[2]}` }));
  } else if (lang.includes('cairo')) {
    push(/fn\s+([A-Za-z0-9_]+)\s*(\([^)]{0,160}\))/g, (m) => ({ name: m[1], sig: `fn ${m[1]}${m[2]}` }));
  } else {
    // Rust-family default (Soroban / Anchor / CosmWasm / ink!)
    push(/pub\s+fn\s+([A-Za-z0-9_]+)\s*(\([^)]{0,200}\))/g, (m) => ({ name: m[1], sig: `pub fn ${m[1]}${m[2]}` }));
    if (found.length === 0) {
      push(/fn\s+([A-Za-z0-9_]+)\s*(\([^)]{0,200}\))/g, (m) => ({ name: m[1], sig: `fn ${m[1]}${m[2]}` }));
    }
  }
  const seen = new Set<string>();
  return found
    .filter((f) => (seen.has(f.name) ? false : (seen.add(f.name), true)))
    .slice(0, 24)
    .map((f, i) => mk(f.name, f.sig, i));
}

async function sha256Hex(input: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return `fnv1a-${(h >>> 0).toString(16).padStart(8, '0')}`;
  }
}

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'contract';
}

function draftContractId(chainId: string, nameInput: string): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `draft-${chainId}-${slugify(nameInput || 'contract')}-${rand}`;
}

function githubToRaw(url: string): string {
  // github.com/owner/repo/blob/main/path → raw.githubusercontent.com/owner/repo/main/path
  const m = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/([^/]+)\/(.+)$/);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  return url;
}

// --- Stellar strkey → contract hash (with checksum verify; null = typo) ---
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function crc16XModem(data: Uint8Array): number {
  let crc = 0;
  for (const b of data) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}
function contractHashFromStrkey(addr: string): Uint8Array | null {
  try {
    const s = addr.trim();
    if (!/^C[A-Z2-7]{55}$/.test(s)) return null;
    let bits = 0, val = 0;
    const out: number[] = [];
    for (const ch of s) {
      const i = B32_ALPHABET.indexOf(ch);
      if (i < 0) return null;
      val = (val << 5) | i;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        out.push((val >> bits) & 255);
      }
    }
    if (out.length !== 35 || out[0] !== 16) return null; // version 16 = contract
    const crc = crc16XModem(Uint8Array.from(out.slice(0, 33)));
    const lo = out[33], hi = out[34];
    if (!((lo === (crc & 255) && hi === (crc >> 8)) || (lo === (crc >> 8) && hi === (crc & 255)))) return null;
    return Uint8Array.from(out.slice(1, 33));
  } catch {
    return null;
  }
}
// LedgerKey.contractData{contract, LEDGER_KEY_CONTRACT_INSTANCE, PERSISTENT} → base64.
// Discriminants verified against @stellar/stellar-sdk + live mainnet query.
function stellarInstanceKeyB64(hash: Uint8Array): string {
  const b = new Uint8Array(48);
  const dv = new DataView(b.buffer);
  dv.setInt32(0, 6); // CONTRACT_DATA
  dv.setInt32(4, 1); // SC_ADDRESS_TYPE_CONTRACT
  b.set(hash, 8);
  dv.setInt32(40, 20); // SCV_LEDGER_KEY_CONTRACT_INSTANCE
  dv.setInt32(44, 1); // PERSISTENT (enum: TEMPORARY=0, PERSISTENT=1)
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

// ---------------------------------------------------------------------------
// Small animated primitives
// ---------------------------------------------------------------------------

const ease = [0.16, 1, 0.3, 1] as const;

const AnimatedWords: React.FC<{ text: string; className?: string; delay?: number }> = ({ text, className = '', delay = 0 }) => (
  <span className={`inline-flex flex-wrap gap-x-[0.28em] ${className}`} aria-label={text}>
    {text.split(' ').map((w, i) => (
      <motion.span
        key={`${w}-${i}`}
        initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.55, delay: delay + i * 0.06, ease }}
        className="inline-block"
      >
        {w}
      </motion.span>
    ))}
  </span>
);

const StepShell: React.FC<{ k: number; children: React.ReactNode }> = ({ k, children }) => (
  <motion.div
    key={k}
    initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
    transition={{ duration: 0.45, ease }}
  >
    {children}
  </motion.div>
);

const WizardNext: React.FC<{ onClick: () => void; disabled?: boolean; label: string; sub?: string }> = ({ onClick, disabled, label, sub }) => (
  <motion.button
    type="button"
    onClick={onClick}
    disabled={disabled}
    whileHover={disabled ? undefined : { x: 3 }}
    whileTap={disabled ? undefined : { scale: 0.96 }}
    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
    className="group relative overflow-hidden inline-flex items-center gap-2.5 rounded-full bg-white text-black pl-6 pr-2.5 py-2 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
  >
    <span className="absolute inset-0 bg-gradient-to-r from-[#3B82F6]/0 via-[#3B82F6]/25 to-[#3B82F6]/0 translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-700" aria-hidden="true" />
    <span className="relative flex flex-col items-start leading-none">
      <span>{label}</span>
      {sub && <span className="text-[10px] font-mono font-medium text-black/50">{sub}</span>}
    </span>
    <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-black text-white overflow-hidden">
      <span className="absolute inset-0 rounded-full bg-[#3B82F6] scale-0 group-hover:scale-100 transition-transform duration-300" aria-hidden="true" />
      <ArrowRight className="relative w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
    </span>
  </motion.button>
);

const WizardBack: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Back' }) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileHover={{ x: -3 }}
    whileTap={{ scale: 0.96 }}
    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
    className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-mono text-[#A1A1AA] hover:text-white hover:bg-white/5 transition-colors"
  >
    <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" />
    {label}
  </motion.button>
);

const STEPS = [
  { n: 1, title: 'Origin', desc: 'Chain · network · address', icon: Radar },
  { n: 2, title: 'Identity', desc: 'Name · story · tags', icon: Fingerprint },
  { n: 3, title: 'Source', desc: 'Code · files · functions', icon: FileCode2 },
  { n: 4, title: 'Verify & Publish', desc: 'Proof · review · ship', icon: Rocket },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const PublishWizardPage: React.FC = () => {
  const { navigate, setContracts, contracts, sessionUser } = useApp();
  const [introDone, setIntroDone] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 — Origin (+ what-if: not deployed yet)
  const [chain, setChain] = useState<ChainType>('stellar');
  const [network, setNetwork] = useState<NetworkType>('pubnet');
  const [deployStatus, setDeployStatus] = useState<'deployed' | 'draft'>('deployed');
  const [contractId, setContractId] = useState('');
  const [chainQuery, setChainQuery] = useState('');
  const [importState, setImportState] = useState<'idle' | 'working' | 'ok' | 'miss'>('idle');
  const [importNote, setImportNote] = useState('');

  // Step 2 — Identity (+ what-if: not mine / license unknown) + README questionnaire
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  // README questionnaire — feeds the on-page README, so the contract page never shows a dummy.
  const [readmeFeatures, setReadmeFeatures] = useState('');
  const [readmeInstall, setReadmeInstall] = useState('');
  const [readmeUsage, setReadmeUsage] = useState('');
  const [readmeNotes, setReadmeNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [license, setLicense] = useState('Apache-2.0');
  const [ownIt, setOwnIt] = useState<'mine' | 'curated'>('mine');

  // Step 3 — Source (+ what-if: repo link only / no source yet)
  const [source, setSource] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceStatus, setSourceStatus] = useState('');
  const [sourceMode, setSourceMode] = useState<'code' | 'repo' | 'none'>('code');
  const [repoUrl, setRepoUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 4 — integrity check + match proof + publish.
  // Integrity (hash + function sanity) NEVER implies a chain match — it is
  // recorded as source_hash for audit. Only match proof (importer-provided
  // source for this exact address, published unedited) may claim verified.
  const [isChecking, setIsChecking] = useState(false);
  const [integrityPassed, setIntegrityPassed] = useState(false);
  const [sourceHash, setSourceHash] = useState('');
  const [fetchedCompiler, setFetchedCompiler] = useState('');
  const [importedSnapshot, setImportedSnapshot] = useState<{ key: string; source: string; provenance: string } | null>(null);
  const [publishError, setPublishError] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ chain: string; network: string; contractId: string; name: string; owner: string } | null>(null);

  const chainMeta: ChainMeta | undefined = getChain(chain);
  const addressCheck = useMemo(() => validateAddress(chain, contractId), [chain, contractId]);

  // Keep network in sync when chain family changes labels
  useEffect(() => {
    const fam = chainMeta?.family ?? 'evm';
    if (chain === 'stellar') {
      if (network !== 'pubnet' && network !== 'testnet') setNetwork('pubnet');
    } else if (fam === 'evm') {
      if (network !== 'mainnet' && network !== 'sepolia') setNetwork('mainnet' as NetworkType);
    }
  }, [chain, chainMeta, network]);

  const detectedFunctions = useMemo(
    () => extractFunctions(source, chainMeta?.defaultLanguage ?? 'Solidity'),
    [source, chainMeta]
  );
  const sourceLines = useMemo(() => (source ? source.split('\n').length : 0), [source]);

  const filteredChains = useMemo(() => {
    const q = chainQuery.trim().toLowerCase();
    const popular: ChainType[] = ['stellar', 'ethereum', 'base', 'solana', 'arbitrum', 'optimism', 'polygon', 'sui'];
    const base = q
      ? CHAINS.filter((c) => c.name.toLowerCase().includes(q) || c.id.includes(q) || c.familyLabel.toLowerCase().includes(q))
      : [...CHAINS].sort((a, b) => popular.indexOf(a.id) - popular.indexOf(b.id) || a.name.localeCompare(b.name));
    return base.slice(0, q ? 24 : 16);
  }, [chainQuery]);

  const suggestName = useCallback(() => {
    if (name.trim()) return;
    const slug = contractId.trim().slice(-6).toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (slug.length >= 3) setName(`${chain}-contract-${slug}`);
  }, [name, contractId, chain]);

  // ---- Import: on-chain address ----
  const runImport = useCallback(async () => {
    if (!addressCheck.ok) {
      setImportState('miss');
      setImportNote(addressCheck.hint);
      return;
    }
    setImportState('working');
    setImportNote(`Looking up ${contractId.trim()} on ${chainMeta?.name ?? chain}…`);
    const res = await importFromOnChain(chain, network, contractId.trim());
    if (res.ok) {
      setImportState('ok');
      setImportNote(res.note);
      if (res.source) {
        const src = res.source.slice(0, 120000);
        setSource(src);
        setSourceMode('code');
        // Match-proof snapshot: source that provably belongs to THIS address.
        // Any later edit voids the proof (shown honestly in step 4).
        setImportedSnapshot({
          key: `${chain.trim().toLowerCase()}:${network.trim().toLowerCase()}:${contractId.trim().toLowerCase()}`,
          source: src,
          provenance: chainMeta?.family === 'evm' ? 'indexer' : 'ledger',
        });
      }
      if (res.contractName && !name.trim()) {
        setName(slugify(res.contractName).slice(0, 60) || name);
      }
      if (res.license && (license === 'Apache-2.0' || license === 'Unknown' || !license.trim())) {
        setLicense(res.license.slice(0, 40));
      }
      if (res.compilerVersion) setFetchedCompiler(res.compilerVersion.slice(0, 60));
      if (!res.source) suggestName();
    } else {
      setImportState('miss');
      setImportNote(res.note);
      suggestName();
    }
  }, [addressCheck, contractId, chain, network, chainMeta, suggestName, name, license]);

  // ---- Import: URL / file (blob→raw auto-convert + public CORS fallback) ----
  const runUrlImport = useCallback(async (rawUrl?: string) => {
    let url = (rawUrl ?? sourceUrl).trim();
    if (!url) {
      setSourceStatus('Paste a raw file URL first (e.g. github raw).');
      return;
    }
    url = githubToRaw(url);
    if (url !== (rawUrl ?? sourceUrl).trim()) {
      setSourceUrl(url);
      setSourceStatus('Converted GitHub page link → raw file. Fetching…');
    } else {
      setSourceStatus(`Fetching ${url.slice(0, 72)}…`);
    }
    const tryFetch = async (u: string) => {
      const res = await fetchWithTimeout(u, 12000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length < 20) throw new Error('empty');
      if (/<html[\s>]/i.test(text.slice(0, 500)) && !u.includes('allorigins')) {
        throw new Error('html');
      }
      return text;
    };
    try {
      const text = await tryFetch(url);
      setSource(text.slice(0, 120000));
      setSourceStatus(`Imported ${(text.length / 1024).toFixed(1)} KB from URL. Review below.`);
    } catch {
      // Public CORS relay fallback (raw.githubusercontent and most hosts work direct;
      // this covers hosts that block cross-origin reads)
      try {
        setSourceStatus('Direct fetch blocked — retrying via relay…');
        const text = await tryFetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        setSource(text.slice(0, 120000));
        setSourceStatus(`Imported ${(text.length / 1024).toFixed(1)} KB via relay. Review below.`);
      } catch {
        setSourceStatus('Could not fetch that URL (private repo, CORS, or offline) — paste the code manually.');
      }
    }
  }, [sourceUrl]);

  const onFilePicked = useCallback(async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 400_000) {
      setSourceStatus('File is over 400 KB — trim to the primary contract file.');
      return;
    }
    const text = await f.text();
    setSource(text.slice(0, 120000));
    setSourceStatus(`Loaded ${f.name} (${(text.length / 1024).toFixed(1)} KB).`);
  }, []);

  // ---- Integrity check: real SHA-256 of source + function sanity.
  // This proves the source is well-formed. It NEVER proves a chain match —
  // only match proof (below) may claim verified.
  const runIntegrityCheck = useCallback(async () => {
    if (source.trim().length < 20) {
      setPublishError('Add source code first — the check hashes what you publish.');
      return;
    }
    setIsChecking(true);
    setPublishError('');
    // let the spinner paint
    await new Promise((r) => setTimeout(r, 650));
    const hash = await sha256Hex(source.trim());
    const fns = extractFunctions(source, chainMeta?.defaultLanguage ?? 'Solidity');
    setSourceHash(hash);
    setIntegrityPassed(fns.length > 0 && source.trim().length >= 20);
    setIsChecking(false);
    if (fns.length === 0) {
      setPublishError('No functions detected — check the language and that the code defines entry points.');
    }
  }, [source, chainMeta]);

  useEffect(() => {
    setIntegrityPassed(false);
  }, [source, chain, network, contractId]);

  // A new address/chain/network voids any previous import snapshot (different key).
  useEffect(() => {
    setImportedSnapshot(null);
  }, [chain, network, contractId, deployStatus]);

  // ---- Step gating (what-if aware) ----
  const canNext1 = deployStatus === 'draft' ? true : addressCheck.ok;
  const canNext2 = name.trim().length >= 2;
  const canNext3 =
    sourceMode === 'code'
      ? source.trim().length >= 20
      : sourceMode === 'repo'
        ? repoUrl.trim().length > 8 || source.trim().length >= 20
        : true; // metadata-only always passes
  const effectiveContractId = deployStatus === 'draft' ? draftContractId(chain, name) : contractId.trim();
  const effectiveKey = `${chain.trim().toLowerCase()}:${network.trim().toLowerCase()}:${effectiveContractId.trim().toLowerCase()}`;
  const hasSource = source.trim().length >= 20;
  // Match proof: source provably belongs to THIS address (importer-provided,
  // published unedited) + integrity checked. The ONLY path to verified.
  const snapshotUnedited =
    importedSnapshot !== null &&
    importedSnapshot.key === effectiveKey &&
    importedSnapshot.source === source;
  const matchProof =
    deployStatus === 'deployed' &&
    hasSource &&
    integrityPassed &&
    snapshotUnedited &&
    importedSnapshot?.provenance === 'indexer';

  const goNext = useCallback(() => {
    setPublishError('');
    setStep((s) => (s >= 4 ? s : ((s + 1) as 1 | 2 | 3 | 4)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  const goBack = useCallback(() => {
    setPublishError('');
    setStep((s) => (s <= 1 ? s : ((s - 1) as 1 | 2 | 3 | 4)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ---- Publish: verified ONLY with match proof, else honest unverified ----
  const handleFinalPublish = useCallback(async () => {
    const publisher = sessionUser || 'alex-dev';
    const cid = deployStatus === 'draft' ? draftContractId(chain, name) : contractId.trim();
    const safeName = name.trim();
    if (!cid || !safeName) {
      setPublishError(
        deployStatus === 'draft'
          ? 'Give the draft a name first (step 2) — the address comes later.'
          : 'Contract name and on-chain address are both required.'
      );
      return;
    }
    if (hasSource && !integrityPassed) {
      setPublishError('Run the source check first — it records the hash we publish alongside.');
      return;
    }
    const claimed = matchProof; // the ONLY path to verified
    setIsPublishing(true);
    setPublishError('');
    setShowSuccess(false);

    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12);
    const language = chainMeta?.defaultLanguage ?? 'Solidity';
    const fns = extractFunctions(source, language);
    // honest provenance notes
    const curatedNote = ownIt === 'curated' ? `\n\n_Curated by @${publisher} — not the original author._` : '';
    const draftNote = deployStatus === 'draft' ? `\n\n_Draft — not deployed yet. Target: ${chain}:${network}._` : '';
    const repoNote = sourceMode === 'repo' && repoUrl.trim() ? `\n\nRepo: ${repoUrl.trim()}` : '';
    const noSourceNote = !hasSource ? `\n\n_Metadata-only entry — source to follow._` : '';
    const proofNote = claimed
      ? `\n\n_Verified: source pulled from the chain indexer for this exact address and published unedited. Source-SHA256: ${sourceHash || 'n/a'}._`
      : hasSource
        ? `\n\n_Unverified: source not cryptographically tied to this address. Source-SHA256: ${sourceHash || 'n/a'}._`
        : '';
    const baseDesc = description.trim() || 'No description provided.';
    const fullDescription = `${baseDesc}${curatedNote}${draftNote}${repoNote}${noSourceNote}${proofNote}`;
    // Rich README from questionnaire — only filled sections ship, so the page never shows dummy text.
    const featLines = readmeFeatures.split('\n').map((s) => s.trim()).filter(Boolean);
    const featMd = featLines.length ? `\n\n## Features\n${featLines.map((l) => `- ${l}`).join('\n')}` : '';
    const installMd = readmeInstall.trim() ? `\n\n## Install & Build\n\`\`\`\n${readmeInstall.trim()}\n\`\`\`` : '';
    const usageMd = readmeUsage.trim() ? `\n\n## Usage\n\`\`\`\n${readmeUsage.trim()}\n\`\`\`` : '';
    const notesMd = readmeNotes.trim() ? `\n\n## Notes & Risks\n${readmeNotes.trim()}` : '';
    const taglineMd = tagline.trim() ? `\n\n_${tagline.trim()}_` : '';
    const fullReadme = `# ${safeName}${taglineMd}\n\n${baseDesc}${featMd}${installMd}${usageMd}${notesMd}\n\n---${curatedNote}${draftNote}${repoNote}${noSourceNote}${proofNote}`;
    const filesPayload = hasSource
      ? [
          { path: 'src/lib.rs', name: 'lib.rs', type: 'file', content: source, lastCommitMessage: 'Initial publish', lastCommitTime: 'Just now' },
        ]
      : [];

    const offEnv = (import.meta.env.VITE_SPACETIMEDB_HANDSHAKE_DB as string | undefined) === 'off';
    if (!offEnv) {
      try {
        const res = await publishViaHandshake({
          chain, network, contractId: cid, name: safeName,
          tagline:
            tagline.trim() ||
            (deployStatus === 'draft' ? `${safeName} (draft on ${chainMeta?.name ?? chain})` : `${safeName} on ${chainMeta?.name ?? chain}`),
          description: fullDescription,
          source, language, license: license.trim() || 'Unknown', tags,
          owner: publisher, bytecodeHash: '',
          sourceHash: sourceHash || '',
          verifiedClaim: claimed,
          compilerVersion: fetchedCompiler || (chain === 'stellar' ? 'soroban-cli 22.0.0' : 'handshake-1.0'),
          readme: fullReadme,
          files: filesPayload as any,
          functions: fns as any,
        });
        if (res.ok) {
          setSuccessInfo({ chain, network, contractId: cid, name: safeName, owner: publisher });
          setShowSuccess(true);
          setIsPublishing(false);
          window.setTimeout(() => navigate({ page: 'contract-overview', chain, contractId: cid, owner: publisher, contractName: safeName }), 1750);
          return;
        }
        if ((res as any).already) {
          setPublishError('This chain · network · address is already published. Open it instead of re-publishing.');
          setIsPublishing(false);
          return;
        }
        setPublishError(`${(res as any).message || 'Publish failed'} — saved locally instead.`);
      } catch (e: any) {
        setPublishError(`${e?.message || 'Handshake DB unreachable'} — saved locally instead.`);
      }
    }

    // Local fallback so the wizard never dead-ends offline
    const fallback: SmartContract = {
      id: `custom-${Date.now()}`,
      name: safeName,
      tagline: tagline.trim() || `${safeName} on ${chain}`,
      description: fullDescription,
      owner: publisher,
      ownerAvatar: getAvatarForUser(publisher),
      chain, network, contractId: cid,
      bytecodeHash: '',
      verified: claimed,
      visibility: 'public',
      language: chainMeta?.defaultLanguage ?? 'Solidity',
      compilerVersion: fetchedCompiler || (chain === 'stellar' ? 'soroban-cli 22.0.0' : 'handshake-1.0'),
      license: license.trim() || 'Unknown',
      stars: 0, likes: 0, forksCount: 0,
      updatedAt: 'Just now',
      tags, primaryBranch: 'main', branches: ['main'], createdAt: 'Just now',
      readme: fullReadme,
      files: hasSource
        ? [{ path: 'src/lib.rs', name: 'lib.rs', type: 'file', content: source, lastCommitMessage: 'Initial verified release', lastCommitTime: 'Just now' }]
        : [],
      functions: (fns.length > 0 ? fns : []) as any,
      history: [{ hash: '9f8b1a', message: 'Initial publish', author: publisher, authorAvatar: getAvatarForUser(publisher), timestamp: 'Just now', contractIdVersion: cid, changesSummary: 'Initial publish.', diffSnippet: hasSource ? source.slice(0, 120) : fullDescription.slice(0, 120) }],
      forks: [], discussions: [],
      callGraph: { nodes: fns.slice(0, 4).map((f) => ({ id: `fn-${f.name}`, label: f.name, type: 'function' as const })), edges: [] },
      relatedContractIds: [],
    };
    setContracts([fallback, ...contracts]);
    setSuccessInfo({ chain, network, contractId: cid, name: safeName, owner: publisher });
    setShowSuccess(true);
    setIsPublishing(false);
    window.setTimeout(() => navigate({ page: 'contract-overview', chain, contractId: cid, owner: publisher, contractName: safeName }), 1750);
  }, [sessionUser, deployStatus, contractId, name, integrityPassed, matchProof, hasSource, tagsInput, chainMeta, source, sourceHash, sourceMode, repoUrl, ownIt, chain, network, tagline, description, license, fetchedCompiler, contracts, setContracts, navigate, readmeFeatures, readmeInstall, readmeUsage, readmeNotes]);

  return (
    <div className="relative min-h-screen">
      {!introDone && <PublishIntro onDone={() => setIntroDone(true)} />}

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-8 pb-24">
        {/* ---- Left-top header (not centered) ---- */}
        <div className="max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: introDone ? 1 : 0, y: introDone ? 0 : 8 }}
            transition={{ duration: 0.4, ease }}
            className="text-[11px] font-mono uppercase tracking-[0.28em] text-[#3B82F6] mb-3"
          >
            Publish · code-first registry
          </motion.p>
          <h1 className="text-3xl sm:text-[2.6rem] leading-[1.05] font-extrabold tracking-tight text-[#FAFAFA]">
            <AnimatedWords text="Publish a Smart Contract" delay={introDone ? 0.05 : 0.6} />
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: introDone ? 1 : 0, y: introDone ? 0 : 10 }}
            transition={{ duration: 0.5, delay: 0.25, ease }}
            className="mt-3 text-sm text-[#A1A1AA] leading-relaxed max-w-xl"
          >
            Tell us <span className="text-[#FAFAFA]">where it lives</span>, <span className="text-[#FAFAFA]">what it is</span>, show the{' '}
            <span className="text-[#FAFAFA]">source</span> — then we verify and index it by{' '}
            <span className="font-mono text-[#FAFAFA]">chain · network · contract ID</span>.
          </motion.p>

        </div>

        {/* ---- Body: borderless left form + vertical right rail ---- */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_264px] gap-10 items-start">
          {/* LEFT — the canvas (no border by design) */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <StepShell key={1} k={1}>
                  <SectionHeading
                    index="01"
                    title="Where does it live?"
                    desc="Pick the chain, the network, then point at the deployed address. Import pulls what the chain knows — you keep control."
                  />

                  {/* what-if: deployed vs not-yet */}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl">
                    {([
                      { v: 'deployed' as const, icon: Radar, t: 'Deployed on-chain', d: 'I have an address — import & verify it' },
                      { v: 'draft' as const, icon: FilePlus2, t: 'Not deployed yet', d: 'Idea / WIP — publish as a draft first' },
                    ]).map((o) => {
                      const active = deployStatus === o.v;
                      const Icon = o.icon;
                      return (
                        <motion.button
                          key={o.v}
                          type="button"
                          onClick={() => { setDeployStatus(o.v); setImportState('idle'); setImportNote(''); }}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          className={`flex items-start gap-3 p-3.5 rounded-2xl text-left transition-all ${
                            active ? 'bg-white text-black shadow-lg' : 'bg-white/[0.04] hover:bg-white/[0.08] text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>
                            <span className="block text-xs font-bold">{o.t}</span>
                            <span className={`block text-[11px] font-mono mt-0.5 ${active ? 'text-black/60' : 'text-[#71717A]'}`}>{o.d}</span>
                          </span>
                          {active && <Check className="w-4 h-4 ml-auto shrink-0" />}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* chain search + grid */}
                  <div className="mt-6 flex items-center gap-2 max-w-md">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
                      <input
                        value={chainQuery}
                        onChange={(e) => setChainQuery(e.target.value)}
                        placeholder="Filter chains… (stellar, base, solana)"
                        className="w-full pl-9 pr-3 py-2 rounded-full bg-white/[0.05] text-xs text-white placeholder:text-[#52525B] outline-none focus:bg-white/[0.08] transition-colors"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl">
                    {filteredChains.map((c, i) => {
                      const active = chain === c.id;
                      return (
                        <motion.button
                          key={c.id}
                          type="button"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease }}
                          onClick={() => { setChain(c.id); setImportState('idle'); setImportNote(''); }}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                            active ? 'bg-white text-black shadow-lg' : 'bg-white/[0.04] hover:bg-white/[0.08] text-white'
                          }`}
                        >
                          <img src={c.logo} alt={`${c.name} logo`} className="w-8 h-8 rounded-full object-cover bg-black/30 shrink-0" loading="lazy" />
                          <span className="min-w-0">
                            <span className={`block text-xs font-bold truncate ${active ? 'text-black' : 'text-white'}`}>{c.name}</span>
                            <span className={`block text-[10px] font-mono truncate ${active ? 'text-black/55' : 'text-[#71717A]'}`}>{c.familyLabel} · {c.caip}</span>
                          </span>
                          {active && <Check className="w-4 h-4 ml-auto shrink-0" />}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* network segmented */}
                  <div className="mt-7">
                    <Label>Network</Label>
                    <div className="mt-2 inline-flex p-1 rounded-full bg-white/[0.05] gap-1">
                      {networkOptions(chain, chainMeta).map((n) => (
                        <button
                          key={n.value}
                          type="button"
                          onClick={() => { setNetwork(n.value); setImportState('idle'); }}
                          className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all ${
                            network === n.value ? 'bg-white text-black font-bold shadow' : 'text-[#A1A1AA] hover:text-white'
                          }`}
                        >
                          {n.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* address + import (or draft preview when not deployed yet) */}
                  {deployStatus === 'deployed' ? (
                    <div className="mt-7 max-w-2xl">
                      <Label>Contract address <span className="text-[#52525B]">— the on-chain identity</span></Label>
                      <div className="mt-2 flex flex-col sm:flex-row gap-2">
                        <input
                          value={contractId}
                          onChange={(e) => { setContractId(e.target.value); setImportState('idle'); }}
                          placeholder={chainMeta?.addressPlaceholder ?? 'Contract ID / deployed address'}
                          spellCheck={false}
                          className="flex-1 px-4 py-3 rounded-2xl bg-white/[0.05] text-sm font-mono text-white placeholder:text-[#52525B] outline-none focus:bg-white/[0.08] focus:ring-1 focus:ring-[#3B82F6]/60 transition-all"
                        />
                        <motion.button
                          type="button"
                          onClick={runImport}
                          disabled={!contractId.trim() || importState === 'working'}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                        >
                          {importState === 'working' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
                          {importState === 'working' ? 'Importing…' : 'Import from address'}
                        </motion.button>
                      </div>
                      <div className={`mt-2 text-xs font-mono ${addressCheck.ok ? 'text-[#22C55E]' : 'text-[#71717A]'}`}>
                        {contractId.trim() ? addressCheck.hint : chainMeta?.addressPlaceholder}
                      </div>
                      <AnimatePresence>
                        {importNote && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`mt-3 flex items-start gap-2 p-3 rounded-2xl text-xs leading-relaxed ${
                              importState === 'ok' ? 'bg-[#22C55E]/10 text-[#86efac]' : 'bg-white/[0.04] text-[#A1A1AA]'
                            }`}
                          >
                            {importState === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />}
                            <span>{importNote}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="mt-7 max-w-2xl p-4 rounded-2xl bg-[#3B82F6]/[0.07]">
                      <p className="text-xs font-bold text-white flex items-center gap-2">
                        <FilePlus2 className="w-4 h-4 text-[#3B82F6]" /> Draft mode — no address needed
                      </p>
                      <p className="mt-1.5 text-xs text-[#A1A1AA] leading-relaxed">
                        Give it a name in the next step and we'll mint a draft key like{' '}
                        <span className="font-mono text-[#93c5fd]">draft-{chain}-{slugify(name || 'my-contract')}-x7k2</span>.
                        Deploy later, then publish again with the real address — the draft stays as provenance.
                      </p>
                      <p className="mt-2 text-[11px] font-mono text-[#71717A]">Target network above still matters — it tells readers where this is headed.</p>
                    </div>
                  )}

                  <WhatIf title="What if…">
                    <WhatIfRow q="It's not deployed yet?" a="Stay in Draft mode — publish the idea now, link the address later. No fake address needed." />
                    <WhatIfRow q="Wrong network?" a="Flip the network switch above. Pubnet/mainnet and testnet are separate registry entries — publish once per network." />
                    <WhatIfRow q="Proxy / upgradeable?" a="Publish the proxy address as the identity, then put the implementation address + admin in the description (step 2)." />
                    <WhatIfRow q="I don't own it?" a="Continue anyway — in step 2 mark it as Curated so the page shows honest provenance." />
                  </WhatIf>

                  <NavRow onBack={undefined} onNext={goNext} nextDisabled={!canNext1} nextLabel="Continue" nextSub="name it →" />
                </StepShell>
              )}

              {step === 2 && (
                <StepShell key={2} k={2}>
                  <SectionHeading index="02" title="What is it?" desc="The human layer — name it like a repo, sell it in one line, tag it so search finds it." />
                  <div className="mt-6 max-w-2xl space-y-5">
                    <div>
                      <Label>Repository name</Label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. soroban-vault-strategy"
                        className="mt-2 w-full px-4 py-3 rounded-2xl bg-white/[0.05] text-sm font-mono text-white placeholder:text-[#52525B] outline-none focus:bg-white/[0.08] focus:ring-1 focus:ring-[#3B82F6]/60 transition-all"
                      />
                    </div>
                    <div>
                      <Label>One-line tagline</Label>
                      <input
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="e.g. Yield vault with atomic withdrawal invariants"
                        className="mt-2 w-full px-4 py-3 rounded-2xl bg-white/[0.05] text-sm text-white placeholder:text-[#52525B] outline-none focus:bg-white/[0.08] focus:ring-1 focus:ring-[#3B82F6]/60 transition-all"
                      />
                    </div>
                    <div>
                      <Label>What does it do? <span className="text-[#52525B]">— invariants, auth, risks</span></Label>
                      <textarea
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Explain the design: what it guarantees, who can call what, what could go wrong…"
                        className="mt-2 w-full px-4 py-3 rounded-2xl bg-white/[0.05] text-sm text-white placeholder:text-[#52525B] outline-none focus:bg-white/[0.08] focus:ring-1 focus:ring-[#3B82F6]/60 transition-all resize-y"
                      />
                    </div>

                    {/* README questionnaire — so the contract page shows YOUR words, not a dummy */}
                    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#3B82F6]" />
                        <p className="text-xs font-bold text-white">README questionnaire <span className="font-mono font-normal text-[#71717A]">— optional, but this becomes the README.md on the contract page</span></p>
                      </div>
                      <div>
                        <Label>Key features <span className="text-[#52525B]">— one per line</span></Label>
                        <textarea
                          rows={3}
                          value={readmeFeatures}
                          onChange={(e) => setReadmeFeatures(e.target.value)}
                          placeholder={`e.g.\nAtomic batch swaps\nTime-locked admin\nNo re-entrancy via Soroban storage isolation`}
                          className="mt-2 w-full px-4 py-3 rounded-2xl bg-black/40 text-sm text-white placeholder:text-[#52525B] outline-none focus:bg-black/60 focus:ring-1 focus:ring-[#3B82F6]/60 transition-all resize-y font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label>Install / build <span className="text-[#52525B]">— how a dev gets it running</span></Label>
                        <textarea
                          rows={2}
                          value={readmeInstall}
                          onChange={(e) => setReadmeInstall(e.target.value)}
                          placeholder="e.g. cargo test • stellar contract build • npm install"
                          className="mt-2 w-full px-4 py-3 rounded-2xl bg-black/40 text-sm text-white placeholder:text-[#52525B] outline-none focus:bg-black/60 focus:ring-1 focus:ring-[#3B82F6]/60 transition-all resize-y font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label>Usage example <span className="text-[#52525B]">— snippet a reader can copy</span></Label>
                        <textarea
                          rows={3}
                          value={readmeUsage}
                          onChange={(e) => setReadmeUsage(e.target.value)}
                          placeholder={`e.g.\nstellar contract invoke --id ${'{contractId}'} -- --help\n// or JS: client.swap({ amount_in: 1000 })`}
                          className="mt-2 w-full px-4 py-3 rounded-2xl bg-black/40 text-sm text-white placeholder:text-[#52525B] outline-none focus:bg-black/60 focus:ring-1 focus:ring-[#3B82F6]/60 transition-all resize-y font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label>Notes / risks / invariants <span className="text-[#52525B]">— be honest</span></Label>
                        <textarea
                          rows={2}
                          value={readmeNotes}
                          onChange={(e) => setReadmeNotes(e.target.value)}
                          placeholder="e.g. Admin can pause. No audit yet — use on testnet first."
                          className="mt-2 w-full px-4 py-3 rounded-2xl bg-black/40 text-sm text-white placeholder:text-[#52525B] outline-none focus:bg-black/60 focus:ring-1 focus:ring-[#3B82F6]/60 transition-all resize-y text-xs"
                        />
                      </div>
                      <p className="text-[11px] font-mono text-[#52525B]">Leave any blank — only filled answers ship into the README.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Tags <span className="text-[#52525B]">— comma separated</span></Label>
                        <input
                          value={tagsInput}
                          onChange={(e) => setTagsInput(e.target.value)}
                          placeholder="defi, amm, soroban"
                          className="mt-2 w-full px-4 py-3 rounded-2xl bg-white/[0.05] text-sm font-mono text-white placeholder:text-[#52525B] outline-none focus:bg-white/[0.08] transition-all"
                        />
                      </div>
                      <div>
                        <Label>License</Label>
                        <div className="mt-2 flex gap-2">
                          <input
                            value={license}
                            onChange={(e) => setLicense(e.target.value)}
                            placeholder="Apache-2.0"
                            className="flex-1 min-w-0 px-4 py-3 rounded-2xl bg-white/[0.05] text-sm font-mono text-white outline-none focus:bg-white/[0.08] transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setLicense('Unknown')}
                            title="I don't know the license yet"
                            className="px-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-[11px] font-mono text-[#A1A1AA] hover:text-white transition-colors shrink-0"
                          >
                            Unknown?
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* what-if: not mine */}
                    <div>
                      <Label>Your relationship to this contract</Label>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {([
                          { v: 'mine' as const, t: 'I wrote / deployed it', d: 'You attest you have rights to publish' },
                          { v: 'curated' as const, t: 'I found it — curating', d: 'Honest provenance, not claiming authorship' },
                        ]).map((o) => (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => setOwnIt(o.v)}
                            className={`text-left p-3 rounded-2xl transition-all ${
                              ownIt === o.v ? 'bg-white text-black' : 'bg-white/[0.04] hover:bg-white/[0.08] text-white'
                            }`}
                          >
                            <span className="block text-xs font-bold">{o.t}</span>
                            <span className={`block text-[11px] font-mono mt-0.5 ${ownIt === o.v ? 'text-black/60' : 'text-[#71717A]'}`}>{o.d}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] font-mono text-[#52525B]">Publishing as <span className="text-[#A1A1AA]">@{sessionUser || 'alex-dev'}</span> · {chain}:{network}{deployStatus === 'draft' ? ' · draft' : ''}</p>
                  </div>
                  <WhatIf title="What if…">
                    <WhatIfRow q="I don't own the code?" a="Pick “curating” above — the page credits you as curator and invites the author to claim it. Never paste code you have no right to share." />
                    <WhatIfRow q="No license?" a="Hit “Unknown?” — it publishes with license Unknown and you can update it once you confirm with the author." />
                    <WhatIfRow q="Name taken?" a="Names are free-form; the unique key is chain · network · address. Pick a clear name — owner/name URLs disambiguate." />
                  </WhatIf>
                  <NavRow onBack={goBack} onNext={goNext} nextDisabled={!canNext2} nextLabel="Continue" nextSub="show code →" />
                </StepShell>
              )}

              {step === 3 && (
                <StepShell key={3} k={3}>
                  <SectionHeading
                    index="03"
                    title="Show me the code"
                    desc={`Paste it, link the repo, or skip it — every path publishes honestly. Language auto-follows the chain (${chainMeta?.defaultLanguage}).`}
                  />

                  {/* what-if: source mode tabs */}
                  <div className="mt-6 inline-flex p-1 rounded-full bg-white/[0.05] gap-1 max-w-full overflow-x-auto">
                    {([
                      { v: 'code' as const, icon: FileCode2, t: 'I have code' },
                      { v: 'repo' as const, icon: Github, t: 'Repo link' },
                      { v: 'none' as const, icon: PackageOpen, t: 'No source yet' },
                    ]).map((o) => {
                      const Icon = o.icon;
                      return (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setSourceMode(o.v)}
                          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-mono transition-all shrink-0 ${
                            sourceMode === o.v ? 'bg-white text-black font-bold shadow' : 'text-[#A1A1AA] hover:text-white'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" /> {o.t}
                        </button>
                      );
                    })}
                  </div>

                  {sourceMode === 'code' && (
                    <>
                      <div className="mt-4 max-w-2xl flex flex-col sm:flex-row gap-2">
                        <input
                          value={sourceUrl}
                          onChange={(e) => setSourceUrl(e.target.value)}
                          placeholder="Import from URL — https://raw.githubusercontent.com/…/lib.rs"
                          spellCheck={false}
                          className="flex-1 px-4 py-2.5 rounded-full bg-white/[0.05] text-xs font-mono text-white placeholder:text-[#52525B] outline-none focus:bg-white/[0.08] transition-all"
                        />
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => void runUrlImport()}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-xs font-semibold text-white transition-colors"
                          >
                            <Link2 className="w-3.5 h-3.5" /> Pull URL
                          </button>
                          <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-xs font-semibold text-white transition-colors"
                          >
                            <Upload className="w-3.5 h-3.5" /> Upload
                          </button>
                          <input ref={fileRef} type="file" accept=".rs,.sol,.move,.cairo,.vy,.txt,.toml" className="hidden" onChange={(e) => void onFilePicked(e.target.files?.[0])} />
                        </div>
                      </div>
                      {sourceStatus && <p className="mt-2 text-xs font-mono text-[#A1A1AA]">{sourceStatus}</p>}

                      <div className="mt-4 max-w-2xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-mono uppercase tracking-wider text-[#71717A]">
                            {chainMeta?.defaultLanguage} · {sourceLines} lines · {detectedFunctions.length} functions
                          </span>
                          {source && (
                            <button type="button" onClick={() => { setSource(''); setSourceStatus(''); }} className="text-[11px] font-mono text-[#71717A] hover:text-white">
                              Clear
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={14}
                          value={source}
                          onChange={(e) => setSource(e.target.value)}
                          placeholder={starterFor(chainMeta?.defaultLanguage ?? 'Solidity')}
                          spellCheck={false}
                          className="w-full p-4 rounded-2xl bg-black/60 font-mono text-[12px] leading-relaxed text-[#E4E4E7] placeholder:text-[#3f3f46] outline-none focus:ring-1 focus:ring-[#3B82F6]/60 transition-all"
                        />
                      </div>

                      {/* live function strip */}
                      <div className="mt-4 max-w-2xl">
                        {detectedFunctions.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {detectedFunctions.map((f) => (
                              <motion.span
                                key={f.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/25 text-[11px] font-mono text-[#93c5fd]"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                                {f.name}
                              </motion.span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[#52525B] font-mono">Functions will appear here as you paste — e.g. <span className="text-[#71717A]">pub fn swap(…)</span></p>
                        )}
                      </div>
                    </>
                  )}

                  {sourceMode === 'repo' && (
                    <div className="mt-4 max-w-2xl space-y-3">
                      <div>
                        <Label>Repository URL</Label>
                        <div className="mt-2 flex flex-col sm:flex-row gap-2">
                          <input
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="https://github.com/owner/repo (blob links auto-convert to raw)"
                            spellCheck={false}
                            className="flex-1 px-4 py-3 rounded-2xl bg-white/[0.05] text-xs font-mono text-white placeholder:text-[#52525B] outline-none focus:bg-white/[0.08] transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!repoUrl.trim()) { setSourceStatus('Paste a repo or raw file URL first.'); return; }
                              const raw = githubToRaw(repoUrl.trim());
                              setSourceUrl(raw);
                              void runUrlImport(raw);
                            }}
                            className="px-4 py-3 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] text-xs font-semibold text-white transition-colors shrink-0"
                          >
                            Fetch code
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          value={sourceUrl}
                          onChange={(e) => setSourceUrl(e.target.value)}
                          placeholder="Raw file URL — auto-filled from the repo link"
                          spellCheck={false}
                          className="flex-1 px-4 py-2.5 rounded-full bg-white/[0.05] text-xs font-mono text-white placeholder:text-[#52525B] outline-none focus:bg-white/[0.08] transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => void runUrlImport()}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#3B82F6] hover:bg-[#2563EB] text-xs font-bold text-white transition-colors shrink-0"
                        >
                          <Link2 className="w-3.5 h-3.5" /> Pull URL
                        </button>
                      </div>
                      {sourceStatus && <p className="text-xs font-mono text-[#A1A1AA]">{sourceStatus}</p>}
                      {source.trim().length >= 20 && (
                        <p className="text-xs font-mono text-[#22C55E]">✓ {sourceLines} lines pulled — functions: {detectedFunctions.map((f) => f.name).join(', ') || 'none detected yet'}.</p>
                      )}
                      <p className="text-[11px] font-mono text-[#52525B]">No fetchable file? Continue anyway — the repo link ships in the readme as provenance.</p>
                    </div>
                  )}

                  {sourceMode === 'none' && (
                    <div className="mt-4 max-w-2xl p-4 rounded-2xl bg-white/[0.03]">
                      <p className="text-xs font-bold text-white flex items-center gap-2">
                        <PackageOpen className="w-4 h-4 text-[#3B82F6]" /> Metadata-only publish
                      </p>
                      <p className="mt-1.5 text-xs text-[#A1A1AA] leading-relaxed">
                        No code? No problem. The entry goes live as <span className="text-white font-semibold">Unverified</span> with
                        your name, description and tags — searchable from step one. Add source later by publishing again
                        (same chain · network · address keeps one history).
                      </p>
                    </div>
                  )}

                  <WhatIf title="What if…">
                    <WhatIfRow q="Multi-file project?" a="Paste the entry point here (lib.rs / main .sol). Full multi-file upload lands next — for now link the repo in “Repo link” mode." />
                    <WhatIfRow q="Wrong language detected?" a="Language follows the chain you picked in step 1. Go back one step and switch chains — the starter template updates." />
                    <WhatIfRow q="Huge file?" a="Cap is ~120 KB for the registry row. Publish the core contract here, keep tests and scripts in the repo link." />
                  </WhatIf>

                  <NavRow onBack={goBack} onNext={goNext} nextDisabled={!canNext3} nextLabel="Continue" nextSub="verify →" />
                </StepShell>
              )}

              {step === 4 && (
                <StepShell key={4} k={4}>
                  <SectionHeading
                    index="04"
                    title={hasSource ? 'Check it, then ship it' : 'Review it, then ship it'}
                    desc={
                      hasSource
                        ? 'Two separate questions: is the source well-formed (check), and is it proven to be what runs at this address (match)?'
                        : deployStatus === 'draft'
                          ? 'Drafts skip checks — review the story and ship it. Add the address later.'
                          : 'No source, no problem — review the metadata and ship it unverified. Source can follow.'
                    }
                  />

                  <div className="mt-6 max-w-2xl space-y-4">
                    {hasSource ? (
                      <button
                        type="button"
                        onClick={runIntegrityCheck}
                        disabled={isChecking || source.trim().length < 20}
                        className="group relative overflow-hidden w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-bold transition-all disabled:opacity-50"
                      >
                        {isChecking ? <RefreshCw className="w-4 h-4 animate-spin" /> : integrityPassed ? <CheckCircle2 className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        {isChecking ? 'Hashing & checking…' : integrityPassed ? 'Integrity OK — run again' : 'Check source'}
                      </button>
                    ) : (
                      <div className="p-4 rounded-2xl bg-white/[0.03] flex items-start gap-2.5">
                        <PackageOpen className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                        <p className="text-xs text-[#A1A1AA] leading-relaxed">
                          {deployStatus === 'draft'
                            ? 'Draft path — checks unlock once you add source + a real address. This ships as an Unverified draft.'
                            : 'Metadata-only path — nothing to hash. This ships as Unverified; the badge can follow with source.'}
                        </p>
                      </div>
                    )}

                    {sourceHash && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-[#22C55E]/[0.07]">
                        <p className="text-[11px] font-mono uppercase tracking-wider text-[#22C55E] mb-1">Source integrity OK · SHA-256 · {detectedFunctions.length} functions</p>
                        <p className="text-xs font-mono text-[#86efac] break-all">{sourceHash}</p>
                        <p className="mt-1.5 text-[11px] text-[#A1A1AA]">This proves the source is well-formed — not that it matches the address. See match status below.</p>
                      </motion.div>
                    )}

                    {/* match status — the ONLY thing that earns Verified */}
                    {hasSource && deployStatus === 'deployed' && (
                      <div className={`p-4 rounded-2xl flex items-start gap-2.5 ${matchProof ? 'bg-[#22C55E]/[0.07]' : 'bg-white/[0.03]'}`}>
                        {matchProof ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                            <div className="text-xs leading-relaxed">
                              <p className="font-bold text-white">Bytecode match — this will publish as Verified.</p>
                              <p className="text-[#A1A1AA] mt-0.5">Source came from the chain indexer for this exact address and hasn't been edited since import.</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                            <div className="text-xs leading-relaxed">
                              <p className="font-bold text-white">No match proof — this will publish as Unverified.</p>
                              <p className="text-[#A1A1AA] mt-0.5">
                                {importedSnapshot
                                  ? 'The imported source was edited after import, so the indexer link no longer holds. Re-import to restore proof.'
                                  : 'Pasted code can’t be tied to the address from here — only source imported from the address carries proof. Unverified is honest; the source hash still ships for audit.'}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* review — borderless rows, not a card */}
                    <div className="pt-2 divide-y divide-white/[0.06]">
                      <ReviewRow k="Contract" v={`${name || '—'}${deployStatus === 'draft' ? ' · draft' : ''}${ownIt === 'curated' ? ' · curated' : ''}`} />
                      <ReviewRow k="Chain" v={`${chainMeta?.name ?? chain} · ${network}`} logo={chainMeta?.logo} />
                      <ReviewRow
                        k="Address"
                        v={deployStatus === 'draft' ? `auto · ${effectiveContractId.slice(0, 28)}…` : effectiveContractId || '—'}
                        mono
                        accent={deployStatus !== 'draft'}
                      />
                      <ReviewRow k="Source" v={sourceMode === 'code' ? `${sourceLines} lines` : sourceMode === 'repo' ? (source.trim() ? `${sourceLines} lines + repo link` : (repoUrl.trim() || 'link only')) : 'metadata only'} mono />
                      <ReviewRow k="Match" v={matchProof ? 'proven · publishes Verified' : hasSource ? 'none · publishes Unverified' : 'n/a · publishes Unverified'} mono accent={matchProof} />
                      {fetchedCompiler && <ReviewRow k="Compiler" v={fetchedCompiler} mono />}
                      <ReviewRow k="Functions" v={detectedFunctions.length > 0 ? detectedFunctions.map((f) => f.name).join(', ') : '—'} mono />
                      <ReviewRow k="Publisher" v={`@${sessionUser || 'alex-dev'}`} />
                    </div>

                    {publishError && (
                      <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-500/10 text-xs text-red-300">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{publishError}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 gap-3 flex-wrap">
                      <WizardBack onClick={goBack} />
                      <motion.button
                        type="button"
                        onClick={() => void handleFinalPublish()}
                        disabled={isPublishing || (hasSource && !integrityPassed)}
                        whileHover={!isPublishing && (!hasSource || integrityPassed) ? { scale: 1.03 } : undefined}
                        whileTap={!isPublishing && (!hasSource || integrityPassed) ? { scale: 0.96 } : undefined}
                        className="group relative overflow-hidden inline-flex items-center gap-2.5 rounded-full bg-[#22C55E] hover:bg-[#16A34A] text-white pl-6 pr-2.5 py-2 text-sm font-bold transition-colors disabled:opacity-40"
                      >
                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-700" aria-hidden="true" />
                        <span className="relative">
                          {isPublishing ? 'Publishing…' : matchProof ? 'Publish Verified ✓' : deployStatus === 'draft' ? 'Publish Draft' : 'Publish Unverified'}
                        </span>
                        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-black/25">
                          {isPublishing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                        </span>
                      </motion.button>
                    </div>
                    {hasSource && !integrityPassed && (
                      <p className="text-[11px] font-mono text-[#52525B]">Run the source check above first — it records the hash published alongside.</p>
                    )}
                  </div>
                  <WhatIf title="What if…">
                    <WhatIfRow q="The check fails?" a="Fix the flagged function and re-run — the check only gates publishing when you have source. No source, no gate." />
                    <WhatIfRow q="Code and address don't match?" a="Then it ships Unverified — correctly. Only source imported from the address, published unedited, earns the badge. Anything else claiming Verified would be lying." />
                    <WhatIfRow q="Already published?" a="You'll get an “already exists” error with this exact chain · network · address. Open that page instead of duplicating." />
                    <WhatIfRow q="Same contract, another network?" a="Publish again with the network switched — testnet and mainnet are intentionally separate entries." />
                    <WhatIfRow q="Need to fix something after?" a="Republish over the same key today (owner edit lands next). For now, drafts and metadata-only entries accept a second publish as the update." />
                  </WhatIf>
                </StepShell>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT — vertical steps rail */}
          <aside className="lg:sticky lg:top-20">
            <div className="lg:border-l lg:border-white/[0.07] lg:pl-6">
              <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-[#52525B] mb-4">Progress</p>
              <ol className="flex lg:flex-col gap-2 lg:gap-0">
                {STEPS.map((s, i) => {
                  const active = step === s.n;
                  const done = step > s.n;
                  const Icon = s.icon;
                  return (
                    <li key={s.n} className="flex-1 lg:flex-none">
                      <button
                        type="button"
                        onClick={() => { if (s.n < step) setStep(s.n as 1 | 2 | 3 | 4); }}
                        disabled={s.n > step}
                        className={`w-full flex lg:flex-row flex-col items-center lg:items-start gap-3 text-left py-1 group ${s.n > step ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <span className="flex lg:flex-col flex-row items-center gap-0">
                          <motion.span
                            animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                            transition={{ duration: 0.5 }}
                            className={`flex h-9 w-9 items-center justify-center rounded-full transition-all shrink-0 ${
                              done ? 'bg-[#22C55E]/15 text-[#22C55E]' : active ? 'bg-white text-black shadow-lg' : 'bg-white/[0.05] text-[#71717A]'
                            }`}
                          >
                            {done ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                          </motion.span>
                          {i < STEPS.length - 1 && (
                            <span className="hidden lg:block w-px h-8 mx-auto my-1 bg-white/10 overflow-hidden relative">
                              <motion.span
                                className="absolute inset-0 bg-[#22C55E]"
                                initial={false}
                                animate={{ scaleY: done || active ? 1 : 0 }}
                                style={{ originY: 0 }}
                                transition={{ duration: 0.5, ease }}
                              />
                            </span>
                          )}
                        </span>
                        <span className="lg:pb-5 lg:pt-1 text-center lg:text-left">
                          <span className={`block text-xs font-bold ${active ? 'text-white' : done ? 'text-[#A1A1AA]' : 'text-[#52525B]'}`}>
                            <span className="font-mono text-[10px] mr-1.5 opacity-60">0{s.n}</span>
                            {s.title}
                          </span>
                          <span className="hidden lg:block text-[11px] font-mono text-[#52525B] mt-0.5">{s.desc}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="hidden lg:block mt-4 p-3 rounded-2xl bg-white/[0.03]">
                <p className="text-[11px] font-mono text-[#71717A] leading-relaxed">
                  Identity key{deployStatus === 'draft' ? ' · draft' : ''}<br />
                  <span className="text-[#A1A1AA] break-all">{chain}:{network}:{deployStatus === 'draft' ? `${effectiveContractId.slice(0, 22)}…` : contractId ? `${contractId.slice(0, 10)}…` : '—'}</span>
                </p>
                {deployStatus === 'draft' && (
                  <p className="mt-1.5 text-[11px] font-mono text-[#52525B]">Draft key mints on publish — no address needed.</p>
                )}
                {deployStatus !== 'draft' && contractId && chainMeta?.explorerAccount && (
                  <a
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-[#3B82F6] hover:underline"
                    href={chain === 'stellar'
                      ? `https://stellar.expert/explorer/${network === 'testnet' ? 'testnet' : 'public'}/contract/${contractId}`
                      : `${chainMeta.explorerAccount}/${contractId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on explorer <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Successful publication — Handshake branded celebration */}
      <AnimatePresence>
        {showSuccess && successInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-[#050506]/85 backdrop-blur-[6px] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 18, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.96, y: 10, filter: 'blur(6px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md rounded-[20px] bg-[#0A0A0B] border border-[#27272A] p-8 text-center shadow-[0_16px_64px_rgba(0,0,0,0.6)]"
            >
              <motion.img
                src="/handshake-logo.png"
                alt="Handshake"
                initial={{ scale: 0.8, rotate: -6 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="w-14 h-14 mx-auto rounded-[12px] object-cover border border-white/10 shadow-[0_8px_32px_rgba(59,130,246,0.35)]"
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, delay: 0.25, type: 'spring', stiffness: 420, damping: 18 }}
                className="w-9 h-9 mx-auto -mt-3 ml-[58%] bg-[#22C55E] rounded-full flex items-center justify-center border-2 border-[#0A0A0B] shadow-lg"
              >
                <Check className="w-5 h-5 text-white stroke-[3]" />
              </motion.div>
              <h3 className="mt-4 text-xl font-extrabold tracking-tight text-[#FAFAFA]">Published!</h3>
              <p className="mt-2 text-xs text-[#A1A1AA] leading-relaxed">
                <span className="text-[#FAFAFA] font-semibold">{successInfo.name}</span> is now live on<br />
                <span className="font-mono text-[#3B82F6]">{successInfo.chain}:{successInfo.network}:{successInfo.contractId.slice(0, 12)}…</span>
              </p>
              <p className="mt-1 text-[11px] font-mono text-[#52525B]">Opening the contract page…</p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                <span className="text-[11px] font-mono text-[#71717A]">Handshake registry indexed</span>
              </div>
              <div className="mt-5 p-3 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-xs font-mono text-[#93C5FD] break-all">
                {successInfo.owner}/{successInfo.name}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------

const WhatIf: React.FC<{ title?: string; children: React.ReactNode }> = ({ title = 'What if…', children }) => (
  <details className="mt-6 max-w-2xl group/whatif rounded-2xl bg-white/[0.03] open:bg-white/[0.05] transition-colors">
    <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none text-xs font-mono text-[#71717A] hover:text-white transition-colors">
      <Info className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
      {title}
      <span className="ml-auto text-[#52525B] group-open/whatif:rotate-90 transition-transform">›</span>
    </summary>
    <div className="px-4 pb-4 space-y-3">{children}</div>
  </details>
);

const WhatIfRow: React.FC<{ q: string; a: string }> = ({ q, a }) => (
  <div className="flex gap-2.5 text-xs leading-relaxed">
    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#3B82F6] shrink-0" />
    <p>
      <span className="font-bold text-white">{q} </span>
      <span className="text-[#A1A1AA]">{a}</span>
    </p>
  </div>
);

const SectionHeading: React.FC<{ index: string; title: string; desc: string }> = ({ index, title, desc }) => (
  <div>
    <p className="text-[11px] font-mono text-[#3B82F6] tracking-[0.24em] uppercase">{index}</p>
    <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
      <AnimatedWords text={title} />
    </h2>
    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }} className="mt-2 text-sm text-[#A1A1AA] max-w-xl leading-relaxed">
      {desc}
    </motion.p>
  </div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs font-mono uppercase tracking-wider text-[#71717A]">{children}</p>
);

const NavRow: React.FC<{ onBack?: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel: string; nextSub?: string }> = ({ onBack, onNext, nextDisabled, nextLabel, nextSub }) => (
  <div className="mt-8 flex items-center justify-between">
    {onBack ? <WizardBack onClick={onBack} /> : <span />}
    <WizardNext onClick={onNext} disabled={nextDisabled} label={nextLabel} sub={nextSub} />
  </div>
);

const ReviewRow: React.FC<{ k: string; v: string; mono?: boolean; accent?: boolean; logo?: string }> = ({ k, v, mono, accent, logo }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <span className="text-[11px] font-mono uppercase tracking-wider text-[#52525B] shrink-0">{k}</span>
    <span className={`text-xs text-right truncate max-w-[60%] ${mono ? 'font-mono' : 'font-semibold'} ${accent ? 'text-[#3B82F6]' : 'text-white'}`}>
      {logo && <img src={logo} alt="" className="inline w-4 h-4 rounded-full object-cover mr-1.5 -mt-0.5" />}
      {v}
    </span>
  </div>
);

function networkOptions(chainId: string, meta: ChainMeta | undefined): Array<{ value: NetworkType; label: string }> {
  if (chainId === 'stellar') return [{ value: 'pubnet', label: 'Pubnet · live' }, { value: 'testnet', label: 'Testnet' }];
  const main = meta?.mainnet ?? 'Mainnet';
  const test = meta?.testnet ?? 'Testnet';
  // keep NetworkType union happy — map unknown labels onto mainnet/sepolia
  return [{ value: 'mainnet' as NetworkType, label: `${main} · live` }, { value: 'sepolia' as NetworkType, label: test }];
}

function starterFor(language: string): string {
  const l = language.toLowerCase();
  if (l.includes('solidity')) return '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\n\ncontract MyContract {\n    function run() external pure returns (bool) {\n        return true;\n    }\n}\n';
  if (l.includes('move')) return 'module 0x1::my_contract {\n    public entry fun run(): bool {\n        true\n    }\n}\n';
  if (l.includes('cairo')) return '#[starknet::contract]\nmod MyContract {\n    #[external(v0)]\n    fn run(self: @ContractState) -> bool {\n        true\n    }\n}\n';
  return '#![no_std]\nuse soroban_sdk::{contract, contractimpl, Env};\n\n#[contract]\npub struct MyContract;\n\n#[contractimpl]\nimpl MyContract {\n    pub fn run(env: Env) -> bool {\n        true\n    }\n}\n';
}
