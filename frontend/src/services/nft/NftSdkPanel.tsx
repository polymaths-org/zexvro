import { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Gamepad2,
  Link2,
  Server,
  Sparkles,
  X,
} from 'lucide-react';

export type SdkSnippetTab = 'popup' | 'custom' | 'backend' | 'script';

export interface NftSdkPanelProps {
  collectionId?: string;
  collectionName?: string;
  onClose?: () => void;
  /** When true, render as a fixed modal overlay. Default true when onClose provided. */
  modal?: boolean;
}

function resolveAppOrigin() {
  if (typeof window === 'undefined') return 'https://app.zexvro.local';
  return window.location.origin;
}

function resolveApiBase() {
  if (typeof window === 'undefined') return 'https://api.zexvro.local/api/nft';
  const configured = (import.meta.env.VITE_NFT_API_URL || '/api/nft').replace(/\/$/, '');
  if (configured.startsWith('http://') || configured.startsWith('https://')) return configured;
  return `${window.location.origin}${configured.startsWith('/') ? configured : `/${configured}`}`;
}

function buildSnippets(input: {
  collectionId: string;
  appOrigin: string;
  apiBase: string;
}) {
  const { collectionId, appOrigin, apiBase } = input;
  const embedUrl = `${appOrigin}/nft/embed/checkout?collectionId=${collectionId}`;
  const publicUrl = `${appOrigin}/nft/collections/${collectionId}`;
  const brandingUrl = `${apiBase}/v1/public/collections/${collectionId}`;

  const popup = `// ZEXVRO NFT — popup checkout (Razorpay-style)
// Call openCheckout when the player buys an item.

import { openCheckout } from '@zexvro/nft-checkout-sdk'
// or copy packages/nft-checkout-sdk/src/index.js into your game

function buyItemInGame() {
  openCheckout({
    collectionId: '${collectionId}',
    checkoutOrigin: '${appOrigin}',
    onSuccess: ({ tokenId, transactionHash, buyerAddress }) => {
      console.log('Purchase confirmed', { tokenId, transactionHash, buyerAddress })
      // Unlock the in-game asset / call your game backend
    },
    onError: ({ message }) => {
      console.error('Checkout failed', message)
    },
    onClose: () => {
      console.log('Player closed checkout')
    },
  })
}

buyItemInGame()`;

  const custom = `// ZEXVRO NFT — custom checkout UI (headless client)
// Build your own buy modal; sign auth entries with Freighter.

import { createNftCheckoutClient } from '@zexvro/nft-checkout-sdk'

const client = createNftCheckoutClient({
  apiBase: '${apiBase}',
})

async function purchaseWithCustomUi(buyerAddress) {
  const { collection, inventory } = await client.getCollection('${collectionId}')
  console.log(collection.name, 'minted', inventory?.mintedCount)

  // tokenId omitted → platform auto-assigns the next free ID
  const intent = await client.createCheckoutIntent({
    collectionId: '${collectionId}',
    buyerAddress,
  })
  console.log('Reserved token', intent.tokenId)

  // signedTransaction = Freighter signAuthEntry on intent.serializedTransaction
  const confirmed = await client.submitCheckoutIntent({
    intentId: intent.id,
    signedTransaction,
  })

  return confirmed
}`;

  const backend = `# ZEXVRO NFT — backend / any language (public REST)
# Token IDs auto-allocate when you omit tokenId.
# Player still signs auth entries in a browser wallet.

export NFT_API='${apiBase}'
export COLLECTION_ID='${collectionId}'
export BUYER='G...YOUR_PLAYER_STELLAR_ADDRESS'

# 1) Collection branding (name + logo for in-game UI)
curl -s "$NFT_API/v1/public/collections/$COLLECTION_ID" | jq '{name, logo, logoUri, coverImageUri, symbol, description, primarySale}'
# branding URL: ${brandingUrl}

# 2) Create checkout intent (auto token id)
curl -s -X POST "$NFT_API/v1/public/checkout/intents" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d "{\\"collectionId\\":\\"$COLLECTION_ID\\",\\"buyerAddress\\":\\"$BUYER\\"}"

# 3) After Freighter signs auth entries, submit:
# curl -s -X POST "$NFT_API/v1/public/checkout/intents/\$INTENT_ID/submit" \\
#   -H "Content-Type: application/json" \\
#   -d '{"signedTransaction":"..."}'

# Public page:  ${publicUrl}
# Embed popup:  ${embedUrl}`;

  const script = `<!-- Drop-in script (no bundler) -->
<script type="module">
  import { openCheckout } from './vendor/zexvro-nft-checkout-sdk.js'

  document.getElementById('buy-btn')?.addEventListener('click', () => {
    openCheckout({
      collectionId: '${collectionId}',
      checkoutOrigin: '${appOrigin}',
      onSuccess: (payload) => {
        alert('Owned token #' + payload.tokenId)
      },
    })
  })
</script>
<button id="buy-btn">Buy NFT</button>

<!-- Optional iframe embed -->
<!-- <iframe src="${embedUrl}" width="420" height="720" title="ZEXVRO checkout"></iframe> -->`;

  return { popup, custom, backend, script, embedUrl, publicUrl, apiBase, appOrigin };
}

