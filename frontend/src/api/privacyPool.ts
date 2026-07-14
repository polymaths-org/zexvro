/**
 * Privacy Pool Client
 *
 * Real ZK deposit/withdraw on Soroban privacy pools.
 * Fast path: EC2 relayer (fund → deposit → RapidSNARK prove → withdraw).
 * Fallback: browser RPC + optional Freighter / treasury auto-sign.
 *
 * Horizon for accounts; raw Soroban RPC for simulate/send; rpc.assembleTransaction
 * from the same stellar-sdk package (avoids dual-package Server hazard).
 */

// @ts-ignore — snarkjs has no bundled types
import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import { signTransaction as freighterSign } from '@stellar/freighter-api';
import {
  Contract, Networks, TransactionBuilder, Address, xdr,
  Horizon, rpc, Account, Keypair, Transaction, authorizeEntry,
} from 'stellar-sdk';
import { zkNotesApi, zkWorkerApi } from './api';

/* ─── Constants ─── */

const SOROBAN_RPC_URL = import.meta.env.VITE_SOROBAN_RPC || 'https://soroban-testnet.stellar.org';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const SAC_NATIVE = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const TREE_DEPTH = 20;
const STROOPS_PER_XLM = 10_000_000;

/**
 * Multi-denomination shared pools (same Groth16 circuit — only unit size differs).
 * Large private pays use few big notes instead of thousands of 1 XLM proofs.
 * 2500 XLM → 2×1000 + 5×100 = 7 proofs (not 2500).
 */
export interface PoolTier {
  id: string;
  xlm: number;
  stroops: bigint;
  contract: string;
}

export const POOL_TIERS: PoolTier[] = [
  {
    id: '1000xlm',
    xlm: 1000,
    stroops: BigInt(1000 * STROOPS_PER_XLM),
    contract: import.meta.env.VITE_ZER0_CONTRACT_1000 || 'CDOOUXPZCGIMKRQ2UQUGEMWFGC7X2V7BGNQTTBFWCQ4GVTHO44AGJUUP',
  },
  {
    id: '100xlm',
    xlm: 100,
    stroops: BigInt(100 * STROOPS_PER_XLM),
    contract: import.meta.env.VITE_ZER0_CONTRACT_100 || 'CDWPYRZVZT37LBB7DTPYV43WPXQZTS7QD6PXLGWO37GDVXVJ3JOJEJP5',
  },
  {
    id: '10xlm',
    xlm: 10,
    stroops: BigInt(10 * STROOPS_PER_XLM),
    contract: import.meta.env.VITE_ZER0_CONTRACT_10 || 'CBNQMLEYWUBYS2JJKGP7NIUK3QOXLBY774JWPXO6ZXONQMB3K5QYLMNW',
  },
  {
    id: '1xlm',
    xlm: 1,
    stroops: BigInt(1 * STROOPS_PER_XLM),
    contract: import.meta.env.VITE_ZER0_CONTRACT || 'CDQSV7I3FRQ6EBQOOE6MQSJHPCPQNHPWRK2G75DYYOOOGHDVIQGOZF4I',
  },
];

/** Legacy default = 1 XLM pool (smallest tier). Prefer planShieldPay / shieldPayAmount. */
const DEFAULT_TIER = POOL_TIERS[POOL_TIERS.length - 1];
let activePoolContract = DEFAULT_TIER.contract;
let activeDenomStroops = DEFAULT_TIER.stroops;
let activeDenomXlm = DEFAULT_TIER.xlm;

export function usePool(tier: PoolTier) {
  activePoolContract = tier.contract;
  activeDenomStroops = tier.stroops;
  activeDenomXlm = tier.xlm;
}

/** @deprecated use planShieldPay — kept for UI that still reads unit size */
const DENOMINATION = Number(DEFAULT_TIER.stroops);
const DENOMINATION_XLM = DEFAULT_TIER.xlm;
const POOL_CONTRACT = DEFAULT_TIER.contract;

/**
 * Optional testnet treasury secret for seamless multi-unit ZK (no Freighter spam).
 * Set VITE_TREASURY_SECRET in .env — never use a mainnet key here.
 */
const TREASURY_SECRET = (import.meta.env.VITE_TREASURY_SECRET || '').trim();

/* ─── Types ─── */

export interface DepositNote {
  secret: string;
  nullifier: string;
  commitment: string;
  nullifierHash: string;
  index: number;
  timestamp: number;
  poolContract?: string;
  denominationXlm?: number;
}

export interface ShieldNotePlan {
  tier: PoolTier;
  count: number;
  xlm: number;
}

export interface ShieldPayPlan {
  amountXlm: number;
  settledXlm: number;
  notes: ShieldNotePlan[];
  totalNotes: number;
  estimatedSeconds: number;
  description: string;
}

/**
 * Greedy pack amount into fewest pool notes (largest denom first).
 * e.g. 2500 → 2×1000 + 5×100 = 7 notes; 11 → 1×10 + 1×1 = 2 notes.
 */
export function planShieldPay(amountXlm: number): ShieldPayPlan {
  const target = Math.max(0, Math.ceil(Number(amountXlm) || 0));
  if (target <= 0) {
    return {
      amountXlm: 0, settledXlm: 0, notes: [], totalNotes: 0,
      estimatedSeconds: 0, description: 'Enter an amount',
    };
  }
  let remaining = target;
  const notes: ShieldNotePlan[] = [];
  for (const tier of POOL_TIERS) {
    const count = Math.floor(remaining / tier.xlm);
    if (count <= 0) continue;
    notes.push({ tier, count, xlm: count * tier.xlm });
    remaining -= count * tier.xlm;
  }
  // Dust below 1 XLM rounds up to one 1-XLM note
  if (remaining > 0) {
    const one = POOL_TIERS.find(t => t.xlm === 1)!;
    const existing = notes.find(n => n.tier.id === one.id);
    if (existing) {
      existing.count += 1;
      existing.xlm += 1;
    } else {
      notes.push({ tier: one, count: 1, xlm: 1 });
    }
    remaining = 0;
  }
  const totalNotes = notes.reduce((s, n) => s + n.count, 0);
  const settledXlm = notes.reduce((s, n) => s + n.xlm, 0);
  // Server settle (EC2 relayer): ~4–6s/note chain time; prove ~0.4s parallel
  const estimatedSeconds = Math.max(12, 8 + totalNotes * 6);
  const parts = notes.map(n => `${n.count}×${n.tier.xlm} XLM`).join(' + ');
  return {
    amountXlm: target,
    settledXlm,
    notes,
    totalNotes,
    estimatedSeconds,
    description: `${parts} = ${settledXlm} XLM · ${totalNotes} ZK note(s)`,
  };
}

