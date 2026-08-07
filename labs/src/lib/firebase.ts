import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GithubAuthProvider,
  GoogleAuthProvider,
  type User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User } from '../types';

// Web app config for labs-zexvro (public by design — used only to address the
// Firebase project; security is enforced by Firestore Security Rules).
const firebaseConfig = {
  apiKey: 'AIzaSyAmF2qY-3F9RyxJyeVY1Wm1Ijs7BaedL8M',
  authDomain: 'labs-zexvro.firebaseapp.com',
  projectId: 'labs-zexvro',
  storageBucket: 'labs-zexvro.firebasestorage.app',
  messagingSenderId: '198326294400',
  appId: '1:198326294400:web:8e9a6d37c45c7c7a835365',
  measurementId: 'G-RT29BG30SY',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const githubProvider = new GithubAuthProvider();
githubProvider.addScope('user:email');
const googleProvider = new GoogleAuthProvider();

function makeUsername(fbUser: FirebaseUser): string {
  const candidate =
    fbUser.displayName?.toLowerCase().replace(/\s+/g, '_') ||
    (fbUser.email || 'user').split('@')[0] ||
    'user';
  return candidate.replace(/[^a-z0-9_]/g, '');
}

export interface ResolvedUser {
  user: User;
  isNew: boolean;
}

// Fetch the user's Firestore profile (role + stats). Creates a minimal doc on
// first sign-in so their progress/xp persist across devices.
export async function resolveUser(fbUser: FirebaseUser): Promise<ResolvedUser> {
  const ref = doc(db, 'users', fbUser.uid);
  let snap = await getDoc(ref);
  let isNew = !snap.exists();

  const base: User = {
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Learner',
    email: fbUser.email || '',
    username: snap.exists() ? snap.data().username : makeUsername(fbUser),
    avatarUrl: fbUser.photoURL || '',
    role: snap.exists() ? snap.data().role || 'student' : 'student',
    xp: snap.exists() ? snap.data().xp || 0 : 0,
    streakDays: snap.exists() ? snap.data().streakDays || 0 : 0,
    completedLabsCount: snap.exists() ? snap.data().completedLabsCount || 0 : 0,
    githubConnected: !!fbUser.providerData.some((p) => p?.providerId === 'github.com'),
  };

  if (isNew) {
    await setDoc(ref, { ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    snap = await getDoc(ref);
  }

  return { user: base, isNew };
}

export function signInWithGithubPopup(): Promise<UserCredential> {
  return signInWithPopup(auth, githubProvider);
}

// Full-page redirect flow — the only reliable GitHub auth on Safari, whose
// Intelligent Tracking Prevention / third-party-cookie blocking breaks the
// popup handshake (common on MacBooks). The browser navigates to GitHub and
// lands back here signed in; the session is restored on app boot.
export function signInWithGithubRedirect(): Promise<void> {
  return signInWithRedirect(auth, githubProvider);
}

// Completes a pending redirect sign-in (called on boot). Returns the
// credential, or null when no redirect was in flight. Errors (e.g. Safari's
// "database connection is closing" IndexedDB bug) are NOT swallowed so the
// caller can trigger a reload recovery.
export async function getGithubRedirectResult(): Promise<UserCredential | null> {
  return getRedirectResult(auth);
}

// Safari's IndexedDB occasionally wedges its connection mid-session
// (WebKit: "The database connection is closing", "Connection to Indexed
// Database server lost"). Firebase Auth reads/writes IndexedDB for session
// persistence and for the OAuth redirect result, so this hits right after a
// GitHub redirect lands back on the app. A single page reload re-establishes
// the connection and completes the pending auth (the redirect result is still
// in the URL fragment). Returns true when the error looks like that failure.
export function isIndexedDbUnavailableError(err: any): boolean {
  const text = String(err?.message || err?.code || '');
  return /closing|connection to indexed database|indexed database server|unknownerror|idbtransaction|web-storage-unsupported/i.test(text);
}

// Reload the page at most once per page-load to recover from a wedged
// IndexedDB connection. The sessionStorage flag stops infinite reload loops
// (sessionStorage survives the reload but clears when the tab closes).
export function recoverWithReload(): void {
  try {
    if (sessionStorage.getItem('zexvro_auto_reloaded')) return;
    sessionStorage.setItem('zexvro_auto_reloaded', '1');
  } catch {
    // sessionStorage unavailable (private mode) — allow the single reload anyway.
  }
  window.location.reload();
}

// Dispatches GitHub sign-in: popup everywhere except Safari, where the popup
// handshake breaks. Returns null when a redirect was started (the page reloads
// with the session already restored, so the caller must not await a user).
export function signInWithGithub(): Promise<UserCredential | null> {
  if (isSafari()) {
    return signInWithGithubRedirect().then(() => null);
  }
  return signInWithPopup(auth, githubProvider);
}

export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const chromium = /chrome|chromium|crios|edg|opr|samsungbrowser|brave/i.test(ua);
  const firefox = /firefox|fxios/i.test(ua);
  return /safari/i.test(ua) && !chromium && !firefox;
}

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signOutFirebase() {
  return signOut(auth);
}

export function onAuthChange(cb: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, cb);
}

// Fresh ID token for authenticated API calls. Auto-refreshed by the SDK.
export async function getIdToken(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken(true);
  } catch {
    return null;
  }
}
