import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Zap,
  HelpCircle,
  Send,
  Loader2,
  Check,
  Flag,
  ShieldCheck,
  Award,
  ChevronRight,
  Terminal,
  GitFork,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Lab, LabTask, LabPage, User, LabRunProgress, Submission } from '../types';
import { renderContentElement, CodeBlockElement, PromptBuilderElement, InputElement } from './ui/ContentElements';
import { api } from '../lib/api';
import { CredentialBadgeArt, credentialBadgeName } from './BadgeArt';

interface LabRunnerViewProps {
  lab: Lab;
  user: User;
  progress?: LabRunProgress;
  onProgressChange: (patch: Partial<LabRunProgress>) => void;
  onExitLab: () => void;
  onLabCompleted: (lab: Lab, xpEarned: number) => void;
  onAwardBadge?: (labId: string) => number;
  onAddSubmission?: (submission: Submission) => void;
}

export const LabRunnerView: React.FC<LabRunnerViewProps> = ({
  lab,
  user,
  progress,
  onProgressChange,
  onExitLab,
  onLabCompleted,
  onAwardBadge,
  onAddSubmission,
}) => {
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [flagInputs, setFlagInputs] = useState<Record<string, string>>({});
  const [flagErrors, setFlagErrors] = useState<Record<string, string>>({});
  const [repoInputs, setRepoInputs] = useState<Record<string, string>>({});
  const [repoSubmitted, setRepoSubmitted] = useState<Record<string, boolean>>({});
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showIncompleteHint, setShowIncompleteHint] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const completedTaskIds = progress?.completedTaskIds || [];

  const hasTimeLimit = !!lab.timeLimitMinutes;
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(
    progress?.timeLeftSeconds != null ? progress.timeLeftSeconds : lab.timeLimitMinutes ? lab.timeLimitMinutes * 60 : null,
  );

  const pages: LabPage[] = (lab.pages && lab.pages.length > 0) ? lab.pages : [];
  const singleElements: LabTask[] = pages.length === 0 ? lab.tasks : [];

  // Compute per-page locked state from progression rules. A page is locked if
  // any unlock-next-page rule targets it and its source task isn't completed.
  const ruleLocks: Record<string, boolean> = {};
  if (Array.isArray(lab.rules)) {
    for (const rule of lab.rules) {
      if (rule.type !== 'unlock-next-page-on-task') continue;
      const sourceIdx = pages.findIndex((p) => p.id === rule.sourcePageId);
      const target = pages[sourceIdx + 1];
      if (!target) continue;
      if (!completedTaskIds.includes(rule.sourceTaskId)) {
        ruleLocks[target.id] = true;
      }
    }
  }
  const isPageLocked = (pageId: string) => !!ruleLocks[pageId];

  const currentPageId = progress?.currentPageId || pages[0]?.id || null;
  const activePage = pages.find((p) => p.id === currentPageId) || null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentPageId]);
  const visibleElements = activePage ? activePage.elements : singleElements;

  const verifiableTasks = (pages.length ? pages.flatMap((p) => p.elements) : lab.tasks).filter(
    (t) => (t.type || 'task') === 'task',
  );
  const completionPercent =
    verifiableTasks.length === 0
      ? 100
      : Math.round((completedTaskIds.length / verifiableTasks.length) * 100);

  useEffect(() => {
    if (!hasTimeLimit) return;
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev === null || prev <= 0) return prev;
        const next = prev - 1;
        onProgressChange({ timeLeftSeconds: next });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [hasTimeLimit]);

  const triggerConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#ffffff', '#dbeafe'],
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Tasks are one-way: once completed they stay completed (cannot be undone).
  const setTaskCompleted = (taskId: string, completed: boolean) => {
    if (!completed) return;
    const next = completedTaskIds.includes(taskId) ? completedTaskIds : [...completedTaskIds, taskId];
    onProgressChange({ completedTaskIds: next });

    if (completed) {
      // Small burst on every task checked so the learner FEELS the effect
      // without leaving the lab.
      confetti({
        particleCount: 30,
        spread: 55,
        startVelocity: 25,
        origin: { y: 0.75 },
        colors: ['#3b82f6', '#60a5fa', '#ffffff'],
        disableForReducedMotion: true,
      });

      // If this lab's badge is granted after THIS specific task completes,
      // award it eagerly (idempotent — the badge is only ever earned once).
      if (lab.credential?.awardOn === `task:${taskId}`) {
        const bonus = onAwardBadge?.(lab.id) || 0;
        if (bonus > 0) {
          confetti({
            particleCount: 60,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#3b82f6', '#ffffff'],
            disableForReducedMotion: true,
          });
        }
      }
    }

    if (completed && next.length === verifiableTasks.length && verifiableTasks.length > 0) {
      triggerConfetti();
      // Show the badge-earned celebration WITHOUT leaving the lab — the
      // learner can keep working or claim their badge when ready.
      setTimeout(() => setShowCompletionModal(true), 500);
    }
  };

  const handleVerifyFlag = async (task: LabTask) => {
    const answer = (flagInputs[task.id] || '').trim();
    if (!answer) {
      setFlagErrors((prev) => ({ ...prev, [task.id]: 'Enter the flag / secret answer first.' }));
      return;
    }
    setVerifyingTaskId(task.id);
    try {
      const result = await api.verifyTask({ labId: lab.id, taskId: task.id, flag: answer });
      if (!result) {
        setFlagErrors((prev) => ({ ...prev, [task.id]: 'Could not verify. Please try again.' }));
      } else if (result.passed) {
        setFlagErrors((prev) => ({ ...prev, [task.id]: '' }));
        setTaskCompleted(task.id, true);
      } else {
        setFlagErrors((prev) => ({ ...prev, [task.id]: 'Incorrect flag. Check the lab content and try again.' }));
      }
    } finally {
      setVerifyingTaskId(null);
    }
  };

  const handleVerifyCode = async (task: LabTask) => {
    const output = (flagInputs[task.id] || '').trim();
    if (!output) {
      setFlagErrors((prev) => ({ ...prev, [task.id]: 'Paste your code/output first.' }));
      return;
    }
    // Code tasks accept whatever the learner shares — no strict output match.
    // The output is recorded as a submission so admins can review it.
    setVerifyingTaskId(task.id);
    try {
      const submission: Submission = {
        id: `sub_${Date.now()}`,
        labId: lab.id,
        userId: user.id,
        userName: user.name || user.username,
        labTitle: lab.title,
        status: 'for_review',
        score: 0,
        submittedAt: new Date().toISOString(),
        reviewNote: `Output shared: ${output.slice(0, 200)}${output.length > 200 ? '…' : ''}`,
        type: 'lab',
      };
      onAddSubmission?.(submission);
      await api.createSubmission({
        labId: lab.id,
        labTitle: lab.title,
        reviewNote: output.slice(0, 400),
        status: 'for_review',
      });
      setTaskCompleted(task.id, true);
    } catch {
      setFlagErrors((prev) => ({
        ...prev,
        [task.id]: 'Could not save your submission. Try again.',
      }));
    } finally {
      setVerifyingTaskId(null);
    }
  };

  const handleSubmitRepo = (task: LabTask) => {
    const url = (repoInputs[task.id] || '').trim();
    if (!url) {
      setFlagErrors((prev) => ({ ...prev, [task.id]: 'Paste your repository link first.' }));
      return;
    }
    const submission: Submission = {
      id: `sub_${Date.now()}`,
      labId: lab.id,
      userId: user.id,
      userName: user.name || user.username,
      labTitle: lab.title,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      repoUrl: url,
      type: 'repo',
    };
    onAddSubmission?.(submission);
    api.createSubmission({
      labId: lab.id,
      labTitle: lab.title,
      repoUrl: url,
      type: 'repo',
      status: 'for_review',
    }).catch(() => {});
    setRepoSubmitted((prev) => ({ ...prev, [task.id]: true }));
    setTaskCompleted(task.id, true);
  };

  const renderTaskCard = (task: LabTask, idx: number) => {
    const isDone = completedTaskIds.includes(task.id);
    const flagType = task.flagType || 'checkbox';

    return (
      <motion.div
        layout
        key={task.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`p-5 sm:p-6 rounded-2xl border transition-all ${
          isDone
            ? 'bg-zinc-900/60 border-blue-900'
            : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'
        }`}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Real checkbox — checked tasks stay checked, they cannot be unchecked.
              Flag/code tasks cannot be checked by hand: they complete only once
              the submitted flag/output is verified. */}
          <motion.button
            role="checkbox"
            aria-checked={isDone}
            aria-label={`Mark task complete: ${task.title}`}
            onClick={() => {
              if (isDone) return;
              if (flagType === 'flag' || flagType === 'code') return;
              setTaskCompleted(task.id, true);
            }}
            whileTap={{ scale: 0.85 }}
            className={`mt-0.5 w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all ${
              isDone
                ? 'bg-blue-600 border-blue-600 text-white'
                : flagType === 'flag' || flagType === 'code'
                  ? 'border-zinc-700 cursor-not-allowed opacity-60'
                  : 'border-zinc-600 hover:border-blue-400 text-transparent'
            }`}
          >
            <motion.span
              initial={false}
              animate={{ scale: isDone ? 1 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Check className="h-4 w-4" strokeWidth={3} />
            </motion.span>
          </motion.button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={`text-sm font-bold font-heading ${isDone ? 'text-zinc-500 line-through' : 'text-white'}`}>
                {task.title}
              </h4>
              <span className="px-2 py-0.5 bg-blue-soft border border-blue-900/50 text-blue-accent text-[10px] font-mono font-bold rounded-md uppercase">
                {flagType === 'flag' ? 'Flag' : flagType === 'code' ? 'Code' : 'Step'}
              </span>
              {isDone && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-[10px] bg-blue-600 text-white font-mono font-bold px-2 py-0.5 rounded-md uppercase"
                >
                  Done
                </motion.span>
              )}
            </div>
            <p className="text-sm text-zinc-300 mt-2 leading-relaxed">{task.description}</p>

            {task.hint && (
              <div className="mt-4 p-3.5 bg-zinc-900/70 border border-zinc-800 rounded-xl text-xs text-zinc-400 flex items-start gap-2.5 font-mono">
                <HelpCircle className="h-3.5 w-3.5 text-blue-accent shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-bold">Hint: </span>
                  <span>{task.hint}</span>
                </div>
              </div>
            )}

            {/* Flag input for 'flag' type */}
            {flagType === 'flag' && !isDone && (
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-3 py-2.5 font-mono">
                  <Flag className="h-3.5 w-3.5 text-blue-accent shrink-0" />
                  <input
                    type="text"
                    value={flagInputs[task.id] || ''}
                    onChange={(e) => setFlagInputs((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyFlag(task)}
                    placeholder="Enter the flag / secret answer"
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => handleVerifyFlag(task)}
                  disabled={verifyingTaskId === task.id}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 font-heading disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verifyingTaskId === task.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {verifyingTaskId === task.id ? 'Checking…' : 'Check'}
                </button>
              </div>
            )}

            {/* Code output input for 'code' type */}
            {flagType === 'code' && !isDone && (
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-3 py-2.5 font-mono">
                  <Terminal className="h-3.5 w-3.5 text-blue-accent shrink-0" />
                  <input
                    type="text"
                    value={flagInputs[task.id] || ''}
                    onChange={(e) => setFlagInputs((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode(task)}
                    placeholder="Share your code / command output"
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => handleVerifyCode(task)}
                  disabled={verifyingTaskId === task.id}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 font-heading"
                >
                  {verifyingTaskId === task.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Submit
                </button>
              </div>
            )}

            {/* Plain checkbox task: show a check button too */}
            {flagType === 'checkbox' && !isDone && task.verificationCommand && (
              <button
                onClick={() => setTaskCompleted(task.id, true)}
                className="mt-4 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-extrabold rounded-xl flex items-center gap-1.5 font-heading"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-accent" />
                Mark Complete
              </button>
            )}

            {/* Repo submission */}
            {flagType === 'repo' && !isDone && !repoSubmitted[task.id] && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-3 py-2.5 font-mono">
                  <GitFork className="h-3.5 w-3.5 text-blue-accent shrink-0" />
                  <input
                    type="text"
                    value={repoInputs[task.id] || ''}
                    onChange={(e) => setRepoInputs((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitRepo(task)}
                    placeholder={task.repoHint || 'https://github.com/you/your-project'}
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => handleSubmitRepo(task)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 font-heading"
                >
                  <GitFork className="h-3.5 w-3.5" />
                  Connect & Submit Repo
                </button>
              </div>
            )}

            {flagErrors[task.id] && (
              <p className="mt-2 text-xs text-red-400 font-mono flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                {flagErrors[task.id]}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderRepoElement = (task: LabTask) => {
    const isDone = completedTaskIds.includes(task.id) || repoSubmitted[task.id];
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-5 rounded-2xl border transition-all ${
          isDone ? 'bg-zinc-900/60 border-blue-900' : 'bg-zinc-950 border-zinc-800'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-6 h-6 shrink-0 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <GitFork className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-white font-heading">{task.title || 'Submit your repository'}</h4>
              <span className="px-2 py-0.5 bg-blue-soft border border-blue-900/50 text-blue-accent text-[10px] font-mono font-bold rounded-md uppercase">
                Repo
              </span>
            </div>
            <p className="text-sm text-zinc-300 mt-1.5 leading-relaxed">{task.description}</p>

            {!isDone ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-3 py-2 font-mono">
                  <GitFork className="h-3.5 w-3.5 text-blue-accent shrink-0" />
                  <input
                    type="text"
                    value={repoInputs[task.id] || ''}
                    onChange={(e) => setRepoInputs((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitRepo(task)}
                    placeholder={task.repoHint || 'https://github.com/you/your-project'}
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => handleSubmitRepo(task)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl flex items-center gap-1.5 font-heading"
                >
                  <GitFork className="h-3.5 w-3.5" />
                  Connect & Submit Repo
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400 font-mono">
                <CheckCircle2 className="h-4 w-4" />
                <span>Repository submitted for review.</span>
                {repoInputs[task.id] && (
                  <a
                    href={repoInputs[task.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 text-blue-accent hover:text-white flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" /> view
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderElement = (el: LabTask, idx: number) => {
    const elType = el.type || 'task';

    if (elType === 'repo') return renderRepoElement(el);
    if (elType === 'heading') {
      return (
        <div key={el.id} className="pt-2">
          <h4 className="text-xl font-extrabold text-white font-heading">{el.title}</h4>
          {el.description && el.description !== el.title && (
            <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{el.description}</p>
          )}
        </div>
      );
    }
    if (elType === 'text') {
      return (
        <div key={el.id} className="py-1">
          <p className="text-[15px] text-zinc-200 leading-relaxed">
            {el.title && <span className="font-bold text-white">{el.title} </span>}
            {el.description}
          </p>
        </div>
      );
    }
    if (elType === 'code') {
      return <div key={el.id}><CodeBlockElement task={el} /></div>;
    }
    if (elType === 'prompt-builder') {
      return <div key={el.id}><PromptBuilderElement task={el} labId={lab.id} userId={user.id} /></div>;
    }
    if (elType === 'input') {
      return (
        <div key={el.id}>
          <InputElement
            task={el}
            labId={lab.id}
            labTitle={lab.title}
            userName={user.name || user.username}
            userId={user.id}
            onAddSubmission={onAddSubmission}
          />
        </div>
      );
    }

    const rendered = renderContentElement(el);
    if (rendered && elType !== 'task') {
      return <div key={el.id}>{rendered}</div>;
    }

    return renderTaskCard(el, idx);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] bg-black text-zinc-100 overflow-hidden font-sans">
      {/* Top Workbench Navbar */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-3 sm:px-4 py-3 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onExitLab}
            className="p-2 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-sm font-mono font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </motion.button>
          <div className="hidden sm:block h-5 w-[1px] bg-zinc-800" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="hidden md:inline-block px-2 py-0.5 bg-blue-soft border border-blue-900/60 text-blue-accent text-[11px] font-mono font-bold rounded-md uppercase">
              {lab.category}
            </span>
            <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[40vw] sm:max-w-xs md:max-w-md font-heading">
              {lab.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-2 font-mono text-xs">
            <span className="text-zinc-400 font-bold">Progress:</span>
            <div className="w-28 h-2 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-500"
                animate={{ width: `${completionPercent}%` }}
              />
            </div>
            <span className="text-white font-bold">{completionPercent}%</span>
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 sm:px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm text-zinc-200 font-bold">
            <Clock className="h-4 w-4 text-blue-accent" />
            {hasTimeLimit ? <span>{formatTime(timeLeftSeconds || 0)}</span> : <span>Unlimited</span>}
          </div>

          <AnimatePresence>
            {showIncompleteHint && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="hidden sm:block px-3 py-2 bg-amber-950/60 border border-amber-800 rounded-xl text-amber-200 text-xs font-mono font-bold"
              >
                Complete all tasks ({verifiableTasks.length - completedTaskIds.length} left) to earn your certificate & badge.
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (completionPercent >= 100) {
                onLabCompleted(lab, lab.xpReward);
                onExitLab();
              } else {
                setShowIncompleteHint(true);
                setTimeout(() => setShowIncompleteHint(false), 3200);
              }
            }}
            className="px-2.5 sm:px-4 py-2 btn-primary-blue text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center gap-1 sm:gap-1.5 font-heading"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline">Submit Lab</span>
          </motion.button>
        </div>
      </div>

      {/* Centered content column — wider so the lab fills the screen, not thin gaps */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-8">
          {/* Lab intro card — shown only on the first page, with the 1:1 banner */}
          {(() => {
            const pageIdx = pages.findIndex((p) => p.id === currentPageId);
            const isFirstPage = pageIdx <= 0;
            return isFirstPage ? (
              <div className="panel-blue bg-zinc-950 border border-zinc-800 p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row gap-5">
                <div className="w-full sm:w-40 lg:w-48 shrink-0">
                  <div className="aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
                    {lab.bannerUrl ? (
                      <img src={lab.bannerUrl} alt={lab.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px] opacity-20" />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white font-heading">Lab Overview</h3>
                  <p className="text-[15px] text-zinc-300 leading-relaxed mt-2 whitespace-pre-line line-clamp-4">
                    {lab.description}
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-mono text-zinc-400 font-bold">
                    <span>Author: {lab.author}</span>
                    <span className="flex items-center gap-1 text-blue-accent">
                      <Zap className="h-4 w-4" />+ {lab.xpReward} XP
                    </span>
                    <span>
                      {lab.timeLimitMinutes ? `${lab.timeLimitMinutes} min` : 'No time limit'}
                    </span>
                  </div>
                </div>
              </div>
            ) : null;
          })()}

          {/* Page tabs */}
          {pages.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0">
              {pages.map((page, i) => {
                const active = page.id === currentPageId;
                const locked = isPageLocked(page.id);
                return (
                  <button
                    key={page.id}
                    onClick={() => !locked && onProgressChange({ currentPageId: page.id })}
                    disabled={locked}
                    title={locked ? 'Complete the task on the previous page to unlock this page' : undefined}
                    className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all font-heading flex items-center gap-1.5 sm:gap-2 ${
                      active
                        ? 'bg-blue-600 text-white shadow-md'
                        : locked
                        ? 'bg-zinc-950 text-zinc-600 border border-zinc-800 cursor-not-allowed opacity-70'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                  >
                    <span className="text-[10px] sm:text-xs">{i + 1}</span>
                    {locked ? <Lock className="h-3 w-3" /> : null}
                    <span className="max-w-[28vw] sm:max-w-none truncate">{page.title || `Page ${i + 1}`}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Animated page content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPageId || 'single'}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {/* Page title as heading */}
              {activePage && (
                <div className="mb-6">
                  <h3 className="text-2xl font-black text-white font-heading">{activePage.title || 'Lab Content'}</h3>
                  <div className="h-px bg-zinc-800 mt-3" />
                </div>
              )}

              {/* Elements */}
              <div className="space-y-5">
                {visibleElements.map((el, idx) => renderElement(el, idx))}

                {visibleElements.length === 0 && (
                  <div className="text-center py-12 text-zinc-500 text-sm font-mono">
                    This lab has no content yet.
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Next page navigation */}
          {pages.length > 1 && activePage && (
            <div className="flex items-center justify-between gap-2 pt-4 mt-8 border-t border-zinc-800">
              {(() => {
                const pageIdx = pages.findIndex((p) => p.id === currentPageId);
                const next = pages[pageIdx + 1];
                const prev = pages[pageIdx - 1];
                const nextLocked = next ? isPageLocked(next.id) : false;
                return (
                  <>
                    {prev ? (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onProgressChange({ currentPageId: prev.id })}
                        className="flex items-center gap-1 text-xs sm:text-sm text-zinc-400 hover:text-white font-bold font-mono px-2 sm:px-0 py-2"
                      >
                        <ChevronRight className="h-4 w-4 rotate-180" />
                        <span className="hidden sm:inline">Previous</span>
                      </motion.button>
                    ) : <span />}
                    <span className="text-[10px] sm:text-xs font-mono text-zinc-500">
                      Page {pageIdx + 1} of {pages.length}
                    </span>
                    {next ? (
                      nextLocked ? (
                        <div
                          className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-zinc-900 text-zinc-500 border border-zinc-800 text-xs sm:text-sm font-bold rounded-xl font-mono cursor-not-allowed"
                          title="Complete the task on this page to unlock the next"
                        >
                          <Lock className="h-4 w-4" />
                          <span className="hidden sm:inline">{next.title}</span>
                          <span className="sm:hidden">Next</span>
                        </div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => onProgressChange({ currentPageId: next.id })}
                          className="flex items-center gap-1 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl font-mono"
                        >
                          <span className="hidden sm:inline">Next: {next.title}</span>
                          <span className="sm:hidden">Next</span>
                          <motion.span
                            animate={{ x: [0, 4, 0] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </motion.span>
                        </motion.button>
                      )
                    ) : (
                      <button
                        onClick={() => {
                          if (completionPercent >= 100) onLabCompleted(lab, lab.xpReward);
                          else {
                            setShowIncompleteHint(true);
                            setTimeout(() => setShowIncompleteHint(false), 3200);
                          }
                        }}
                        className="flex items-center gap-1 px-3 sm:px-4 py-2 btn-primary-blue text-white text-xs sm:text-sm font-bold rounded-xl font-mono"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Finish Lab</span>
                        <span className="sm:hidden">Finish</span>
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Completion Celebration Modal — shows the earned badge without exiting */}
      <AnimatePresence>
        {showCompletionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="relative w-full max-w-lg bg-zinc-950 border border-blue-900 rounded-3xl p-5 sm:p-8 text-center shadow-[0_0_50px_rgba(59,130,246,0.25)]"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-4 shadow-lg ring-2 ring-blue-500/50">
                {lab.credential?.badge ? (
                  <CredentialBadgeArt badge={lab.credential.badge} className="w-full h-full" />
                ) : lab.badgeIconUrl ? (
                  <img src={lab.badgeIconUrl} alt={credentialBadgeName(lab)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-600 to-sky-400 text-white flex items-center justify-center animate-bounce font-extrabold">
                    <Award className="h-8 w-8" />
                  </div>
                )}
              </div>

              <span className="text-xs font-mono font-bold text-white uppercase tracking-widest bg-blue-600 px-3 py-1 rounded-md">
                {credentialBadgeName(lab).toUpperCase()} UNLOCKED • {completionPercent}% SCORE
              </span>

              <h2 className="text-2xl font-black text-white mt-4 font-heading">{lab.title}</h2>
              <p className="text-sm text-zinc-300 mt-2">
                You finished every task! You earned{' '}
                <span className="text-blue-accent font-extrabold font-mono">+{lab.xpReward} XP</span>
                {' '}and unlocked the <span className="text-white font-bold">{credentialBadgeName(lab)}</span> badge.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {completionPercent < 100 ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCompletionModal(false)}
                    className="py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-extrabold text-sm rounded-xl transition-all font-heading"
                  >
                    Keep Working
                  </motion.button>
                ) : (
                  <div className="flex flex-col justify-center text-[11px] font-mono text-emerald-400 font-bold gap-1">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> All tasks completed
                    </span>
                    <span className="text-zinc-500">
                      {lab.credential?.awardCertificate === false
                        ? 'Your score & progress are saved.'
                        : 'Your certificate & badge are ready to claim.'}
                    </span>
                  </div>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onLabCompleted(lab, lab.xpReward);
                    setShowCompletionModal(false);
                    onExitLab();
                  }}
                  className="py-3 btn-primary-blue text-white font-extrabold text-sm rounded-xl transition-all shadow-xl font-heading"
                >
                  Submit Lab & Exit
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
