import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ImagePlus,
  LoaderCircle,
  X,
} from 'lucide-react';
import type { NftCollectionDraft } from '../../types';
import {
  clearCollectionDraft,
  loadCollectionDraft,
  saveCollectionDraft,
} from './collectionStore';
import {
  createNftCollection,
  getNftServiceHealth,
  prepareNftSaleConfig,
  submitNftSaleConfig,
  uploadNftMedia,
  type ApiNftCollection,
  type NftServiceHealth,
} from './nftApi';
import { formatWalletError, getPublicKey, isWalletAvailable, signTransaction } from './stellarWallet';

interface CollectionCreateProps {
  workspaceId: string;
  accessToken: string;
  onClose: () => void;
  onCreated?: (collection: ApiNftCollection) => void;
}

type FieldName = 'name' | 'description' | 'cover' | 'unitPriceXlm' | 'ownerAddress';
type FieldErrors = Partial<Record<FieldName, string>>;

const DEFAULT_OWNER = import.meta.env.VITE_STELLAR_OWNER_ADDRESS?.trim() || '';
const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

const STEPS = [
  { number: 1, label: 'NFT details' },
  { number: 2, label: 'Price' },
  { number: 3, label: 'Wallet' },
];

function emptyDraft(): NftCollectionDraft {
  return {
    name: '',
    symbol: '',
    description: '',
    coverName: '',
    royaltyBps: 0,
    unitPriceXlm: '1',
    ownerAddress: DEFAULT_OWNER,
    royaltyRecipient: DEFAULT_OWNER,
  };
}

function autoSymbol(name: string) {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length >= 2) return cleaned.slice(0, 10);
  const fallback = `NFT${cleaned}`.slice(0, 10);
  return fallback.length >= 2 ? fallback : 'NFT';
}

/** Convert display unit price to USDC atomic (7 decimals) for on-chain primary sale. */
function unitPriceToAtomicUsdc(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,7})?$/.test(trimmed)) return undefined;
  const [whole, fraction = ''] = trimmed.split('.');
  const atomic = BigInt(whole) * 10_000_000n + BigInt((fraction + '0000000').slice(0, 7));
  return atomic > 0n ? atomic.toString() : undefined;
}

function errorMessage(error: unknown) {
  const wallet = formatWalletError(error);
  if (wallet && wallet !== 'Wallet action failed.') return wallet;
  if (error instanceof Error && error.message) return error.message;
  return 'The NFT service could not complete this deployment.';
}

