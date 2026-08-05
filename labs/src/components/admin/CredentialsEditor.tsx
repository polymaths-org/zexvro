import React, { useState } from 'react';
import {
  Award,
  ShieldCheck,
  PlusCircle,
  Trash2,
  QrCode,
  Palette,
  Type,
  ImagePlus,
  Save,
  User,
  BadgeCheck,
  Zap,
  Flame,
} from 'lucide-react';
import { Badge, CertificateTemplate } from '../../types';

interface CredentialsEditorProps {
  badges: Badge[];
  onUpdateBadge: (id: string, badge: Partial<Badge>) => void;
  onCreateBadge: (badge: Partial<Badge>) => void;
  onDeleteBadge: (id: string) => void;
}

const ICON_OPTIONS = ['Award', 'ShieldCheck', 'Zap', 'Flame', 'Code2', 'Blocks', 'Cpu', 'Globe', 'Lock', 'KeyRound'];
const COLOR_SWATCHES = ['#3b82f6', '#60a5fa', '#22d3ee', '#34d399', '#a78bfa', '#f59e0b', '#f43f5e', '#f4f4f5'];

const BADGE_ICONS: Record<string, React.ReactNode> = {
  Award: <Award className="h-6 w-6" />,
  ShieldCheck: <ShieldCheck className="h-6 w-6" />,
  Zap: <Zap className="h-6 w-6" />,
  Flame: <Flame className="h-6 w-6" />,
};

