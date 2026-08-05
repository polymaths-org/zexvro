import React from 'react';
import { 
  Sparkles, 
  Terminal, 
  Flame, 
  Trophy, 
  Award, 
  ArrowRight, 
  Clock, 
  Play, 
  Zap,
  ShieldCheck,
  Compass,
  ChevronRight,
  Users,
  FileCheck,
  Boxes,
  TrendingUp
} from 'lucide-react';
import { motion } from 'motion/react';
import { User, Lab, Badge, Certificate } from '../types';
import { Card } from './ui/Card';
import { StatusBadge, Tag } from './ui/Badge';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';

interface DashboardViewProps {
  user: User;
  labs: Lab[];
  badges: Badge[];
  certificates: Certificate[];
  onStartLab: (lab: Lab) => void;
  onOpenDetails: (lab: Lab) => void;
  onNavigateTab: (tab: 'catalog' | 'student-progress' | 'admin-panel') => void;
}

// Simple level calculator from XP
const getLevel = (xp: number) => {
  if (xp >= 5000) return { level: 5, title: 'Web3 Architect', next: null, progress: 100 };
  if (xp >= 3000) return { level: 4, title: 'Protocol Engineer', next: 5000, progress: ((xp - 3000) / 2000) * 100 };
  if (xp >= 1500) return { level: 3, title: 'Smart Contract Dev', next: 3000, progress: ((xp - 1500) / 1500) * 100 };
  if (xp >= 500) return { level: 2, title: 'Chain Explorer', next: 1500, progress: ((xp - 500) / 1000) * 100 };
  return { level: 1, title: 'Web3 Novice', next: 500, progress: (xp / 500) * 100 };
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  labs,
  badges,
  certificates,
  onStartLab,
  onOpenDetails,
  onNavigateTab,
}) => {
  const featuredLabs = labs.filter((l) => l.featured || l.isPublished).slice(0, 3);
  const earnedBadgesCount = badges.filter((b) => b.earnedAt).length;
  const levelInfo = getLevel(user.xp);

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto text-zinc-100">
      {/* Hero Welcome Banner - Monochrome High-Contrast */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-950 border border-zinc-800 p-6 sm:p-8 lg:p-10 shadow-2xl">
        {/* Decorative Grid Lines & Ambient Glow */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-zinc-100/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight font-heading">
              Welcome back, <span className="underline decoration-zinc-500 underline-offset-4">{user.name}</span>
            </h1>

            <p className="text-zinc-400 text-sm leading-relaxed font-sans">
              Master Solidity, DeFi protocols, NFT engineering, ZK-proofs, and decentralized governance with interactive step-by-step hands-on labs.
            </p>

            {/* Level Progress Bar */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-3 py-1.5 font-mono text-xs">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
                <span className="font-bold text-white">Lv.{levelInfo.level}</span>
                <span className="text-zinc-400">{levelInfo.title}</span>
              </div>
              {levelInfo.next && (
                <div className="flex items-center gap-2 flex-1 max-w-48">
                  <div className="flex-1 h-1.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-700"
                      style={{ width: `${levelInfo.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">{levelInfo.next} XP</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Button
                variant="primary"
                size="lg"
                icon={<Compass className="h-4 w-4" />}
                onClick={() => onNavigateTab('catalog')}
              >
                Explore All Labs
              </Button>
            </div>
          </div>

          {/* Quick Stats Grid - Monochrome */}
          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto shrink-0 font-mono">
            <div className="bg-black border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Experience</span>
              <div className="text-xl font-black text-white flex items-center gap-1.5 mt-1">
                <Trophy className="h-5 w-5 text-zinc-300" />
                <span>{user.xp.toLocaleString()} XP</span>
              </div>
            </div>

            <div className="bg-black border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Daily Streak</span>
              <div className="text-xl font-black text-white flex items-center gap-1.5 mt-1">
                <Flame className="h-5 w-5 text-white animate-pulse" />
                <span>{user.streakDays} Days</span>
              </div>
            </div>

            <div className="bg-black border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Skill Badges</span>
              <div className="text-xl font-black text-white flex items-center gap-1.5 mt-1">
                <Award className="h-5 w-5 text-zinc-300" />
                <span>{earnedBadgesCount} Badges</span>
              </div>
            </div>

            <div className="bg-black border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Certificates</span>
              <div className="text-xl font-black text-white flex items-center gap-1.5 mt-1">
                <ShieldCheck className="h-5 w-5 text-zinc-300" />
                <span>{certificates.length} Issued</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Quick Stats (admin-only) */}
      {user.role === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card padding="sm" className="flex items-center gap-4">
            <div className="p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl">
              <Terminal className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Total Labs</p>
              <p className="text-lg font-black text-white">{labs.length}</p>
            </div>
          </Card>
          <Card padding="sm" className="flex items-center gap-4">
            <div className="p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Students</p>
              <p className="text-lg font-black text-white">—</p>
            </div>
          </Card>
          <Card padding="sm" className="flex items-center gap-4">
            <div className="p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl">
              <FileCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Submissions</p>
              <p className="text-lg font-black text-white">—</p>
            </div>
          </Card>
          <Card padding="sm" className="flex items-center gap-4">
            <div className="p-2.5 bg-zinc-900 border border-zinc-700 rounded-xl">
              <Boxes className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Modules</p>
              <p className="text-lg font-black text-white">—</p>
            </div>
          </Card>
        </div>
      )}

      {/* Recent Badges (if any earned) */}
      {earnedBadgesCount > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 font-heading">
              <Award className="h-4 w-4 text-zinc-300" />
              <span>Recently Earned Badges</span>
            </h2>
            <button
              onClick={() => onNavigateTab('student-progress')}
              className="text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1 transition-colors font-mono"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
            {badges.filter(b => b.earnedAt).slice(0, 4).map(badge => (
              <div key={badge.id} className="shrink-0 bg-zinc-950 border border-zinc-600 rounded-2xl p-4 flex items-center gap-3 min-w-[200px]">
                <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center shrink-0">
                  <Award className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{badge.name}</p>
                  <p className="text-[10px] font-mono text-zinc-400">+{badge.xpBonus} XP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Featured Labs Carousel / Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 font-heading">
              <Terminal className="h-5 w-5 text-zinc-300" />
              <span>Recommended Web3 Labs</span>
            </h2>
            <p className="text-xs text-zinc-400">Step-by-step interactive sandbox labs with live smart contract verification</p>
          </div>
          <button
            onClick={() => onNavigateTab('catalog')}
            className="text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1 transition-colors font-mono"
          >
            <span>View Catalog</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {featuredLabs.length === 0 ? (
          <EmptyState
            title="No labs available yet"
            description="Labs will appear here once published. Check back soon!"
            actionLabel="Explore Catalog"
            onAction={() => onNavigateTab('catalog')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredLabs.map((lab) => (
              <motion.div
                key={lab.id}
                whileHover={{ y: -4 }}
                onClick={() => onOpenDetails(lab)}
                className="group cursor-pointer bg-zinc-950 border border-zinc-800 hover:border-zinc-500 rounded-2xl overflow-hidden flex flex-col transition-all relative"
              >
                <div className="relative aspect-square bg-zinc-900 border-b border-zinc-800">
                  {lab.bannerUrl ? (
                    <img src={lab.bannerUrl} alt={lab.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />
                  )}
                </div>

                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mb-2">
                    <span className="text-white font-bold">{lab.category}</span>
                    <span>•</span>
                    <span>{lab.difficulty}</span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-zinc-200 transition-colors line-clamp-2 leading-snug font-heading">
                    {lab.title}
                  </h3>

                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                    {lab.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {lab.tags.slice(0, 3).map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>

                  <div className="pt-5 mt-4 border-t border-zinc-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-zinc-500" />
                        {lab.timeLimitMinutes ? `${lab.timeLimitMinutes}m` : 'Unlimited'}
                      </span>
                      <span className="flex items-center gap-1 text-white font-bold">
                        <Zap className="h-3.5 w-3.5 text-white" />
                        +{lab.xpReward} XP
                      </span>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Play className="h-3 w-3 fill-current" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartLab(lab);
                      }}
                    >
                      Start Lab
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
