import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GithubAuthProvider,
  GoogleAuthProvider,
  type User as FirebaseUser,
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

export function signInWithGithub() {
  return signInWithPopup(auth, githubProvider);
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