export interface WithdrawResult {
  txHash: string;
  nullifierHash: string;
}

/* ─── Poseidon ─── */

let _poseidon: any = null;

async function getPoseidon() {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}

function randomFieldElement(): bigint {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return BigInt('0x' + hex) % BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
}

function toHex(val: bigint): string {
  return val.toString(16).padStart(64, '0');
}

/* ─── Note Storage ─── */

const NOTES_KEY = 'zexvro_zk_notes';
const AWS_SYNCED_KEY = 'zexvro_zk_notes_synced';

export function saveNote(note: DepositNote) {
  const existing = getNotes();
  existing.push(note);
  localStorage.setItem(NOTES_KEY, JSON.stringify(existing));
  // Also persist to AWS (fire-and-forget, local is source of truth)
  zkNotesApi.save(note).catch(() => {});
}

export function getNotes(): DepositNote[] {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); }
  catch { return []; }
}

export function getNoteByCommitment(commitment: string): DepositNote | undefined {
  return getNotes().find(n => n.commitment === commitment);
}

export async function syncNotesFromAws(): Promise<void> {
  try {
    const { notes: awsNotes } = await zkNotesApi.list();
    if (!awsNotes || awsNotes.length === 0) return;

    const local = getNotes();
    const localCommitments = new Set(local.map(n => n.commitment));
    const merged = [...local];

    for (const aws of awsNotes) {
      if (!localCommitments.has(aws.commitment)) {
        merged.push({
          secret: aws.secret,
          nullifier: aws.nullifier,
          commitment: aws.commitment,
          nullifierHash: aws.nullifierHash,
          index: aws.index || 0,
          timestamp: aws.timestamp || aws.createdAt || Date.now(),
        } as DepositNote);
      }
    }

    localStorage.setItem(NOTES_KEY, JSON.stringify(merged));
    localStorage.setItem(AWS_SYNCED_KEY, Date.now().toString());
  } catch (err) {
    console.warn('Failed to sync ZK notes from AWS:', err);
  }
}

export async function pushNotesToAws(): Promise<void> {
  try {
    const notes = getNotes();
    for (const note of notes) {
      await zkNotesApi.save(note);
    }
    localStorage.setItem(AWS_SYNCED_KEY, Date.now().toString());
  } catch (err) {
    console.warn('Failed to push ZK notes to AWS:', err);
  }
}

/* ─── Horizon + Soroban RPC (object params, no getAccount on Soroban) ─── */

const horizon = new Horizon.Server(HORIZON_URL);

