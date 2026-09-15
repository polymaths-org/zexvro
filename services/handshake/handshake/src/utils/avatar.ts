/**
 * Themed default profile photos — pixel-art identicons (GitHub-style).
 *
 * Eight hand-tuned 7x7 mirrored block avatars in `public/avatars/`,
 * colored with ZEXVRO/Handshake theme tokens (dark-first surfaces,
 * Labs blue #3B82F6, brand purple #7C3AED, zinc neutrals). No real
 * human photos: every user without a custom photo gets a deterministic
 * identicon derived from their username, so the same user always renders
 * the same avatar everywhere (TopNav, profile, discussions, history).
 *
 * Files are served from Vite `public/` at `/avatars/avatar-N.svg`.
 */

export const DEFAULT_AVATARS = [
  '/avatars/avatar-1.svg', // mono white — default
  '/avatars/avatar-2.svg', // labs blue
  '/avatars/avatar-3.svg', // brand purple
  '/avatars/avatar-4.svg', // zinc
  '/avatars/avatar-5.svg', // white + blue duo
  '/avatars/avatar-6.svg', // purple + blue duo
  '/avatars/avatar-7.svg', // success green
  '/avatars/avatar-8.svg', // warm amber
] as const;

export const DEFAULT_AVATAR: string = DEFAULT_AVATARS[0];

/**
 * Deterministic avatar for a username (stable across renders/sessions).
 * Falls back to avatar-1 for empty input.
 */
export function getAvatarForUser(username: string): string {
  if (!username) return DEFAULT_AVATAR;
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (Math.imul(h, 31) + username.charCodeAt(i)) | 0;
  }
  return DEFAULT_AVATARS[Math.abs(h) % DEFAULT_AVATARS.length];
}

/**
 * Human display name from a handle: 'alex-dev' -> 'Alex Dev'.
 */
export function prettyName(username: string): string {
  return username
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
