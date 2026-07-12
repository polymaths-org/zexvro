/**
 * Privacy Pool Client
 *
 * Real ZK deposit/withdraw operations using the Soroban privacy pool contract.
 * All cryptographic operations happen client-side. No secret keys leave the browser.
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
import { zkNotesApi } from './api';

/* ─── Constants ─── */

const POOL_CONTRACT = import.meta.env.VITE_ZER0_CONTRACT || 'CDQSV7I3FRQ6EBQOOE6MQSJHPCPQNHPWRK2G75DYYOOOGHDVIQGOZF4I';
const SOROBAN_RPC_URL = import.meta.env.VITE_SOROBAN_RPC || 'https://soroban-testnet.stellar.org';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const SAC_NATIVE = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const TREE_DEPTH = 20;
/** Stellar: 1 XLM = 10_000_000 stroops. Pool unit = 1 XLM for MVP (matches typed amounts closely). */
const STROOPS_PER_XLM = 10_000_000;
const DENOMINATION = 10_000_000; // 1 XLM in stroops
const DENOMINATION_XLM = DENOMINATION / STROOPS_PER_XLM;

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
    .addOperation(new Contract(POOL_CONTRACT).call(method, ...args))
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

  const leaves: bigint[] = [];
  for (let i = 0; i < count; i++) {
    const hex = parseSimOptionBytes(await simulateContractCall(source, 'get_commitment', scvU32(i)));
    if (!hex) throw new Error(`Missing commitment at index ${i}`);
    leaves.push(BigInt('0x' + hex));
  }

  const zeros: bigint[] = [BigInt(0)];
  let z = BigInt(0);
  for (let i = 0; i < TREE_DEPTH; i++) {
    z = poseidon.F.toObject(poseidon([z, z]));
    zeros.push(z);
  }

  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  let level = leaves.slice();
  let idx = leafIndex;

  for (let d = 0; d < TREE_DEPTH; d++) {
    pathIndices.push(idx & 1);
    const siblingIdx = idx ^ 1;
    pathElements.push(level[siblingIdx] ?? zeros[d]);

    const next: bigint[] = [];
    const width = Math.ceil(Math.max(level.length, idx + 1) / 2) || 1;
    for (let i = 0; i < width; i++) {
      const left = level[i * 2] ?? zeros[d];
      const right = level[i * 2 + 1] ?? zeros[d];
      next.push(poseidon.F.toObject(poseidon([left, right])));
    }
    level = next;
    idx >>= 1;
  }

  const rootHex = parseSimBytes(await simulateContractCall(source, 'get_root'));
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

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
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

/** Move total XLM into the pool once, then call depositNoteOnly per unit. */
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
        scvAddress(POOL_CONTRACT),
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
      new Contract(POOL_CONTRACT).call(
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
  };
  saveNote(note);

  return { txHash: depositTxHash, note };
}

/**
 * Full multi-unit ZK pay: 1 fund + N deposits + N withdraws.
 * With auto-sign: 0 Freighter popups. With Freighter: 1 + 2N confirms (not 3N).
 */
export async function shieldPay(args: {
  fromAddress: string;
  toAddress: string;
  units: number;
  onProgress?: (step: string, current: number, total: number) => void;
}): Promise<{ lastTxHash: string; notes: DepositNote[]; settledXlm: number }> {
  const units = Math.max(1, Math.min(50, Math.floor(args.units)));
  const totalStroops = BigInt(DENOMINATION) * BigInt(units);
  // When auto-sign is on, always fund/deposit/sign as treasury (not Freighter address)
  const from = resolveFundingAddress(args.fromAddress);
  if (!from) throw new Error('No funding address for shielded pay');

  const totalSteps = 1 + units * 2;
  let step = 0;
  const progress = (label: string) => {
    step += 1;
    args.onProgress?.(label, step, totalSteps);
  };

  progress(`Funding pool with ${units * DENOMINATION_XLM} XLM from ${from.slice(0, 8)}…`);
  await fundPool(from, totalStroops);

  const notes: DepositNote[] = [];
  for (let i = 0; i < units; i++) {
    progress(`ZK deposit ${i + 1}/${units}`);
    const { note } = await deposit(from, BigInt(DENOMINATION), { skipFund: true });
    notes.push(note);
  }

  let lastTxHash = '';
  for (let i = 0; i < notes.length; i++) {
    progress(`ZK withdraw ${i + 1}/${units}`);
    const { txHash } = await withdraw(args.toAddress, notes[i], from);
    lastTxHash = txHash;
  }

  return { lastTxHash, notes, settledXlm: units * DENOMINATION_XLM };
}

