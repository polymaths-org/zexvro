/**
 * ZEXVRO ZK worker
 *
 * Endpoints:
 *   GET  /health
 *   POST /prove              { input } → packed groth16 proof (RapidSNARK)
 *   POST /merkle             { contract, commitments? } → root + paths
 *   POST /settle             { to, tier, notes } → fund/deposit/prove/withdraw (relayer)
 *
 * Env:
 *   PORT, ZK_ARTIFACT_DIR, ZK_PROVER_SHARED_SECRET
 *   RAPIDSNARK_PROVER, FORCE_SNARKJS
 *   RELAYER_SECRET            optional Stellar secret for server-side fund/deposit/withdraw
 *   SOROBAN_RPC               default testnet
 *   HORIZON_URL               default testnet
 *   NETWORK_PASSPHRASE        default Test SDF Network...
 *   SAC_NATIVE                native SAC on network
 *   IDLE_EXIT_MS
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as snarkjs from 'snarkjs';
import { wtns } from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import {
  Contract, Networks, TransactionBuilder, Address, xdr,
  Horizon, rpc, Account, Keypair, authorizeEntry,
} from 'stellar-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const ARTIFACT_DIR = process.env.ZK_ARTIFACT_DIR
  || path.resolve(__dirname, '../../zer0-pool/backups/zk-proofs-LATEST/frontend-public-zk');
const SHARED_SECRET = (process.env.ZK_PROVER_SHARED_SECRET || '').trim();
const IDLE_EXIT_MS = Number(process.env.IDLE_EXIT_MS || 0);
const FORCE_SNARKJS = process.env.FORCE_SNARKJS === '1' || process.env.FORCE_SNARKJS === 'true';
const RELAYER_SECRET = (process.env.RELAYER_SECRET || process.env.TREASURY_SECRET || '').trim();
const SOROBAN_RPC_URL = process.env.SOROBAN_RPC || 'https://soroban-testnet.stellar.org';
const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || Networks.TESTNET;
const SAC_NATIVE = process.env.SAC_NATIVE || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const TREE_DEPTH = 20;

const WASM = path.join(ARTIFACT_DIR, 'withdraw.wasm');
const ZKEY = path.join(ARTIFACT_DIR, 'withdraw_0000.zkey');

const RAPIDSNARK_CANDIDATES = [
  process.env.RAPIDSNARK_PROVER,
  '/opt/rapidsnark/package/bin/prover',
  '/opt/rapidsnark/build_prover/src/prover',
  path.resolve(__dirname, 'bin/prover'),
].filter(Boolean);

function resolveRapidsnark() {
  for (const p of RAPIDSNARK_CANDIDATES) {
    try {
      if (p && fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch { /* ignore */ }
  }
  return null;
}

const RAPIDSNARK_BIN = resolveRapidsnark();
const horizon = new Horizon.Server(HORIZON_URL);
const soroban = new rpc.Server(SOROBAN_RPC_URL, { allowHttp: true });

let lastBusy = Date.now();
let proving = 0;
let settling = 0;
let poseidonPromise = null;
/** @type {Map<string, { count: number, leaves: bigint[], rootHex: string, ts: number }>} */
const merkleCache = new Map();
const MERKLE_CACHE_MS = 15_000;
/** @type {Map<string, any>} */
const jobs = new Map();

function getPoseidon() {
  if (!poseidonPromise) poseidonPromise = buildPoseidon();
  return poseidonPromise;
}

function packProof(proof) {
  const h = (v) => BigInt(v).toString(16).padStart(64, '0');
  return {
    a: h(proof.pi_a[0]) + h(proof.pi_a[1]),
    b: h(proof.pi_b[0][1]) + h(proof.pi_b[0][0]) + h(proof.pi_b[1][1]) + h(proof.pi_b[1][0]),
    c: h(proof.pi_c[0]) + h(proof.pi_c[1]),
  };
}