const TABS: Array<{
  id: SdkSnippetTab;
  label: string;
  hint: string;
  icon: typeof Sparkles;
  language: string;
}> = [
  { id: 'popup', label: 'Popup', hint: 'Hosted checkout window', icon: Sparkles, language: 'javascript' },
  { id: 'custom', label: 'Custom UI', hint: 'Headless JS client', icon: Code2, language: 'javascript' },
  { id: 'backend', label: 'Backend', hint: 'REST / curl', icon: Server, language: 'bash' },
  { id: 'script', label: 'Script tag', hint: 'HTML drop-in', icon: Gamepad2, language: 'html' },
];

const TAB_HELP: Record<SdkSnippetTab, string> = {
  popup: 'Best for web games. Opens a hosted checkout popup and returns success via callback.',
  custom: 'Build your own buy UI. Create an intent, sign with Freighter, then submit.',
  backend: 'Server creates intents. Player still signs in a wallet-capable client.',
  script: 'Paste into a simple HTML or web build without a package bundler.',
};

export function buildNftSdkSnippets(collectionId: string) {
  return buildSnippets({
    collectionId,
    appOrigin: resolveAppOrigin(),
    apiBase: resolveApiBase(),
  });
}

function CopyIconButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-white"
    >
      {active ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function NftSdkPanel({
  collectionId,
  collectionName,
  onClose,
  modal,
}: NftSdkPanelProps) {
  const [tab, setTab] = useState<SdkSnippetTab>('popup');
  const [copied, setCopied] = useState('');
  const selectedId = collectionId?.trim() || 'YOUR_COLLECTION_UUID';
  const isPlaceholder = !collectionId?.trim();

  const snippets = useMemo(
    () =>
      buildSnippets({
        collectionId: selectedId,
        appOrigin: resolveAppOrigin(),
        apiBase: resolveApiBase(),
      }),
    [selectedId],
  );

  const activeTab = TABS.find((item) => item.id === tab) || TABS[0];
  const activeCode = snippets[tab];

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied((current) => (current === label ? '' : current)), 1800);
    } catch {
      setCopied('failed');
    }
  };

  const body = (
    <section
      role="dialog"
      aria-modal={modal ?? Boolean(onClose)}
      aria-labelledby="nft-sdk-title"
      className="flex max-h-[min(92vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#0A0A0B]"
    >
      {/* Header */}
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
            <Code2 className="h-3.5 w-3.5 text-brand-blue" />
            Game integration
          </div>
          <h2 id="nft-sdk-title" className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">
            NFT SDK
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-5 text-zinc-500 dark:text-zinc-400">
            Copy-ready snippets for in-game purchase. Token IDs are assigned automatically.
          </p>
          {collectionName ? (
            <div className="mt-2.5 inline-flex max-w-full items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-950/50">
              <span className="text-zinc-500 dark:text-zinc-400">Collection</span>
              <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{collectionName}</span>
            </div>
          ) : null}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close SDK guide"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {isPlaceholder && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-2.5 text-sm leading-5 text-amber-800 dark:text-amber-200">
            No live collection selected. Snippets use{' '}
            <code className="rounded bg-amber-500/10 px-1 font-mono text-[12px]">YOUR_COLLECTION_UUID</code>.
            Open SDK from a live collection row to pre-fill the real ID.
          </div>
        )}

        {/* Credentials card */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="border-b border-zinc-200 px-3.5 py-2 dark:border-zinc-800">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">
              Connection values
            </p>
          </div>
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="border-b border-zinc-200 p-3.5 sm:border-b-0 sm:border-r dark:border-zinc-800">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Collection ID</span>
                <CopyIconButton
                  active={copied === 'collectionId'}
                  label="Copy collection ID"
                  onClick={() => void copy('collectionId', selectedId)}
                />
              </div>
              <input
                readOnly
                value={selectedId}
                className="w-full truncate rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 font-mono text-[11px] text-zinc-800 outline-none dark:border-zinc-800 dark:bg-[#050506] dark:text-zinc-200"
              />
            </div>
            <div className="p-3.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Public API base</span>
                <CopyIconButton
                  active={copied === 'apiBase'}
                  label="Copy API base"
                  onClick={() => void copy('apiBase', snippets.apiBase)}
                />
              </div>
              <input
                readOnly
                value={snippets.apiBase}
                className="w-full truncate rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 font-mono text-[11px] text-zinc-800 outline-none dark:border-zinc-800 dark:bg-[#050506] dark:text-zinc-200"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 px-3.5 py-2.5 dark:border-zinc-800">
            <a
              href={snippets.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Public page
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>
            <a
              href={snippets.embedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Embed checkout
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>
            <button
              type="button"
              onClick={() => void copy('embedUrl', snippets.embedUrl)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              {copied === 'embedUrl' ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Link2 className="h-3 w-3" />
              )}
              {copied === 'embedUrl' ? 'Copied URL' : 'Copy embed URL'}
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500 dark:text-zinc-400">
            Integration mode
          </p>
          <div
            className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950/40 sm:grid-cols-4"
            role="tablist"
            aria-label="SDK integration modes"
          >
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`flex min-h-[52px] flex-col items-start justify-center gap-0.5 rounded-md px-2.5 py-2 text-left transition ${
                    active
                      ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-white dark:ring-zinc-700'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    <Icon className={`h-3.5 w-3.5 ${active ? 'text-brand-blue' : ''}`} />
                    {item.label}
                  </span>
                  <span className={`pl-5 text-[10px] leading-tight ${active ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    {item.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Code block */}
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-3.5 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">
                {activeTab.label}
                <span className="ml-2 font-normal text-zinc-400">· {activeTab.language}</span>
              </p>
              <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                {TAB_HELP[tab]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copy(tab, activeCode)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-zinc-950 px-3 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {copied === tab ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === tab ? 'Copied' : 'Copy code'}
            </button>
          </div>
          <pre className="max-h-[min(38vh,320px)] overflow-auto bg-[#0B0B0C] p-4 font-mono text-[11.5px] leading-5 text-zinc-200">
            <code>{activeCode}</code>
          </pre>
        </div>

        {(copied === 'failed' || (copied && copied !== tab && !['collectionId', 'apiBase', 'embedUrl'].includes(copied))) && null}
        {copied === 'failed' && (
          <p className="text-xs text-red-500" role="status">
            Copy failed — select the text manually.
          </p>
        )}
        {copied && copied !== 'failed' && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400" role="status">
            Copied {copied === tab ? `${activeTab.label} snippet` : copied}.
          </p>
        )}

        {/* Checklist */}
        <div className="rounded-lg border border-zinc-200 px-3.5 py-3 dark:border-zinc-800">
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Before go-live</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
              <span>Collection must be <span className="font-medium text-zinc-700 dark:text-zinc-200">live</span> with primary sale configured (XLM).</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
              <span>Player needs Freighter (testnet) and enough XLM. Network fees are sponsored.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
              <span>
                SDK package path:{' '}
                <code className="rounded bg-zinc-100 px-1 font-mono text-[11px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  packages/nft-checkout-sdk
                </code>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
              <span>Third-party game sites need CORS allowlist on the NFT API host.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );

  const asModal = modal ?? Boolean(onClose);
  if (!asModal) return body;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]">
      {body}
    </div>
  );
}
