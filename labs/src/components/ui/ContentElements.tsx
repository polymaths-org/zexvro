import React, { useState, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Info,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Quote as QuoteIcon,
  Minus,
  ExternalLink,
  Sparkles,
  Send,
  Lock,
  Loader2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LabTask, CalloutVariant, LabIdea } from '../../types';
import { api } from '../../lib/api';
import { toast } from './Toaster';

// --- Accordion ---
export const AccordionElement: React.FC<{ task: LabTask }> = ({ task }) => {
  const [open, setOpen] = useState(task.accordionOpen ?? false);

  return (
    <div className="border border-zinc-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-900/50 transition-colors"
      >
        <h4 className="text-sm font-bold text-white font-heading">{task.title}</h4>
        {open ? (
          <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-xs text-zinc-300 leading-relaxed border-t border-zinc-800 pt-3">
              {task.description}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Callout / Tip ---
const calloutStyles: Record<CalloutVariant, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
  info: {
    bg: 'bg-blue-950/40',
    border: 'border-blue-800/60',
    icon: <Info className="h-4 w-4 text-blue-400" />,
    label: 'Info',
  },
  tip: {
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-800/60',
    icon: <Lightbulb className="h-4 w-4 text-emerald-400" />,
    label: 'Tip',
  },
  warning: {
    bg: 'bg-amber-950/40',
    border: 'border-amber-800/60',
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    label: 'Warning',
  },
  success: {
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-800/60',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    label: 'Success',
  },
};

export const CalloutElement: React.FC<{ task: LabTask }> = ({ task }) => {
  const variant = task.calloutVariant || 'info';
  const style = calloutStyles[variant];

  return (
    <div className={`${style.bg} ${style.border} border rounded-2xl p-4 flex items-start gap-3`}>
      <div className="shrink-0 mt-0.5">{style.icon}</div>
      <div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">{style.label}</span>
        {task.title && task.title !== style.label && (
          <h4 className="text-sm font-bold text-white mt-0.5">{task.title}</h4>
        )}
        <p className="text-xs text-zinc-300 leading-relaxed mt-1">{task.description}</p>
      </div>
    </div>
  );
};

// --- Image ---
export const ImageElement: React.FC<{ task: LabTask }> = ({ task }) => (
  <div className="rounded-2xl overflow-hidden border border-zinc-800">
    {task.imageUrl ? (
      <img
        src={task.imageUrl}
        alt={task.imageCaption || task.title || 'Lab image'}
        className="w-full h-auto object-cover"
      />
    ) : (
      <div className="w-full h-48 bg-zinc-900 flex items-center justify-center">
        <span className="text-xs text-zinc-600 font-mono">Image not available</span>
      </div>
    )}
    {(task.imageCaption || task.title) && (
      <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-800">
        <p className="text-[11px] text-zinc-400 font-mono">{task.imageCaption || task.title}</p>
      </div>
    )}
  </div>
);

// --- Divider / Spacer ---
export const DividerElement: React.FC = () => (
  <div className="flex items-center gap-3 py-2">
    <div className="flex-1 h-px bg-zinc-800" />
    <Minus className="h-3 w-3 text-zinc-700" />
    <div className="flex-1 h-px bg-zinc-800" />
  </div>
);

// --- Quote ---
export const QuoteElement: React.FC<{ task: LabTask }> = ({ task }) => (
  <div className="border-l-2 border-zinc-600 pl-4 py-2">
    <div className="flex items-start gap-2">
      <QuoteIcon className="h-4 w-4 text-zinc-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm text-zinc-200 italic leading-relaxed">{task.description}</p>
        {task.title && (
          <p className="text-[11px] text-zinc-500 mt-2 font-mono">— {task.title}</p>
        )}
      </div>
    </div>
  </div>
);

// --- Embed (YouTube / Loom / generic) ---
export const EmbedElement: React.FC<{ task: LabTask }> = ({ task }) => {
  const url = task.embedUrl || '';
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const embedSrc = isYouTube
    ? url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
    : url;

  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-800">
      {task.title && (
        <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800">
          <p className="text-xs font-bold text-zinc-300">{task.title}</p>
        </div>
      )}
      {embedSrc ? (
        <div className="aspect-video bg-black">
          <iframe
            src={embedSrc}
            className="w-full h-full"
            allowFullScreen
            title={task.title || 'Embedded content'}
          />
        </div>
      ) : (
        <div className="aspect-video bg-zinc-900 flex items-center justify-center">
          <span className="text-xs text-zinc-600 font-mono">No embed URL provided</span>
        </div>
      )}
    </div>
  );
};

// --- Table ---
export const TableElement: React.FC<{ task: LabTask }> = ({ task }) => {
  const headers = task.tableHeaders || [];
  const rows = task.tableRows || [];

  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-800">
      {task.title && (
        <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800">
          <p className="text-xs font-bold text-zinc-300">{task.title}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          {headers.length > 0 && (
            <thead className="bg-zinc-900 text-zinc-400 uppercase text-[10px] tracking-widest border-b border-zinc-800">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="p-3 font-bold">{h}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
            {rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-zinc-900/40 transition-colors">
                {row.map((cell, ci) => (
                  <td key={ci} className="p-3">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Inline Steps ---
export const StepsElement: React.FC<{ task: LabTask }> = ({ task }) => {
  const steps = task.steps || [];

  return (
    <div className="space-y-3">
      {task.title && (
        <h4 className="text-sm font-bold text-white font-heading">{task.title}</h4>
      )}
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3 pl-1">
          <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[10px] font-mono font-bold text-white">{i + 1}</span>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-100">{step.title}</p>
            {step.description && (
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{step.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Redirect Button ---
export const RedirectElement: React.FC<{ task: LabTask }> = ({ task }) => {
  const color = task.buttonColor || '#2563eb';
  const url = task.redirectUrl || '#';

  return (
    <div className="border border-zinc-800 rounded-2xl p-5 bg-zinc-950/60 space-y-3 text-center">
      {task.title && (
        <h4 className="text-sm font-bold text-white font-heading">{task.title}</h4>
      )}
      {task.description && (
        <p className="text-xs text-zinc-400 leading-relaxed">{task.description}</p>
      )}
      <a
        href={url}
        target={url.startsWith('#') ? undefined : '_blank'}
        rel="noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold text-white font-heading shadow-lg transition-transform hover:scale-[1.03] active:scale-95"
        style={{ backgroundColor: color }}
      >
        {task.title || 'Open link'}
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
};

// --- Enhanced Code Block (collapsed by default, expandable, copy) ---
export const CodeBlockElement: React.FC<{ task: LabTask }> = ({ task }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lines = (task.description || '').split('\n');
  const collapsedLines = 4;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(task.description || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900 border-b border-zinc-800 text-xs font-mono">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors font-bold min-w-0"
          title={expanded ? 'Collapse code' : 'Expand code'}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-blue-accent shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-blue-accent shrink-0" />
          )}
          <span className="truncate">{task.language || 'code'}</span>
          {task.title && <span className="text-zinc-500 truncate">• {task.title}</span>}
          <span className="text-[10px] text-zinc-500 shrink-0">
            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </span>
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-zinc-800 text-zinc-300 font-bold shrink-0"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="relative">
        <div className={`overflow-x-auto ${expanded ? '' : 'max-h-40'}`}>
          <table className="w-full">
            <tbody>
              {(expanded ? lines : lines.slice(0, collapsedLines)).map((line, i) => (
                <tr key={i} className="leading-relaxed">
                  <td className="text-[10px] text-zinc-600 font-mono pr-4 select-none text-right w-8 align-top border-r border-zinc-800/60">
                    {i + 1}
                  </td>
                  <td className="text-sm text-zinc-100 font-mono whitespace-pre-wrap px-3 py-0.5">
                    {line || '\u00A0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!expanded && lines.length > collapsedLines && (
          <>
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
            <button
              onClick={() => setExpanded(true)}
              className="absolute bottom-2 inset-x-0 mx-auto w-fit px-3 py-1 text-[11px] font-bold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg font-mono"
            >
              Expand all ({lines.length} lines)
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// --- Prompt Builder (interactive) ---
// Lets a learner enter a project name + description (or pull a curated random
// idea from the lab idea pool), then generates the lab's custom prompt with the
// details injected. Once a prompt is generated from a random idea, that idea is
// marked "taken" so it's never offered to another student, and the learner's
// choice is locked.
const PROMPT_PLACEHOLDER = '___STUDENT_PROJECT_DETAILS___';

export const PromptBuilderElement: React.FC<{
  task: LabTask;
  labId: string;
  userId: string;
}> = ({ task, labId, userId }) => {
  const template = task.description || task.title || '';
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState('');
  const chosenIdeaIdRef = useRef<string | null>(null);

  const applyIdea = (idea: LabIdea) => {
    chosenIdeaIdRef.current = idea.id;
    setProjectTitle(idea.title);
    setProjectDesc(idea.description);
  };

  const handleRandomIdea = async () => {
    setBusy(true);
    setNotice('');
    try {
      const data = await api.fetchLabIdeas();
      const pool = (data?.ideas || []).filter((i: LabIdea) => i.labId === labId && !i.takenBy);
      if (pool.length === 0) {
        setNotice('No project ideas available right now — feel free to enter your own.');
      } else {
        applyIdea(pool[Math.floor(Math.random() * pool.length)]);
        setNotice('');
      }
    } catch {
      setNotice('Could not load ideas. Enter your own project below.');
    } finally {
      setBusy(false);
    }
  };

  const generatePrompt = async () => {
    const title = projectTitle.trim();
    const desc = projectDesc.trim();
    if (!title || !desc) {
      setNotice('Enter both a project name and a description (or tap "Get Random Idea").');
      return;
    }
setGenerating(true);
    const projectDetails = `Project name: ${title}\nProject description: ${desc}`;
    let compiled = template.includes(PROMPT_PLACEHOLDER)
      ? template.replace(PROMPT_PLACEHOLDER, projectDetails)
      : template;
    // Also fill the inline "PROJECT TITLE + DESCRIPTION HERE" hint if present.
    compiled = compiled.replace(/PROJECT TITLE \+ DESCRIPTION HERE/g, projectDetails);
    setGenerated(compiled);
    setShowPrompt(true);
    setLocked(true);
    setNotice('');
    // Mark the chosen idea as taken so it isn't offered to another student.
    const ideaId = chosenIdeaIdRef.current;
    if (ideaId) {
      await api.takeLabIdea(ideaId);
    }
    setGenerating(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Could not copy to clipboard.', 'error');
    }
  };

  return (
    <div className="border border-zinc-800 rounded-2xl p-5 bg-zinc-950/60">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-blue-accent" />
        <h4 className="text-sm font-bold text-white font-heading">{task.title || 'Build Your Project Prompt'}</h4>
      </div>
      <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
        {task.description?.includes(PROMPT_PLACEHOLDER)
          ? 'Tell us what you are building and generate your Midnight bootcamp prompt.'
          : task.description}
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-mono text-zinc-400 mb-1 font-bold uppercase tracking-wider">Project name</label>
          <input
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            disabled={locked}
            placeholder="e.g. Simple Crypto Wallet"
            className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-[11px] font-mono text-zinc-400 mb-1 font-bold uppercase tracking-wider">Project description</label>
          <textarea
            value={projectDesc}
            onChange={(e) => setProjectDesc(e.target.value)}
            disabled={locked}
            placeholder="What the learner will build…"
            rows={3}
            className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleRandomIdea}
            disabled={locked || busy}
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 font-heading disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-blue-accent" />}
            Random Project Idea
          </button>
          <button
            onClick={generatePrompt}
            disabled={locked || generating}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 font-heading shadow-lg disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Generate Prompt
          </button>
        </div>

        {!locked && (
          <p className="text-[11px] font-mono text-zinc-500">
            Tip: tap Random Project Idea for a curated project, or enter your own. Generating a prompt locks your choice.
          </p>
        )}
        {locked && (
          <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Your project choice is locked. Preview your prompt with the Generate button.
          </p>
        )}
        {notice && <p className="text-[11px] font-mono text-amber-300">{notice}</p>}
      </div>

      {generated && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider">Your Generated Prompt</span>
            </div>
            <button
              onClick={() => setShowPrompt(true)}
              className="text-[11px] font-mono font-bold text-blue-accent hover:text-white"
            >
              Expand
            </button>
          </div>
          <CodeBlockElement
            task={{
              id: 'generated-prompt-inline',
              type: 'code',
              title: 'Prompt to Use',
              description: generated,
              language: 'text',
            }}
          />
          <p className="text-[11px] font-mono text-emerald-400 mt-2 flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Your project choice is locked. Tap "Expand" to reopen the full prompt at any time.
          </p>
        </div>
      )}

      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowPrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-700 rounded-3xl shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white font-heading">Your Custom Prompt</h3>
                </div>
                <button onClick={() => setShowPrompt(false)} className="p-1.5 text-zinc-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <CodeBlockElement
                  task={{
                    id: 'generated-prompt',
                    type: 'code',
                    title: 'Prompt to Use',
                    description: generated,
                    language: 'text',
                  }}
                />
              </div>
              <div className="px-5 py-4 border-t border-zinc-800 flex items-center gap-2 justify-end">
                <button
                  onClick={handleCopy}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold rounded-xl flex items-center gap-2 font-heading"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Prompt'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Input Form (collect normal learner details like name/email) ---
export const InputElement: React.FC<{
  task: LabTask;
  labId: string;
  labTitle: string;
  userName: string;
  userId: string;
  onAddSubmission?: (submission: import('../../types').Submission) => void;
}> = ({ task, labId, labTitle, userName, userId, onAddSubmission }) => {
  const fields = task.inputFields || [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const missing = fields.filter((f) => f.required && !(values[f.id] || '').trim());
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    setSaving(true);
    setError('');
    const formData: Record<string, string> = {};
    for (const f of fields) formData[f.label] = (values[f.id] || '').trim();
    try {
      const submission = {
        id: `sub_${Date.now()}`,
        labId,
        userId,
        userName,
        labTitle,
        status: 'for_review',
        submittedAt: new Date().toISOString(),
        type: 'lab',
        inputElementTitle: task.title,
        formData,
      };
      onAddSubmission?.(submission);
      await api.createSubmission({
        labId,
        labTitle,
        status: 'for_review',
        inputElementTitle: task.title,
        formData,
      });
      setSaved(true);
    } catch {
      setError('Could not save your details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-zinc-800 rounded-2xl bg-zinc-950 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-800/50 text-blue-accent flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white font-heading">{task.title || 'Your Details'}</h4>
          {task.description && <p className="text-xs text-zinc-400 mt-0.5">{task.description}</p>}
        </div>
        {saved && (
          <span className="ml-auto text-[10px] font-mono font-bold text-emerald-400 uppercase bg-emerald-950/40 border border-emerald-800 rounded-md px-2 py-0.5">
            Saved
          </span>
        )}
      </div>

      {fields.length === 0 ? (
        <p className="p-5 text-xs text-zinc-500 font-mono">This form has no fields configured.</p>
      ) : (
        <div className="p-5 space-y-4">
          {fields.map((f) => (
            <label key={f.id} className="block">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-bold">
                {f.label}
                {f.required && <span className="text-blue-accent"> *</span>}
              </span>
              <input
                type={f.type || 'text'}
                value={values[f.id] || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                placeholder={f.placeholder}
                disabled={saved}
                className="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 disabled:opacity-60"
              />
            </label>
          ))}

          {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

          {!saved ? (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 font-heading disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Submit'}
            </button>
          ) : (
            <p className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Your details have been submitted for review.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// --- Master renderer ---
export const renderContentElement = (task: LabTask): React.ReactNode => {
  switch (task.type) {
    case 'accordion':
      return <AccordionElement task={task} />;
    case 'callout':
      return <CalloutElement task={task} />;
    case 'image':
      return <ImageElement task={task} />;
    case 'divider':
      return <DividerElement />;
    case 'quote':
      return <QuoteElement task={task} />;
    case 'embed':
      return <EmbedElement task={task} />;
    case 'table':
      return <TableElement task={task} />;
    case 'steps':
      return <StepsElement task={task} />;
    case 'code':
      return <CodeBlockElement task={task} />;
    case 'redirect':
      return <RedirectElement task={task} />;
    default:
      return null;
  }
};
