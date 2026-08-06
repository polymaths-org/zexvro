import React, { useRef, useState } from 'react';
import {
  Award,
  ShieldCheck,
  Zap,
  Flame,
  Code2,
  Globe,
  Lock,
  KeyRound,
  Type,
  ImagePlus,
  Image as ImageIcon,
  QrCode,
  Move,
  Trash2,
  PlusCircle,
  Minus,
  Check,
} from 'lucide-react';
import { LabCredential, CredentialElement } from '../../types';
import { VerifyQR } from '../VerifyQR';

interface CredentialCanvasProps {
  value: LabCredential;
  onChange: (next: LabCredential) => void;
  badgeName: string;
  labName: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Award: <Award className="w-full h-full" />,
  ShieldCheck: <ShieldCheck className="w-full h-full" />,
  Zap: <Zap className="w-full h-full" />,
  Flame: <Flame className="w-full h-full" />,
  Code2: <Code2 className="w-full h-full" />,
  Globe: <Globe className="w-full h-full" />,
  Lock: <Lock className="w-full h-full" />,
  KeyRound: <KeyRound className="w-full h-full" />,
};

const ICON_KEYS = Object.keys(ICON_MAP);
const COLORS = ['#3b82f6', '#60a5fa', '#22d3ee', '#34d399', '#a78bfa', '#f59e0b', '#f43f5e', '#f4f4f5', '#0a0a0a', '#ffffff'];

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

const defaultBadge = (badgeName: string, labName: string): NonNullable<LabCredential['badge']> => ({
  background: '#0a0a0a',
  accent: '#3b82f6',
  icon: 'Award',
  dotgrid: true,
  elements: [
    { id: uid('b_icon'), kind: 'icon', x: 50, y: 34, size: 84, color: '#ffffff', align: 'center', shape: 'hex' },
    { id: uid('b_name'), kind: 'text', x: 50, y: 60, size: 26, color: '#ffffff', text: badgeName || 'Skill Badge', align: 'center', bold: true, width: 82 },
    { id: uid('b_desc'), kind: 'text', x: 50, y: 74, size: 13, color: '#a1a1aa', text: labName || 'ZEXVRO Labs', align: 'center', width: 86 },
    { id: uid('b_xp'), kind: 'text', x: 50, y: 88, size: 12, color: '#3b82f6', text: '+250 XP', align: 'center', bold: true, width: 40 },
  ],
});

const defaultCert = (): NonNullable<LabCredential['certificate']> => ({
  background: '#0b0b0d',
  borderColor: '#3b82f6',
  accent: '#3b82f6',
  logoUrl: '',
  qrUrl: '',
  elements: [
    { id: uid('c_logo'), kind: 'logo', x: 50, y: 16, size: 40, color: '#ffffff', align: 'center' },
    { id: uid('c_title'), kind: 'text', x: 50, y: 28, size: 15, color: '#3b82f6', text: 'ZEXVRO CERTIFIES', align: 'center', bold: true, width: 80 },
    { id: uid('c_name'), kind: 'text', x: 50, y: 46, size: 30, color: '#ffffff', text: '{username}', align: 'center', bold: true, width: 80 },
    { id: uid('c_line'), kind: 'text', x: 50, y: 60, size: 13, color: '#a1a1aa', text: 'has successfully completed', align: 'center', width: 80 },
    { id: uid('c_lab'), kind: 'text', x: 50, y: 71, size: 20, color: '#3b82f6', text: '{labname}', align: 'center', bold: true, width: 80 },
    { id: uid('c_sign'), kind: 'line', x: 50, y: 82, size: 1, color: '#52525b', align: 'center', width: 24 },
    { id: uid('c_date'), kind: 'text', x: 30, y: 90, size: 11, color: '#71717a', text: 'Issued {date}', align: 'center', width: 40 },
    { id: uid('c_qr'), kind: 'qr', x: 82, y: 90, size: 36, color: '#ffffff', align: 'center' },
  ],
});

const replaceVars = (text: string, badgeName: string, labName: string) =>
  (text || '')
    .replaceAll('{username}', 'Alex Learner')
    .replaceAll('{labname}', labName || 'ZEXVRO Lab')
    .replaceAll('{badgename}', badgeName || 'Skill Badge')
    .replaceAll('{date}', new Date().toLocaleDateString());