function toHex32(n) {
  return BigInt(n).toString(16).padStart(64, '0');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function send(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Zexvro-Prover-Secret,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(data);
}

function authOk(req) {
  if (!SHARED_SECRET) return true;
  return req.headers['x-zexvro-prover-secret'] === SHARED_SECRET;
}

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr || stdout}`.trim()));
    });
  });
}

function relayerEnabled() {
  return RELAYER_SECRET.startsWith('S') && RELAYER_SECRET.length >= 50;
}

function relayerKeypair() {
  return Keypair.fromSecret(RELAYER_SECRET);
}

/* ─── Prove ─── */

async function proveWithRapidsnark(input) {
  if (!RAPIDSNARK_BIN) throw new Error('rapidsnark binary not found');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zexvro-prove-'));
  const wtnsPath = path.join(tmp, 'witness.wtns');
  const proofPath = path.join(tmp, 'proof.json');
  const publicPath = path.join(tmp, 'public.json');
  const t0 = Date.now();
  try {
    await wtns.calculate(input, WASM, wtnsPath);
    const witnessMs = Date.now() - t0;
    const t1 = Date.now();
    await runCmd(RAPIDSNARK_BIN, [ZKEY, wtnsPath, proofPath, publicPath]);
    const proveMs = Date.now() - t1;
    const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    const publicSignals = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
    const packed = packProof(proof);
    return {
      proof: packed,
      a: packed.a,
      b: packed.b,
      c: packed.c,
      publicSignals,
      engine: 'rapidsnark',
      timings: { witnessMs, proveMs, totalMs: Date.now() - t0 },
    };
  } finally {
    try {
      for (const f of [wtnsPath, proofPath, publicPath]) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      fs.rmdirSync(tmp);
    } catch { /* ignore */ }
  }
}

async function proveWithSnarkjs(input) {
  const t0 = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  const packed = packProof(proof);
  return {
    proof: packed,
    a: packed.a,
    b: packed.b,
    c: packed.c,
    publicSignals,
    engine: 'snarkjs',
    timings: { totalMs: Date.now() - t0 },
  };
}

async function prove(input) {
  if (!fs.existsSync(WASM) || !fs.existsSync(ZKEY)) {
    throw new Error(`Missing artifacts in ${ARTIFACT_DIR}`);
  }
  if (!FORCE_SNARKJS && RAPIDSNARK_BIN) {
    try {
      return await proveWithRapidsnark(input);
    } catch (e) {
      console.error('[worker] rapidsnark failed, snarkjs fallback:', e);
    }
  }
  return proveWithSnarkjs(input);
}

/* ─── ScVal helpers ─── */

const _Int64Type = xdr.Int128Parts._fields[0][1];
const _UnsignedHyperType = xdr.Int128Parts._fields[1][1];

function scvAddress(address) {
  return xdr.ScVal.scvAddress(Address.fromString(address).toScAddress());
}
function scvBytesN(hex) {
  return xdr.ScVal.scvBytes(Buffer.from(hex, 'hex'));
}
function scvI128(value) {
  const v = BigInt(value);
  const lo = v & BigInt('0xFFFFFFFFFFFFFFFF');
  const hi = v >> BigInt(64);
  return xdr.ScVal.scvI128(new xdr.Int128Parts({
    hi: new _Int64Type(hi),
    lo: new _UnsignedHyperType(lo),
  }));
}
function scvU32(value) {
  return xdr.ScVal.scvU32(value);
}

async function rpcCall(method, params) {
  const resp = await fetch(SOROBAN_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await resp.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message || JSON.stringify(json.error)}`);
  return json.result;
}

async function loadAccount(address) {
  return horizon.loadAccount(address);
}

function parseSimBytes(sim) {
  const xdrStr = sim.results?.[0]?.xdr;
  if (!xdrStr) throw new Error('No return value from simulation');
  const scVal = xdr.ScVal.fromXDR(xdrStr, 'base64');
  return Buffer.from(scVal.bytes()).toString('hex');
}

function parseSimU32(sim) {
  const xdrStr = sim.results?.[0]?.xdr;
  if (!xdrStr) throw new Error('No return value from simulation');
  const scVal = xdr.ScVal.fromXDR(xdrStr, 'base64');
  return scVal.u32();
}

