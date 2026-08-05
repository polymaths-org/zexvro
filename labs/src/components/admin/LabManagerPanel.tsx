import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  BarChart3,
  FileText,
  LayoutList,
  Users,
  Award,
  Trash2,
  PlusCircle,
  ChevronUp,
  ChevronDown,
  ImagePlus,
  KeyRound,
  Clock,
  Eye,
  FilePlus2,
  UserPlus,
  CheckCircle2,
  Tag,
  X,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { Lab, LabPage, LabTask, LabTaskType, LabCategory, LabDifficulty, Badge } from '../../types';
import { CredentialCanvas } from './CredentialCanvas';
import { SaveButton } from './SaveButton';

interface LabManagerPanelProps {
  lab: Lab;
  badges: Badge[];
  onUpdateLab: (id: string, lab: Partial<Lab>) => void;
  onDeleteLab: (id: string) => void;
  onPreviewLab: (lab: Lab) => void;
  onBack: () => void;
}

type SubTab = 'overview' | 'details' | 'content' | 'access' | 'credentials';

const ELEMENT_TYPES: { type: LabTaskType; label: string }[] = [
  { type: 'heading', label: 'Heading' },
  { type: 'text', label: 'Text' },
  { type: 'code', label: 'Code' },
  { type: 'task', label: 'Task' },
  { type: 'repo', label: 'Connect Repo' },
  { type: 'image', label: 'Image' },
  { type: 'embed', label: 'YouTube' },
  { type: 'callout', label: 'Callout' },
  { type: 'accordion', label: 'Accordion' },
  { type: 'quote', label: 'Quote' },
  { type: 'table', label: 'Table' },
  { type: 'steps', label: 'Steps' },
  { type: 'divider', label: 'Divider' },
  { type: 'redirect', label: 'Redirect Button' },
];

