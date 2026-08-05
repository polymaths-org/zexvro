import React from 'react';
import {
  Trophy,
  Flame,
  Award,
  ShieldCheck,
  Users,
  CheckCircle2,
  Calendar,
  Github,
  Share2,
  Copy,
  BadgeCheck,
  ExternalLink,
} from 'lucide-react';
import { User, Badge, Certificate } from '../types';
import { StatusBadge } from './ui/Badge';
import { shareUrl, profileUrl, verifyUrl } from '../lib/router';

interface ProfileViewProps {
  user: User;
  badges: Badge[];
  certificates: Certificate[];
}

const getLevel = (xp: number) => {
  if (xp >= 5000) return { level: 5, title: 'Web3 Architect', next: null, progress: 100 };
  if (xp >= 3000) return { level: 4, title: 'Protocol Engineer', next: 5000, progress: ((xp - 3000) / 2000) * 100 };
  if (xp >= 1500) return { level: 3, title: 'Smart Contract Dev', next: 3000, progress: ((xp - 1500) / 1500) * 100 };
  if (xp >= 500) return { level: 2, title: 'Chain Explorer', next: 1500, progress: ((xp - 500) / 1000) * 100 };
  return { level: 1, title: 'Web3 Novice', next: 500, progress: (xp / 500) * 100 };
};

export const ProfileView: React.FC<ProfileViewProps> = ({ user, badges, certificates }) => {
  const levelInfo = getLevel(user.xp);
  const earned = badges.filter((b) => b.earnedAt);

  const [copied, setCopied] = React.useState(false);
  const copyProfileLink = async () => {
    await navigator.clipboard.writeText(shareUrl(profileUrl(user.username)));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 text-zinc-100">
      {/* Profile hero */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="h-32 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px] opacity-25 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950" />
        </div>
        <div className="px-6 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 rounded-3xl border-4 border-zinc-950 overflow-hidden bg-blue-600 flex items-center justify-center text-white text-3xl font-black shadow-2xl">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  (user.name?.[0] || '?').toUpperCase()
                )}
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-black text-white font-heading">{user.name}</h1>
                <p className="text-sm text-zinc-400 font-mono flex items-center gap-2 mt-0.5">
                  @{user.username}
                  <StatusBadge variant={user.role === 'admin' ? 'solid' : 'default'}>{user.role}</StatusBadge>
                </p>
                {user.email && <p className="text-xs text-zinc-500 font-mono mt-1">{user.email}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <button
                onClick={copyProfileLink}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-extrabold rounded-xl flex items-center gap-1.5 font-heading"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
                {copied ? 'Link Copied' : 'Share Profile'}
              </button>
              {user.githubConnected && (
                <span className="px-3.5 py-2 bg-black border border-zinc-700 text-zinc-300 text-xs font-extrabold rounded-xl flex items-center gap-1.5 font-mono">
                  <Github className="h-4 w-4" />
                  GitHub Linked
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Experience" value={`${user.xp.toLocaleString()} XP`} icon={<Trophy className="h-5 w-5" />} />
        <StatTile label="Level" value={`Lv.${levelInfo.level} · ${levelInfo.title}`} icon={<BadgeCheck className="h-5 w-5" />} />
        <StatTile label="Streak" value={`${user.streakDays} days`} icon={<Flame className="h-5 w-5" />} />
        <StatTile label="Completions" value={user.completedLabsCount} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      {/* Level progress */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between text-sm font-mono mb-2">
          <span className="text-zinc-400 font-bold">Progress to next level</span>
          <span className="text-white font-bold">
            {levelInfo.next ? `${user.xp} / ${levelInfo.next} XP` : 'Max level'}
          </span>
        </div>
        <div className="h-2.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-sky-400 rounded-full transition-all duration-700"
            style={{ width: `${levelInfo.progress}%` }}
          />
        </div>
      </div>

      {/* Badges */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
          <Award className="h-5 w-5 text-blue-accent" />
          Earned Badges ({earned.length})
        </h2>
        {earned.length === 0 ? (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-center text-sm text-zinc-500 font-mono">
            Complete your first lab to earn a badge.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {earned.map((badge) => (
              <div key={badge.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-center">
                <div
                  className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-white mb-3"
                  style={{ backgroundColor: badge.color, boxShadow: `0 0 20px ${badge.color}44` }}
                >
                  <Award className="h-7 w-7" />
                </div>
                <p className="text-sm font-bold text-white">{badge.name}</p>
                <p className="text-[11px] font-mono text-zinc-500 mt-1">+{badge.xpBonus} XP</p>
                {badge.earnedAt && (
                  <p className="text-[10px] font-mono text-blue-accent mt-1 flex items-center justify-center gap-1">
                    <Calendar className="h-3 w-3" /> {badge.earnedAt}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Certificates */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-accent" />
          Certificates ({certificates.length})
        </h2>
        {certificates.length === 0 ? (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-center text-sm text-zinc-500 font-mono">
            No certificates issued yet.
          </div>
        ) : (
          <div className="space-y-3">
            {certificates.map((cert) => (
              <div key={cert.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{cert.labTitle}</p>
                  <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                    {cert.certificateNumber} · Issued {cert.issuedAt}
                  </p>
                </div>
                <a
                  href={shareUrl(verifyUrl(cert.certificateNumber))}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 btn-primary-blue text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 font-heading"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Verify
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-blue-accent flex items-center justify-center mb-3">
      {icon}
    </div>
    <p className="text-xl font-black text-white font-heading">{value}</p>
    <p className="text-[11px] font-mono text-zinc-500 uppercase font-bold mt-0.5">{label}</p>
  </div>
);