function parseSimOptionBytes(sim) {
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

async function simulateContractCall(source, contractId, method, ...args) {
  const account = await loadAccount(source);
  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await rpcCall('simulateTransaction', { transaction: tx.toXDR() });
  if (sim.error) throw new Error(`${method} failed: ${sim.error}`);
  return sim;
}

async function fetchAllLeaves(source, contractId, count) {
  const leaves = new Array(count);
  const CONCURRENCY = 24;
  for (let start = 0; start < count; start += CONCURRENCY) {
    const batch = [];
    for (let i = start; i < Math.min(start + CONCURRENCY, count); i++) {
      const idx = i;
      batch.push(
        simulateContractCall(source, contractId, 'get_commitment', scvU32(idx)).then((sim) => {
          const hex = parseSimOptionBytes(sim);
          if (!hex) throw new Error(`Missing commitment at index ${idx}`);
          leaves[idx] = BigInt('0x' + hex);
        }),
      );
    }
    await Promise.all(batch);
  }
  return leaves;
}

function buildZeros(poseidon) {
  const zeros = [0n];
  let z = 0n;
  for (let i = 0; i < TREE_DEPTH; i++) {
    z = poseidon.F.toObject(poseidon([z, z]));
    zeros.push(z);
  }
  return zeros;
}

function buildMerklePathFromLeaves(leaves, leafIndex, poseidon, rootHex, zeros) {
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error(`Invalid leaf index ${leafIndex} (tree has ${leaves.length} leaves)`);
  }
  const z = zeros || buildZeros(poseidon);
  const pathElements = [];
  const pathIndices = [];
  let level = leaves.slice();
  let idx = leafIndex;

  for (let d = 0; d < TREE_DEPTH; d++) {
    pathIndices.push(idx & 1);
    const siblingIdx = idx ^ 1;
    pathElements.push(level[siblingIdx] ?? z[d]);

    const next = [];
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
    throw new Error(`Merkle path mismatch: computed=${toHex32(cur)} onchain=${rootHex}`);
  }
  return {
    pathElements: pathElements.map((e) => e.toString()),
    pathIndices,
    root: root.toString(),
    rootHex,
  };
}

async function merkleSnapshot(contractId, wantedCommitments = []) {
  const t0 = Date.now();
  const poseidon = await getPoseidon();
  // any funded account works as read source
  const source = relayerEnabled()
    ? relayerKeypair().publicKey()
    : 'GADWIZHQJKSWTKMADYHB4DAUE74TJX47CUK4KJH3QBGURYQ4LDCSZLPQ';

  const cached = merkleCache.get(contractId);
  let count;
  let leaves;
  let rootHex;
  if (cached && Date.now() - cached.ts < MERKLE_CACHE_MS) {
    count = cached.count;
    leaves = cached.leaves.slice();
    rootHex = cached.rootHex;
  } else {
    count = parseSimU32(await simulateContractCall(source, contractId, 'get_commitment_count'));
    [leaves, rootHex] = await Promise.all([
      fetchAllLeaves(source, contractId, count),
      parseSimBytes(await simulateContractCall(source, contractId, 'get_root')),
    ]);
    merkleCache.set(contractId, { count, leaves: leaves.slice(), rootHex, ts: Date.now() });
  }

  // if cache is stale vs wanted leaves, refetch
  const missing = (wantedCommitments || []).filter((c) => {
    const needle = String(c).replace(/^0x/, '').toLowerCase();
    return !leaves.some((l) => toHex32(l) === needle.padStart(64, '0'));
  });
  if (missing.length) {
    count = parseSimU32(await simulateContractCall(source, contractId, 'get_commitment_count'));
    [leaves, rootHex] = await Promise.all([
      fetchAllLeaves(source, contractId, count),
      parseSimBytes(await simulateContractCall(source, contractId, 'get_root')),
    ]);
    merkleCache.set(contractId, { count, leaves: leaves.slice(), rootHex, ts: Date.now() });
  }

  const zeros = buildZeros(poseidon);
  const paths = {};
  for (const c of wantedCommitments || []) {
    const needle = String(c).replace(/^0x/, '').toLowerCase().padStart(64, '0');
    const leafIndex = leaves.findIndex((l) => toHex32(l) === needle);
    if (leafIndex < 0) {
      paths[c] = { error: 'commitment_not_found' };
      continue;
    }
    paths[c] = {
      leafIndex,
      ...buildMerklePathFromLeaves(leaves, leafIndex, poseidon, rootHex, zeros),
    };
  }

  return {
    contract: contractId,
    count,
    rootHex,
    paths,
    timings: { totalMs: Date.now() - t0 },
    engine: 'worker-merkle',
  };
}

