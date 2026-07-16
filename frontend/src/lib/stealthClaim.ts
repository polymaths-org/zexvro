/**
 * Stealth withdraw claims (PIN-gated sweep).
 *
 * After a stealth payment lands on a one-time G… account, the sender can mint
 * a portable claim: secret encrypted under a human PIN.
 *
 * Crypto is pure-JS (no WebCrypto / crypto.subtle required):
 *   PBKDF2-SHA256 (noble) → 32-byte key → NaCl secretbox (tweetnacl)
 * so Vite polyfills / non-secure contexts cannot break claim minting.
 *
 * Recipient opens /withdraw, pastes claim + PIN + their long-term G… address.
 * We decrypt the one-time S… key client-side and sweep funds to them.
 */

import nacl from 'tweetnacl';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { Keypair, TransactionBuilder, Operation, Networks, Account, BASE_FEE, Asset } from 'stellar-sdk';

/** Current claim format (pure JS). Legacy AES-GCM claims used z0w1. */
const CLAIM_PREFIX = 'z0w2';
const CLAIM_PREFIX_LEGACY = 'z0w1';
/** 40k is plenty for a 6-digit PIN and stays snappy on low-end devices. */
const PBKDF2_ITERS = 40_000;
const PIN_LEN = 6;
const SALT_LEN = 16;
const NONCE_LEN = 24; // nacl.secretbox.nonceLength

function getRandomValues(len: number): Uint8Array {
  const out = new Uint8Array(len);
  try {
    const c =
      (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.getRandomValues)
        ? (globalThis as any).crypto
        : (typeof window !== 'undefined' ? window.crypto : null);
    if (c?.getRandomValues) {
      c.getRandomValues(out);
      return out;
    }
  } catch { /* fall through */ }
  // Fallback if getRandomValues is missing (should be rare on modern browsers)
  for (let i = 0; i < len; i++) out[i] = Math.floor(Math.random() * 256) ^ ((Date.now() >> (i % 16)) & 0xff);
  return out;
}

/** Derive a 32-byte secretbox key from PIN + salt (pure JS, no WebCrypto). */
function deriveKeyBytes(pin: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, pin.normalize('NFKC'), salt, {
    c: PBKDF2_ITERS,
    dkLen: 32,
  });
}

export interface StealthClaimPayload {
  /** One-time public key (G…) funds landed on */
  oneTimePublicKey: string;
  /** Amount intended (display only) */
  amountXlm?: number;
  /** Recipient label for sender notes */
  note?: string;
  /** Payment id for correlation */
  paymentId?: string;
  /** Horizon network hint */
  network: 'TESTNET' | 'PUBLIC';
  createdAt: number;
}

export interface IssuedClaim {
  id: string;
  /** Portable claim code (share with PIN) */
  claimCode: string;
  /** Human PIN (share out-of-band or together carefully) */
  pin: string;
  oneTimePublicKey: string;
  amountXlm?: number;
  note?: string;
  paymentId?: string;
  network: 'TESTNET' | 'PUBLIC';
  createdAt: number;
  redeemedAt?: number | null;
  redeemTxHash?: string | null;
}

export interface DecryptedClaim {
  oneTimeSecret: string;
  meta: StealthClaimPayload;
}

function toB64Url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Generate a 6-digit withdraw PIN (never starts with 0 for readability). */
export function generateWithdrawPin(): string {
  const n = 100000 + Math.floor(Math.random() * 900000);
  return String(n).slice(0, PIN_LEN);
}

/**
 * Encrypt one-time secret under PIN → portable claim code.
 * Format: z0w2.<b64url(salt|nonce|metaLen|meta|secretbox)>
 * Pure JS — does not need crypto.subtle.
 */
