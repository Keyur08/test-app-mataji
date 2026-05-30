// Shared Firebase configuration used by both the mobile app and admin dashboard.
// Values are pulled from environment variables so the same source can power
// both Expo (EXPO_PUBLIC_*) and Next.js (NEXT_PUBLIC_*) environments.
//
//  - Expo:    define EXPO_PUBLIC_FIREBASE_*    in mobile-app/.env
//  - Next.js: define NEXT_PUBLIC_FIREBASE_*    in admin-dashboard/.env.local

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

// IMPORTANT: bundlers (Next.js / Turbopack / Metro) can only replace
// `process.env.NEXT_PUBLIC_*` / `process.env.EXPO_PUBLIC_*` at build time when
// the property name is a STATIC LITERAL. A dynamic `env[k]` lookup defeats
// that inlining and leaves the values empty on the client. So we access each
// variable explicitly below.
const pick = (a: string | undefined, b: string | undefined): string =>
  (a && a.length > 0 ? a : b && b.length > 0 ? b : "") as string;

export const firebaseConfig: FirebaseConfig = {
  apiKey: pick(
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  ),
  authDomain: pick(
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  ),
  projectId: pick(
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ),
  storageBucket: pick(
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  ),
  messagingSenderId: pick(
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  ),
  appId: pick(
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  ),
  measurementId: pick(
    process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  ),
};

/**
 * Throws a descriptive error in development if any required Firebase env var
 * is missing. Call this once at app startup (after loading env).
 */
export function assertFirebaseConfig(cfg: FirebaseConfig = firebaseConfig): void {
  const required: (keyof FirebaseConfig)[] = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];
  const missing = required.filter((k) => !cfg[k]);
  if (missing.length > 0) {
    throw new Error(
      `[firebase] Missing required env vars: ${missing.join(", ")}. ` +
        `Check your .env / .env.local file.`
    );
  }
}
