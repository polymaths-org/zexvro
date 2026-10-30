// Asset handling for ZEXVRO Labs.
//
// Binary assets (lab banners, badge/certificate art, credential canvas
// images) live in Firebase Storage, never in the database. Rows keep only
// a public URL plus a sha256 content hash. This keeps SpacetimeDB
// subscriptions small: images load from the CDN in parallel and cost zero
// database egress.
//
// The pure helpers below (no network) are unit-tested; the thin Firebase
// upload wrapper sits on top of them.

export const ALLOWED_ASSET_HOSTS = [
  'firebasestorage.googleapis.com',
  'labs.zexvro.in',
  'beta.labs.zexvro.in',
];

export interface AssetRef {
  url: string;
  sha256: string;
}

export interface DataUrlAsset {
  path: string;
  mime: string;
  bytes: Uint8Array;
}

export function isAllowedAssetUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_ASSET_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function validateAssetRef(url: string, sha256: string): { ok: boolean; error?: string } {
  if (!isAllowedAssetUrl(url)) return { ok: false, error: 'Asset host is not allowlisted' };
  if (!/^[0-9a-f]{64}$/i.test(sha256 || '')) return { ok: false, error: 'sha256 must be 64 hex chars' };
  return { ok: true };
}

export function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

export function parseDataUrl(value: string): { mime: string; bytes: Uint8Array } {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) throw new Error('Invalid data URL');
  const mime = match[1] || 'application/octet-stream';
  const raw = match[3] || '';
  if (match[2]) {
    const bin = atob(raw);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, bytes };
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(raw)) };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function storagePathForLabAsset(
  labId: string,
  kind: 'banner' | 'badge' | 'certificate' | 'element',
  hash: string,
  mime: string,
): string {
  const ext = (mime.split('/')[1] || 'bin').split('+')[0].replace(/[^a-z0-9]/gi, '');
  const safeLab = labId.replace(/[^a-z0-9_-]/gi, '_');
  return `labs/${safeLab}/${kind}-${hash.slice(0, 16)}.${ext}`;
}

// Image-bearing fields anywhere inside a lab JSON document.
const IMAGE_KEYS = new Set([
  'bannerUrl',
  'backgroundImage',
  'imageUrl',
  'logoUrl',
  'qrUrl',
  'badgeIconUrl',
]);

// Walks any JSON value, collecting inline data-URL images with their paths.
export function extractDataUrls(value: unknown, base = '$'): DataUrlAsset[] {
  const found: DataUrlAsset[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (isDataUrl(node)) {
        const { mime, bytes } = parseDataUrl(node);
        found.push({ path, mime, bytes });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        if (typeof child === 'string' && isDataUrl(child) && !IMAGE_KEYS.has(key)) continue;
        walk(child, path === '$' ? `$.${key}` : `${path}.${key}`);
      }
    }
  };
  walk(value, base);
  return found;
}

function setPath(root: unknown, path: string, value: unknown): void {
  const parts = path
    .replace(/^\$\.?/, '')
    .split(/\.|\[|\]/)
    .filter(Boolean);
  let node = root as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    node = (node as Record<string | number, unknown>)[part as string] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  (node as Record<string, unknown>)[last] = value;
}

// Replaces inline data URLs with { url, sha256 } references produced by
// refFor(path, mime, hash). Returns the list of replaced paths.
export async function replaceDataUrlsWithRefs(
  doc: unknown,
  refFor: (asset: DataUrlAsset, hash: string) => Promise<AssetRef> | AssetRef,
): Promise<string[]> {
  const assets = extractDataUrls(doc);
  for (const asset of assets) {
    const hash = await sha256Hex(asset.bytes);
    const ref = await refFor(asset, hash);
    setPath(doc, asset.path, { url: ref.url, sha256: ref.sha256 });
  }
  return assets.map((a) => a.path);
}