/** With bulk fund: 1 fund + 1 deposit + 1 withdraw = 3 per unit if funded per unit; multi-unit uses 1+2N */
export const FREIGHTER_PROMPTS_PER_NOTE = 2; // deposit + withdraw after shared fund
export const FREIGHTER_FUND_PROMPTS = 1;
/** Max units for multi-note private pay */
export const MAX_SHIELD_UNITS = 50;

export function estimateFreighterPrompts(units: number): number {
  if (isAutoSignEnabled()) return 0;
  const n = Math.max(1, Math.min(MAX_SHIELD_UNITS, units));
  return FREIGHTER_FUND_PROMPTS + n * FREIGHTER_PROMPTS_PER_NOTE;
}

/* ─── Generate ZK Proof ─── */

async function generateWithdrawProof(
  secret: bigint, nullifier: bigint, index: number,
  pathElements: bigint[], pathIndices: number[],
  root: bigint, nullifierHash: bigint,
): Promise<{ a: string; b: string; c: string }> {
  const input = {
    root: root.toString(),
    nullifier_hash: nullifierHash.toString(),
    secret: secret.toString(),
    nullifier: nullifier.toString(),
    path_elements: pathElements.map(e => e.toString()),
    path_indices: pathIndices,
  };

  const { proof } = await snarkjs.groth16.fullProve(input, '/zk/withdraw.wasm', '/zk/withdraw_0000.zkey');

  const h = (v: any) => BigInt(v).toString(16).padStart(64, '0');
  const aHex = h(proof.pi_a[0]) + h(proof.pi_a[1]);
  const bHex = h(proof.pi_b[0][1]) + h(proof.pi_b[0][0]) + h(proof.pi_b[1][1]) + h(proof.pi_b[1][0]);
  const cHex = h(proof.pi_c[0]) + h(proof.pi_c[1]);

  return { a: aHex, b: bHex, c: cHex };
}

/* ─── Withdraw ─── */

export async function withdraw(
  toAddress: string,
  note: DepositNote,
  signerAddress?: string,
): Promise<WithdrawResult> {
  const poseidon = await getPoseidon();
  const source = signerAddress || toAddress;

  // Resolve leaf index: prefer stored index, else find commitment on-chain
  let leafIndex = note.index;
  const count = parseSimU32(await simulateContractCall(source, 'get_commitment_count'));
  if (leafIndex < 0 || leafIndex >= count) {
    leafIndex = -1;
    for (let i = 0; i < count; i++) {
      const hex = parseSimOptionBytes(await simulateContractCall(source, 'get_commitment', scvU32(i)));
      if (hex === note.commitment) {
        leafIndex = i;
        break;
      }
    }
    if (leafIndex < 0) throw new Error('Commitment not found on-chain');
  } else {
    const onChain = parseSimOptionBytes(
      await simulateContractCall(source, 'get_commitment', scvU32(leafIndex)),
    );
    if (onChain !== note.commitment) {
      // stored index wrong — search
      leafIndex = -1;
      for (let i = 0; i < count; i++) {
        const hex = parseSimOptionBytes(await simulateContractCall(source, 'get_commitment', scvU32(i)));
        if (hex === note.commitment) {
          leafIndex = i;
          break;
        }
      }
      if (leafIndex < 0) throw new Error('Commitment not found on-chain');
    }
  }

  const { pathElements, pathIndices, root, rootHex } = await buildMerklePath(
    source, leafIndex, poseidon,
  );

  const secret = BigInt('0x' + note.secret);
  const nullifier = BigInt('0x' + note.nullifier);
  const nullifierHash = poseidon.F.toObject(poseidon([nullifier]));

  // Prefer recomputed nullifier hash (field element) over stored hex
  const nullifierHashHex = toHex(nullifierHash);

  const proofData = await generateWithdrawProof(
    secret, nullifier, leafIndex, pathElements, pathIndices, root, nullifierHash,
  );

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
      new Contract(POOL_CONTRACT).call('withdraw',
        scvAddress(toAddress), proofMap,
        scvBytesN(nullifierHashHex), scvBytesN(rootHex),
      ),
    )
    .setTimeout(180)
    .build();

  const txHash = await prepareAndSubmit(wdTx);

  // Mark note as spent locally
  const notes = getNotes().map(n =>
    n.commitment === note.commitment ? { ...n, spent: true } : n
  );
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

  // Mark note as spent on AWS
  try {
    const { notes: awsNotes } = await zkNotesApi.list();
    const awsNote = awsNotes.find((n: any) => n.commitment === note.commitment);
    if (awsNote?.id) {
      await zkNotesApi.update(awsNote.id, { spent: true });
    }
  } catch {}

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