export const CredentialsEditor: React.FC<CredentialsEditorProps> = ({
  badges,
  onUpdateBadge,
  onCreateBadge,
  onDeleteBadge,
}) => {
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(badges[0]?.id || null);
  const selected = badges.find((b) => b.id === selectedBadgeId) || null;

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newIcon, setNewIcon] = useState('Award');
  const [newImage, setNewImage] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateBadge({
      id: `badge_${Date.now()}`,
      name: newName,
      description: 'Newly created credential',
      category: 'Smart Contracts',
      iconName: newIcon,
      color: newColor,
      imageUrl: newImage || undefined,
      xpBonus: 100,
      awardOn: 'completion',
    });
    setNewName('');
    setNewImage('');
  };

  const toDataUrl = (file: File, cb: (url: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result));
    reader.readAsDataURL(file);
  };

  const badgeVisual = (badge: Badge) =>
    badge.imageUrl ? (
      <img src={badge.imageUrl} alt={badge.name} className="w-full h-full object-cover" />
    ) : (
      <>{BADGE_ICONS[badge.iconName] || <Award className="h-6 w-6" />}</>
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: badge list + create */}
      <div className="space-y-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
            <Award className="h-4 w-4 text-blue-accent" />
            Badges & Credentials
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {badges.map((badge) => (
              <div
                key={badge.id}
                onClick={() => setSelectedBadgeId(badge.id)}
                className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  selectedBadgeId === badge.id
                    ? 'border-blue-700 bg-blue-soft'
                    : 'border-zinc-800 bg-black hover:border-zinc-600'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 overflow-hidden"
                  style={{ backgroundColor: badge.color }}
                >
                  {badgeVisual(badge)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{badge.name}</p>
                  <p className="text-[11px] font-mono text-zinc-400">
                    +{badge.xpBonus} XP · {badge.awardOn || 'completion'}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBadge(badge.id);
                    if (selectedBadgeId === badge.id) setSelectedBadgeId(null);
                  }}
                  className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg"
                  title="Delete badge"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {badges.length === 0 && (
              <p className="text-xs text-zinc-500 font-mono text-center py-6">No badges created yet.</p>
            )}
          </div>
        </div>

        {/* Create new badge */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-widest">Create Badge</h3>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Badge name (e.g. Solidity Master)"
            className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
          />
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setNewIcon(icon)}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-mono font-bold ${
                      newIcon === icon ? 'border-blue-500 bg-blue-soft text-blue-accent' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {icon.slice(0, 1)}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 ml-auto">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-7 h-7 rounded-lg border-2 ${newColor === c ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200 transition-colors">
                <ImagePlus className="h-3.5 w-3.5" />
                {newImage ? 'Change image' : 'Upload badge image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) toDataUrl(file, (url) => setNewImage(url));
                  }}
                />
              </label>
              {newImage && (
                <>
                  <img src={newImage} alt="badge preview" className="h-8 w-8 rounded-lg object-cover border border-zinc-700" />
                  <button onClick={() => setNewImage('')} className="text-[11px] font-mono text-zinc-500 hover:text-white underline">
                    Clear
                  </button>
                </>
              )}
            </div>
          <button
            onClick={handleCreate}
            className="w-full py-2.5 btn-primary-blue text-white text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 font-heading"
          >
            <PlusCircle className="h-4 w-4" />
            Create Badge
          </button>
        </div>
      </div>

      {/* RIGHT: selected badge editor + certificate template */}
      <div className="space-y-4">
        {selected && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
              <Palette className="h-4 w-4 text-blue-accent" />
              Edit Badge: {selected.name}
            </h3>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Name</label>
              <input
                value={selected.name}
                onChange={(e) => onUpdateBadge(selected.id, { name: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Description</label>
              <textarea
                value={selected.description}
                onChange={(e) => onUpdateBadge(selected.id, { description: e.target.value })}
                rows={2}
                className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">XP Bonus</label>
                <input
                  type="number"
                  value={selected.xpBonus}
                  onChange={(e) => onUpdateBadge(selected.id, { xpBonus: Number(e.target.value) })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Granted when</label>
                <select
                  value={selected.awardOn || 'completion'}
                  onChange={(e) => onUpdateBadge(selected.id, { awardOn: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="completion">Lab completed</option>
                  <option value="page:1">After Page 1</option>
                  <option value="page:2">After Page 2</option>
                  <option value="page:3">After Page 3</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Badge image (optional — overrides icon/color)</label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200 transition-colors">
                  <ImagePlus className="h-3.5 w-3.5" />
                  {selected.imageUrl ? 'Change image' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) toDataUrl(file, (url) => onUpdateBadge(selected.id, { imageUrl: url }));
                    }}
                  />
                </label>
                {selected.imageUrl && (
                  <button
                    onClick={() => onUpdateBadge(selected.id, { imageUrl: undefined })}
                    className="text-[11px] font-mono text-zinc-500 hover:text-white underline"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">Color</label>
              <div className="flex gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => onUpdateBadge(selected.id, { color: c })}
                    className={`w-8 h-8 rounded-lg border-2 ${selected.color === c ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Live preview */}
            <div className="pt-3 border-t border-zinc-800">
              <p className="text-[11px] font-mono text-zinc-400 mb-2">Live preview</p>
              <div className="flex items-center gap-4 bg-black border border-zinc-800 rounded-2xl p-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg overflow-hidden"
                  style={{ backgroundColor: selected.color, boxShadow: `0 0 24px ${selected.color}55` }}
                >
                  {badgeVisual(selected)}
                </div>
                <div>
                  <p className="text-base font-black text-white font-heading">{selected.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{selected.description}</p>
                  <p className="text-[11px] font-mono text-blue-accent mt-1">+{selected.xpBonus} XP</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Certificate template helper */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-accent" />
            Certificate Template
          </h3>
          <div className="rounded-2xl border border-zinc-700 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-600 flex items-center justify-center text-white mb-3">
              <BadgeCheck className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-mono text-blue-accent uppercase tracking-widest font-bold">ZEXVRO CERTIFIES</p>
            <p className="text-xl font-black text-white font-heading my-1">{"{username}"}</p>
            <p className="text-xs text-zinc-400 font-mono">for completing</p>
            <p className="text-base font-bold text-blue-accent font-heading my-1">{"{labname}"}</p>
            <p className="text-xs text-zinc-500 font-mono mt-2">Issued {"{date}"} · Verified via QR</p>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5">
            <QrCode className="h-3.5 w-3.5" />
            Vars: <span className="text-blue-accent">{"{username}"}</span>, <span className="text-blue-accent">{"{labname}"}</span>, <span className="text-blue-accent">{"{date}"}</span>
          </p>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
            <ImagePlus className="h-3.5 w-3.5" /> Logo upload & QR verify box land here with full canvas editor in the lab management panel.
          </div>
          <button
            onClick={() => onCreateBadge({
              id: 'cert_template',
              name: 'Default Certificate',
              description: 'Official completion certificate',
              category: 'Smart Contracts',
              iconName: 'ShieldCheck',
              color: '#3b82f6',
              xpBonus: 0,
              awardOn: 'completion',
            })}
            className="text-[11px] font-mono text-blue-accent hover:text-white underline font-bold"
          >
            <Save className="h-3 w-3 inline mr-1" />
            Use default template
          </button>
        </div>
      </div>
    </div>
  );
};
