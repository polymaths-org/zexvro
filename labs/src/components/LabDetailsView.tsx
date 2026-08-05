import React, { useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Zap,
  Lock,
  Users,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Play,
  Globe,
  EyeOff,
  Award,
  Share2,
  Check,
  GraduationCap,
  ListChecks,
  Target,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Lab, User } from '../types';
import { Button } from './ui/Button';
import { shareUrl, paths } from '../lib/router';

interface LabDetailsViewProps {
  lab: Lab;
  user: User;
  onBack: () => void;
  onStartLab: (lab: Lab) => void;
}

export type LabAccessState = 'open' | 'locked' | 'closed' | 'draft';

export const getLabAccessState = (lab: Lab): LabAccessState => {
  if (lab.status === 'draft' || !lab.isPublished) return 'draft';
  if (lab.status === 'closed') return 'closed';
  if (lab.password || lab.accessCode) return 'locked';
  return 'open';
};

export const LabDetailsView: React.FC<LabDetailsViewProps> = ({ lab, user, onBack, onStartLab }) => {
  const state = getLabAccessState(lab);
  const enrolled = lab.enrolledCount ?? lab.completions ?? 0;
  const isAdmin = user.role === 'admin';
  const [copied, setCopied] = useState(false);

  const copyLabLink = async () => {
    await navigator.clipboard.writeText(shareUrl(paths.lab(lab.slug || lab.id)));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pages = lab.pages && lab.pages.length > 0 ? lab.pages : [];
  const allTasks = pages.length ? pages.flatMap((p) => p.elements) : lab.tasks;
  const tasks = allTasks.filter((t) => (t.type || 'task') === 'task');
  const steps = allTasks.filter((t) => (t.type || 'task') === 'task' || t.type === 'repo');
  const learnGoals = [...tasks.map((t) => t.title).filter(Boolean)].slice(0, 6);

  const stateMeta: Record<LabAccessState, { label: string; cls: string; icon: React.ReactNode }> = {
    open: {
      label: 'Open',
      cls: 'bg-emerald-950/60 border-emerald-700 text-emerald-300',
      icon: <Globe className="h-3.5 w-3.5" />,
    },
    locked: {
      label: 'Locked · Access Code',
      cls: 'bg-blue-950/60 border-blue-800 text-blue-300',
      icon: <Lock className="h-3.5 w-3.5" />,
    },
    closed: {
      label: 'Closed',
      cls: 'bg-red-950/60 border-red-800 text-red-300',
      icon: <EyeOff className="h-3.5 w-3.5" />,
    },
    draft: {
      label: 'Draft',
      cls: 'bg-amber-950/60 border-amber-800 text-amber-300',
      icon: <Award className="h-3.5 w-3.5" />,
    },
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 text-zinc-100">
      <div className="flex items-center justify-between">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white font-mono font-bold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Labs
        </motion.button>
        <button
          onClick={copyLabLink}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-extrabold rounded-xl font-heading transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
          {copied ? 'Link Copied' : 'Share Lab'}
        </button>
      </div>

      {/* Hero: square banner left, title right */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-6 p-5 sm:p-7">
          {/* Square image */}
          <div className="w-full sm:w-56 lg:w-64 shrink-0">
            <div className="aspect-square w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 relative">
              {lab.bannerUrl ? (
                <img src={lab.bannerUrl} alt={lab.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px] opacity-20" />
              )}
              <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 bg-black/70 border border-zinc-700 text-zinc-200 text-[10px] font-mono font-bold rounded-md uppercase">
                  {lab.category}
                </span>
              </div>
              <div className="absolute bottom-2 right-2">
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md border uppercase flex items-center gap-1.5 backdrop-blur-sm ${stateMeta[state].cls}`}
                >
                  {stateMeta[state].icon}
                  {stateMeta[state].label}
                </span>
              </div>
            </div>
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border uppercase ${stateMeta[state].cls}`}>
                {stateMeta[state].icon}
                {stateMeta[state].label}
              </span>
              <span className="text-[11px] font-mono text-zinc-400 font-bold uppercase">{lab.difficulty}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-heading leading-tight">
              {lab.title}
            </h1>
            <p className="text-sm text-zinc-400 mt-2 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-blue-accent" />
                {enrolled.toLocaleString()} enrolled
              </span>
              <span className="text-zinc-600">•</span>
              <span>{steps.length} steps</span>
              <span className="text-zinc-600">•</span>
              <span>by {lab.author}</span>
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-xs text-zinc-200 font-bold">
                <Clock className="h-3.5 w-3.5 text-blue-accent" />
                {lab.timeLimitMinutes ? `${lab.timeLimitMinutes} min` : 'Unlimited'}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-soft border border-blue-900/60 rounded-xl font-mono text-xs text-blue-accent font-bold">
                <Zap className="h-3.5 w-3.5" />+{lab.xpReward} XP
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl font-mono text-xs text-zinc-200 font-bold">
                <Award className="h-3.5 w-3.5 text-blue-accent" />
                {lab.badgeName || 'ZEXVRO Skill Badge'}
              </span>
            </div>
          </div>
        </div>

        {/* Meta strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-zinc-800 border-t border-zinc-800">
          <MetaCell icon={<Clock className="h-3.5 w-3.5" />} label="Duration" value={lab.timeLimitMinutes ? `${lab.timeLimitMinutes} min` : 'Unlimited'} />
          <MetaCell icon={<Zap className="h-3.5 w-3.5" />} label="XP Reward" value={`+${lab.xpReward} XP`} accent />
          <MetaCell icon={<Layers className="h-3.5 w-3.5" />} label="Content" value={pages.length ? `${pages.length} pages` : `${steps.length} steps`} />
          <MetaCell icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Completions" value={(lab.completions || 0).toLocaleString()} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-accent" />
              About this lab
            </h2>
            <p className="text-[15px] text-zinc-300 leading-relaxed">{lab.description}</p>

            {lab.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {lab.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-blue-300 text-xs font-mono font-bold rounded-lg"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-zinc-800/70 flex flex-wrap gap-6 text-sm font-mono text-zinc-400">
              <span>Author: <span className="text-white font-bold">{lab.author}</span></span>
              <span>Updated: <span className="text-white font-bold">{lab.updatedAt}</span></span>
              <span>Credential: <span className="text-blue-accent font-bold">{lab.badgeName || 'ZEXVRO Skill Badge'}</span></span>
            </div>
          </div>

          {/* What you'll learn */}
          {learnGoals.length > 0 && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-accent" />
                What you'll learn
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {learnGoals.map((goal, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-zinc-200 leading-snug">{goal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Curriculum outline */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-blue-accent" />
              Lab curriculum
            </h2>
            {pages.length > 0 ? (
              <div className="space-y-3">
                {pages.map((page, i) => {
                  const pageTasks = page.elements.filter((e) => (e.type || 'task') === 'task' || e.type === 'repo');
                  return (
                    <div key={page.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-soft border border-blue-900/60 text-blue-accent flex items-center justify-center font-mono text-xs font-black shrink-0">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">{page.title || `Page ${i + 1}`}</p>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">
                          {pageTasks.length} {pageTasks.length === 1 ? 'step' : 'steps'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2.5">
                {tasks.map((t, i) => (
                  <div key={t.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-soft border border-blue-900/60 text-blue-accent flex items-center justify-center font-mono text-xs font-black shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-zinc-200 pt-1.5">{t.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Start CTA */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 h-fit lg:sticky lg:top-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-soft border border-blue-900/60 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-blue-accent" />
            </div>
            <div>
              <p className="text-sm font-bold text-white font-heading">
                {state === 'open' ? 'Ready to start' : state === 'locked' ? 'Requires access code' : state === 'closed' ? 'Lab closed' : 'Not published yet'}
              </p>
              <p className="text-xs text-zinc-500 font-mono">
                {state === 'open'
                  ? 'Begin this hands-on web3 lab now'
                  : state === 'locked'
                  ? 'An access code is required to enter'
                  : 'This lab is not available to students'}
              </p>
            </div>
          </div>

          {isAdmin && state === 'draft' && (
            <p className="text-xs text-amber-300 font-mono bg-amber-950/40 border border-amber-800 rounded-xl p-3">
              You are viewing a draft. Publish it from the Management panel to make it live.
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={state === 'closed'}
            icon={<Play className="h-4 w-4 fill-current" />}
            onClick={() => onStartLab(lab)}
          >
            {state === 'locked' ? 'Enter Access Code' : 'Start Lab'}
          </Button>

          {state === 'locked' && (
            <p className="text-xs text-zinc-500 font-mono text-center">
              You will be asked for the code after clicking Start.
            </p>
          )}

          <div className="pt-3 border-t border-zinc-800 text-center">
            <button
              onClick={copyLabLink}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white font-bold transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? 'Link copied!' : 'Copy shareable lab link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetaCell: React.FC<{ icon: React.ReactNode; label: string; value: string; accent?: boolean }> = ({
  icon,
  label,
  value,
  accent,
}) => (
  <div className="p-4 sm:p-5">
    <p className="text-[10px] font-mono text-zinc-500 uppercase font-bold flex items-center gap-1">
      {icon} {label}
    </p>
    <p className={`text-sm font-bold mt-1 ${accent ? 'text-blue-accent' : 'text-white'}`}>{value}</p>
  </div>
);
