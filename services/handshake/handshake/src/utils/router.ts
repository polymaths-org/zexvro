import { RouteState } from '../context/AppContext';

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Top-level segments owned by app pages — never a contract owner. */
const RESERVED_TOP = new Set([
  'home', 'explore', 'search', 'browse', 'studio', 'publish', 'collections',
  'profile', 'login', 'signup', 'settings', 'notifications', 'c', '404',
]);

/**
 * Parses raw hash or pathname into a structured RouteState
 * Example hashes supported:
 * - #/ or #/home
 * - #/explore
 * - #/search?q=swap&chain=stellar
 * - #/browse?q=amm&chain=stellar
 * - #/alex-dev/soroban-amm
 * - #/alex-dev/soroban-amm/functions
 * - #/alex-dev/soroban-amm/functions/swap
 * - #/alex-dev/soroban-amm/tree/src/lib.rs
 * - #/alex-dev/soroban-amm/history
 * - #/alex-dev/soroban-amm/forks
 * - #/alex-dev/soroban-amm/discussions
 * - #/c/stellar/CA3D5L8MNP4K19QZ7W22XYR09V1K83L6PQQ901X1Z (legacy, still resolves)
 * - #/studio
 * - #/studio/proj-1
 * - #/publish
 * - #/collections
 * - #/collections/soroban-essentials
 * - #/profile/alex-dev
 * - #/settings
 * - #/notifications
 */
export function parseRouteFromUrl(): RouteState {
  // Read hash first (default in SPA iframe environments)
  let raw = window.location.hash || '';

  // Remove leading '#'
  if (raw.startsWith('#')) {
    raw = raw.slice(1);
  }

  // Fallback to pathname if no hash
  if (!raw || raw === '/') {
    const pathname = window.location.pathname;
    if (pathname && pathname !== '/') {
      raw = pathname;
    }
  }

  // Remove leading slash
  if (raw.startsWith('/')) {
    raw = raw.slice(1);
  }

  // Separate query parameters
  const [pathPart, queryPart] = raw.split('?');
  const searchParams = new URLSearchParams(queryPart || '');

  const segments = pathPart ? pathPart.split('/').filter(Boolean) : [];

  // Default route is home
  if (segments.length === 0 || segments[0] === 'home') {
    return { page: 'home' };
  }

  // 0. Explore (landing-style discovery, not the default)
  if (segments[0] === 'explore') {
    return { page: 'explore' };
  }

  // 1. Browse
  if (segments[0] === 'browse') {
    return {
      page: 'browse',
      searchQuery: searchParams.get('q') || undefined,
      chain: searchParams.get('chain') || undefined,
    };
  }

  // 1b. Search screen
  if (segments[0] === 'search') {
    return {
      page: 'search',
      searchQuery: searchParams.get('q') || undefined,
      chain: searchParams.get('chain') || undefined,
    };
  }

  // 1b. Search screen (contracts + functions + publishers, with discovery)
  if (segments[0] === 'search') {
    return {
      page: 'search',
      searchQuery: searchParams.get('q') || undefined,
      chain: searchParams.get('chain') || undefined,
    };
  }

  // 2. Studio
  if (segments[0] === 'studio') {
    if (segments.length >= 2) {
      return {
        page: 'studio-workspace',
        projectId: segments[1],
        studioId: segments[1],
      };
    }
    return { page: 'studio-launcher' };
  }

  // 3. Publish
  if (segments[0] === 'publish') {
    return { page: 'publish' };
  }

  // 4. Collections
  if (segments[0] === 'collections') {
    return {
      page: 'collections',
      collectionSlug: segments[1] || undefined,
    };
  }

  // 5. Profile
  if (segments[0] === 'profile') {
    return {
      page: 'profile',
      username: segments[1] || 'alex-dev',
    };
  }

  // 6. Settings
  if (segments[0] === 'settings') {
    return { page: 'settings' };
  }

  // 6b. Auth
  if (segments[0] === 'login') {
    return { page: 'login' };
  }
  if (segments[0] === 'signup') {
    return { page: 'signup' };
  }

  // 7. Notifications
  if (segments[0] === 'notifications') {
    return { page: 'notifications' };
  }

  // 8. Contract routes.
  // Canonical: /:owner/:contractName/... (GitHub-style).
  // Legacy (still resolves): /c/:chain/:contractId/...
  const contractSubRoute = (
    base: { owner?: string; contractName?: string; chain?: string; contractId?: string },
    subRoute?: string,
    rest: string[] = []
  ): RouteState => {
    if (subRoute === 'functions') {
      if (rest.length >= 1) {
        const fn = safeDecode(rest[0]);
        return { page: 'function-deep-read', fnName: fn, functionName: fn, ...base };
      }
      return { page: 'functions-index', ...base };
    }
    if (subRoute === 'tree') {
      return { page: 'file-reader', filePath: rest.join('/') || 'src/lib.rs', ...base };
    }
    if (subRoute === 'history') return { page: 'history', ...base };
    if (subRoute === 'forks') return { page: 'forks', ...base };
    if (subRoute === 'discussions') return { page: 'discussions', ...base };
    return { page: 'contract-overview', ...base };
  };

  if (segments[0] === 'c' && segments.length >= 3) {
    const chain = safeDecode(segments[1]);
    const contractId = safeDecode(segments[2]);
    return contractSubRoute({ chain, contractId }, segments[3], segments.slice(4));
  }

  // Pretty owner/name routes — every reserved route returned above.
  if (segments.length >= 2 && !RESERVED_TOP.has(segments[0])) {
    const owner = safeDecode(segments[0]);
    const contractName = safeDecode(segments[1]);
    return contractSubRoute({ owner, contractName }, segments[2], segments.slice(3));
  }

  // Fallback: unknown non-empty path is a real 404 (empty stays home).
  return { page: '404' };
}