/* ─── Chain submit (relayer) ─── */

async function signSorobanAuthEntries(preparedTx, kp) {
  const latest = await rpcCall('getLatestLedger', {});
  const validUntil = Number(latest?.sequence || 0) + 120;
  const ops = preparedTx.operations;
  if (!ops?.length) return;
  for (const op of ops) {
    if (!op.auth || !Array.isArray(op.auth) || op.auth.length === 0) continue;
    for (let i = 0; i < op.auth.length; i++) {
      op.auth[i] = await authorizeEntry(op.auth[i], kp, validUntil, NETWORK_PASSPHRASE);
    }
  }
}

async function prepareAndSubmit(tx, kp) {
  const sim = await rpcCall('simulateTransaction', { transaction: tx.toXDR() });
  if (sim.error) {
    throw new Error(`Simulation failed: ${typeof sim.error === 'string' ? sim.error : JSON.stringify(sim.error)}`);
  }
  const preparedTx = rpc.assembleTransaction(tx, sim).build();
  await signSorobanAuthEntries(preparedTx, kp);
  preparedTx.sign(kp);
  const sendResult = await rpcCall('sendTransaction', { transaction: preparedTx.toXDR() });
  if (sendResult.status === 'ERROR') {
    throw new Error(`Submit failed: ${sendResult.errorResultXdr || sendResult.status}`);
  }
  const hash = sendResult.hash;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, i < 10 ? 350 : 700));
    const txResult = await rpcCall('getTransaction', { hash });
    if (txResult.status === 'SUCCESS') return hash;
    if (txResult.status === 'FAILED') {
      throw new Error(`On-chain tx failed (hash=${hash})`);
    }
  }
  throw new Error(`Transaction timed out (hash=${hash})`);
}

async function fundPool(kp, poolContract, totalStroops) {
  const from = kp.publicKey();
  const account = await loadAccount(from);
  const sacTx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(SAC_NATIVE).call(
        'transfer',
        scvAddress(from),
        scvAddress(poolContract),
        scvI128(totalStroops),
      ),
    )
    .setTimeout(180)
    .build();
  return prepareAndSubmit(sacTx, kp);
}

async function depositCommitment(kp, poolContract, commitmentHex) {
  const from = kp.publicKey();
  const account = await loadAccount(from);
  const depTx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(poolContract).call(
        'deposit',
        scvAddress(from),
        scvBytesN(commitmentHex),
      ),
    )
    .setTimeout(180)
    .build();
  return prepareAndSubmit(depTx, kp);
}

async function submitWithdraw(kp, poolContract, toAddress, proofData, nullifierHashHex, rootHex) {
  const proofMap = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('a'), val: scvBytesN(proofData.a) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('b'), val: scvBytesN(proofData.b) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('c'), val: scvBytesN(proofData.c) }),
  ]);
  const account = await loadAccount(kp.publicKey());
  const wdTx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      new Contract(poolContract).call(
        'withdraw',
        scvAddress(toAddress),
        proofMap,
        scvBytesN(nullifierHashHex),
        scvBytesN(rootHex),
      ),
    )
    .setTimeout(180)
    .build();
  return prepareAndSubmit(wdTx, kp);
}

/**
 * Full tier settle on worker:
 *   fund once → deposit N → merkle snapshot → prove N (parallel) → withdraw N
 * notes: [{ secret, nullifier, commitment?, nullifierHash? }] hex without 0x
 * amountStroops: total fund amount for this tier
 */
