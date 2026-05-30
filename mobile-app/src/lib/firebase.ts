// Firebase initialization for the Expo / React Native app.
//
// Uses the standard "firebase" web SDK (the same one the Next.js admin uses),
// but wires up `initializeAuth` with `getReactNativePersistence(AsyncStorage)`
// so the user's session survives app restarts on iOS/Android.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  // @ts-expect-error — getReactNativePersistence is exported from
  // "firebase/auth" at runtime but isn't in the public type definitions yet.
  getReactNativePersistence,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  firebaseConfig,
  assertFirebaseConfig,
} from "../../../shared/firebaseConfig";

assertFirebaseConfig(firebaseConfig);

// 1. App — singleton (Fast Refresh in Expo can re-evaluate this module)
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 2. Auth — initialize once with AsyncStorage persistence, then fall back to
//    getAuth() on subsequent imports (initializeAuth throws if called twice).
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

// 3. Firestore + Storage — simple singletons
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

/**
 * Resolves once Firebase Auth has finished restoring the persisted session
 * from AsyncStorage. Without this, `auth.currentUser` can be `null` on the
 * very first JS frame even though a user IS persisted — which previously
 * caused us to mint a brand-new anonymous user on every cold start.
 *
 * Uses the SDK's `authStateReady()` when available (modern firebase JS) and
 * falls back to a one-shot `onAuthStateChanged` listener otherwise.
 */
function authReady(): Promise<void> {
  const a = auth as unknown as { authStateReady?: () => Promise<void> };
  if (typeof a.authStateReady === "function") {
    return a.authStateReady();
  }
  return new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve();
    });
  });
}

/**
 * Returns the existing Firebase user if one is already persisted; otherwise
 * creates a fresh anonymous user. ALWAYS use this instead of calling
 * `signInAnonymously(auth)` directly — it guarantees we never create a
 * duplicate anonymous user just because `auth.currentUser` hadn't been
 * hydrated yet from AsyncStorage.
 */
async function ensureAnonymousUser(): Promise<User> {
  await authReady();
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export { app, auth, db, storage, authReady, ensureAnonymousUser };
export default app;