async function rpcCall(method: string, params: Record<string, unknown>): Promise<any> {
  const resp = await fetch(SOROBAN_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await resp.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message || JSON.stringify(json.error)}`);
  return json.result;
}

async function loadAccount(address: string): Promise<Account> {
  return horizon.loadAccount(address);
}

async function rpcSimulate(txXdr: string): Promise<any> {
  return rpcCall('simulateTransaction', { transaction: txXdr });
}

async function rpcSend(txXdr: string): Promise<any> {
  return rpcCall('sendTransaction', { transaction: txXdr });
}

async function rpcGetTx(hash: string): Promise<any> {
  return rpcCall('getTransaction', { hash });
}

/* ─── ScVal Helpers ─── */

const _Int64Type = (xdr as any).Int128Parts._fields[0][1];
const _UnsignedHyperType = (xdr as any).Int128Parts._fields[1][1];

function scvAddress(address: string): xdr.ScVal {
  return xdr.ScVal.scvAddress(Address.fromString(address).toScAddress());
}

function scvBytesN(hex: string): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(hex, 'hex'));
}

function scvI128(value: bigint): xdr.ScVal {
  const lo = value & BigInt('0xFFFFFFFFFFFFFFFF');
  const hi = value >> BigInt(64);
  return xdr.ScVal.scvI128(new (xdr as any).Int128Parts({
    hi: new _Int64Type(hi),
    lo: new _UnsignedHyperType(lo),
  }));
}

function scvU32(value: number): xdr.ScVal {
  return xdr.ScVal.scvU32(value);
}

/* ─── Contract reads (simulation) ─── */

async function simulateContractCall(
  source: string,
  method: string,
  ...args: xdr.ScVal[]
): Promise<any> {
  const account = await loadAccount(source);
  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(activePoolContract).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await rpcSimulate(tx.toXDR());
  if (sim.error) throw new Error(`${method} failed: ${sim.error}`);
  return sim;
}

function parseSimBytes(sim: any): string {
  const xdrStr = sim.results?.[0]?.xdr;
  if (!xdrStr) throw new Error('No return value from simulation');
  const scVal = xdr.ScVal.fromXDR(xdrStr, 'base64');
  return Buffer.from(scVal.bytes()).toString('hex');
}

function parseSimU32(sim: any): number {
  const xdrStr = sim.results?.[0]?.xdr;
  if (!xdrStr) throw new Error('No return value from simulation');
  const scVal = xdr.ScVal.fromXDR(xdrStr, 'base64');
  return scVal.u32();
}

function parseSimOptionBytes(sim: any): string | null {
  const xdrStr = sim.results?.[0]?.xdr;
  if (!xdrStr) return null;
  const scVal = xdr.ScVal.fromXDR(xdrStr, 'base64');
  if (scVal.switch().name === 'scvVoid') return null;
  try {
    if (scVal.switch().name === 'scvVec') {
      const vec = scVal.vec();
      if (!vec || vec.length === 0) return null;
      return Buffer.from(vec[0].bytes()).toString('hex');
    }
    return Buffer.from(scVal.bytes()).toString('hex');
  } catch {
    return null;
  }
}

/** Parallel-ish commitment fetch (bounded concurrency). */
async function fetchAllLeaves(source: string, count: number): Promise<bigint[]> {
  const leaves: bigint[] = new Array(count);
  // Higher concurrency — public testnet RPC tolerates more than 8; cut wall time as tree grows
  const CONCURRENCY = 20;
  for (let start = 0; start < count; start += CONCURRENCY) {
    const batch: Promise<void>[] = [];
    for (let i = start; i < Math.min(start + CONCURRENCY, count); i++) {
      batch.push(
        simulateContractCall(source, 'get_commitment', scvU32(i)).then(sim => {
          const hex = parseSimOptionBytes(sim);
          if (!hex) throw new Error(`Missing commitment at index ${i}`);
          leaves[i] = BigInt('0x' + hex);
        }),
      );
    }
    await Promise.all(batch);
  }
  return leaves;
}

/** Prefer EC2 worker merkle snapshot (server RPC pool) over browser leaf-by-leaf. */
async function fetchMerklePathsRemote(
  contract: string,
  commitments: string[],
): Promise<{
  rootHex: string;
  paths: Record<string, {
    leafIndex: number;
    pathElements: bigint[];
    pathIndices: number[];
    root: bigint;
    rootHex: string;
  }>;
} | null> {
  try {
    const remote = await zkWorkerApi.merkle(contract, commitments);
    if (remote.error || remote.reason === 'worker_offline' || remote.mode === 'browser_fallback') {
      return null;
    }
    if (!remote.rootHex || !remote.paths) return null;
    const paths: Record<string, {
      leafIndex: number;
      pathElements: bigint[];
      pathIndices: number[];
      root: bigint;
      rootHex: string;
    }> = {};
    for (const [c, p] of Object.entries(remote.paths)) {
      if (!p || p.error || p.leafIndex == null || !p.pathElements || !p.pathIndices || !p.root) continue;
      paths[c] = {
        leafIndex: p.leafIndex,
        pathElements: p.pathElements.map(e => BigInt(e)),
        pathIndices: p.pathIndices,
        root: BigInt(p.root),
        rootHex: p.rootHex || remote.rootHex,
      };
    }
    return { rootHex: remote.rootHex, paths };
  } catch {
    return null;
  }
}

function buildZeros(poseidon: any): bigint[] {
  const zeros: bigint[] = [BigInt(0)];
  let z = BigInt(0);
  for (let i = 0; i < TREE_DEPTH; i++) {
    z = poseidon.F.toObject(poseidon([z, z]));
    zeros.push(z);
  }
  return zeros;
}

/** Build Merkle path offline from prefetched leaves (no RPC). */
function buildMerklePathFromLeaves(
  leaves: bigint[],
  leafIndex: number,
  poseidon: any,
  rootHex: string,
  zeros?: bigint[],
): { pathElements: bigint[]; pathIndices: number[]; root: bigint; rootHex: string } {
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error(`Invalid leaf index ${leafIndex} (tree has ${leaves.length} leaves)`);
  }
  const z = zeros || buildZeros(poseidon);
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  let level = leaves.slice();
  let idx = leafIndex;

  for (let d = 0; d < TREE_DEPTH; d++) {
    pathIndices.push(idx & 1);
    const siblingIdx = idx ^ 1;
    pathElements.push(level[siblingIdx] ?? z[d]);

    const next: bigint[] = [];
    const width = Math.ceil(Math.max(level.length, idx + 1) / 2) || 1;
    for (let i = 0; i < width; i++) {
      const left = level[i * 2] ?? z[d];
      const right = level[i * 2 + 1] ?? z[d];
      next.push(poseidon.F.toObject(poseidon([left, right])));
    }
    level = next;
    idx >>= 1;
  }

  const root = BigInt('0x' + rootHex);
  let cur = leaves[leafIndex];
  for (let d = 0; d < TREE_DEPTH; d++) {
    const sib = pathElements[d];
    cur = pathIndices[d] === 0
      ? poseidon.F.toObject(poseidon([cur, sib]))
      : poseidon.F.toObject(poseidon([sib, cur]));
  }
  if (cur !== root) {
    throw new Error(`Merkle path mismatch: computed=${toHex(cur)} onchain=${rootHex}`);
  }
  return { pathElements, pathIndices, root, rootHex };
}

/** Fetch on-chain leaves and build Merkle path matching the contract tree. */
async function buildMerklePath(
  source: string,
  leafIndex: number,
  poseidon: any,
): Promise<{ pathElements: bigint[]; pathIndices: number[]; root: bigint; rootHex: string }> {
  const count = parseSimU32(await simulateContractCall(source, 'get_commitment_count'));
  if (leafIndex < 0 || leafIndex >= count) {
    throw new Error(`Invalid leaf index ${leafIndex} (tree has ${count} leaves)`);
  }
  const [leaves, rootHex] = await Promise.all([
    fetchAllLeaves(source, count),
    parseSimBytes(await simulateContractCall(source, 'get_root')),
  ]);
  return buildMerklePathFromLeaves(leaves, leafIndex, poseidon, rootHex);
}

/* ─── Prepare + Sign + Submit ─── */

/** Runtime override from Settings — true = always Freighter (for debugging). */
let forceFreighterSigning = true;

export function setForceFreighterSigning(force: boolean) {
  forceFreighterSigning = !!force;
}

export function isTreasuryKeyConfigured(): boolean {
  return TREASURY_SECRET.startsWith('S') && TREASURY_SECRET.length >= 50;
}

export function getTreasuryPublicKey(): string | null {
  if (!isTreasuryKeyConfigured()) return null;
  try {
    return Keypair.fromSecret(TREASURY_SECRET).publicKey();
  } catch {
    return null;
  }
}

/** Auto-sign only when treasury key exists AND user disabled Freighter popups in Settings. */
export function isAutoSignEnabled(): boolean {
  if (forceFreighterSigning) return false;
  return isTreasuryKeyConfigured();
}

/**
 * Address that must be tx source / SAC from / deposit from.
 * Auto-sign REQUIRES treasury pubkey — signing a Freighter-sourced tx with treasury key → txBAD_AUTH.
 */
export function resolveFundingAddress(preferred?: string): string {
  if (isAutoSignEnabled()) {
    const t = getTreasuryPublicKey();
    if (t) return t;
  }
  return (preferred || '').trim();
}

/** Sync signing preference from persisted Zer0 settings (call on boot + settings save). */
export function syncSigningPreferenceFromStorage() {
  try {
    const raw = localStorage.getItem('zexvro_zer0');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const prefer = parsed?.state?.settings?.preferFreighterSigning;
    if (typeof prefer === 'boolean') forceFreighterSigning = prefer;
  } catch {
    // keep default
  }
}

function decodeSubmitError(errorResultXdr?: string): string {
  if (!errorResultXdr) return 'unknown submit error';
  try {
    const buf = Buffer.from(errorResultXdr, 'base64');
    // TransactionResult: int64 feeCharged + int32 code (last 4 bytes of first 12)
    if (buf.length >= 12) {
      const code = buf.readInt32BE(8);
      const map: Record<number, string> = {
        0: 'txSUCCESS',
        [-1]: 'txFAILED',
        [-2]: 'txTOO_EARLY',
        [-3]: 'txTOO_LATE',
        [-4]: 'txMISSING_OPERATION',
        [-5]: 'txBAD_SEQ',
        [-6]: 'txBAD_AUTH',
        [-7]: 'txINSUFFICIENT_BALANCE',
        [-8]: 'txNO_ACCOUNT',
        [-9]: 'txINSUFFICIENT_FEE',
        [-10]: 'txBAD_AUTH_EXTRA',
        [-11]: 'txINTERNAL_ERROR',
        [-12]: 'txNOT_SUPPORTED',
        [-13]: 'txFEE_BUMP_INNER_FAILED',
        [-14]: 'txBAD_SPONSORSHIP',
      };
      const name = map[code] || `code_${code}`;
      if (code === -6) {
        return `${name}: missing Soroban auth (auto-sign must authorizeEntry for require_auth)`;
      }
      return name;
    }
  } catch { /* ignore */ }
  return errorResultXdr;
}

/** Sign Soroban auth entries (when credentials are Address-type) on the prepared tx. */
async function signSorobanAuthEntries(preparedTx: any, kp: Keypair): Promise<void> {
  const latest = await rpcCall('getLatestLedger', {});
  const validUntil = Number(latest?.sequence || 0) + 120;
  const ops = preparedTx.operations as any[];
  if (!ops?.length) return;
  for (const op of ops) {
    if (!op.auth || !Array.isArray(op.auth) || op.auth.length === 0) continue;
    for (let i = 0; i < op.auth.length; i++) {
      op.auth[i] = await authorizeEntry(op.auth[i], kp, validUntil, NETWORK_PASSPHRASE);
    }
  }
}

async function prepareAndSubmit(tx: any): Promise<string> {
  const sim = await rpcSimulate(tx.toXDR());
  if (sim.error) {
    throw new Error(`Simulation failed: ${typeof sim.error === 'string' ? sim.error : JSON.stringify(sim.error)}`);
  }

  // assembleTransaction is in the same stellar-sdk package → no dual-package hazard
  const preparedTx = rpc.assembleTransaction(tx, sim).build();

  let signedTxXdr: string;
  if (isAutoSignEnabled()) {
    const kp = Keypair.fromSecret(TREASURY_SECRET);
    // Source account must be the treasury key or envelope auth fails
    const src = preparedTx.source;
    if (src && src !== kp.publicKey()) {
      throw new Error(
        `Auto-sign txBAD_AUTH risk: tx source ${src.slice(0, 8)}… is not treasury ${kp.publicKey().slice(0, 8)}…. ` +
        `Connect the treasury wallet in Settings, or enable Freighter popups.`,
      );
    }
    await signSorobanAuthEntries(preparedTx, kp);
    preparedTx.sign(kp);
    signedTxXdr = preparedTx.toXDR();
  } else {
    let signedResult;
    try {
      signedResult = await freighterSign(preparedTx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
    } catch (e: any) {
      throw new Error(`freighterSign threw: ${e.message || e}`);
    }
    if (signedResult.error) {
      const msg = typeof signedResult.error === 'object'
        ? (signedResult.error as any).message || JSON.stringify(signedResult.error)
        : signedResult.error;
      throw new Error(`Signing failed: ${msg}`);
    }
    if (!signedResult.signedTxXdr) throw new Error('Transaction not signed');
    signedTxXdr = signedResult.signedTxXdr;
  }

  const sendResult = await rpcSend(signedTxXdr);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Submit failed: ${decodeSubmitError(sendResult.errorResultXdr)} (${sendResult.errorResultXdr || sendResult.status})`);
  }
  const hash = sendResult.hash;

  // Fast poll: 400ms first, then 800ms — was 2s×30 which alone added minutes
  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, i < 8 ? 400 : 800));
    const txResult = await rpcGetTx(hash);
    if (txResult.status === 'SUCCESS') return hash;
    if (txResult.status === 'FAILED') {
      const detail = decodeSubmitError(txResult.resultXdr) || txResult.status;
      throw new Error(`On-chain tx failed: ${detail} (hash=${hash})`);
    }
  }
  throw new Error(`Transaction timed out (hash=${hash})`);
}

