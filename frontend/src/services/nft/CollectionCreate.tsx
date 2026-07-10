import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileImage,
  Gamepad2,
  ImagePlus,
  Info,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NftCollectionDraft } from '../../types';
import {
  clearCollectionDraft,
  createCollection,
  loadCollectionDraft,
  saveCollectionDraft,
} from './collectionStore';

interface CollectionCreateProps {
  workspaceId: string;
}

type FieldErrors = Partial<Record<'name' | 'symbol' | 'description' | 'cover' | 'royalty', string>>;

const EMPTY_DRAFT: NftCollectionDraft = {
  name: '',
  symbol: '',
  description: '',
  coverName: '',
  royaltyBps: 500,
};

const STEPS = [
  { number: 1, label: 'Details' },
  { number: 2, label: 'Media & royalty' },
  { number: 3, label: 'Review' },
];

function validateDetails(draft: NftCollectionDraft): FieldErrors {
  const errors: FieldErrors = {};
  const name = draft.name.trim();
  const description = draft.description.trim();
  if (name.length < 3 || name.length > 64) errors.name = 'Use 3–64 characters.';
  if (!/^[A-Z0-9]{2,10}$/.test(draft.symbol)) errors.symbol = 'Use 2–10 uppercase letters or numbers.';
  if (description.length < 10 || description.length > 500) errors.description = 'Use 10–500 characters.';
  return errors;
}