async function settleTier(body, onProgress) {
  if (!relayerEnabled()) throw new Error('RELAYER_SECRET not configured on worker');
  const {
    toAddress,
    poolContract,
    amountStroops,
    notes,
  } = body;
  if (!toAddress || !poolContract || !amountStroops || !Array.isArray(notes) || !notes.length) {
    throw new Error('toAddress, poolContract, amountStroops, notes[] required');
  }
  const progress = (msg) => {
    try { if (typeof onProgress === 'function') onProgress(msg); } catch { /* ignore */ }
  };

  const kp = relayerKeypair();
  const poseidon = await getPoseidon();
  const t0 = Date.now();
  const steps = [];

  progress(`fund ${notes.length} note(s)`);
  const fundHash = await fundPool(kp, poolContract, BigInt(amountStroops));
  steps.push({ step: 'fund', hash: fundHash, ms: Date.now() - t0 });

  const deposited = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const secret = BigInt('0x' + String(n.secret).replace(/^0x/, ''));
    const nullifier = BigInt('0x' + String(n.nullifier).replace(/^0x/, ''));
    const commitment = n.commitment
      ? BigInt('0x' + String(n.commitment).replace(/^0x/, ''))
      : poseidon.F.toObject(poseidon([secret, nullifier]));
    const nullifierHash = n.nullifierHash
      ? BigInt('0x' + String(n.nullifierHash).replace(/^0x/, ''))
      : poseidon.F.toObject(poseidon([nullifier]));
    const commitmentHex = toHex32(commitment);
    progress(`deposit ${i + 1}/${notes.length}`);
    const tDep = Date.now();
    const hash = await depositCommitment(kp, poolContract, commitmentHex);
    deposited.push({
      secret: toHex32(secret),
      nullifier: toHex32(nullifier),
      commitment: commitmentHex,
      nullifierHash: toHex32(nullifierHash),
      depositHash: hash,
    });
    steps.push({ step: `deposit_${i + 1}`, hash, ms: Date.now() - tDep });
  }

  // invalidate cache
  merkleCache.delete(poolContract);
  progress(`merkle snapshot (${notes.length} leaves)`);
  const tMer = Date.now();
  const snap = await merkleSnapshot(poolContract, deposited.map((d) => d.commitment));
  steps.push({ step: 'merkle', ms: Date.now() - tMer, count: snap.count });

  // parallel prove
  progress(`prove ${notes.length} (parallel RapidSNARK)`);
  const tProve = Date.now();
  const ready = await Promise.all(deposited.map(async (d, i) => {
    const path = snap.paths[d.commitment];
    if (!path || path.error) throw new Error(`No merkle path for note ${i + 1}: ${path?.error || 'missing'}`);
    const input = {
      root: path.root,
      nullifier_hash: BigInt('0x' + d.nullifierHash).toString(),
      secret: BigInt('0x' + d.secret).toString(),
      nullifier: BigInt('0x' + d.nullifier).toString(),
      path_elements: path.pathElements,
      path_indices: path.pathIndices,
    };
    const out = await prove(input);
    return {
      ...d,
      proof: { a: out.a, b: out.b, c: out.c },
      rootHex: path.rootHex,
      leafIndex: path.leafIndex,
      proveMs: out.timings?.totalMs,
      engine: out.engine,
    };
  }));
  steps.push({ step: 'prove_all', ms: Date.now() - tProve, count: ready.length });

  let lastTxHash = '';
  const withdraws = [];
  for (let i = 0; i < ready.length; i++) {
    const r = ready[i];
    progress(`withdraw ${i + 1}/${ready.length}`);
    const tW = Date.now();
    const hash = await submitWithdraw(
      kp, poolContract, toAddress, r.proof, r.nullifierHash, r.rootHex,
    );
    lastTxHash = hash;
    withdraws.push({ commitment: r.commitment, hash, ms: Date.now() - tW });
    steps.push({ step: `withdraw_${i + 1}`, hash, ms: Date.now() - tW });
  }

  return {
    ok: true,
    mode: 'server_settle',
    lastTxHash,
    fundHash,
    notes: ready.map((r) => ({
      commitment: r.commitment,
      nullifierHash: r.nullifierHash,
      leafIndex: r.leafIndex,
      depositHash: r.depositHash,
    })),
    withdraws,
    steps,
    timings: { totalMs: Date.now() - t0 },
    relayer: kp.publicKey(),
  };
}

/* ─── HTTP ─── */

