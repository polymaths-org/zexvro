import React from 'react';
import { Award, ShieldCheck, Zap, Flame, Code2, Globe, Lock, KeyRound } from 'lucide-react';
import { Lab, LabCredential } from '../types';

// Renders the badge designed in the admin Credential tab (`lab.credential.badge`).
// Used on completion, progress sidebar and lab details so learners always see
// the badge admins actually made — never a hardcoded name/icon. When the badge
// uses a background image, that image IS the badge and it's shown as-is; the
// icon only appears as a fallback for color-only badges.

const ICONS: Record<string, React.ReactNode> = {
  Award: <Award className="w-1/2 h-1/2" />,
  ShieldCheck: <ShieldCheck className="w-1/2 h-1/2" />,
  Zap: <Zap className="w-1/2 h-1/2" />,
  Flame: <Flame className="w-1/2 h-1/2" />,
  Globe: <Globe className="w-1/2 h-1/2" />,
  Lock: <Lock className="w-1/2 h-1/2" />,
  KeyRound: <KeyRound className="w-1/2 h-1/2" />,
};

export const credentialBadgeName = (lab: Lab): string =>
  lab.credential?.badgeName || lab.credentialName || lab.badgeName || 'ZEXVRO Skill Badge';

export const CredentialBadgeArt: React.FC<{
  badge: Required<LabCredential>['badge'];
  className?: string;
  grayscale?: boolean;
}> = ({ badge, className = '', grayscale = false }) => {
  const style: React.CSSProperties = badge.backgroundImage
    ? {
        backgroundImage: `url("${badge.backgroundImage}")`,
        backgroundSize: badge.bgSize === 'contain' ? 'contain' : 'cover',
        backgroundPosition: `${badge.bgPosX ?? 50}% ${badge.bgPosY ?? 50}%`,
        backgroundRepeat: 'no-repeat',
      }
    : { background: badge.background };

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${className}`} style={style}>
      {!badge.backgroundImage && (
        <div
          className="absolute inset-0 flex items-center justify-center text-white"
          style={{
            filter: grayscale ? 'grayscale(1) opacity(0.5)' : undefined,
          }}
        >
          {ICONS[badge.icon || 'Award'] || <Award className="w-1/2 h-1/2" />}
        </div>
      )}
    </div>
  );
};