/* ─── Fund pool (one SAC transfer for many notes) ─── */

/** Move total XLM into the active pool once, then deposit notes. */
export async function fundPool(
  fromAddress: string,
  totalStroops: bigint,
): Promise<string> {
  const from = resolveFundingAddress(fromAddress);
  if (!from) throw new Error('No funding address (connect wallet or configure treasury auto-sign)');
  const account = await loadAccount(from);
  const sacTx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(SAC_NATIVE).call(
        'transfer',
        scvAddress(from),
        scvAddress(activePoolContract),
        scvI128(totalStroops),
      ),
    )
    .setTimeout(180)
    .build();
  return prepareAndSubmit(sacTx);
}

/* ─── Deposit ─── */

/**
 * @param skipFund - if true, only insert commitment (pool must already hold funds).
 *   Use fundPool(total) once, then depositNoteOnly N times → 1 + N signs instead of 2N.
 */
export async function deposit(
  fromAddress: string,
  amountStroops: bigint,
  opts?: { skipFund?: boolean },
): Promise<{ txHash: string; note: DepositNote }> {
  const from = resolveFundingAddress(fromAddress);
  if (!from) throw new Error('No funding address');

  const poseidon = await getPoseidon();

  const secret = randomFieldElement();
  const nullifier = randomFieldElement();
  const commitment = poseidon.F.toObject(poseidon([secret, nullifier]));
  const nullifierHash = poseidon.F.toObject(poseidon([nullifier]));
  const commitmentHex = toHex(commitment);

  const leafIndex = parseSimU32(
    await simulateContractCall(from, 'get_commitment_count'),
  );

  // Soroban allows only ONE host invoke per tx — fund and deposit are always separate txs.
  if (!opts?.skipFund) {
    await fundPool(from, amountStroops);
  }

  const acc2 = await loadAccount(from);
  const depTx = new TransactionBuilder(acc2, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(activePoolContract).call(
        'deposit',
        scvAddress(from),
        scvBytesN(commitmentHex),
      ),
    )
    .setTimeout(180)
    .build();
  const depositTxHash = await prepareAndSubmit(depTx);

  const note: DepositNote = {
    secret: toHex(secret),
    nullifier: toHex(nullifier),
    commitment: commitmentHex,
    nullifierHash: toHex(nullifierHash),
    index: leafIndex,
    timestamp: Date.now(),
    poolContract: activePoolContract,
    denominationXlm: activeDenomXlm,
  };
  saveNote(note);

  return { txHash: depositTxHash, note };
}