export const CredentialCanvas: React.FC<CredentialCanvasProps> = ({
  value,
  onChange,
  badgeName,
  labName,
}) => {
  const badge = value.badge || defaultBadge(badgeName, labName);
  const cert = value.certificate || defaultCert();

  const [selectedKind, setSelectedKind] = useState<'badge' | 'cert'>('badge');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(false);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selected =
    selectedId != null
      ? (selectedKind === 'badge' ? badge.elements : cert.elements).find((e) => e.id === selectedId)
      : null;

  const patch = (kind: 'badge' | 'cert', fn: (d: typeof badge | typeof cert) => typeof badge | typeof cert) => {
    if (kind === 'badge') {
      onChange({ badge: fn(badge) as typeof badge, certificate: cert });
    } else {
      onChange({ badge, certificate: fn(cert) as typeof cert });
    }
  };

  const updateElement = (kind: 'badge' | 'cert', id: string, p: Partial<CredentialElement>) => {
    patch(kind, (d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? { ...e, ...p } : e)) }));
  };

  const removeElement = (kind: 'badge' | 'cert', id: string) => {
    patch(kind, (d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
    setSelectedId(null);
  };

  const addElement = (kind: 'badge' | 'cert', type: string) => {
    const base: CredentialElement =
      type === 'icon'
        ? { id: uid('b_icon'), kind: 'icon', x: 50, y: 30, size: 60, color: '#ffffff', align: 'center', shape: 'rect' }
        : type === 'line'
        ? { id: uid('c_sign'), kind: 'line', x: 50, y: 84, size: 1, color: '#52525b', align: 'center', width: 24 }
        : type === 'image'
        ? { id: uid('c_img'), kind: 'image', x: 50, y: 30, size: 80, color: '#ffffff', align: 'center' }
        : { id: uid('t'), kind: 'text', x: 50, y: 50, size: 16, color: '#ffffff', text: 'New text', align: 'center', width: 60 };
    const kindKey = kind === 'badge' ? 'badge' : 'certificate';
    const next: any = { ...(kind === 'badge' ? badge : cert) };
    next.elements = [...next.elements, base];
    onChange({ badge: kindKey === 'badge' ? next : badge, certificate: kindKey === 'certificate' ? next : cert } as LabCredential);
    setSelectedId(base.id);
  };

  const readImage = (file: File | undefined, cb: (url: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result));
    reader.readAsDataURL(file);
  };

  // --- drag handling ---
  // The element rects must come from the CANVAS, not the dragged block —
  // using the block's rect made deltas wrong and snapped elements to the
  // border. Compute positions against the canvas container rect instead.
  const canvasRect = () => canvasRef.current?.getBoundingClientRect();

  const onCanvasPointerDown = (e: React.PointerEvent, id: string) => {
    const rect = canvasRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    const el = (selectedKind === 'badge' ? badge.elements : cert.elements).find((x) => x.id === id);
    dragRef.current = { id, dx: px - (el?.x ?? 0), dy: py - (el?.y ?? 0) };
    setSelectedId(id);
    canvasRef.current?.setPointerCapture?.(e.pointerId);
  };
  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const rect = canvasRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    const x = Math.min(100, Math.max(0, px - dragRef.current.dx));
    const y = Math.min(100, Math.max(0, py - dragRef.current.dy));
    updateElement(selectedKind, dragRef.current.id, { x, y });
  };
  const onCanvasPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
  };

  // --- rendering blocks ---
  const renderBlock = (el: CredentialElement) => {
    const isSelected = selectedId === el.id;
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x}%`,
      top: `${el.y}%`,
      transform: 'translate(-50%, -50%)',
      color: el.color,
      textAlign: el.align,
      cursor: 'grab',
    };

    const commonProps = {
      onPointerDown: (e: React.PointerEvent) => onCanvasPointerDown(e, el.id),
      className: `absolute ${isSelected ? 'outline outline-2 outline-blue-400' : ''}`,
      style,
    };

    if (el.kind === 'icon') {
      const shapeCls =
        el.shape === 'circle'
          ? 'rounded-full'
          : el.shape === 'hex'
          ? 'rounded-2xl [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0%_50%)]'
          : 'rounded-2xl';
      return (
        <div
          key={el.id}
          {...commonProps}
          style={{ ...style, width: el.size, height: el.size, background: 'rgba(255,255,255,0.08)', border: `1px solid ${el.color}44` }}
        >
          <div className={`w-full h-full flex items-center justify-center text-white p-[18%] ${shapeCls}`}>
            {ICON_MAP[(value.badge?.icon || 'Award') as keyof typeof ICON_MAP] || <Award className="w-full h-full" />}
          </div>
        </div>
      );
    }
    if (el.kind === 'logo') {
      return (
        <div key={el.id} {...commonProps} style={{ ...style, width: el.size, height: el.size }}>
          {(value.certificate?.logoUrl || '') ? (
            <img src={value.certificate?.logoUrl} alt="logo" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full rounded-lg bg-zinc-800 border border-dashed border-zinc-600 flex items-center justify-center">
              <ImagePlus className="w-1/2 h-1/2 text-zinc-500" />
            </div>
          )}
        </div>
      );
    }
    if (el.kind === 'image') {
      return (
        <div key={el.id} {...commonProps} style={{ ...style, width: el.size, height: el.size }}>
          {el.imageUrl ? (
            <img src={el.imageUrl} alt="block" className="w-full h-full object-contain" />
          ) : (
            <label className="w-full h-full flex items-center justify-center rounded-lg bg-zinc-800 border border-dashed border-zinc-600 text-zinc-500 cursor-pointer">
              <ImagePlus className="w-1/2 h-1/2" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  readImage(e.target.files?.[0], (url) =>
                    updateElement(selectedKind, el.id, { imageUrl: url }),
                  );
                }}
              />
            </label>
          )}
        </div>
      );
    }
    if (el.kind === 'qr') {
      return (
        <div key={el.id} {...commonProps} style={{ ...style, width: el.size, height: el.size }}>
          <VerifyQR
            value={typeof el.text === 'string' && el.text.length > 4 ? el.text : 'https://labs.zexvro.in/verify'}
            size={Math.max(16, el.size)}
            className="w-full h-full"
          />
        </div>
      );
    }
    if (el.kind === 'line') {
      return (
        <div
          key={el.id}
          {...commonProps}
          style={{
            ...style,
            width: `${el.width || 24}%`,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${el.color}, transparent)`,
          }}
        />
      );
    }
    // text
    return (
      <div
        key={el.id}
        {...commonProps}
        style={{
          ...style,
          width: `${el.width || 70}%`,
          fontSize: el.size,
          fontWeight: el.bold ? 800 : 500,
          fontStyle: el.italic ? 'italic' : 'normal',
          lineHeight: 1.2,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
        }}
      >
        {replaceVars(el.text || '', badgeName, labName)}
      </div>
    );
  };

  const badgeBackgroundImage = badge.backgroundImage || undefined;
  const certBackgroundImage = cert.backgroundImage || undefined;
  const badgeBg = badge.dotgrid
    ? `radial-gradient(${badge.accent}33 1px, transparent 1px)`
    : undefined;
  const isBadge = selectedKind === 'badge';
  const activeBgImage = isBadge ? badgeBackgroundImage : certBackgroundImage;
  const canvasBg =
    activeBgImage
      ? `url("${activeBgImage}") center / cover no-repeat`
      : undefined;
  const canvasBgStyle: React.CSSProperties =
    canvasBg
      ? { background: canvasBg }
      : {
          background: isBadge ? badge.background : cert.background,
          backgroundImage: isBadge ? badgeBg : undefined,
          backgroundSize: isBadge ? '24px 24px' : undefined,
        };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Editor tabs */}
      <div className="space-y-4 xl:col-span-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedKind('badge')}
            className={`px-4 py-2 rounded-xl text-sm font-bold font-heading flex items-center gap-2 transition-all ${selectedKind === 'badge' ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}`}
          >
            <Award className="h-4 w-4" /> Badge
          </button>
          <button
            onClick={() => setSelectedKind('cert')}
            className={`px-4 py-2 rounded-xl text-sm font-bold font-heading flex items-center gap-2 transition-all ${selectedKind === 'cert' ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'}`}
          >
            <ShieldCheck className="h-4 w-4" /> Certificate
          </button>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="relative overflow-hidden rounded-2xl border border-zinc-700 touch-none select-none"
          style={{
            aspectRatio: selectedKind === 'badge' ? '1 / 1' : '16 / 9',
            ...canvasBgStyle,
          }}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerLeave={onCanvasPointerUp}
        >
          {selectedKind === 'badge' && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white/20 pointer-events-none select-none">
              {badge.dotgrid && <div className="absolute inset-0 rounded-2xl border-2" style={{ borderColor: badge.accent }} />}
            </div>
          )}
          {selectedKind === 'cert' && (
            <div className="absolute inset-0 rounded-2xl border-2 pointer-events-none" style={{ borderColor: cert.borderColor }} />
          )}
          {(selectedKind === 'badge' ? badge.elements : cert.elements).map(renderBlock)}
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 border border-zinc-700 rounded-lg text-[9px] font-mono text-zinc-400 flex items-center gap-1 pointer-events-none">
            <Move className="h-3 w-3" /> drag blocks
          </div>
        </div>
      </div>

      {/* Property panel */}
      <div className="space-y-4 xl:col-span-1">
        {/* Global styles */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-widest">
            {selectedKind === 'badge' ? 'Badge styles' : 'Certificate styles'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 mb-1 font-bold">Background</label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      selectedKind === 'badge'
                        ? patch('badge', (d) => ({ ...d, background: c }) as any)
                        : patch('cert', (d) => ({ ...d, background: c }) as any)
                    }
                    className={`w-6 h-6 rounded-lg border-2 ${(selectedKind === 'badge' ? badge.background : cert.background) === c ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-zinc-500 mb-1 font-bold">Accent</label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.slice(0, 8).map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      selectedKind === 'badge'
                        ? patch('badge', (d) => ({ ...d, accent: c }) as any)
                        : patch('cert', (d) => ({ ...d, accent: c, borderColor: c }) as any)
                    }
                    className={`w-6 h-6 rounded-lg border-2 ${(selectedKind === 'badge' ? badge.accent : cert.accent) === c ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {selectedKind === 'badge' ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 mb-1 font-bold">Icon</label>
                <div className="flex gap-1.5">
                  {ICON_KEYS.slice(0, 8).map((k) => (
                    <button
                      key={k}
                      onClick={() => patch('badge', (d) => ({ ...d, icon: k }) as any)}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center text-white p-1.5 ${
                        (value.badge?.icon || 'Award') === k ? 'border-blue-500 bg-blue-600' : 'border-zinc-700 bg-zinc-900'
                      }`}
                    >
                      {ICON_MAP[k]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 ml-auto text-[11px] font-mono text-zinc-400 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!badge.dotgrid}
                  onChange={(e) => patch('badge', (d) => ({ ...d, dotgrid: e.target.checked }) as any)}
                  className="accent-blue-600"
                />
                Dot grid
              </label>
            </div>
            <div className="pt-2 border-t border-zinc-800 flex items-center gap-3 flex-wrap">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200">
                <ImageIcon className="h-3.5 w-3.5" /> Badge background image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    readImage(e.target.files?.[0], (url) =>
                      patch('badge', (d) => ({ ...d, backgroundImage: url }) as any),
                    );
                  }}
                />
              </label>
              {badge.backgroundImage && (
                <button
                  onClick={() => patch('badge', (d) => ({ ...d, backgroundImage: '' }) as any)}
                  className="text-[11px] font-mono text-zinc-500 hover:text-white underline"
                >
                  Remove bg image
                </button>
              )}
            </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 mb-1 font-bold">Logo</label>
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200">
                  <ImagePlus className="h-3.5 w-3.5" /> Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () =>
                        patch('cert', (d) => ({ ...d, logoUrl: String(reader.result) }) as any);
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {cert.logoUrl && (
                  <button
                    onClick={() => patch('cert', (d) => ({ ...d, logoUrl: '' }) as any)}
                    className="ml-2 text-[11px] font-mono text-zinc-500 hover:text-white underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="pt-2 border-t border-zinc-800 flex items-center gap-3 flex-wrap">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200">
                  <ImageIcon className="h-3.5 w-3.5" /> Certificate background image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      readImage(e.target.files?.[0], (url) =>
                        patch('cert', (d) => ({ ...d, backgroundImage: url }) as any),
                      );
                    }}
                  />
                </label>
                {cert.backgroundImage && (
                  <button
                    onClick={() => patch('cert', (d) => ({ ...d, backgroundImage: '' }) as any)}
                    className="text-[11px] font-mono text-zinc-500 hover:text-white underline"
                  >
                    Remove bg image
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Selected block properties */}
        {selected ? (
          <div className="bg-zinc-950 border border-blue-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-blue-accent uppercase tracking-widest">
                {selected.kind === 'icon' ? 'Icon block' : selected.kind === 'line' ? 'Line block' : selected.kind === 'qr' ? 'QR block' : selected.kind === 'logo' ? 'Logo block' : 'Text block'}
              </h3>
              <button
                onClick={() => removeElement(selectedKind, selected.id)}
                className="p-1 text-zinc-500 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {selected.kind === 'text' && (
              <>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 mb-1 font-bold">Text (vars: {'{username}'} {'{labname}'} {'{date}'})</label>
                  <input
                    value={selected.text || ''}
                    onChange={(e) => updateElement(selectedKind, selected.id, { text: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 mb-1 font-bold">Size</label>
                    <input
                      type="number"
                      value={selected.size}
                      onChange={(e) => updateElement(selectedKind, selected.id, { size: Number(e.target.value) || 12 })}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 mb-1 font-bold">Width %</label>
                    <input
                      type="number"
                      value={selected.width || 70}
                      onChange={(e) => updateElement(selectedKind, selected.id, { width: Number(e.target.value) || 70 })}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 mb-1 font-bold">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateElement(selectedKind, selected.id, { color: c })}
                        className={`w-6 h-6 rounded-lg border-2 ${selected.color === c ? 'border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selected.bold}
                      onChange={(e) => updateElement(selectedKind, selected.id, { bold: e.target.checked })}
                      className="accent-blue-600"
                    />
                    Bold
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selected.italic}
                      onChange={(e) => updateElement(selectedKind, selected.id, { italic: e.target.checked })}
                      className="accent-blue-600"
                    />
                    Italic
                  </label>
                </div>
              </>
            )}

            {selected.kind === 'icon' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1.5">
                  {ICON_KEYS.slice(0, 8).map((k) => (
                    <button
                      key={k}
                      onClick={() => patch('badge', (d) => ({ ...d, icon: k }) as any)}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center text-white p-1.5 ${
                        (value.badge?.icon || 'Award') === k ? 'border-blue-500 bg-blue-600' : 'border-zinc-700 bg-zinc-900'
                      }`}
                    >
                      {ICON_MAP[k]}
                    </button>
                  ))}
                </div>
                <select
                  value={selected.shape || 'rect'}
                  onChange={(e) => updateElement(selectedKind, selected.id, { shape: e.target.value as any })}
                  className="ml-auto bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="rect">Square</option>
                  <option value="circle">Circle</option>
                  <option value="hex">Hex</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
              <Move className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[11px] font-mono text-zinc-400">
                Drag on the canvas to move · X {selected.x.toFixed(1)}% · Y {selected.y.toFixed(1)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-widest">Add block</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => addElement(selectedKind, 'text')} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold rounded-lg flex items-center gap-1.5">
                <Type className="h-3.5 w-3.5" /> Text
              </button>
              {selectedKind === 'badge' && (
                <button onClick={() => addElement('badge', 'icon')} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold rounded-lg flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5" /> Icon
                </button>
              )}
              <button onClick={() => addElement(selectedKind, 'image')} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold rounded-lg flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Image
              </button>
              {selectedKind === 'cert' && (
                <button onClick={() => addElement('cert', 'line')} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold rounded-lg flex items-center gap-1.5">
                  <Minus className="h-3.5 w-3.5" /> Line
                </button>
              )}
            </div>
            <p className="text-[11px] font-mono text-zinc-500 leading-relaxed">
              Click a block on the canvas to edit its text, size, color and position.
            </p>
          </div>
        )}

        {/* QR toggle for cert */}
        {selectedKind === 'cert' && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
            <QrCode className="h-4 w-4 text-blue-accent" />
            <div className="flex-1">
              <p className="text-xs font-bold text-white">Verification QR</p>
              <p className="text-[10px] font-mono text-zinc-500">Scans to the public verify page — baked in on issue.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
