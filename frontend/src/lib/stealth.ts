/**
 * Zer0 stealth addresses (one-time receive keys).
 *
 * Dual-key style (scan + spend), adapted to Stellar ed25519:
 *  - Recipient publishes a meta-address (scan_pub + spend_pub)
 *  - Sender generates an ephemeral key, derives a one-time Stellar account
 *  - On-chain withdraw goes to that fresh G… address (not the long-term wallet)
 *  - Only someone with the scan key can recognize / recover the one-time secret
 *
 * Honest limits:
 *  - The one-time G… address is still visible on the ledger
 *  - Long-term employee identity is not published as the withdraw destination
 *  - Create-account / first fund may still show a funder → one-time edge
 */

import nacl from 'tweetnacl';
import { sha256 as nobleSha256 } from '@noble/hashes/sha256';
import { Keypair } from 'stellar-sdk';

const META_PREFIX = 'z0st1';
const DOMAIN = new TextEncoder().encode('zexvro-stealth-v1');

/**
 * Sync SHA-256 in the browser (no Node `crypto` / Vite externalized module).
 * Pure JS via @noble/hashes — keeps stealth meta encode/decode working client-side.
 */
function sha256(data: Uint8Array): Uint8Array {
  return nobleSha256(data);
}

export interface StealthIdentity {
  /** Long-term public meta-address (share this) */
  metaAddress: string;
  /** Base58-ish packed scan public (also inside meta) */
  scanPublicHex: string;
  spendPublicHex: string;
  /** Secrets — never share scan/spend secrets publicly */
  scanSecretHex: string;
  spendSecretHex: string;
  createdAt: number;
  label?: string;
}

export interface StealthPaymentRecord {
  id: string;
  paymentId?: string;
  metaAddress: string;
  ephemeralPublicHex: string;
  oneTimePublicKey: string;
  /** One-time secret seed (S…) — holder can sweep funds */
  oneTimeSecret: string;
  amountXlm: number;
  createdAt: number;
  txHash?: string | null;
  note?: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '').toLowerCase();
  if (clean.length % 2) throw new Error('Invalid hex');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
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

function clampScalar(sk: Uint8Array): Uint8Array {
  // X25519 scalar clamp
  const s = new Uint8Array(sk);
  s[0] &= 248;
  s[31] &= 127;
  s[31] |= 64;
  return s;
}

/** Derive X25519 keypair from random 32 bytes (scan or ephemeral). */
function x25519FromSeed(seed32: Uint8Array): { publicKey: Uint8Array; secretKey: Uint8Array } {
  const secretKey = clampScalar(seed32);
  const publicKey = nacl.scalarMult.base(secretKey);
  return { publicKey, secretKey };
}

function random32(): Uint8Array {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b;
}

/** Create a new long-term stealth identity for an employee / payee. */
export function generateStealthIdentity(label?: string): StealthIdentity {
  const scanSeed = random32();
  const spendSeed = random32();
  const scan = x25519FromSeed(scanSeed);
  // Spend is Stellar ed25519 seed material (we only publish H(spend) style pub for binding)
  const spendKp = Keypair.fromRawEd25519Seed(Buffer.from(spendSeed));
  const spendPub = spendKp.rawPublicKey();

  const metaAddress = encodeMetaAddress(scan.publicKey, spendPub);

  return {
    metaAddress,
    scanPublicHex: toHex(scan.publicKey),
    spendPublicHex: toHex(spendPub),
    scanSecretHex: toHex(scan.secretKey),
    spendSecretHex: toHex(spendSeed),
    createdAt: Date.now(),
    label,
  };
}

export function encodeMetaAddress(scanPub: Uint8Array, spendPub: Uint8Array): string {
  if (scanPub.length !== 32 || spendPub.length !== 32) {
    throw new Error('scan/spend public keys must be 32 bytes');
  }
  const payload = concat(new Uint8Array([1]), scanPub, spendPub);
  const checksum = sha256(concat(DOMAIN, payload)).slice(0, 4);
  return `${META_PREFIX}${b64url(concat(payload, checksum))}`;
}

export function decodeMetaAddress(meta: string): { scanPub: Uint8Array; spendPub: Uint8Array } {
  const raw = meta.trim();
  if (!raw.startsWith(META_PREFIX)) {
    throw new Error('Not a Zer0 stealth meta-address (expected z0st1…)');
  }
  const body = b64urlDecode(raw.slice(META_PREFIX.length));
  if (body.length !== 1 + 32 + 32 + 4) {
    throw new Error('Invalid stealth meta-address length');
  }
  const payload = body.slice(0, 1 + 64);
  const checksum = body.slice(1 + 64);
  const expect = sha256(concat(DOMAIN, payload)).slice(0, 4);
  if (!checksum.every((b, i) => b === expect[i])) {
    throw new Error('Invalid stealth meta-address checksum');
  }
  if (payload[0] !== 1) throw new Error('Unsupported stealth meta version');
  return {
    scanPub: payload.slice(1, 33),
    spendPub: payload.slice(33, 65),
  };
}

