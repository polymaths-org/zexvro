import { Lab, Badge, Certificate, Submission, User, LabRunProgress } from '../types';

// Client-side persistence layer. The platform's backend (DynamoDB) is the
// source of truth when it is reachable and configured, but the demo must not
// lose admin edits (labs, badges, credentials) or platform records on reload.
// Every mutation in App is mirrored here, and on boot the local store is merged
// over whatever the API returns so changes always stick.

const KEY = 'zexvro_labs_db_v1';

export interface LocalDB {
  labs?: Lab[];
  badges?: Badge[];
  certificates?: Certificate[];
  submissions?: Submission[];
  users?: User[];
  user?: User;
  labProgress?: Record<string, LabRunProgress>;
}

export function loadLocalDB(): LocalDB | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalDB;
  } catch {
    return null;
  }
}

export function saveLocalDB(db: LocalDB): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Storage full (usually from oversized banner data URLs) — trim lab banners.
    try {
      const trimmed: LocalDB = {
        ...db,
        labs: db.labs?.map((l) => ({ ...l, bannerUrl: undefined })),
      };
      localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      /* give up silently */
    }
  }
}

export function clearLocalDB(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// Merge local state over the server/mock baseline.
export function mergeLabs(base: Lab[], local?: Lab[]): Lab[] {
  if (!local || local.length === 0) return base;
  const byId = new Map(local.map((l) => [l.id, l]));
  const merged = base.map((l) => byId.get(l.id) || l);
  const localIds = new Set(local.map((l) => l.id));
  const extra = local.filter((l) => !base.some((b) => b.id === l.id));
  return [...extra, ...merged];
}