/**
 * Serializes a RouteState into a clean hash string
 */
export function buildUrlFromRoute(route: RouteState): string {
  const p = route.page;

  if (p === 'home') return '#/home';
  if (p === 'explore') return '#/explore';
  if (p === 'browse') {
    const params = new URLSearchParams();
    if (route.searchQuery) params.set('q', route.searchQuery);
    if (route.chain) params.set('chain', route.chain);
    const qs = params.toString();
    return `#/browse${qs ? `?${qs}` : ''}`;
  }
  if (p === 'search') {
    const params = new URLSearchParams();
    if (route.searchQuery) params.set('q', route.searchQuery);
    if (route.chain) params.set('chain', route.chain);
    const qs = params.toString();
    return `#/search${qs ? `?${qs}` : ''}`;
  }

  if (p === 'studio-launcher') return '#/studio';
  if (p === 'studio' || p === 'studio-workspace') {
    const id = route.projectId || route.studioId || 'proj-1';
    return `#/studio/${encodeURIComponent(id)}`;
  }

  if (p === 'publish') return '#/publish';
  if (p === 'collections') {
    return route.collectionSlug ? `#/collections/${encodeURIComponent(route.collectionSlug)}` : '#/collections';
  }
  if (p === 'profile') {
    return `#/profile/${encodeURIComponent(route.username || 'alex-dev')}`;
  }
  if (p === 'settings') return '#/settings';
  if (p === 'login') return '#/login';
  if (p === 'signup') return '#/signup';
  if (p === 'notifications') return '#/notifications';

  // Contract routes — canonical pretty URLs (/owner/name), with legacy
  // /c/chain/id fallback when owner/name are unknown (e.g. fork stubs).
  const chain = route.chain || 'stellar';
  const contractId = route.contractId || 'CA3D5L8MNP4K19QZ7W22XYR09V1K83L6PQQ901X1Z';
  const base =
    route.owner && route.contractName
      ? `#/${encodeURIComponent(route.owner)}/${encodeURIComponent(route.contractName)}`
      : `#/c/${encodeURIComponent(chain)}/${encodeURIComponent(contractId)}`;

  if (p === 'functions-index') {
    return `${base}/functions`;
  }
  if (p === 'function-detail' || p === 'function-deep-read') {
    const fn = route.functionName || route.fnName || 'swap';
    return `${base}/functions/${encodeURIComponent(fn)}`;
  }
  if (p === 'file-browser' || p === 'file-reader') {
    const path = route.filePath || 'src/lib.rs';
    return `${base}/tree/${path}`;
  }
  if (p === 'history') {
    return `${base}/history`;
  }
  if (p === 'forks') {
    return `${base}/forks`;
  }
  if (p === 'discussions') {
    return `${base}/discussions`;
  }
  if (p === 'contract-overview') {
    return base;
  }

  return '#/home';
}