export async function createStealthClaim(args: {
  oneTimeSecret: string;
  oneTimePublicKey: string;
  pin?: string;
  amountXlm?: number;
  note?: string;
  paymentId?: string;
  network?: 'TESTNET' | 'PUBLIC';
}): Promise<IssuedClaim> {
  if (!args.oneTimeSecret?.startsWith('S')) {
    throw new Error('Invalid one-time secret (expected S…)');
  }
  const pin = args.pin || generateWithdrawPin();
  const salt = getRandomValues(SALT_LEN);
  const nonce = getRandomValues(NONCE_LEN);
  const key = deriveKeyBytes(pin, salt);

  const meta: StealthClaimPayload = {
    oneTimePublicKey: args.oneTimePublicKey,
    amountXlm: args.amountXlm,
    note: args.note,
    paymentId: args.paymentId,
    network: args.network || 'TESTNET',
    createdAt: Date.now(),
  };
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  if (metaBytes.length > 0xffff) throw new Error('Claim metadata too large');

  const plain = new TextEncoder().encode(args.oneTimeSecret);
  const cipher = nacl.secretbox(plain, nonce, key);
  if (!cipher) throw new Error('Failed to encrypt claim payload.');

  // salt(16) | nonce(24) | metaLen(2 BE) | meta | cipher
  const metaLen = new Uint8Array(2);
  metaLen[0] = (metaBytes.length >> 8) & 0xff;
  metaLen[1] = metaBytes.length & 0xff;
  const packed = concat(salt, nonce, metaLen, metaBytes, cipher);
  const claimCode = `${CLAIM_PREFIX}.${toB64Url(packed)}`;

  return {
    id: `claim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    claimCode,
    pin,
    oneTimePublicKey: args.oneTimePublicKey,
    amountXlm: args.amountXlm,
    note: args.note,
    paymentId: args.paymentId,
    network: meta.network,
    createdAt: meta.createdAt,
    redeemedAt: null,
    redeemTxHash: null,
  };
}

function parseMetaAndRest(packed: Uint8Array, saltLen: number, nonceLen: number): {
  salt: Uint8Array;
  nonce: Uint8Array;
  meta: StealthClaimPayload;
  cipher: Uint8Array;
} {
  if (packed.length < saltLen + nonceLen + 2 + 8) {
    throw new Error('Claim code is truncated or corrupted.');
  }
  const salt = packed.slice(0, saltLen);
  const nonce = packed.slice(saltLen, saltLen + nonceLen);
  const metaLen = (packed[saltLen + nonceLen] << 8) | packed[saltLen + nonceLen + 1];
  const metaStart = saltLen + nonceLen + 2;
  const metaEnd = metaStart + metaLen;
  if (metaEnd > packed.length) throw new Error('Claim code is corrupted (metadata).');
  const metaBytes = packed.slice(metaStart, metaEnd);
  const cipher = packed.slice(metaEnd);
  let meta: StealthClaimPayload;
  try {
    meta = JSON.parse(new TextDecoder().decode(metaBytes));
  } catch {
    throw new Error('Claim metadata unreadable.');
  }
  return { salt, nonce, meta, cipher };
}

function finalizeOpened(oneTimeSecret: string, meta: StealthClaimPayload): DecryptedClaim {
  if (!oneTimeSecret.startsWith('S')) {
    throw new Error('Decrypted payload is not a Stellar secret.');
  }
  try {
    const kp = Keypair.fromSecret(oneTimeSecret);
    if (meta.oneTimePublicKey && kp.publicKey() !== meta.oneTimePublicKey) {
      throw new Error('Claim secret does not match the expected one-time address.');
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('match')) throw e;
    throw new Error('Decrypted secret is not a valid Stellar key.');
  }
  return { oneTimeSecret, meta };
}

/** Parse claim code → decrypt with PIN (pure JS for z0w2; legacy z0w1 if WebCrypto exists). */
export async function openStealthClaim(claimCode: string, pin: string): Promise<DecryptedClaim> {
  const raw = claimCode.trim().replace(/\s+/g, '');
  const pinClean = pin.trim();

  // ── Current pure-JS format (z0w2) ──
  if (raw.startsWith(`${CLAIM_PREFIX}.`)) {
    const packed = fromB64Url(raw.slice(CLAIM_PREFIX.length + 1));
    const { salt, nonce, meta, cipher } = parseMetaAndRest(packed, SALT_LEN, NONCE_LEN);
    const key = deriveKeyBytes(pinClean, salt);
    const plain = nacl.secretbox.open(cipher, nonce, key);
    if (!plain) {
      throw new Error('Wrong PIN or corrupted claim code. Check both and try again.');
    }
    return finalizeOpened(new TextDecoder().decode(plain), meta);
  }

  // ── Legacy AES-GCM format (z0w1) — only if browser WebCrypto is available ──
  if (raw.startsWith(`${CLAIM_PREFIX_LEGACY}.`)) {
    const subtle =
      (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle)
      || (typeof window !== 'undefined' ? window.crypto?.subtle : null);
    if (!subtle?.importKey) {
      throw new Error(
        'This claim uses an older format that needs Web Crypto. Ask the payer to re-send a new withdraw link (z0w2…), or open the app on HTTPS/localhost.',
      );
    }
    const packed = fromB64Url(raw.slice(CLAIM_PREFIX_LEGACY.length + 1));
    // legacy: salt(16) | iv(12) | metaLen | meta | cipher
    const { salt, nonce: iv, meta, cipher } = parseMetaAndRest(packed, 16, 12);
    try {
      const baseKey = await subtle.importKey(
        'raw',
        new TextEncoder().encode(pinClean.normalize('NFKC')),
        'PBKDF2',
        false,
        ['deriveKey'],
      );
      const key = await subtle.deriveKey(
        { name: 'PBKDF2', salt: salt as BufferSource, iterations: 60_000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'],
      );
      const plainBuf = await subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        cipher as BufferSource,
      );
      return finalizeOpened(new TextDecoder().decode(plainBuf), meta);
    } catch (e) {
      if (e instanceof Error && (
        e.message.includes('match')
        || e.message.includes('valid Stellar')
        || e.message.includes('not a Stellar')
      )) throw e;
      throw new Error('Wrong PIN or corrupted legacy claim code.');
    }
  }

  throw new Error('Invalid claim code. It should start with z0w2. (or older z0w1.)');
}

export function isClaimCode(value: string): boolean {
  const v = value.trim();
  return v.startsWith(`${CLAIM_PREFIX}.`) || v.startsWith(`${CLAIM_PREFIX_LEGACY}.`);
}

export function buildWithdrawUrl(claimCode: string, origin?: string): string {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const q = new URLSearchParams({ c: claimCode });
  return `${base}/withdraw?${q.toString()}`;
}

export function networkFromHorizon(horizonUrl: string): 'TESTNET' | 'PUBLIC' {
  return (horizonUrl || '').includes('testnet') ? 'TESTNET' : 'PUBLIC';
}

function passphraseFor(network: 'TESTNET' | 'PUBLIC'): string {
  return network === 'TESTNET' ? Networks.TESTNET : Networks.PUBLIC;
}

function horizonFor(network: 'TESTNET' | 'PUBLIC'): string {
  return network === 'TESTNET'
    ? 'https://horizon-testnet.stellar.org'
    : 'https://horizon.stellar.org';
}

/**
 * Sweep all XLM from the one-time account to the recipient's long-term wallet.
 * Uses accountMerge when destination exists; createAccount when it does not.
 */
export async function sweepOneTimeToAddress(args: {
  oneTimeSecret: string;
  toAddress: string;
  network?: 'TESTNET' | 'PUBLIC';
  horizonUrl?: string;
}): Promise<{ txHash: string; amountXlm: number; mode: 'merge' | 'create' | 'payment' }> {
  const to = args.toAddress.trim();
  if (!/^G[A-Z2-7]{55}$/.test(to)) {
    throw new Error('Destination must be a Stellar public key starting with G (56 characters).');
  }

  const source = Keypair.fromSecret(args.oneTimeSecret);
  const network = args.network || 'TESTNET';
  const horizon = (args.horizonUrl || horizonFor(network)).replace(/\/$/, '');
  const passphrase = passphraseFor(network);

  // Load source account
  const srcRes = await fetch(`${horizon}/accounts/${source.publicKey()}`);
  if (!srcRes.ok) {
    if (srcRes.status === 404) {
      throw new Error('This claim has no funds yet (or already emptied). Check the explorer, or wait a minute after payment.');
    }
    throw new Error(`Could not load one-time account: ${srcRes.statusText}`);
  }
  const srcData = await srcRes.json();
  const nativeBal = (srcData.balances || []).find((b: any) => b.asset_type === 'native');
  const balanceXlm = parseFloat(nativeBal?.balance || '0');
  if (balanceXlm <= 0) {
    throw new Error('One-time account balance is zero — already withdrawn?');
  }

  // Destination exists?
  const destRes = await fetch(`${horizon}/accounts/${to}`);
  const destExists = destRes.ok;

  const sequence = srcData.sequence;
  const account = new Account(source.publicKey(), sequence);
  // Leave room for base fee; accountMerge sends everything minus fee automatically
  const fee = String(Math.max(Number(BASE_FEE), 1000));

  let mode: 'merge' | 'create' | 'payment' = 'merge';
  const builder = new TransactionBuilder(account, {
    fee,
    networkPassphrase: passphrase,
  });

  if (destExists) {
    // Prefer merge — empties + closes one-time account (cleanest privacy hygiene)
    builder.addOperation(Operation.accountMerge({ destination: to }));
    mode = 'merge';
  } else {
    // Create destination with almost all funds (keep fee buffer)
    const feeXlm = Number(fee) / 1e7;
    // Need extra base reserve on source if we only createAccount… simpler: createAccount with balance - fee*2
    const send = Math.max(0, balanceXlm - feeXlm * 3);
    if (send < 1) {
      throw new Error(
        `Not enough XLM to create a new account (need ~1 XLM reserve). Balance: ${balanceXlm.toFixed(4)} XLM. Ask recipient to fund their wallet first, then retry.`,
      );
    }
    builder.addOperation(
      Operation.createAccount({
        destination: to,
        startingBalance: send.toFixed(7),
      }),
    );
    mode = 'create';
  }

  const tx = builder.setTimeout(180).build();
  tx.sign(source);

  const submit = await fetch(`${horizon}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ tx: tx.toXDR() }).toString(),
  });
  const submitData = await submit.json();
  if (!submit.ok || submitData.status === 'ERROR') {
    const detail = submitData.extras?.result_codes
      ? JSON.stringify(submitData.extras.result_codes)
      : (submitData.detail || submitData.title || 'Unknown error');
    // Fallback: if merge fails for trustline / subentry reasons, try plain payment of free balance
    if (mode === 'merge') {
      return sweepViaPayment({
        oneTimeSecret: args.oneTimeSecret,
        toAddress: to,
        network,
        horizonUrl: horizon,
        balanceXlm,
        sequence: srcData.sequence,
        failDetail: String(detail),
      });
    }
    throw new Error(`Withdraw failed: ${detail}`);
  }

  return {
    txHash: submitData.hash,
    amountXlm: balanceXlm,
    mode,
  };
}