/** Soft cap on total notes across all tiers (still ZK, still private). */
export const MAX_SHIELD_UNITS = 25;
export const FREIGHTER_PROMPTS_PER_NOTE = 2;
export const FREIGHTER_FUND_PROMPTS = 1;

type ReadyProof = {
  note: DepositNote;
  proof: { a: string; b: string; c: string };
  nullifierHashHex: string;
  rootHex: string;
  tier: PoolTier;
};

/** Wake EC2 prover if stopped; poll status until online or timeout. */
async function ensureZkWorkerOnline(onProgress: (label: string) => void, maxWaitMs = 90_000): Promise<boolean> {
  try {
    let st = await zkWorkerApi.status();
    if (st.online) return true;
    onProgress(`Waking ZK worker (${st.state || 'offline'})…`);
    try {
      st = await zkWorkerApi.start();
    } catch (e) {
      console.warn('[zk] worker start request failed:', e);
    }
    const deadline = Date.now() + maxWaitMs;
    let n = 0;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2500));
      n += 1;
      try {
        st = await zkWorkerApi.status();
      } catch {
        continue;
      }
      if (st.online) {
        onProgress('ZK worker online');
        return true;
      }
      onProgress(`Waiting for ZK worker… ${st.state || 'starting'} (${n * 2.5 | 0}s)`);
    }
    return false;
  } catch (e) {
    console.warn('[zk] ensure worker failed:', e);
    return false;
  }
}

/**
 * Prefer EC2 relayer settle (fund+deposit+prove+withdraw on server).
 * Auto-wakes worker. Returns null only if worker cannot be used.
 */