export default function CollectionCreate({
  workspaceId,
  accessToken,
  onClose,
  onCreated,
}: CollectionCreateProps) {
  const uploadId = useId();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<NftCollectionDraft>(() => loadCollectionDraft(workspaceId) || emptyDraft());
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [health, setHealth] = useState<NftServiceHealth | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'uploading' | 'deploying' | 'activating_sale'>('idle');
  const [connectingWallet, setConnectingWallet] = useState(false);
  const skipHydrationSave = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    getNftServiceHealth(controller.signal)
      .then(setHealth)
      .catch(() => {
        if (!controller.signal.aborted) setHealth(null);
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

  const isSubmitting = submitStatus !== 'idle';

  const updateDraft = <Key extends keyof NftCollectionDraft>(key: Key, value: NftCollectionDraft[Key]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key as FieldName]: undefined }));
  };

  const selectCover = (file: File | null) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrors((previous) => ({ ...previous, cover: 'Choose a PNG, JPEG, or WebP image.' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((previous) => ({ ...previous, cover: 'Image must be 5 MB or smaller.' }));
      return;
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    updateDraft('coverName', file.name);
    setErrors((previous) => ({ ...previous, cover: undefined }));
  };

  const validateStep1 = (): FieldErrors => {
    const next: FieldErrors = {};
    if (draft.name.trim().length < 3 || draft.name.trim().length > 64) next.name = 'Use 3–64 characters.';
    if (draft.description.trim().length < 10 || draft.description.trim().length > 500) {
      next.description = 'Use 10–500 characters.';
    }
    if (!coverFile) next.cover = 'Upload an NFT logo / cover image.';
    return next;
  };

  const validateStep2 = (): FieldErrors => {
    const next: FieldErrors = {};
    const price = (draft.unitPriceXlm || '').trim();
    if (!/^\d+(?:\.\d{1,7})?$/.test(price) || Number(price) <= 0) {
      next.unitPriceXlm = 'Enter a price greater than 0 (XLM).';
    }
    return next;
  };

  const validateStep3 = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!STELLAR_ADDRESS.test(draft.ownerAddress?.trim() || '')) {
      next.ownerAddress = 'Enter a valid Stellar G-address.';
    }
    return next;
  };

  const goForward = () => {
    if (step === 1) {
      const next = validateStep1();
      setErrors(next);
      if (Object.keys(next).length > 0) return;
      if (!draft.symbol || draft.symbol.length < 2) {
        updateDraft('symbol', autoSymbol(draft.name));
      }
    }
    if (step === 2) {
      const next = validateStep2();
      setErrors(next);
      if (Object.keys(next).length > 0) return;
    }
    setStep((previous) => Math.min(3, previous + 1));
  };

  const connectWallet = async () => {
    setConnectingWallet(true);
    setSubmitError('');
    try {
      if (!(await isWalletAvailable())) {
        throw new Error('Install and unlock Freighter (Testnet), then allow this site.');
      }
      const address = await getPublicKey();
      setDraft((previous) => ({
        ...previous,
        ownerAddress: address,
        royaltyRecipient: address,
      }));
      setErrors((previous) => ({ ...previous, ownerAddress: undefined }));
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setConnectingWallet(false);
    }
  };

  const confirmCollection = async () => {
    const all = { ...validateStep1(), ...validateStep2(), ...validateStep3() };
    if (Object.keys(all).length > 0 || !coverFile) {
      setErrors(all);
      if (all.name || all.description || all.cover) setStep(1);
      else if (all.unitPriceXlm) setStep(2);
      else setStep(3);
      return;
    }

    setSubmitError('');
    try {
      let currentHealth = health;
      try {
        currentHealth = currentHealth || await getNftServiceHealth();
        setHealth(currentHealth);
      } catch (healthError) {
        throw new Error(
          healthError instanceof Error
            ? healthError.message
            : 'Could not reach the NFT API health endpoint. Check VITE_NFT_API_URL.',
        );
      }
      const caps = currentHealth?.capabilities;
      if (!currentHealth || !caps) {
        throw new Error('NFT API health is unavailable. Refresh and try again.');
      }
      if (!caps.stellarConfigured) {
        throw new Error('Stellar deployment is not configured on the NFT service.');
      }
      if (!caps.pinningConfigured) {
        throw new Error('Media storage is not configured on the NFT service.');
      }

      setSubmitStatus('uploading');
      const asset = await uploadNftMedia(coverFile, accessToken);
      setSubmitStatus('deploying');
      const symbol = draft.symbol && draft.symbol.length >= 2 ? draft.symbol : autoSymbol(draft.name);
      const ownerAddress = draft.ownerAddress!.trim();
      let created = await createNftCollection({
        workspaceId,
        name: draft.name.trim(),
        symbol,
        description: draft.description.trim(),
        ownerAddress,
        coverImageUri: asset.uri,
        royaltyRecipient: (draft.royaltyRecipient || draft.ownerAddress)!.trim(),
        royaltyBps: draft.royaltyBps || 0,
      }, accessToken);

      // Activate primary sale so public checkout "Prepare purchase" is enabled immediately.
      const priceAtomic = unitPriceToAtomicUsdc(draft.unitPriceXlm || '1');
      if (created.status === 'live' && priceAtomic) {
        try {
          setSubmitStatus('activating_sale');
          const saleIntent = await prepareNftSaleConfig({
            collectionId: created.id,
            ownerAddress,
            priceAtomic,
            accessToken,
          });
          // Some sponsor setups auto-submit set_sale_config during prepare.
          if (saleIntent.autoSubmitted?.transactionHash) {
            // Persist via submit path is not needed; reload collection if API already marked sale.
            // Fall through — dashboard/public will reflect primarySale after prepare's server mark.
          } else if (saleIntent.requiredSigners?.length) {
            const signedTransaction = await signTransaction(saleIntent.serializedTransaction);
            const saleResult = await submitNftSaleConfig({
              collectionId: created.id,
              preparedTransaction: saleIntent.serializedTransaction,
              signedTransaction,
              priceAtomic,
              accessToken,
            });
            if (saleResult.collection) created = saleResult.collection;
          } else {
            // No signers required and no autoSubmitted — still record via submit with sponsor-only envelope.
            const saleResult = await submitNftSaleConfig({
              collectionId: created.id,
              preparedTransaction: saleIntent.serializedTransaction,
              signedTransaction: saleIntent.serializedTransaction,
              priceAtomic,
              accessToken,
            });
            if (saleResult.collection) created = saleResult.collection;
          }
        } catch (saleError) {
          // Collection exists; sale can still be activated from the dashboard.
          console.warn('[nft/create] primary sale activation deferred', saleError);
        }
      }

      clearCollectionDraft(workspaceId);
      onCreated?.(created);
      onClose();
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitStatus('idle');
    }
  };

  const price = (draft.unitPriceXlm || '0').trim() || '0';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b border-zinc-200 pb-5 dark:border-zinc-900">
        <button
          type="button"
          onClick={onClose}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Collections
        </button>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">Create NFT collection</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Name, logo, price, then your Stellar wallet — then open the collection dashboard.
        </p>
      </header>

      <ol className="grid grid-cols-3 border-b border-zinc-200 dark:border-zinc-800" aria-label="Setup progress">
        {STEPS.map((item) => {
          const isActive = item.number === step;
          const isComplete = item.number < step;
          return (
            <li
              key={item.number}
              className={`border-b-2 px-2 pb-3 text-center text-xs font-medium sm:text-left ${
                isActive
                  ? 'border-brand-blue text-zinc-950 dark:text-white'
                  : isComplete
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-zinc-400'
              }`}
            >
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
          <div className="grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div>
              <label
                htmlFor={uploadId}
                className={`flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-zinc-50 text-center transition hover:border-brand-blue/60 dark:bg-zinc-950/30 ${
                  errors.cover ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'
                }`}
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="NFT logo preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-4">
                    <ImagePlus className="mx-auto h-7 w-7 text-zinc-400" />
                    <span className="mt-3 block text-xs font-medium text-zinc-700 dark:text-zinc-200">NFT logo</span>
                    <span className="mt-1 block text-[11px] text-zinc-500">PNG / JPEG / WebP</span>
                  </span>
                )}
              </label>
              <input
                id={uploadId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => selectCover(event.target.files?.[0] || null)}
                className="sr-only"
              />
              {errors.cover && <p className="mt-2 text-xs text-red-500">{errors.cover}</p>}
              {coverFile && (
                <button
                  type="button"
                  onClick={() => {
                    if (coverPreview) URL.revokeObjectURL(coverPreview);
                    setCoverFile(null);
                    setCoverPreview('');
                    updateDraft('coverName', '');
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" /> Remove
                </button>
              )}
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                NFT name
                <input
                  value={draft.name}
                  onChange={(event) => {
                    updateDraft('name', event.target.value);
                    updateDraft('symbol', autoSymbol(event.target.value));
                  }}
                  placeholder="Astral Sword"
                  maxLength={64}
                  className={`mt-2 w-full rounded-md border bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none dark:bg-[#0A0A0B] dark:text-white ${
                    errors.name ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'
                  }`}
                />
                {errors.name && <span className="mt-1.5 block text-xs font-normal text-red-500">{errors.name}</span>}
              </label>
              <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Description
                <textarea
                  value={draft.description}
                  onChange={(event) => updateDraft('description', event.target.value)}
                  placeholder="What players unlock when they buy this NFT."
                  rows={5}
                  maxLength={500}
                  className={`mt-2 w-full resize-y rounded-md border bg-white px-3 py-2.5 text-sm leading-6 text-zinc-950 outline-none dark:bg-[#0A0A0B] dark:text-white ${
                    errors.description ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'
                  }`}
                />
                <span className="mt-1.5 flex justify-between text-xs font-normal text-zinc-400">
                  <span>{errors.description || 'Shown on checkout and public pages.'}</span>
                  <span>{draft.description.length}/500</span>
                </span>
              </label>
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                {coverPreview ? (
                  <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-400">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-zinc-950 dark:text-white">{draft.name || 'Untitled NFT'}</p>
                <p className="mt-0.5 font-mono text-xs text-zinc-500">{draft.symbol || 'NFT'}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">1 NFT</span>
              <span className="text-lg font-semibold text-zinc-400">=</span>
              <div className="flex items-center gap-2">
                <input
                  value={draft.unitPriceXlm || ''}
                  onChange={(event) => updateDraft('unitPriceXlm', event.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="10"
                  inputMode="decimal"
                  className={`w-28 rounded-md border bg-white px-3 py-2 text-center text-lg font-semibold tabular-nums text-zinc-950 outline-none dark:bg-[#0A0A0B] dark:text-white ${
                    errors.unitPriceXlm ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'
                  }`}
                />
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">XLM</span>
              </div>
            </div>
            {errors.unitPriceXlm && <p className="mt-2 text-xs text-red-500">{errors.unitPriceXlm}</p>}
            <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              After deploy, Freighter will ask you to activate the primary sale so buyers can purchase immediately (Stellar testnet XLM, same unit amount).
            </p>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#0A0A0B]">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">Developer wallet</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              This public address becomes the collection owner / creator wallet on Stellar testnet.
            </p>
            <label className="mt-4 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Wallet address
              <input
                value={draft.ownerAddress || ''}
                onChange={(event) => {
                  const value = event.target.value.toUpperCase().trim();
                  setDraft((previous) => ({
                    ...previous,
                    ownerAddress: value,
                    royaltyRecipient: value,
                  }));
                  setErrors((previous) => ({ ...previous, ownerAddress: undefined }));
                }}
                placeholder="G..."
                spellCheck={false}
                className={`mt-2 w-full rounded-md border bg-white px-3 py-2.5 font-mono text-xs text-zinc-950 outline-none dark:bg-[#0A0A0B] dark:text-white ${
                  errors.ownerAddress ? 'border-red-500' : 'border-zinc-200 focus:border-brand-blue dark:border-zinc-800'
                }`}
              />
              {errors.ownerAddress && (
                <span className="mt-1.5 block text-xs font-normal text-red-500">{errors.ownerAddress}</span>
              )}
            </label>
            <button
              type="button"
              disabled={connectingWallet}
              onClick={() => void connectWallet()}
              className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              {connectingWallet ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Connect Freighter
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-center gap-3">
              {coverPreview ? (
                <img src={coverPreview} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-950 dark:text-white">{draft.name}</p>
                <p className="text-xs text-zinc-500">1 NFT = {price} XLM</p>
              </div>
            </div>
          </div>

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
          onClick={() => (step === 1 ? onClose() : setStep((previous) => previous - 1))}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
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
            className="inline-flex min-w-44 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {submitStatus === 'uploading'
              ? 'Uploading logo…'
              : submitStatus === 'deploying'
                ? 'Deploying…'
                : submitStatus === 'activating_sale'
                  ? 'Activating sale (sign in Freighter)…'
                  : 'Create collection'}
          </button>
        )}
      </footer>
    </div>
  );
}