async function sweepViaPayment(args: {
  oneTimeSecret: string;
  toAddress: string;
  network: 'TESTNET' | 'PUBLIC';
  horizonUrl: string;
  balanceXlm: number;
  sequence: string;
  failDetail: string;
}): Promise<{ txHash: string; amountXlm: number; mode: 'payment' }> {
  const source = Keypair.fromSecret(args.oneTimeSecret);
  const fee = Math.max(Number(BASE_FEE), 1000);
  const feeXlm = fee / 1e7;
  // Keep min reserve (~0.5) + fee on source if not merging
  const reserve = 0.5 + feeXlm * 2;
  const send = Math.max(0, args.balanceXlm - reserve);
  if (send <= 0) {
    throw new Error(`Withdraw failed (merge): ${args.failDetail}. Not enough free balance for payment fallback.`);
  }
  const account = new Account(source.publicKey(), args.sequence);
  const tx = new TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: passphraseFor(args.network),
  })
    .addOperation(
      Operation.payment({
        destination: args.toAddress,
        asset: Asset.native(),
        amount: send.toFixed(7),
      }),
    )
    .setTimeout(180)
    .build();
  tx.sign(source);

  const submit = await fetch(`${args.horizonUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ tx: tx.toXDR() }).toString(),
  });
  const submitData = await submit.json();
  if (!submit.ok || submitData.status === 'ERROR') {
    const detail = submitData.extras?.result_codes
      ? JSON.stringify(submitData.extras.result_codes)
      : (submitData.detail || submitData.title || args.failDetail);
    throw new Error(`Withdraw failed: ${detail}`);
  }
  return { txHash: submitData.hash, amountXlm: send, mode: 'payment' };
}
