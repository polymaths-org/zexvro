import { Lab, Badge, User } from '../types';

// Badges are NOT a global dummy catalog. Each lab carries its own badge design
// made in the admin Credential tab (`lab.credential.badge`). This helper
// derives the earnable badge list straight from the labs so learners only ever
// see the badges admins actually designed.

interface DerivedBadge extends Badge {
  labId: string;
}

export function deriveBadges(labs: Lab[], user: User | null): DerivedBadge[] {
  const earnedDate = (lab: Lab): string | undefined => {
    if (lab.credential?.awardBadge === false) return undefined;
    if (!user?.completedLabIds?.includes(lab.id)) return undefined;
    return new Date().toISOString().split('T')[0];
  };

  return labs
    .filter((lab) => lab.credential?.badge)
    .map((lab) => {
      const badge = lab.credential!.badge!;
      return {
        labId: lab.id,
        id: `lab_${lab.id}`,
        name: lab.credential?.badgeName || lab.badgeName || `${lab.title} Badge`,
        description: lab.title,
        category: lab.category,
        iconName: badge.icon || 'Award',
        color: badge.accent || '#3b82f6',
        background: badge.background,
        backgroundImage: badge.backgroundImage,
        xpBonus: lab.xpReward || 0,
        awardOn: lab.credential?.awardOn || 'completion',
        earnedAt: earnedDate(lab),
      };
    });
}

export function derivedEarned(labs: Lab[], user: User | null): DerivedBadge[] {
  return deriveBadges(labs, user).filter((b) => b.earnedAt);
}