export const LabManagerPanel: React.FC<LabManagerPanelProps> = ({
  lab,
  badges,
  onUpdateLab,
  onDeleteLab,
  onPreviewLab,
  onBack,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [deleteArm, setDeleteArm] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Details editor state ---
  const [title, setTitle] = useState(lab.title);
  const [description, setDescription] = useState(lab.description);
  const [category, setCategory] = useState<LabCategory>(lab.category);
  const [difficulty, setDifficulty] = useState<LabDifficulty>(lab.difficulty);
  const [tags, setTags] = useState<string[]>(lab.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [xpReward, setXpReward] = useState(lab.xpReward);
  const [author, setAuthor] = useState(lab.author);
  const [status, setStatus] = useState<'draft' | 'published' | 'closed'>(lab.status || (lab.isPublished ? 'published' : 'draft'));
  const [timed, setTimed] = useState(!!lab.timeLimitMinutes);
  const [durationMinutes, setDurationMinutes] = useState(lab.timeLimitMinutes || 60);
  const [hasPin, setHasPin] = useState(!!(lab.password || lab.accessCode));
  const [pin, setPin] = useState(lab.password || lab.accessCode || '');
  const [bannerUrl, setBannerUrl] = useState(lab.bannerUrl || '');

  // --- Content editor state (multi-page) ---
  const [pages, setPages] = useState<LabPage[]>(() =>
    lab.pages && lab.pages.length > 0
      ? lab.pages
      : [{ id: 'page_1', title: 'Introduction', elements: lab.tasks || [] }],
  );
  const [activePageId, setActivePageId] = useState<string>('');

  // --- Access editor state ---
  const [editors, setEditors] = useState<string[]>(lab.editors || []);
  const [editorInput, setEditorInput] = useState('');

  // --- Credentials state ---
  const [badgeId, setBadgeId] = useState(lab.badgeId || badges[0]?.id || '');
  const [awardOn, setAwardOn] = useState('completion');

  useEffect(() => {
    if (pages.length > 0 && !activePageId) setActivePageId(pages[0].id);
  }, [pages, activePageId]);

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, size, size);
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        setBannerUrl(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const addTag = (raw?: string) => {
    const value = (raw ?? tagInput).trim().replace(/^#/, '');
    if (!value) return;
    if (!tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setTags((prev) => [...prev, value]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const saveDetails = () => {
    onUpdateLab(lab.id, {
      title,
      description,
      category,
      difficulty,
      xpReward: Number(xpReward) || 0,
      tags,
      author,
      status,
      isPublished: status === 'published',
      timeLimitMinutes: timed ? Number(durationMinutes) || 60 : null,
      password: hasPin ? pin : undefined,
      accessCode: hasPin ? pin : undefined,
      bannerUrl: bannerUrl || undefined,
    });
  };

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

  const addPage = () => {
    const id = `page_${Date.now()}`;
    const page: LabPage = { id, title: `Page ${pages.length + 1}`, elements: [] };
    setPages((prev) => [...prev, page]);
    setActivePageId(id);
  };

  const updatePageTitle = (id: string, value: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, title: value } : p)));
  };

  const addElement = (type: LabTaskType) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === activePageId
          ? {
              ...p,
              elements: [
                ...p.elements,
                {
                  id: `el_${Date.now()}`,
                  type,
                  title: type === 'heading' ? 'New Heading' : type === 'code' ? 'New Code Block' : type === 'task' ? 'New Task' : type === 'text' ? 'Paragraph' : type === 'redirect' ? 'Open Exercise' : 'New Element',
                  description: type === 'code' ? '// code here' : '',
                  language: type === 'code' ? 'solidity' : undefined,
                  flagType: type === 'task' ? 'checkbox' : undefined,
                } as LabTask,
              ],
            }
          : p,
      ),
    );
  };

  const updateElement = (pageId: string, elId: string, patch: Partial<LabTask>) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, elements: p.elements.map((el) => (el.id === elId ? { ...el, ...patch } : el)) }
          : p,
      ),
    );
  };

  const removeElement = (pageId: string, elId: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId ? { ...p, elements: p.elements.filter((el) => el.id !== elId) } : p,
      ),
    );
  };

  const moveElement = (pageId: string, elId: string, dir: -1 | 1) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        const idx = p.elements.findIndex((el) => el.id === elId);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= p.elements.length) return p;
        const next = [...p.elements];
        [next[idx], next[target]] = [next[target], next[idx]];
        return { ...p, elements: next };
      }),
    );
  };

  const saveContent = () => {
    onUpdateLab(lab.id, { pages });
  };

  const addEditor = () => {
    const name = editorInput.trim().toLowerCase().replace(/^@/, '');
    if (!name) return;
    setEditors((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setEditorInput('');
  };

  const saveAccess = () => {
    onUpdateLab(lab.id, { editors });
  };

  const saveCredentials = () => {
    const badge = badges.find((b) => b.id === badgeId);
    onUpdateLab(lab.id, {
      badgeId: badgeId || undefined,
      badgeName: badge?.name || lab.badgeName,
      badgeIconUrl: badge?.iconName || lab.badgeIconUrl,
      credential: { ...(lab.credential || {}), awardOn },
    });
  };

  const tabMeta: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'details', label: 'Details', icon: <FileText className="h-4 w-4" /> },
    { id: 'content', label: 'Content', icon: <LayoutList className="h-4 w-4" /> },
    { id: 'access', label: 'Access', icon: <Users className="h-4 w-4" /> },
    { id: 'credentials', label: 'Credentials', icon: <Award className="h-4 w-4" /> },
  ];

  const enrolled = lab.enrolledCount ?? lab.completions ?? 0;
  const completions = lab.completions ?? 0;
  const stepCount = pages.reduce((n, p) => n + p.elements.filter((e) => (e.type || 'task') === 'task').length, 0);
  const completionRate = enrolled > 0 ? Math.round((completions / enrolled) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BackButton onClick={onBack} />
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-blue-accent text-xs font-mono font-bold uppercase mb-1">
                <BarChart3 className="h-3.5 w-3.5" />
                Lab Management
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight font-heading truncate">{lab.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPreviewLab({ ...lab, pages })}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-extrabold rounded-xl flex items-center gap-1.5 font-heading"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
            <button
              onClick={() => {
                if (!deleteArm) {
                  setDeleteArm(true);
                  if (deleteTimer.current) clearTimeout(deleteTimer.current);
                  deleteTimer.current = setTimeout(() => setDeleteArm(false), 3000);
                  return;
                }
                if (deleteTimer.current) clearTimeout(deleteTimer.current);
                setDeleteArm(false);
                onDeleteLab(lab.id);
              }}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-xl flex items-center gap-1.5 font-heading transition-all ${
                deleteArm
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-105'
                  : 'bg-red-950 hover:bg-red-900 border border-red-800 text-red-200'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {deleteArm ? 'Confirm delete?' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-zinc-800 pt-3">
          {tabMeta.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all font-heading flex items-center gap-2 ${
                subTab === t.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Enrolled" value={enrolled.toLocaleString()} icon={<Users className="h-5 w-5" />} />
            <MetricCard label="Completions" value={completions.toLocaleString()} icon={<CheckCircle2 className="h-5 w-5" />} />
            <MetricCard label="Completion Rate" value={`${completionRate}%`} icon={<BarChart3 className="h-5 w-5" />} />
            <MetricCard label="Steps" value={stepCount} icon={<LayoutList className="h-5 w-5" />} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Pages" value={pages.length} icon={<FilePlus2 className="h-5 w-5" />} />
            <MetricCard label="XP Reward" value={`+${lab.xpReward}`} icon={<Award className="h-5 w-5" />} />
            <MetricCard label="Duration" value={lab.timeLimitMinutes ? `${lab.timeLimitMinutes}m` : 'Unlimited'} icon={<Clock className="h-5 w-5" />} />
            <MetricCard label="Status" value={status} icon={<CheckCircle2 className="h-5 w-5" />} accent={status === 'published'} />
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-white font-heading">Access</h3>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300">
                {hasPin ? '🔒 Password protected' : 'Open access'}
              </span>
              <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300">
                {editors.length} {editors.length === 1 ? 'editor' : 'editors'}
              </span>
              <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300">
                {badgeId ? 'Badge: ' + (lab.badgeName || badgeId) : 'No badge linked'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS */}
      {subTab === 'details' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center">
              {bannerUrl ? (
                <img src={bannerUrl} alt="banner" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="h-8 w-8 text-zinc-600" />
              )}
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-400 mb-1 font-bold">Lab Logo / Banner</p>
              <label className="cursor-pointer px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200 transition-colors inline-block">
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
              </label>
              {bannerUrl && (
                <button onClick={() => setBannerUrl('')} className="ml-3 text-[11px] font-mono text-zinc-500 hover:text-white underline">
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Author">
              <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value as LabCategory)} className={inputCls}>
                {['Smart Contracts', 'DeFi Protocols', 'NFTs & Digital Assets', 'DAOs & Governance', 'Cross-chain & L2s', 'ZK & Privacy'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Difficulty">
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as LabDifficulty)} className={inputCls}>
                {['Introductory', 'Intermediate', 'Advanced'].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="XP Reward">
              <input type="number" value={xpReward} onChange={(e) => setXpReward(Number(e.target.value))} className={inputCls} />
            </Field>
          </div>

          <Field label="Hashtags">
            <div className="flex flex-wrap items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-2 focus-within:border-blue-600/60 transition-colors">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600/15 border border-blue-500/30 text-blue-200 text-xs font-mono font-bold rounded-lg"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 text-blue-300/70 hover:text-white transition-colors"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag();
                  } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                    removeTag(tags[tags.length - 1]);
                  }
                }}
                onBlur={() => addTag()}
                placeholder={tags.length === 0 ? 'Add hashtags (press Enter)' : 'Add…'}
                className="flex-1 min-w-[9rem] bg-transparent text-sm text-white placeholder-zinc-500 outline-none py-0.5"
              />
            </div>
            <p className="text-[11px] text-zinc-500 font-mono mt-1.5">Separate with Enter or comma — shown as hashtags on the lab page.</p>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-black border border-zinc-800 rounded-2xl space-y-2">
              <p className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Time
              </p>
              <div className="flex items-center gap-2">
                <ToggleBtn active={!timed} onClick={() => setTimed(false)} label="No duration" icon={<InfinityIcon className="h-3.5 w-3.5" />} />
                <ToggleBtn active={timed} onClick={() => setTimed(true)} label="Duration" icon={<Clock className="h-3.5 w-3.5" />} />
                {timed && (
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-24 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-sm text-white font-mono"
                  />
                )}
                {timed && <span className="text-[11px] font-mono text-zinc-500">min</span>}
              </div>
            </div>

            <div className="p-4 bg-black border border-zinc-800 rounded-2xl space-y-2">
              <p className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Password
              </p>
              <div className="flex items-center gap-2">
                <ToggleBtn active={!hasPin} onClick={() => setHasPin(false)} label="No pin" />
                <ToggleBtn active={hasPin} onClick={() => setHasPin(true)} label="Pin" />
              </div>
              {hasPin && (
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Access pin / code"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-sm text-white font-mono"
                />
              )}
            </div>
          </div>

          <div className="p-4 bg-black border border-zinc-800 rounded-2xl space-y-2">
            <p className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">Status</p>
            <div className="flex items-center gap-2">
              {(['draft', 'published', 'closed'] as const).map((s) => (
                <ToggleBtn key={s} active={status === s} onClick={() => setStatus(s)} label={s} />
              ))}
            </div>
          </div>

          <SaveButton onSave={(done) => { saveDetails(); done(); }} label="Save Details" className="w-full" />
        </div>
      )}

      {/* CONTENT */}
      {subTab === 'content' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Page list */}
          <div className="lg:col-span-1 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3 h-fit">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-widest">Pages</h3>
              <button onClick={addPage} className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg" title="Add page">
                <PlusCircle className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {pages.map((page, i) => (
                <button
                  key={page.id}
                  onClick={() => setActivePageId(page.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition-all border ${
                    page.id === activePageId
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-black border-zinc-800 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-[10px] opacity-70 mr-1.5">{i + 1}</span>
                  {page.title || `Page ${i + 1}`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 font-mono leading-relaxed">
              The page heading becomes the title students see.
            </p>
          </div>

          {/* Page editor */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
              <input
                value={activePage?.title || ''}
                onChange={(e) => updatePageTitle(activePage.id, e.target.value)}
                placeholder="Page title (heading)"
                className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-lg font-black text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 font-heading"
              />
            </div>

            {/* Element palette */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
              <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-widest mb-2">Add element</h3>
              <div className="flex flex-wrap gap-2">
                {ELEMENT_TYPES.map((el) => (
                  <button
                    key={el.type}
                    onClick={() => addElement(el.type)}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-bold rounded-lg transition-colors font-mono"
                  >
                    + {el.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Elements */}
            <div className="space-y-3">
              {activePage?.elements.map((el, idx) => (
                <ElementEditor
                  key={el.id}
                  el={el}
                  idx={idx}
                  count={activePage.elements.length}
                  onChange={(patch) => updateElement(activePage.id, el.id, patch)}
                  onRemove={() => removeElement(activePage.id, el.id)}
                  onMove={(dir) => moveElement(activePage.id, el.id, dir)}
                />
              ))}
              {(!activePage || activePage.elements.length === 0) && (
                <div className="text-center py-10 text-zinc-500 text-sm font-mono bg-zinc-950 border border-dashed border-zinc-800 rounded-2xl">
                  No elements yet — add a heading, task, code block, image or video.
                </div>
              )}
            </div>

            <SaveButton onSave={(done) => { saveContent(); done(); }} label="Save Content" className="w-full" />
          </div>
        </div>
      )}

      {/* ACCESS */}
      {subTab === 'access' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4 max-w-2xl">
          <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-accent" />
            Editors
          </h3>
          <p className="text-xs text-zinc-400">
            Add GitHub usernames who may edit this lab's content, details and credentials.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-3 py-2">
              <UserPlus className="h-4 w-4 text-blue-accent shrink-0" />
              <input
                value={editorInput}
                onChange={(e) => setEditorInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEditor()}
                placeholder="GitHub username"
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
              />
            </div>
            <button onClick={addEditor} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold rounded-xl font-heading">
              Add
            </button>
          </div>
          <div className="space-y-2">
            {editors.map((ed) => (
              <div key={ed} className="flex items-center justify-between bg-black border border-zinc-800 rounded-xl px-3 py-2">
                <span className="text-sm font-bold text-white font-mono">@{ed}</span>
                <button
                  onClick={() => setEditors((prev) => prev.filter((e) => e !== ed))}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {editors.length === 0 && <p className="text-xs text-zinc-500 font-mono text-center py-4">No editors added.</p>}
          </div>
          <SaveButton onSave={(done) => { saveAccess(); done(); }} label="Save Access" className="w-full" />
        </div>
      )}

      {/* CREDENTIALS */}
      {subTab === 'credentials' && (
        <div className="space-y-5">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-accent" />
              Credentials for this lab
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1 font-bold">Badge earned on completion</label>
                <select value={badgeId} onChange={(e) => setBadgeId(e.target.value)} className={inputCls}>
                  <option value="">None</option>
                  {badges.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1 font-bold">Grant badge when</label>
                <select value={awardOn} onChange={(e) => setAwardOn(e.target.value)} className={inputCls}>
                  <option value="completion">Lab completed</option>
                  {pages.map((p, i) => (
                    <option key={p.id} value={`page:${i + 1}`}>After Page {i + 1}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <SaveButton onSave={(done) => { saveCredentials(); done(); }} label="Save Credentials" />
              <button
                onClick={() => onPreviewLab({ ...lab, credential: lab.credential })}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-extrabold rounded-xl flex items-center gap-2 font-heading"
              >
                <Eye className="h-4 w-4" /> Preview
              </button>
            </div>
          </div>

          <CredentialCanvas
            value={lab.credential || {}}
            onChange={(credential) => onUpdateLab(lab.id, { credential })}
            badgeName={badges.find((b) => b.id === badgeId)?.name || lab.badgeName || 'Skill Badge'}
            labName={lab.title}
          />
        </div>
      )}
    </div>
  );
};

// Small helper sub-components (kept in this file for cohesion)
const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="p-2 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg transition-colors"
    title="Back to labs"
  >
    <ArrowLeft className="h-5 w-5" />
  </button>
);

const inputCls =
  'w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-mono text-zinc-400 mb-1 font-bold uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

const MetricCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; accent?: boolean }> = ({
  label,
  value,
  icon,
  accent,
}) => (
  <div className={`bg-zinc-950 border ${accent ? 'border-blue-800' : 'border-zinc-800'} rounded-2xl p-5`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accent ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-blue-accent border border-zinc-800'}`}>
      {icon}
    </div>
    <p className="text-2xl font-black text-white font-heading">{value}</p>
    <p className="text-[11px] font-mono text-zinc-500 uppercase font-bold mt-0.5">{label}</p>
  </div>
);

const ToggleBtn: React.FC<{ active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }> = ({
  active,
  onClick,
  label,
  icon,
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-colors flex items-center gap-1.5 font-mono ${
      active ? 'bg-blue-600 text-white border-blue-600' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500'
    }`}
  >
    {icon}
    {label}
  </button>
);

const ElementEditor: React.FC<{
  el: LabTask;
  idx: number;
  count: number;
  onChange: (patch: Partial<LabTask>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}> = ({ el, idx, count, onChange, onRemove, onMove }) => {
  const type = el.type || 'task';
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => setOpen(!open)} className="text-[10px] font-mono text-zinc-400 uppercase font-bold">
          {idx + 1}
        </button>
        <select
          value={type}
          onChange={(e) =>
            onChange({
              type: e.target.value as LabTaskType,
              flagType: e.target.value === 'task' ? (el.flagType || 'checkbox') : undefined,
            })
          }          className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-xs font-mono text-white font-bold focus:outline-none"
        >
          {ELEMENT_TYPES.map((t) => (
            <option key={t.type} value={t.type}>{t.label}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => onMove(-1)} disabled={idx === 0} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onMove(1)} disabled={idx === count - 1} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button onClick={onRemove} className="p-1 text-zinc-500 hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-3">
          {type === 'task' && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">How students complete this step</label>
              <div className="flex items-center gap-2">
                {(['checkbox', 'flag', 'code'] as const).map((f) => (
                  <ToggleBtn key={f} active={(el.flagType || 'checkbox') === f} onClick={() => onChange({ flagType: f })} label={f} />
                ))}
              </div>
            </div>
          )}

          {type !== 'divider' && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Title / Label</label>
              <input value={el.title || ''} onChange={(e) => onChange({ title: e.target.value })} className={inputCls} />
            </div>
          )}

          {type === 'code' && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Language</label>
              <input value={el.language || ''} onChange={(e) => onChange({ language: e.target.value })} className={inputCls} />
            </div>
          )}

          {type !== 'divider' && type !== 'embed' && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                {type === 'code' ? 'Code content' : type === 'task' ? 'Instructions' : 'Content'}
              </label>
              <textarea
                value={el.description || ''}
                onChange={(e) => onChange({ description: e.target.value })}
                rows={type === 'code' ? 4 : 2}
                className={inputCls}
              />
            </div>
          )}

          {type === 'embed' && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">YouTube / embed URL</label>
              <input value={el.embedUrl || ''} onChange={(e) => onChange({ embedUrl: e.target.value })} className={inputCls} />
            </div>
          )}

          {type === 'repo' && (
            <>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Submission instructions</label>
                <textarea
                  value={el.description || ''}
                  onChange={(e) => onChange({ description: e.target.value })}
                  rows={2}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Placeholder hint</label>
                <input
                  value={el.repoHint || ''}
                  onChange={(e) => onChange({ repoHint: e.target.value })}
                  placeholder="https://github.com/you/your-project"
                  className={inputCls}
                />
              </div>
            </>
          )}

          {type === 'redirect' && (
            <>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Redirect URL</label>
                <input
                  value={el.redirectUrl || ''}
                  onChange={(e) => onChange({ redirectUrl: e.target.value })}
                  placeholder="https://github.com/zexvro/solidity-course"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Button color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={el.buttonColor || '#2563eb'}
                    onChange={(e) => onChange({ buttonColor: e.target.value })}
                    className="h-9 w-12 rounded-lg border border-zinc-700 bg-zinc-900 cursor-pointer"
                  />
                  <input
                    value={el.buttonColor || '#2563eb'}
                    onChange={(e) => onChange({ buttonColor: e.target.value })}
                    placeholder="#2563eb"
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
            </>
          )}

          {type === 'image' && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Image URL</label>
              <input value={el.imageUrl || ''} onChange={(e) => onChange({ imageUrl: e.target.value })} className={inputCls} />
              <label className="block text-[11px] font-mono text-zinc-400 mb-1 mt-2">Caption</label>
              <input value={el.imageCaption || ''} onChange={(e) => onChange({ imageCaption: e.target.value })} className={inputCls} />
            </div>
          )}

          {type === 'task' && (el.flagType || 'checkbox') === 'flag' && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Correct flag / answer</label>
              <input value={el.expectedFlag || ''} onChange={(e) => onChange({ expectedFlag: e.target.value })} className={inputCls} />
            </div>
          )}

          {type === 'task' && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Hint (optional)</label>
              <input value={el.hint || ''} onChange={(e) => onChange({ hint: e.target.value })} className={inputCls} />
            </div>
          )}

          {type === 'callout' && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Variant</label>
              <select
                value={el.calloutVariant || 'info'}
                onChange={(e) => onChange({ calloutVariant: e.target.value as any })}
                className={inputCls}
              >
                {['info', 'tip', 'warning', 'success'].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}

          {type === 'table' && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Headers (comma separated)</label>
              <input
                value={(el.tableHeaders || []).join(', ')}
                onChange={(e) => onChange({ tableHeaders: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                className={inputCls}
              />
              <label className="block text-[11px] font-mono text-zinc-400 mb-1 mt-2">Rows (one per line, cells by |)</label>
              <textarea
                value={(el.tableRows || []).map((r) => r.join(' | ')).join('\n')}
                onChange={(e) =>
                  onChange({ tableRows: e.target.value.split('\n').filter(Boolean).map((l) => l.split('|').map((s) => s.trim())) })
                }
                rows={3}
                className={inputCls}
              />
            </div>
          )}

          {type === 'steps' && (
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Steps (one per line: Title::description)</label>
              <textarea
                value={(el.steps || []).map((s) => `${s.title}::${s.description}`).join('\n')}
                onChange={(e) =>
                  onChange({
                    steps: e.target.value.split('\n').filter(Boolean).map((l) => {
                      const [t, ...rest] = l.split('::');
                      return { title: t.trim(), description: rest.join('::').trim() };
                    }),
                  })
                }
                rows={3}
                className={inputCls}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
