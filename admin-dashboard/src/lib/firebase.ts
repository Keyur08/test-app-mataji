// Firebase initialization for the Next.js admin dashboard (client SDK).
// For server-only Admin SDK usage, see `firebaseAdmin.ts`.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

import {
  firebaseConfig,
  assertFirebaseConfig,
} from "@shared/firebaseConfig";

assertFirebaseConfig(firebaseConfig);

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export { app };
export default app;
