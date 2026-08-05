import React, { useState } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LabTask, CalloutVariant } from '../../types';

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