export default function CollectionCreate({ workspaceId }: CollectionCreateProps) {
  const navigate = useNavigate();
  const uploadId = useId();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<NftCollectionDraft>(() => loadCollectionDraft(workspaceId) || EMPTY_DRAFT);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const skipHydrationSave = useRef(false);

  useEffect(() => {
    skipHydrationSave.current = true;
    setDraft(loadCollectionDraft(workspaceId) || EMPTY_DRAFT);
    setCoverFile(null);
    setCoverPreview('');
    setStep(1);
    setErrors({});
  }, [workspaceId]);

  useEffect(() => {
    if (skipHydrationSave.current) {
      skipHydrationSave.current = false;
      return;
    }
    saveCollectionDraft(workspaceId, draft);
  }, [draft, workspaceId]);

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const royaltyPercent = useMemo(() => draft.royaltyBps / 100, [draft.royaltyBps]);

  const updateDraft = <Key extends keyof NftCollectionDraft>(key: Key, value: NftCollectionDraft[Key]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: undefined }));
  };

  const selectCover = (file: File | null) => {
    if (!file) return;
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrors(previous => ({ ...previous, cover: 'Choose a PNG, JPEG, or WebP image.' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(previous => ({ ...previous, cover: 'Image must be 5 MB or smaller.' }));
      return;
    }

    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    updateDraft('coverName', file.name);
    setErrors(previous => ({ ...previous, cover: undefined }));
  };

  const goForward = () => {
    if (step === 1) {
      const detailErrors = validateDetails(draft);
      setErrors(detailErrors);
      if (Object.keys(detailErrors).length > 0) return;
    }
    if (step === 2) {
      const mediaErrors: FieldErrors = {};
      if (!coverFile) mediaErrors.cover = 'Select a cover image for this browser session.';
      if (draft.royaltyBps < 0 || draft.royaltyBps > 1000) mediaErrors.royalty = 'Royalty must be between 0% and 10%.';
      setErrors(mediaErrors);
      if (Object.keys(mediaErrors).length > 0) return;
    }
    setStep(previous => Math.min(3, previous + 1));
  };

  const confirmCollection = () => {
    const detailErrors = validateDetails(draft);
    if (!coverFile) detailErrors.cover = 'Select a cover image before confirming.';
    if (Object.keys(detailErrors).length > 0) {
      setErrors(detailErrors);
      setStep(detailErrors.name || detailErrors.symbol || detailErrors.description ? 1 : 2);
      return;
    }

    createCollection(workspaceId, draft);
    clearCollectionDraft(workspaceId);
    navigate('/services/nft');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="border-b border-zinc-200 pb-5 dark:border-zinc-900">
        <button
          type="button"
          onClick={() => navigate('/services/nft')}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Collections
        </button>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-brand-blue dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <Gamepad2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Create collection</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Prepare a local Stellar collection draft in three steps.</p>
          </div>
        </div>
      </header>

      <ol className="grid grid-cols-3 border-b border-zinc-200 dark:border-zinc-800" aria-label="Collection setup progress">
        {STEPS.map(item => {
          const isActive = item.number === step;
          const isComplete = item.number < step;
          return (
            <li key={item.number} className={`border-b-2 px-2 pb-3 text-center text-xs font-medium sm:text-left ${
              isActive
                ? 'border-brand-blue text-zinc-950 dark:text-white'
                : isComplete
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-zinc-400'
            }`}>
              <span className="inline-flex items-center gap-2">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                  isComplete ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-current'
                }`}>
                  {isComplete ? <Check className="h-3 w-3" /> : item.number}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <section className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Collection details</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Use labels your players will recognize. These values are still editable in this draft.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Name
              <input
                value={draft.name}
                onChange={event => updateDraft('name', event.target.value)}
                placeholder="Astral Gear"
                maxLength={64}
                className={`mt-2 w-full rounded-md border bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition dark:bg-[#0A0A0B] dark:text-white ${errors.name ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'}`}
              />
              {errors.name && <span className="mt-1.5 block text-xs font-normal text-red-500">{errors.name}</span>}
            </label>
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Symbol
              <input
                value={draft.symbol}
                onChange={event => updateDraft('symbol', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                placeholder="GEAR"
                className={`mt-2 w-full rounded-md border bg-white px-3 py-2.5 font-mono text-sm text-zinc-950 outline-none transition dark:bg-[#0A0A0B] dark:text-white ${errors.symbol ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'}`}
              />
              {errors.symbol && <span className="mt-1.5 block text-xs font-normal text-red-500">{errors.symbol}</span>}
            </label>
          </div>
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Description
            <textarea
              value={draft.description}
              onChange={event => updateDraft('description', event.target.value)}
              placeholder="Equipment and artifacts used across the Astral Gear game world."
              rows={5}
              maxLength={500}
              className={`mt-2 w-full resize-y rounded-md border bg-white px-3 py-2.5 text-sm leading-6 text-zinc-950 outline-none transition dark:bg-[#0A0A0B] dark:text-white ${errors.description ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'}`}
            />
            <span className="mt-1.5 flex justify-between text-xs font-normal text-zinc-400">
              <span>{errors.description || 'Explain what this collection represents in your game.'}</span>
              <span>{draft.description.length}/500</span>
            </span>
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Media and royalty preference</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">The image stays in this browser session. Upload and IPFS pinning are not connected yet.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <label
                htmlFor={uploadId}
                className={`flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed bg-zinc-50 text-center transition hover:border-brand-blue/60 dark:bg-zinc-950/30 ${errors.cover ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="Collection cover preview" className="h-64 w-full object-cover" />
                ) : (
                  <span className="px-6 py-12">
                    <ImagePlus className="mx-auto h-7 w-7 text-zinc-400" />
                    <span className="mt-4 block text-sm font-medium text-zinc-800 dark:text-zinc-200">Choose collection cover</span>
                    <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">PNG, JPEG, or WebP up to 5 MB</span>
                  </span>
                )}
              </label>
              <input
                id={uploadId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={event => selectCover(event.target.files?.[0] || null)}
                className="sr-only"
              />
              <div className="mt-2 flex min-h-5 items-center justify-between gap-3 text-xs">
                <span className={errors.cover ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}>
                  {errors.cover || (coverFile ? `${coverFile.name} · ${(coverFile.size / 1024 / 1024).toFixed(2)} MB` : 'No image selected')}
                </span>
                {coverFile && (
                  <button
                    type="button"
                    onClick={() => {
                      if (coverPreview) URL.revokeObjectURL(coverPreview);
                      setCoverFile(null);
                      setCoverPreview('');
                      updateDraft('coverName', '');
                    }}
                    className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4 border-t border-zinc-200 pt-5 dark:border-zinc-800 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div>
                <label htmlFor="royalty" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Royalty preference</label>
                <div className="relative mt-2">
                  <input
                    id="royalty"
                    type="number"
                    min="0"
                    max="10"
                    step="0.25"
                    value={royaltyPercent}
                    onChange={event => updateDraft('royaltyBps', Math.round(Number(event.target.value) * 100))}
                    className={`w-full rounded-md border bg-white px-3 py-2.5 pr-9 text-sm text-zinc-950 outline-none dark:bg-[#0A0A0B] dark:text-white ${errors.royalty ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">%</span>
                </div>
                {errors.royalty && <p className="mt-1.5 text-xs text-red-500">{errors.royalty}</p>}
              </div>
              <div className="flex gap-2.5 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
                This records a preference only. Royalties are not enforced on arbitrary transfers, and no marketplace is connected.
              </div>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Review local draft</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Confirm what will be saved to this workspace in browser storage.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30">
              {coverPreview ? (
                <img src={coverPreview} alt="Collection cover" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400"><FileImage className="h-8 w-8" /></div>
              )}
            </div>
            <dl className="divide-y divide-zinc-200 border-y border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
              {[
                ['Name', draft.name],
                ['Symbol', draft.symbol],
                ['Description', draft.description],
                ['Cover', draft.coverName],
                ['Royalty preference', `${royaltyPercent.toFixed(2)}%`],
                ['Network', 'Stellar · not connected'],
                ['Status after save', 'Local draft'],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 py-3 sm:grid-cols-[170px_1fr]">
                  <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
                  <dd className="break-words font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex gap-2.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            Confirming does not deploy a contract, upload media, create a wallet, or charge fees.
          </div>
        </section>
      )}

      <footer className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => step === 1 ? navigate('/services/nft') : setStep(previous => previous - 1)}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        {step < 3 ? (
          <button
            type="button"
            onClick={goForward}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={confirmCollection}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <Check className="h-4 w-4" />
            Save local draft
          </button>
        )}
      </footer>
    </div>
  );
}
