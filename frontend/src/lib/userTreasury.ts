import {accountStorageKey} from './accountStorage';
/**
 * Per-browser personal treasury for Zer0 auto-approve.
 * Secret stays in localStorage only — never put in Zer0 settings / AWS sync.
 */
import { Keypair } from '@stellar/stellar-sdk';

const STORAGE_KEY = 'zexvro_user_treasury_v1';

export type UserTreasuryRecord = {
  publicKey: string;
  secret: string;
  createdAt: number;
  label?: string;
};

function isValidSecret(secret: string): boolean {
  return typeof secret === 'string' && secret.startsWith('S') && secret.length >= 50;
}

function isValidPublic(publicKey: string): boolean {
  return typeof publicKey === 'string' && /^G[A-Z2-7]{55}$/.test(publicKey);
}

export function readUserTreasury(): UserTreasuryRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(accountStorageKey(STORAGE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserTreasuryRecord>;
    if (!isValidSecret(parsed.secret || '') || !isValidPublic(parsed.publicKey || '')) {
      return null;
    }
    // Ensure secret matches public key
    try {
      const kp = Keypair.fromSecret(parsed.secret!);
      if (kp.publicKey() !== parsed.publicKey) return null;
    } catch {
      return null;
    }
    return {
      publicKey: parsed.publicKey!,
      secret: parsed.secret!,
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
      label: typeof parsed.label === 'string' ? parsed.label : undefined,
    };
  } catch {
    return null;
  }
}

export function getUserTreasurySecret(): string | null {
  const rec = readUserTreasury();
  return rec?.secret || null;
}

export function getUserTreasuryPublicKey(): string | null {
  const rec = readUserTreasury();
  return rec?.publicKey || null;
}

export function hasUserTreasury(): boolean {
  return !!getUserTreasurySecret();
}

export function writeUserTreasury(record: UserTreasuryRecord): void {
  if (typeof window === 'undefined') return;
  if (!isValidSecret(record.secret) || !isValidPublic(record.publicKey)) {
    throw new Error('Invalid treasury keypair');
  }
  const kp = Keypair.fromSecret(record.secret);
  if (kp.publicKey() !== record.publicKey) {
    throw new Error('Treasury secret does not match public key');
  }
  localStorage.setItem(
    accountStorageKey(STORAGE_KEY),
    JSON.stringify({
      publicKey: record.publicKey,
      secret: record.secret,
      createdAt: record.createdAt || Date.now(),
      label: record.label || 'Personal treasury',
    }),
  );
}

export function generateUserTreasury(label = 'Personal treasury'): UserTreasuryRecord {
  const kp = Keypair.random();
  const record: UserTreasuryRecord = {
    publicKey: kp.publicKey(),
    secret: kp.secret(),
    createdAt: Date.now(),
    label,
  };
  writeUserTreasury(record);
  return record;
}

export function importUserTreasurySecret(secret: string, label = 'Imported treasury'): UserTreasuryRecord {
  const cleaned = secret.trim();
  if (!isValidSecret(cleaned)) {
    throw new Error('Secret must be a Stellar secret key starting with S');
  }
  const kp = Keypair.fromSecret(cleaned);
  const record: UserTreasuryRecord = {
    publicKey: kp.publicKey(),
    secret: cleaned,
    createdAt: Date.now(),
    label,
  };
  writeUserTreasury(record);
  return record;
}

export function clearUserTreasury(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(accountStorageKey(STORAGE_KEY));
}

export function shortG(address: string): string {
  const a = (address || '').trim();
  if (a.length < 12) return a || '—';
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}
