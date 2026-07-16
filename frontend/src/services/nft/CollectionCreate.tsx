import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  CloudUpload,
  FileImage,
  Gamepad2,
  ImagePlus,
  Info,
  LoaderCircle,
  RadioTower,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { NftCollectionDraft } from '../../types';
import {
  clearCollectionDraft,
  loadCollectionDraft,
  saveCollectionDraft,
} from './collectionStore';
import {
  NFT_MEDIA_ACCEPT,
  NFT_MEDIA_MAX_BYTES,
  normalizeNftImageFile,
} from './media';
import {
  createNftCollection,
  getNftServiceHealth,
  uploadNftMedia,
  type NftServiceHealth,
} from './nftApi';

interface CollectionCreateProps {
  workspaceId: string;
  accessToken: string;
  onClose: () => void;
}

type FieldName =
  | 'name'
  | 'symbol'
  | 'description'
  | 'cover'
  | 'ownerAddress'
  | 'royaltyRecipient'
  | 'royalty'
  | 'baseMetadataUri'
  | 'externalUrl';

type FieldErrors = Partial<Record<FieldName, string>>;

const DEFAULT_OWNER = import.meta.env.VITE_STELLAR_OWNER_ADDRESS?.trim() || '';
const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;
const IPFS_BASE_URI = /^ipfs:\/\/[A-Za-z0-9]+(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%-]+)*\/$/;

const STEPS = [
  { number: 1, label: 'Details' },
  { number: 2, label: 'Media & ownership' },
  { number: 3, label: 'Review' },
];

function emptyDraft(): NftCollectionDraft {
  return {
    name: '',
    symbol: '',
    description: '',
    coverName: '',
    royaltyBps: 500,
    ownerAddress: DEFAULT_OWNER,
    royaltyRecipient: DEFAULT_OWNER,
    baseMetadataUri: '',
    externalUrl: '',
  };
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateDetails(draft: NftCollectionDraft): FieldErrors {
  const errors: FieldErrors = {};
  const name = draft.name.trim();
  const description = draft.description.trim();
  if (name.length < 3 || name.length > 64) errors.name = 'Use 3–64 characters.';
  if (!/^[A-Z0-9]{2,10}$/.test(draft.symbol)) errors.symbol = 'Use 2–10 uppercase letters or numbers.';
  if (description.length < 10 || description.length > 500) errors.description = 'Use 10–500 characters.';
  if (draft.externalUrl?.trim() && !isHttpUrl(draft.externalUrl.trim())) {
    errors.externalUrl = 'Use a valid HTTP or HTTPS URL.';
  }
  return errors;
}

function validateDeployment(
  draft: NftCollectionDraft,
  coverFile: File | null,
  health: NftServiceHealth | null,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!coverFile) errors.cover = 'Select a cover image for this browser session.';
  if (!STELLAR_ADDRESS.test(draft.ownerAddress?.trim() || '')) {
    errors.ownerAddress = 'Enter a Stellar public G-address.';
  }
  if (!STELLAR_ADDRESS.test(draft.royaltyRecipient?.trim() || '')) {
    errors.royaltyRecipient = 'Enter a Stellar public G-address.';
  }
  if (!Number.isInteger(draft.royaltyBps) || draft.royaltyBps < 0 || draft.royaltyBps > 1000) {
    errors.royalty = 'Royalty must be between 0% and 10%.';
  }
  if (
    health?.capabilities.storageMode === 'pinata' &&
    !IPFS_BASE_URI.test(draft.baseMetadataUri?.trim() || '')
  ) {
    errors.baseMetadataUri = 'Enter an IPFS base URI ending with a slash.';
  }
  return errors;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return 'The NFT service could not complete this deployment.';
}

