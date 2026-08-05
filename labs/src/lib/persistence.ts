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
    const db = JSON.parse(raw) as LocalDB;
    if (Array.isArray(db.labs)) {
      db.labs = sanitizeLabs(db.labs);
    }
    return db;
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

// Normalize a possibly-malformed lab into something every render path can
// handle safely. Prevents partial / legacy records (missing title, tags,
// category, difficulty) from crashing the catalog or rendering as blanks.
export function sanitizeLab(lab: Lab): Lab {
  return {
    ...lab,
    title: typeof lab.title === 'string' && lab.title.trim() ? lab.title : lab.id,
    description: typeof lab.description === 'string' ? lab.description : '',
    tags: Array.isArray(lab.tags) ? lab.tags.filter(Boolean) : [],
    category: lab.category ?? 'Smart Contracts',
    difficulty: lab.difficulty ?? 'Introductory',
  };
}

export function sanitizeLabs(labs: Lab[]): Lab[] {
  if (!Array.isArray(labs)) return [];
  return labs.filter((l) => l && typeof l.id === 'string').map(sanitizeLab);
}

// A lab is "draft" (unpublished) when status is draft or isPublished is false.
// Only admins and the lab's listed editors (by username) may see drafts.
export function isDraftLab(lab: Lab): boolean {
  return lab.status === 'draft' || lab.isPublished === false;
}

export function canViewLab(lab: Lab, user?: { role?: string; username?: string } | null): boolean {
  if (!isDraftLab(lab)) return true;
  if (user?.role === 'admin') return true;
  const editors = Array.isArray(lab.editors) ? lab.editors.map((e) => e.toLowerCase()) : [];
  return !!user?.username && editors.includes(user.username.toLowerCase());
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