const server = http.createServer(async (req, res) => {
  lastBusy = Date.now();
  if (req.method === 'OPTIONS') return send(res, 200, {});

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return send(res, 200, {
      ok: true,
      proving,
      settling,
      jobs: jobs.size,
      engine: FORCE_SNARKJS ? 'snarkjs(forced)' : (RAPIDSNARK_BIN ? 'rapidsnark' : 'snarkjs'),
      rapidsnark: RAPIDSNARK_BIN || null,
      relayer: relayerEnabled(),
      relayerPublicKey: relayerEnabled() ? relayerKeypair().publicKey() : null,
      artifacts: { wasm: fs.existsSync(WASM), zkey: fs.existsSync(ZKEY), dir: ARTIFACT_DIR },
      endpoints: ['/health', '/prove', '/merkle', '/settle', '/jobs/:id'],
    });
  }

  // Job status (auth required)
  if (req.method === 'GET' && url.pathname.startsWith('/jobs/')) {
    if (!authOk(req)) return send(res, 401, { error: 'unauthorized' });
    const jobId = url.pathname.slice('/jobs/'.length);
    const job = jobs.get(jobId);
    if (!job) return send(res, 404, { error: 'job_not_found', jobId });
    return send(res, 200, job);
  }

  if (req.method === 'POST' && (url.pathname === '/prove' || url.pathname === '/merkle' || url.pathname === '/settle')) {
    if (!authOk(req)) return send(res, 401, { error: 'unauthorized' });
  }

  if (req.method === 'POST' && url.pathname === '/prove') {
    try {
      const body = await readJson(req);
      const input = body.input;
      if (!input || typeof input !== 'object') return send(res, 400, { error: 'input object required' });
      proving += 1;
      const t0 = Date.now();
      const out = await prove(input);
      proving -= 1;
      lastBusy = Date.now();
      return send(res, 200, { ...out, generationTimeMs: Date.now() - t0 });
    } catch (e) {
      proving = Math.max(0, proving - 1);
      return send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (req.method === 'POST' && url.pathname === '/merkle') {
    try {
      const body = await readJson(req);
      const contract = body.contract || body.poolContract;
      if (!contract) return send(res, 400, { error: 'contract required' });
      const commitments = body.commitments || body.wanted || [];
      const out = await merkleSnapshot(contract, commitments);
      lastBusy = Date.now();
      return send(res, 200, out);
    } catch (e) {
      return send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Async settle — returns jobId immediately (API GW 30s limit safe)
  if (req.method === 'POST' && url.pathname === '/settle') {
    try {
      if (!relayerEnabled()) {
        return send(res, 503, {
          error: 'relayer_disabled',
          message: 'Set RELAYER_SECRET on worker to enable server settle',
        });
      }
      const body = await readJson(req);
      const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const job = {
        jobId,
        status: 'running',
        progress: 'queued',
        startedAt: Date.now(),
        result: null,
        error: null,
      };
      jobs.set(jobId, job);
      settling += 1;
      // fire-and-forget
      (async () => {
        try {
          job.progress = 'starting';
          const out = await settleTier(body, (msg) => { job.progress = msg; });
          job.status = 'done';
          job.progress = 'done';
          job.result = out;
          job.finishedAt = Date.now();
        } catch (e) {
          job.status = 'error';
          job.progress = 'error';
          job.error = e instanceof Error ? e.message : String(e);
          job.finishedAt = Date.now();
          console.error('[worker] settle job failed:', job.error);
        } finally {
          settling = Math.max(0, settling - 1);
          lastBusy = Date.now();
          // GC old jobs after 30 min
          setTimeout(() => jobs.delete(jobId), 30 * 60 * 1000);
        }
      })();
      return send(res, 202, { mode: 'async', jobId, status: 'running' });
    } catch (e) {
      return send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
  }

  return send(res, 404, { error: 'not_found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[zexvro-zk-prover] listening on :${PORT}`);
  console.log(`[zexvro-zk-prover] artifacts: ${ARTIFACT_DIR}`);
  console.log(`[zexvro-zk-prover] wasm=${fs.existsSync(WASM)} zkey=${fs.existsSync(ZKEY)}`);
  console.log(`[zexvro-zk-prover] rapidsnark=${RAPIDSNARK_BIN || 'NOT FOUND'}`);
  console.log(`[zexvro-zk-prover] relayer=${relayerEnabled() ? relayerKeypair().publicKey() : 'OFF'}`);
});

if (IDLE_EXIT_MS > 0) {
  setInterval(() => {
    if (proving > 0 || settling > 0) return;
    if (Date.now() - lastBusy > IDLE_EXIT_MS) {
      console.log(`[zexvro-zk-prover] idle ${IDLE_EXIT_MS}ms — exiting`);
      process.exit(0);
    }
  }, 15_000);
}
