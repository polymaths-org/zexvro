import React, { useEffect, useState } from 'react';

export type AdminTab = 'overview' | 'labs' | 'operations' | 'users' | 'submissions';

export type Route =
  | { kind: 'home' }
  | { kind: 'labs' }
  | { kind: 'lab'; slug: string }
  | { kind: 'labs-manage' }
  | { kind: 'certificates' }
  | { kind: 'profile' }
  | { kind: 'runner'; labId: string }
  | { kind: 'verify'; number: string }
  | { kind: 'public-profile'; username: string }
  | { kind: 'admin'; tab: AdminTab }
  | { kind: 'operations' }
  | { kind: 'not-found' };

const ADMIN_TABS: AdminTab[] = ['overview', 'labs', 'operations', 'users', 'submissions'];

export function parsePathname(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return { kind: 'home' };
  switch (parts[0]) {
    case 'home':
      return { kind: 'home' };
    case 'labs':
      if (!parts[1]) return { kind: 'labs' };
      if (parts[1] === 'manage') return { kind: 'labs-manage' };
      return { kind: 'lab', slug: decodeURIComponent(parts[1]) };
    case 'certificates':
      return { kind: 'certificates' };
    case 'profile':
      return { kind: 'profile' };
    case 'runner':
      return parts[1] ? { kind: 'runner', labId: decodeURIComponent(parts[1]) } : { kind: 'labs' };
    case 'verify':
      return parts[1] ? { kind: 'verify', number: decodeURIComponent(parts[1]) } : { kind: 'not-found' };
    case 'u':
      return parts[1] ? { kind: 'public-profile', username: decodeURIComponent(parts[1]) } : { kind: 'not-found' };
    case 'operations':
      return { kind: 'operations' };
    case 'admin': {
      const tab = (parts[1] || 'overview') as AdminTab;
      return { kind: 'admin', tab: ADMIN_TABS.includes(tab) ? tab : 'overview' };
    }
    default:
      return { kind: 'not-found' };
  }
}

const ROUTE_EVENT = 'zexvro:route';

export function navigate(path: string): void {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event(ROUTE_EVENT));
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parsePathname(window.location.pathname));

  useEffect(() => {
    const handler = () => setRoute(parsePathname(window.location.pathname));
    window.addEventListener(ROUTE_EVENT, handler);
    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener(ROUTE_EVENT, handler);
      window.removeEventListener('popstate', handler);
    };
  }, []);

  return route;
}

export const shareUrl = (path: string) =>
  `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;

export const paths = {
  home: '/home',
  labs: '/labs',
  lab: (slug: string) => `/labs/${encodeURIComponent(slug)}`,
  labsManage: '/labs/manage',
  certificates: '/certificates',
  profile: '/profile',
  runner: (labId: string) => `/runner/${encodeURIComponent(labId)}`,
  verify: (number: string) => `/verify/${encodeURIComponent(number)}`,
  publicProfile: (username: string) => `/u/${encodeURIComponent(username)}`,
  admin: (tab: AdminTab = 'overview') => `/admin/${tab}`,
  operations: '/operations',
};

export const labUrl = paths.lab;
export const verifyUrl = paths.verify;
export const profileUrl = paths.publicProfile;

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export const Link: React.FC<LinkProps> = ({ to, onClick, children, ...rest }) => (
  <a
    href={to}
    {...rest}
    onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onClick?.(e);
      navigate(to);
    }}
  >
    {children}
  </a>
);