export default function CollectionCreate({ workspaceId, accessToken, onClose }: CollectionCreateProps) {
  const uploadId = useId();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<NftCollectionDraft>(() => loadCollectionDraft(workspaceId) || emptyDraft());
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [health, setHealth] = useState<NftServiceHealth | null>(null);
  const [healthError, setHealthError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'uploading' | 'deploying'>('idle');
  const skipHydrationSave = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setHealth(null);
    setHealthError('');
    getNftServiceHealth(controller.signal)
      .then(setHealth)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setHealthError(errorMessage(error));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    skipHydrationSave.current = true;
    setDraft(loadCollectionDraft(workspaceId) || emptyDraft());
    setCoverFile(null);
    setCoverPreview('');
    setStep(1);
    setErrors({});
    setSubmitError('');
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
  const isSubmitting = submitStatus !== 'idle';

  const updateDraft = <Key extends keyof NftCollectionDraft>(key: Key, value: NftCollectionDraft[Key]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: undefined }));
  };

  const updateOwner = (ownerAddress: string) => {
    setDraft(previous => ({
      ...previous,
      ownerAddress,
      royaltyRecipient:
        !previous.royaltyRecipient || previous.royaltyRecipient === previous.ownerAddress
          ? ownerAddress
          : previous.royaltyRecipient,
    }));
    setErrors(previous => ({ ...previous, ownerAddress: undefined, royaltyRecipient: undefined }));
  };

  const selectCover = (file: File | null, input?: HTMLInputElement | null) => {
    if (!file) return;

    const normalized = normalizeNftImageFile(file);
    if (!normalized) {
      setErrors(previous => ({ ...previous, cover: 'Choose a PNG, JPEG, WebP, or SVG image.' }));
      if (input) input.value = '';
      return;
    }
    if (normalized.size > NFT_MEDIA_MAX_BYTES) {
      setErrors(previous => ({ ...previous, cover: 'Image must be 5 MB or smaller.' }));
      if (input) input.value = '';
      return;
    }

    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(normalized);
    setCoverPreview(URL.createObjectURL(normalized));
    updateDraft('coverName', normalized.name);
    setErrors(previous => ({ ...previous, cover: undefined }));
  };

  const goForward = () => {
    if (step === 1) {
      const detailErrors = validateDetails(draft);
      setErrors(detailErrors);
      if (Object.keys(detailErrors).length > 0) return;
    }
    if (step === 2) {
      const deploymentErrors = validateDeployment(draft, coverFile, health);
      setErrors(deploymentErrors);
      if (Object.keys(deploymentErrors).length > 0) return;
    }
    setStep(previous => Math.min(3, previous + 1));
  };

  const confirmCollection = async () => {
    const detailErrors = validateDetails(draft);
    const deploymentErrors = validateDeployment(draft, coverFile, health);
    const nextErrors = { ...detailErrors, ...deploymentErrors };
    if (Object.keys(nextErrors).length > 0 || !coverFile) {
      setErrors(nextErrors);
      setStep(detailErrors.name || detailErrors.symbol || detailErrors.description || detailErrors.externalUrl ? 1 : 2);
      return;
    }

    setSubmitError('');
    try {
      const currentHealth = health || await getNftServiceHealth();
      setHealth(currentHealth);
      if (!currentHealth.capabilities.stellarConfigured) {
        throw new Error('Stellar deployment is not configured on the NFT service.');
      }
      if (!currentHealth.capabilities.pinningConfigured) {
        throw new Error('Media storage is not configured on the NFT service.');
      }

      setSubmitStatus('uploading');
      const asset = await uploadNftMedia(coverFile, accessToken);
      setSubmitStatus('deploying');
      await createNftCollection({
        workspaceId,
        name: draft.name.trim(),
        symbol: draft.symbol,
        description: draft.description.trim(),
        ownerAddress: draft.ownerAddress!.trim(),
        coverImageUri: asset.uri,
        royaltyRecipient: draft.royaltyRecipient!.trim(),
        royaltyBps: draft.royaltyBps,
        ...(draft.baseMetadataUri?.trim() ? { baseMetadataUri: draft.baseMetadataUri.trim() } : {}),
        ...(draft.externalUrl?.trim() ? { externalUrl: draft.externalUrl.trim() } : {}),
      }, accessToken);
      clearCollectionDraft(workspaceId);
      onClose();
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitStatus('idle');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="border-b border-zinc-200 pb-5 dark:border-zinc-900">
        <button
          type="button"
          onClick={onClose}
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
            <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Deploy a Stellar collection</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Upload collection media and deploy its Soroban contract to Stellar testnet.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-px border-y border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 sm:grid-cols-3">
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <RadioTower className={`h-4 w-4 ${health ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">API</span>
          <span className="ml-auto font-medium text-zinc-800 dark:text-zinc-200">{health ? 'Connected' : healthError ? 'Unavailable' : 'Checking'}</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <ShieldCheck className={`h-4 w-4 ${health?.capabilities.stellarConfigured ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">Network</span>
          <span className="ml-auto font-medium text-zinc-800 dark:text-zinc-200">Stellar testnet</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2.5 text-xs dark:bg-[#050506]">
          <CloudUpload className={`h-4 w-4 ${health?.capabilities.pinningConfigured ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span className="text-zinc-500 dark:text-zinc-400">Media</span>
          <span className="ml-auto font-medium capitalize text-zinc-800 dark:text-zinc-200">{health?.capabilities.storageMode || 'Checking'}</span>
        </div>
      </div>

      {healthError && (
        <div className="flex gap-2.5 border border-red-500/25 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400" role="alert">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {healthError}
        </div>
      )}

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
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">These values become the collection identity used by the contract.</p>
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
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Gameplay URL <span className="font-normal text-zinc-400">(optional)</span>
            <input
              type="url"
              value={draft.externalUrl || ''}
              onChange={event => updateDraft('externalUrl', event.target.value)}
              placeholder="https://studio.example/games/astral-gear"
              className={`mt-2 w-full rounded-md border bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition dark:bg-[#0A0A0B] dark:text-white ${errors.externalUrl ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'}`}
            />
            <span className={`mt-1.5 block text-xs font-normal ${errors.externalUrl ? 'text-red-500' : 'text-zinc-400'}`}>
              {errors.externalUrl || 'A mutable external reference; it is not presented as immutable on-chain metadata.'}
            </span>
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Media, ownership, and royalties</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Only public wallet addresses enter the browser. The service sponsor key stays on the backend.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
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
                    <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">PNG, JPEG, WebP, or SVG up to 5 MB</span>
                  </span>
                )}
              </label>
              <input
                id={uploadId}
                type="file"
                accept={NFT_MEDIA_ACCEPT}
                onChange={event => selectCover(event.target.files?.[0] || null, event.target)}
                className="sr-only"
              />
              <div className="mt-2 flex min-h-5 items-center justify-between gap-3 text-xs">
                <span className={errors.cover ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}>
                  {errors.cover || (coverFile ? `${coverFile.name} (${(coverFile.size / 1024 / 1024).toFixed(2)} MB)` : 'No image selected')}
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
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Creator wallet
                <input
                  value={draft.ownerAddress || ''}
                  onChange={event => updateOwner(event.target.value.toUpperCase().trim())}
                  placeholder="G..."
                  spellCheck={false}
                  className={`mt-2 w-full rounded-md border bg-white px-3 py-2.5 font-mono text-xs text-zinc-950 outline-none dark:bg-[#0A0A0B] dark:text-white ${errors.ownerAddress ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'}`}
                />
                {errors.ownerAddress && <span className="mt-1.5 block text-xs font-normal text-red-500">{errors.ownerAddress}</span>}
              </label>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Royalty recipient
                <input
                  value={draft.royaltyRecipient || ''}
                  onChange={event => updateDraft('royaltyRecipient', event.target.value.toUpperCase().trim())}
                  placeholder="G..."
                  spellCheck={false}
                  className={`mt-2 w-full rounded-md border bg-white px-3 py-2.5 font-mono text-xs text-zinc-950 outline-none dark:bg-[#0A0A0B] dark:text-white ${errors.royaltyRecipient ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'}`}
                />
                {errors.royaltyRecipient && <span className="mt-1.5 block text-xs font-normal text-red-500">{errors.royaltyRecipient}</span>}
              </label>
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
              {health?.capabilities.storageMode === 'pinata' && (
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Token metadata base URI
                  <input
                    value={draft.baseMetadataUri || ''}
                    onChange={event => updateDraft('baseMetadataUri', event.target.value)}
                    placeholder="ipfs://bafy.../"
                    className={`mt-2 w-full rounded-md border bg-white px-3 py-2.5 font-mono text-xs text-zinc-950 outline-none dark:bg-[#0A0A0B] dark:text-white ${errors.baseMetadataUri ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'}`}
                  />
                  {errors.baseMetadataUri && <span className="mt-1.5 block text-xs font-normal text-red-500">{errors.baseMetadataUri}</span>}
                </label>
              )}
              <div className="flex gap-2.5 border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
                Royalties are exposed for compatible sales but cannot be enforced on arbitrary transfers.
              </div>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Review deployment</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">The backend uploads the cover first, then deploys one Soroban contract for this collection.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
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
                ['Creator wallet', draft.ownerAddress],
                ['Royalty recipient', draft.royaltyRecipient],
                ['Royalty preference', `${royaltyPercent.toFixed(2)}%`],
                [
                  'Media storage',
                  health?.capabilities.storageMode === 'local'
                    ? 'Local test storage'
                    : health?.capabilities.storageMode === 's3'
                      ? 'AWS S3'
                      : health?.capabilities.storageMode === 'pinata'
                        ? 'Pinata IPFS (legacy)'
                        : 'Checking',
                ],
                ['Network', 'Stellar testnet'],
                ['Status after confirmation', 'Live after successful deployment'],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 py-3 sm:grid-cols-[190px_minmax(0,1fr)]">
                  <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
                  <dd className="break-all font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          {health?.capabilities.storageMode === 'local' && (
            <div className="flex gap-2.5 border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              Local test storage is content-addressed HTTP only. Use NFT_STORAGE_MODE=s3 with an S3 bucket for production media.
            </div>
          )}
          {health?.capabilities.storageMode === 's3' && (
            <div className="flex gap-2.5 border border-brand-blue/25 bg-brand-blue/5 p-3 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
              Media uploads go to AWS S3. Token metadata can use the API public routes or an HTTPS directory URI ending with /.
            </div>
          )}
          {submitError && (
            <div className="flex gap-2.5 border border-red-500/25 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400" role="alert">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {submitError}
            </div>
          )}
        </section>
      )}

      <footer className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => step === 1 ? onClose() : setStep(previous => previous - 1)}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
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
            disabled={isSubmitting}
            onClick={() => void confirmCollection()}
            className="inline-flex min-w-44 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
            {submitStatus === 'uploading' ? 'Uploading cover...' : submitStatus === 'deploying' ? 'Deploying contract...' : 'Deploy collection'}
          </button>
        )}
      </footer>
    </div>
  );
}
