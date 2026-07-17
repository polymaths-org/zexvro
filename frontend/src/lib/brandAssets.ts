/** Local-first brand media — Cache API + IndexedDB, no CDN re-fetch after first load. */

export const BRAND_LOADER_GIF = '/marketing/zexvro-laoding-ani-nobg.gif';
export const BRAND_INTRO_MP4 =
  '/marketing/watermark-removed-Brand_intro_animation_logo_assembly_202607162304.mp4';
export const PLATFORM_BOOTUP_MP4 = '/marketing/Platform-bootup.mp4';

/** NFT create/deploy cinema stages (ordered). */
export const NFT_MISSION_BRIEF_MP4 = '/marketing/mission-brief_gwr_video_mvp.mp4';
export const NFT_FUELING_MP4 = '/marketing/NFT-fuleing_gwr_video_mvp.mp4';
export const NFT_ASSEMBLE_MP4 = '/marketing/NFT-Assemble_gwr_video_mvp.mp4';
export const NFT_LAUNCH_MP4 = '/marketing/NFT_Launch.mp4';

export type NftCinemaStage = 'brief' | 'fueling' | 'assemble' | 'launch' | 'abort';

export const NFT_CINEMA: Record<
  NftCinemaStage,
  { path: string; label: string; /** playbackRate: <1 slow, >1 fast */ rate: number; loop: boolean }
> = {
  brief: {
    path: NFT_MISSION_BRIEF_MP4,
    label: 'Preparing launch vehicle…',
    rate: 1.15,
    loop: true,
  },
  fueling: {
    path: NFT_FUELING_MP4,
    label: 'Loading media payload…',
    rate: 1.25,
    loop: true,
  },
  assemble: {
    path: NFT_ASSEMBLE_MP4,
    label: 'Deploying collection on Stellar…',
    rate: 0.9,
    loop: true,
  },
  launch: {
    path: NFT_LAUNCH_MP4,
    label: 'NFT collection live',
    // Slightly faster so Freighter wait + finale doesn’t drag.
    rate: 1.1,
    loop: false,
  },
  abort: {
    path: NFT_ASSEMBLE_MP4,
    label: 'Launch aborted — retry deploy',
    rate: 1.4,
    loop: true,
  },
};

export const BRAND_SURFACE = '#141416';

const CACHE_NAME = 'zexvro-brand-v2';
const IDB_NAME = 'zexvro-brand';
const IDB_STORE = 'assets';
const LOADER_READY_KEY = 'zexvro.loader.ready';
const PLATFORM_BOOTUP_SEEN_KEY = 'zexvro.platform.bootup.seen';

const objectUrlByPath = new Map<string, string>();
let cachePromise: Promise<void> | null = null;

const PREFETCH_PATHS = [
  BRAND_LOADER_GIF,
  BRAND_INTRO_MP4,
  PLATFORM_BOOTUP_MP4,
  NFT_MISSION_BRIEF_MP4,
  NFT_FUELING_MP4,
  NFT_ASSEMBLE_MP4,
  NFT_LAUNCH_MP4,
];

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const value = req.result;
        resolve(value instanceof Blob ? value : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(key: string, blob: Blob): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function cacheAndObjectUrl(path: string): Promise<string> {
  if (typeof window === 'undefined') return path;
  const existingUrl = objectUrlByPath.get(path);
  if (existingUrl) return existingUrl;

  try {
    const existing = await idbGet(path);
    if (existing && existing.size > 0) {
      const url = URL.createObjectURL(existing);
      objectUrlByPath.set(path, url);
      return url;
    }
  } catch {
    // continue
  }

  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      let response = await cache.match(path);
      if (!response) {
        response = await fetch(path, { cache: 'force-cache' });
        if (response.ok) {
          await cache.put(path, response.clone());
        }
      }
      if (response?.ok) {
        const blob = await response.blob();
        void idbPut(path, blob);
        const url = URL.createObjectURL(blob);
        objectUrlByPath.set(path, url);
        return url;
      }
    }
  } catch {
    // fall through
  }

  try {
    const response = await fetch(path, { cache: 'force-cache' });
    if (response.ok) {
      const blob = await response.blob();
      void idbPut(path, blob);
      if ('caches' in window) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(
            path,
            new Response(blob.slice(), {
              headers: { 'Content-Type': blob.type || 'application/octet-stream' },
            }),
          );
        } catch {
          // ignore
        }
      }
      const url = URL.createObjectURL(blob);
      objectUrlByPath.set(path, url);
      return url;
    }
  } catch {
    // ignore
  }

  return path;
}

/** Prefetch brand + NFT cinema into IDB/Cache and warm object URLs. */
export function ensureBrandAssetsCached(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    await Promise.all(PREFETCH_PATHS.map((path) => cacheAndObjectUrl(path)));
    try {
      localStorage.setItem(LOADER_READY_KEY, '1');
    } catch {
      // ignore
    }
  })();

  return cachePromise;
}

export function getBrandLoaderSrc(): string {
  return objectUrlByPath.get(BRAND_LOADER_GIF) || BRAND_LOADER_GIF;
}

export function getBrandIntroSrc(): string {
  return objectUrlByPath.get(BRAND_INTRO_MP4) || BRAND_INTRO_MP4;
}

export function getPlatformBootupSrc(): string {
  return objectUrlByPath.get(PLATFORM_BOOTUP_MP4) || PLATFORM_BOOTUP_MP4;
}

export function getNftLaunchSrc(): string {
  return objectUrlByPath.get(NFT_LAUNCH_MP4) || NFT_LAUNCH_MP4;
}

export function getNftCinemaSrc(stage: NftCinemaStage): string {
  const path = NFT_CINEMA[stage].path;
  return objectUrlByPath.get(path) || path;
}

export function isBrandLoaderReadyFlag(): boolean {
  try {
    return localStorage.getItem(LOADER_READY_KEY) === '1';
  } catch {
    return false;
  }
}

/** Once per browser (login → dashboard boot cinema). */
export function hasSeenPlatformBootup(): boolean {
  try {
    return localStorage.getItem(PLATFORM_BOOTUP_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPlatformBootupSeen(): void {
  try {
    localStorage.setItem(PLATFORM_BOOTUP_SEEN_KEY, '1');
  } catch {
    // ignore
  }
}