export function isStealthMetaAddress(value: string): boolean {
  try {
    decodeMetaAddress(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Derive a one-time Stellar keypair for paying a meta-address.
 * Returns ephemeral public key (needed for recipient scan) + one-time account.
 */
export function createStealthPayment(metaAddress: string, salt = ''): {
  ephemeralPublicHex: string;
  oneTimeKeypair: Keypair;
  oneTimePublicKey: string;
  oneTimeSecret: string;
  sharedSecretHex: string;
} {
  const { scanPub, spendPub } = decodeMetaAddress(metaAddress);
  const ephSeed = random32();
  const eph = x25519FromSeed(ephSeed);

  // ECDH shared secret with recipient scan key
  const shared = nacl.scalarMult(eph.secretKey, scanPub);

  const seedMaterial = sha256(
    concat(
      DOMAIN,
      shared,
      spendPub,
      eph.publicKey,
      new TextEncoder().encode(salt),
    ),
  );

  const oneTimeKeypair = Keypair.fromRawEd25519Seed(Buffer.from(seedMaterial));
  return {
    ephemeralPublicHex: toHex(eph.publicKey),
    oneTimeKeypair,
    oneTimePublicKey: oneTimeKeypair.publicKey(),
    oneTimeSecret: oneTimeKeypair.secret(),
    sharedSecretHex: toHex(shared),
  };
}

/**
 * Recipient: given scan secret + published ephemeral pubkey, recover one-time keypair.
 */
export function recoverStealthPayment(args: {
  scanSecretHex: string;
  spendPublicHex: string;
  ephemeralPublicHex: string;
  salt?: string;
}): { oneTimeKeypair: Keypair; oneTimePublicKey: string; oneTimeSecret: string } {
  const scanSecret = fromHex(args.scanSecretHex);
  const ephPub = fromHex(args.ephemeralPublicHex);
  const spendPub = fromHex(args.spendPublicHex);
  const shared = nacl.scalarMult(scanSecret, ephPub);
  const seedMaterial = sha256(
    concat(
      DOMAIN,
      shared,
      spendPub,
      ephPub,
      new TextEncoder().encode(args.salt || ''),
    ),
  );
  const oneTimeKeypair = Keypair.fromRawEd25519Seed(Buffer.from(seedMaterial));
  return {
    oneTimeKeypair,
    oneTimePublicKey: oneTimeKeypair.publicKey(),
    oneTimeSecret: oneTimeKeypair.secret(),
  };
}

/** Privacy score 0–100 from operational knobs + anonymity set size. */
export function computePrivacyScore(input: {
  shielded: boolean;
  stealthEnabled: boolean;
  privacyDelaySec: number;
  privacyJitterSec: number;
  decoyDepositsEnabled: boolean;
  decoyDepositCount: number;
  anonymitySetSize: number;
  preferRelayer: boolean;
}): { score: number; grade: 'F' | 'D' | 'C' | 'B' | 'A' | 'A+'; factors: string[] } {
  if (!input.shielded) {
    return {
      score: 5,
      grade: 'F',
      factors: ['Transparent on-chain payment — full sender, amount, receiver visible'],
    };
  }

  let score = 40; // base mixer unlinkability
  const factors: string[] = ['ZK pool breaks deposit↔withdraw link'];

  if (input.stealthEnabled) {
    score += 22;
    factors.push('Stealth one-time receive address hides long-term payee identity');
  } else {
    factors.push('Recipient long-term wallet still public on withdraw');
  }

  if (input.preferRelayer) {
    score += 10;
    factors.push('Relayer deposits reduce company-wallet fingerprint');
  }

  const delay = Math.max(0, input.privacyDelaySec) + Math.max(0, input.privacyJitterSec) / 2;
  if (delay >= 120) {
    score += 12;
    factors.push('Strong timing delay between ops');
  } else if (delay >= 30) {
    score += 8;
    factors.push('Moderate timing delay');
  } else if (delay > 0) {
    score += 4;
    factors.push('Light timing delay');
  } else {
    factors.push('No timing delay — deposit/withdraw may correlate in time');
  }

  if (input.decoyDepositsEnabled && input.decoyDepositCount > 0) {
    score += Math.min(10, 4 + input.decoyDepositCount);
    factors.push(`${input.decoyDepositCount} decoy deposit(s) grow anonymity set`);
  }

  if (input.anonymitySetSize >= 100) {
    score += 12;
    factors.push(`Large anonymity set (~${input.anonymitySetSize} deposits)`);
  } else if (input.anonymitySetSize >= 20) {
    score += 8;
    factors.push(`Moderate anonymity set (~${input.anonymitySetSize})`);
  } else if (input.anonymitySetSize > 0) {
    score += 3;
    factors.push(`Small anonymity set (~${input.anonymitySetSize}) — more users = stronger privacy`);
  } else {
    factors.push('Anonymity set unknown / empty');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let grade: 'F' | 'D' | 'C' | 'B' | 'A' | 'A+' = 'F';
  if (score >= 92) grade = 'A+';
  else if (score >= 85) grade = 'A';
  else if (score >= 72) grade = 'B';
  else if (score >= 58) grade = 'C';
  else if (score >= 40) grade = 'D';

  return { score, grade, factors };
}

export function shortAddr(addr: string, n = 4): string {
  if (!addr) return '—';
  if (addr.length <= n * 2 + 2) return addr;
  return `${addr.slice(0, n + 2)}…${addr.slice(-n)}`;
}