async function settleTierServer(args: {
  toAddress: string;
  tier: PoolTier;
  count: number;
  onProgress: (label: string) => void;
  onJobId?: (jobId: string) => void;
}): Promise<{ lastTxHash: string; notes: DepositNote[] } | null> {
  const { toAddress, tier, count, onProgress, onJobId } = args;

  const online = await ensureZkWorkerOnline(onProgress);
  if (!online) {
    onProgress('ZK worker offline — try again in a minute (Payroll Settings → Start worker)');
    return null;
  }

  const poseidon = await getPoseidon();
  const preNotes: DepositNote[] = [];
  for (let i = 0; i < count; i++) {
    const secret = randomFieldElement();
    const nullifier = randomFieldElement();
    const commitment = poseidon.F.toObject(poseidon([secret, nullifier]));
    const nullifierHash = poseidon.F.toObject(poseidon([nullifier]));
    preNotes.push({
      secret: toHex(secret),
      nullifier: toHex(nullifier),
      commitment: toHex(commitment),
      nullifierHash: toHex(nullifierHash),
      index: -1,
      timestamp: Date.now(),
      poolContract: tier.contract,
      denominationXlm: tier.xlm,
    });
  }

  onProgress(`Server settle ${count}×${tier.xlm} XLM (fund→deposit→prove→withdraw)`);
  try {
    const started = await zkWorkerApi.settle({
      toAddress,
      poolContract: tier.contract,
      amountStroops: (tier.stroops * BigInt(count)).toString(),
      notes: preNotes.map(n => ({
        secret: n.secret,
        nullifier: n.nullifier,
        commitment: n.commitment,
        nullifierHash: n.nullifierHash,
      })),
    });
    if (
      started.error
      || started.mode === 'browser_fallback'
      || started.mode === 'error'
      || !started.jobId
    ) {
      // Legacy sync response support
      if (started.ok && started.lastTxHash) {
        const notes: DepositNote[] = preNotes.map((n, i) => {
          const r = started.notes?.[i];
          const note: DepositNote = {
            ...n,
            commitment: r?.commitment || n.commitment,
            nullifierHash: r?.nullifierHash || n.nullifierHash,
            index: r?.leafIndex ?? n.index,
            timestamp: Date.now(),
          };
          saveNote(note);
          markNoteSpent(note);
          return note;
        });
        return { lastTxHash: started.lastTxHash, notes };
      }
      console.info('[zk] server settle unavailable:', started.error || started.reason || started.message);
      onProgress(`Server settle unavailable: ${started.error || started.message || started.reason || 'offline'}`);
      return null;
    }

    const jobId = started.jobId;
    onJobId?.(jobId);
    const deadline = Date.now() + 12 * 60 * 1000; // 12 min max
    let lastProgress = '';
    let stallTicks = 0;
    let netFailStreak = 0;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1200));
      let job: Awaited<ReturnType<typeof zkWorkerApi.job>>;
      try {
        job = await zkWorkerApi.job(jobId);
        netFailStreak = 0;
      } catch (e) {
        netFailStreak += 1;
        // Network blips: keep polling — worker may still be settling on-chain
        if (netFailStreak <= 20) {
          if (netFailStreak === 1 || netFailStreak % 4 === 0) {
            onProgress(
              `Network hiccup — settle still running on worker (retry ${netFailStreak})…`,
            );
          }
          continue;
        }
        console.warn('[zk] server settle poll failed repeatedly:', e);
        onProgress(`Lost network to worker after ${netFailStreak} tries`);
        return null;
      }
      if (job.progress && job.progress !== lastProgress) {
        lastProgress = job.progress;
        stallTicks = 0;
        onProgress(`Server settle: ${job.progress}`);
      } else {
        stallTicks += 1;
        if (stallTicks % 5 === 0) {
          onProgress(`Server settle: ${lastProgress || job.status || 'running'}…`);
        }
      }
      if (job.status === 'error') {
        console.warn('[zk] server settle job error:', job.error);
        onProgress(`Server settle failed: ${job.error || 'error'}`);
        return null;
      }
      if (job.status === 'done' && job.result?.lastTxHash) {
        const remote = job.result;
        const notes: DepositNote[] = preNotes.map((n, i) => {
          const r = remote.notes?.[i];
          const note: DepositNote = {
            ...n,
            commitment: r?.commitment || n.commitment,
            nullifierHash: r?.nullifierHash || n.nullifierHash,
            index: r?.leafIndex ?? n.index,
            timestamp: Date.now(),
          };
          saveNote(note);
          markNoteSpent(note);
          return note;
        });
        onProgress(`Server settle done @ ${tier.xlm} XLM (${remote.timings?.totalMs || '?'}ms)`);
        return { lastTxHash: remote.lastTxHash!, notes };
      }
      if (job.mode === 'browser_fallback' || job.reason === 'worker_offline') {
        onProgress('ZK worker dropped offline mid-settle');
        return null;
      }
    }
    console.warn('[zk] server settle timed out');
    onProgress('Server settle timed out');
    return null;
  } catch (e) {
    console.warn('[zk] server settle failed, browser path:', e);
    onProgress(`Server settle error: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Settle one pool tier: fund → deposit N → prove N → withdraw N. */
async function settleTier(args: {
  from: string;
  toAddress: string;
  tier: PoolTier;
  count: number;
  onProgress: (label: string) => void;
  onJobId?: (jobId: string) => void;
}): Promise<{ lastTxHash: string; notes: DepositNote[] }> {
  const { from, toAddress, tier, count, onProgress, onJobId } = args;
  usePool(tier);

  // Fast path: entire chain+prove on EC2 relayer (no Freighter, no browser RPC spam)
  const server = await settleTierServer({ toAddress, tier, count, onProgress, onJobId });
  if (server) return server;

  // Browser path is much slower (minutes + many Freighter prompts). Prefer failing
  // clearly when auto-sign is off and many notes would hang the UI.
  if (!isAutoSignEnabled() && count > 2) {
    throw new Error(
      'Private pay needs the ZK worker (EC2). It was offline — start it in Payroll Settings, wait ~1 min, then retry. '
      + 'Browser fallback with Freighter is disabled for multi-note pays.',
    );
  }

  onProgress('Server path unavailable — browser settle (slower)…');
  const totalStroops = tier.stroops * BigInt(count);
  onProgress(`Fund ${count}×${tier.xlm} XLM pool (${tier.contract.slice(0, 8)}…)`);
  await fundPool(from, totalStroops);

  const notes: DepositNote[] = [];
  for (let i = 0; i < count; i++) {
    onProgress(`Deposit ${i + 1}/${count} @ ${tier.xlm} XLM`);
    const { note } = await deposit(from, tier.stroops, { skipFund: true });
    notes.push(note);
  }

  onProgress(`Merkle snapshot @ ${tier.xlm} XLM pool`);
  const poseidon = await getPoseidon();
  await loadZkArtifacts();

  // Prefer server merkle (EC2 RPC concurrency + cache); fall back to browser leaves
  let ready: ReadyProof[] = [];
  const remoteMerkle = await fetchMerklePathsRemote(
    tier.contract,
    notes.map(n => n.commitment),
  );

  if (remoteMerkle) {
    onProgress(`Prove ${count} notes in parallel (server merkle)`);
    ready = await Promise.all(notes.map(async (note, i) => {
      const path = remoteMerkle.paths[note.commitment];
      if (!path) throw new Error(`Server merkle missing path for note ${i + 1}`);
      const secret = BigInt('0x' + note.secret);
      const nullifier = BigInt('0x' + note.nullifier);
      const nullifierHash = poseidon.F.toObject(poseidon([nullifier]));
      const proof = await generateWithdrawProof(
        secret, nullifier, path.leafIndex, path.pathElements, path.pathIndices, path.root, nullifierHash,
      );
      return {
        note: { ...note, index: path.leafIndex },
        proof,
        nullifierHashHex: toHex(nullifierHash),
        rootHex: path.rootHex || remoteMerkle.rootHex,
        tier,
      };
    }));
  } else {
    const treeCount = parseSimU32(await simulateContractCall(from, 'get_commitment_count'));
    const [leaves, rootHex] = await Promise.all([
      fetchAllLeaves(from, treeCount),
      parseSimBytes(await simulateContractCall(from, 'get_root')),
    ]);
    const zeros = buildZeros(poseidon);

    onProgress(`Prove ${count} notes in parallel @ ${tier.xlm} XLM`);
    ready = await Promise.all(notes.map(async (note, i) => {
      let leafIndex = note.index;
      if (leafIndex < 0 || leafIndex >= leaves.length || toHex(leaves[leafIndex]) !== note.commitment) {
        leafIndex = leaves.findIndex(l => toHex(l) === note.commitment);
        if (leafIndex < 0) throw new Error(`Commitment not found for ${tier.xlm} XLM note ${i + 1}`);
      }
      const { pathElements, pathIndices, root } = buildMerklePathFromLeaves(
        leaves, leafIndex, poseidon, rootHex, zeros,
      );
      const secret = BigInt('0x' + note.secret);
      const nullifier = BigInt('0x' + note.nullifier);
      const nullifierHash = poseidon.F.toObject(poseidon([nullifier]));
      const proof = await generateWithdrawProof(
        secret, nullifier, leafIndex, pathElements, pathIndices, root, nullifierHash,
      );
      return {
        note: { ...note, index: leafIndex },
        proof,
        nullifierHashHex: toHex(nullifierHash),
        rootHex,
        tier,
      };
    }));
  }

  let lastTxHash = '';
  for (let i = 0; i < ready.length; i++) {
    onProgress(`Withdraw ${i + 1}/${count} @ ${tier.xlm} XLM`);
    usePool(ready[i].tier);
    lastTxHash = await submitWithdrawTx(
      toAddress, from, ready[i].proof, ready[i].nullifierHashHex, ready[i].rootHex,
    );
    markNoteSpent(ready[i].note);
  }

  return { lastTxHash, notes: ready.map(r => r.note) };
}

/**
 * Preferred API: private pay any XLM amount via multi-denom pools.
 * Picks fewest notes (1000 → 100 → 10 → 1) so big payroll stays ZK + fast.
 */
export async function shieldPayAmount(args: {
  fromAddress: string;
  toAddress: string;
  amountXlm: number;
  onProgress?: (step: string, current: number, total: number) => void;
  /** Fired when EC2 worker accepts an async settle job (for reload recovery). */
  onJobId?: (jobId: string) => void;
  /**
   * Optional privacy knobs (timing / decoys). Delay is usually applied by the store
   * before calling this; decoys run after successful settle when browser path is used.
   */
  privacy?: {
    delaySec?: number;
    decoyCount?: number;
    batchDepositThenWithdraw?: boolean;
  };
}): Promise<{ lastTxHash: string; notes: DepositNote[]; settledXlm: number; plan: ShieldPayPlan }> {
  const plan = planShieldPay(args.amountXlm);
  if (plan.totalNotes === 0) throw new Error('Amount must be > 0');
  if (plan.totalNotes > MAX_SHIELD_UNITS) {
    throw new Error(
      `Private pay needs ${plan.totalNotes} notes (max ${MAX_SHIELD_UNITS}). ` +
      `Plan: ${plan.description}. Split payment or add larger pool tiers.`,
    );
  }

  const from = resolveFundingAddress(args.fromAddress);
  if (!from) throw new Error('No funding address for shielded pay');

  const decoyCount = Math.max(0, Math.min(5, args.privacy?.decoyCount ?? 0));

  // Rough step budget: per note ≈ fund-group + deposit + prove + withdraw (+ few shared)
  const totalSteps = Math.max(1, plan.totalNotes * 4 + plan.notes.length * 2 + decoyCount + 2);
  let step = 0;
  const progress = (label: string) => {
    step = Math.min(step + 1, totalSteps);
    args.onProgress?.(label, step, totalSteps);
  };

  progress(`Plan: ${plan.description}`);
  loadZkArtifacts().catch(() => {});
  getPoseidon().catch(() => {});

  const delaySec = Math.max(0, args.privacy?.delaySec ?? 0);
  if (delaySec > 0) {
    progress(`Privacy delay ${delaySec}s…`);
    await new Promise(r => setTimeout(r, delaySec * 1000));
  }

  const allNotes: DepositNote[] = [];
  let lastTxHash = '';

  // Largest tiers first (already ordered in plan.notes)
  for (const chunk of plan.notes) {
    const { lastTxHash: hash, notes } = await settleTier({
      from,
      toAddress: args.toAddress,
      tier: chunk.tier,
      count: chunk.count,
      onProgress: progress,
      onJobId: args.onJobId,
    });
    lastTxHash = hash || lastTxHash;
    allNotes.push(...notes);
  }

  // Decoy deposits: fund+deposit only (never withdraw) → grow anonymity set.
  // Best-effort; failures do not roll back the real payment.
  if (decoyCount > 0 && isAutoSignEnabled()) {
    try {
      const tier1 = POOL_TIERS.find(t => t.xlm === 1) || POOL_TIERS[POOL_TIERS.length - 1];
      usePool(tier1);
      for (let i = 0; i < decoyCount; i++) {
        progress(`Decoy deposit ${i + 1}/${decoyCount} @ ${tier1.xlm} XLM`);
        await deposit(from, tier1.stroops);
      }
    } catch (e) {
      console.warn('[privacy] decoy deposit failed (non-fatal):', e);
      progress('Decoy deposit skipped (non-fatal)');
    }
  } else if (decoyCount > 0) {
    progress(`Decoy deposits deferred (need auto-sign; ${decoyCount} requested)`);
  }

  return {
    lastTxHash,
    notes: allNotes,
    settledXlm: plan.settledXlm,
    plan,
  };
}

/**
 * Legacy unit API — treats units as 1 XLM notes. Prefer shieldPayAmount.
 */
export async function shieldPay(args: {
  fromAddress: string;
  toAddress: string;
  units: number;
  onProgress?: (step: string, current: number, total: number) => void;
}): Promise<{ lastTxHash: string; notes: DepositNote[]; settledXlm: number }> {
  const r = await shieldPayAmount({
    fromAddress: args.fromAddress,
    toAddress: args.toAddress,
    amountXlm: Math.max(1, Math.floor(args.units)),
    onProgress: args.onProgress,
  });
  return { lastTxHash: r.lastTxHash, notes: r.notes, settledXlm: r.settledXlm };
}

export function estimateFreighterPrompts(unitsOrNotes: number): number {
  if (isAutoSignEnabled()) return 0;
  const n = Math.max(1, Math.min(MAX_SHIELD_UNITS, unitsOrNotes));
  return FREIGHTER_FUND_PROMPTS + n * FREIGHTER_PROMPTS_PER_NOTE;
}

export function estimateFreighterPromptsForAmount(amountXlm: number): number {
  const plan = planShieldPay(amountXlm);
  return estimateFreighterPrompts(plan.totalNotes);
}

/* ─── Generate ZK Proof (cached artifacts — avoid reloading 7MB every unit) ─── */

let _zkArtifacts: { wasm: Uint8Array; zkey: Uint8Array } | null = null;
let _zkLoadPromise: Promise<{ wasm: Uint8Array; zkey: Uint8Array }> | null = null;

async function loadZkArtifacts(): Promise<{ wasm: Uint8Array; zkey: Uint8Array }> {
  if (_zkArtifacts) return _zkArtifacts;
  if (_zkLoadPromise) return _zkLoadPromise;
  _zkLoadPromise = (async () => {
    const [wasmRes, zkeyRes] = await Promise.all([
      fetch('/zk/withdraw.wasm'),
      fetch('/zk/withdraw_0000.zkey'),
    ]);
    if (!wasmRes.ok) throw new Error(`Failed to load withdraw.wasm (${wasmRes.status})`);
    if (!zkeyRes.ok) throw new Error(`Failed to load withdraw zkey (${zkeyRes.status})`);
    const [wasmBuf, zkeyBuf] = await Promise.all([wasmRes.arrayBuffer(), zkeyRes.arrayBuffer()]);
    _zkArtifacts = {
      wasm: new Uint8Array(wasmBuf),
      zkey: new Uint8Array(zkeyBuf),
    };
    return _zkArtifacts;
  })();
  try {
    return await _zkLoadPromise;
  } finally {
    // keep promise for concurrent callers; artifacts set
  }
}

/** Prefetch wasm/zkey on idle so first private pay is faster. */
export function prefetchZkArtifacts(): void {
  if (typeof window === 'undefined') return;
  const run = () => { loadZkArtifacts().catch(() => {}); };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 1500);
  }
}

function packGroth16Proof(proof: any): { a: string; b: string; c: string } {
  const h = (v: any) => BigInt(v).toString(16).padStart(64, '0');
  const aHex = h(proof.pi_a[0]) + h(proof.pi_a[1]);
  const bHex = h(proof.pi_b[0][1]) + h(proof.pi_b[0][0]) + h(proof.pi_b[1][1]) + h(proof.pi_b[1][0]);
  const cHex = h(proof.pi_c[0]) + h(proof.pi_c[1]);
  return { a: aHex, b: bHex, c: cHex };
}

async function generateWithdrawProofLocal(
  input: Record<string, unknown>,
): Promise<{ a: string; b: string; c: string }> {
  const { wasm, zkey } = await loadZkArtifacts();
  const { proof } = await snarkjs.groth16.fullProve(input, wasm, zkey);
  return packGroth16Proof(proof);
}

/** When true (default), private pay requires EC2 prover — no silent browser snarkjs. */
let preferRemoteProver = true;

export function setPreferRemoteProver(v: boolean) {
  preferRemoteProver = !!v;
}

export function getPreferRemoteProver() {
  return preferRemoteProver;
}

/**
 * Prefer remote EC2 prove worker (via Lambda).
 * If preferRemoteProver: fail if worker offline (user must Turn ON in Settings).
 * Else: fall back to browser snarkjs.
 */
async function generateWithdrawProof(
  secret: bigint, nullifier: bigint, _index: number,
  pathElements: bigint[], pathIndices: number[],
  root: bigint, nullifierHash: bigint,
): Promise<{ a: string; b: string; c: string }> {
  const input: Record<string, unknown> = {
    root: root.toString(),
    nullifier_hash: nullifierHash.toString(),
    secret: secret.toString(),
    nullifier: nullifier.toString(),
    path_elements: pathElements.map(e => e.toString()),
    path_indices: pathIndices,
  };

  try {
    const remote = await zkWorkerApi.prove(input);
    if (remote.mode === 'remote') {
      if (remote.proof?.a && remote.proof?.b && remote.proof?.c) {
        return { a: remote.proof.a, b: remote.proof.b, c: remote.proof.c };
      }
      if (remote.a && remote.b && remote.c) {
        return { a: remote.a, b: remote.b, c: remote.c };
      }
      if ((remote as any).pi_a) {
        return packGroth16Proof(remote);
      }
      throw new Error('Remote prover returned success without proof fields');
    }
    if (remote.mode === 'error') {
      throw new Error(remote.error || remote.message || 'Remote prover error');
    }
    if (preferRemoteProver) {
      throw new Error(
        remote.message
        || 'ZK prover EC2 is offline/unconfigured. Open Payroll → Settings → Security → Turn ON the ZK prover worker, wait until Online, then retry.',
      );
    }
    console.info('[zk] remote prove unavailable, browser snarkjs:', remote.reason || remote.message);
  } catch (e) {
    if (preferRemoteProver) throw e;
    console.warn('[zk] remote prove call failed, browser fallback:', e);
  }

  return generateWithdrawProofLocal(input);
}

/* ─── Withdraw ─── */

function markNoteSpent(note: DepositNote) {
  const notes = getNotes().map(n =>
    n.commitment === note.commitment ? { ...n, spent: true } : n,
  );
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  zkNotesApi.list().then(({ notes: awsNotes }) => {
    const awsNote = awsNotes.find((n: any) => n.commitment === note.commitment);
    if (awsNote?.id) return zkNotesApi.update(awsNote.id, { spent: true });
  }).catch(() => {});
}

async function submitWithdrawTx(
  toAddress: string,
  source: string,
  proofData: { a: string; b: string; c: string },
  nullifierHashHex: string,
  rootHex: string,
): Promise<string> {
  const proofMap = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('a'), val: scvBytesN(proofData.a) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('b'), val: scvBytesN(proofData.b) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('c'), val: scvBytesN(proofData.c) }),
  ]);
  const wdAccount = await loadAccount(source);
  const wdTx = new TransactionBuilder(wdAccount, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(activePoolContract).call(
        'withdraw',
        scvAddress(toAddress),
        proofMap,
        scvBytesN(nullifierHashHex),
        scvBytesN(rootHex),
      ),
    )
    .setTimeout(180)
    .build();
  return prepareAndSubmit(wdTx);
}

export async function withdraw(
  toAddress: string,
  note: DepositNote,
  signerAddress?: string,
): Promise<WithdrawResult> {
  const poseidon = await getPoseidon();
  const source = resolveFundingAddress(signerAddress) || signerAddress || toAddress;

  let leafIndex = note.index;
  const count = parseSimU32(await simulateContractCall(source, 'get_commitment_count'));
  const leaves = await fetchAllLeaves(source, count);

  if (leafIndex < 0 || leafIndex >= leaves.length || toHex(leaves[leafIndex]) !== note.commitment) {
    leafIndex = leaves.findIndex(l => toHex(l) === note.commitment);
    if (leafIndex < 0) throw new Error('Commitment not found on-chain');
  }

  const rootHex = parseSimBytes(await simulateContractCall(source, 'get_root'));
  const { pathElements, pathIndices, root } = buildMerklePathFromLeaves(
    leaves, leafIndex, poseidon, rootHex,
  );

  const secret = BigInt('0x' + note.secret);
  const nullifier = BigInt('0x' + note.nullifier);
  const nullifierHash = poseidon.F.toObject(poseidon([nullifier]));
  const nullifierHashHex = toHex(nullifierHash);

  const proofData = await generateWithdrawProof(
    secret, nullifier, leafIndex, pathElements, pathIndices, root, nullifierHash,
  );

  const txHash = await submitWithdrawTx(toAddress, source, proofData, nullifierHashHex, rootHex);
  markNoteSpent(note);

  return { txHash, nullifierHash: note.nullifierHash };
}

/* ─── Read Contract State ─── */

const READ_SOURCE = 'GADWIZHQJKSWTKMADYHB4DAUE74TJX47CUK4KJH3QBGURYQ4LDCSZLPQ';

export async function getContractRoot(): Promise<string> {
  return parseSimBytes(await simulateContractCall(READ_SOURCE, 'get_root'));
}

export async function getCommitmentCount(): Promise<number> {
  return parseSimU32(await simulateContractCall(READ_SOURCE, 'get_commitment_count'));
}

export {
  POOL_CONTRACT,
  SOROBAN_RPC_URL as SOROBAN_RPC,
  DENOMINATION,
  DENOMINATION_XLM,
  STROOPS_PER_XLM,
};
