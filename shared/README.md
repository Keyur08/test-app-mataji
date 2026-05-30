# Shared

Cross-project code consumed by both `mobile-app` (Expo) and `admin-dashboard` (Next.js).

- `firebaseConfig.ts` — Pulls Firebase credentials from environment variables.
  - Expo expects `EXPO_PUBLIC_FIREBASE_*` in `mobile-app/.env`.
  - Next.js expects `NEXT_PUBLIC_FIREBASE_*` in `admin-dashboard/.env.local`.
