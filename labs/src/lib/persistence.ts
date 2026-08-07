import { Lab } from '../types';

// No client-side persistence. The Firestore backend is the sole source of
// truth — localStorage was removed because oversized banner data URLs overflowed
// the browser's ~5MB quota and resurrected stale edits after reload. These
// helpers only normalize/guard the server data for safe rendering.

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
