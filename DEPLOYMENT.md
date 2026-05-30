# Deployment Guide — Gey Mati Mata Ji

This document captures every command and configuration needed to ship the
two apps that live in this monorepo:

- **Next.js admin dashboard** (`/admin-dashboard`) → deployed to **Vercel**
- **Expo React Native mobile app** (`/mobile-app`) → built with **EAS Build**
  for the Google Play Store and Apple App Store

Both apps share a single Firebase project. Firestore + Storage rules are
deployed from the repo root (`firestore.rules`, `storage.rules`).

---

## 0. Prerequisites

```bash
# Node tooling
node -v           # >= 20
npm -v            # >= 10

# Global CLIs
npm install -g vercel @expo/cli eas-cli firebase-tools

# Auth
vercel login
eas login
firebase login
```

You should also have:

- A Firebase project (already provisioned).
- Service-account JSON for the admin SDK (one was used to populate
  `FIREBASE_ADMIN_*` env vars).
- Apple Developer & Google Play developer accounts (for store submissions).

---

## 1. Deploy Firestore + Storage rules

From the repo root (`/GeyMatiMataJiApp`):

```bash
firebase use --add        # pick the Firebase project
firebase deploy --only firestore:rules,storage
```

Don't forget to **manually create the first admin document** in the
Firebase Console: `admins/<your-auth-uid>` (empty doc). The security rules
treat that as the admin allow-list.

---

## 2. Deploy the Next.js Admin Dashboard to Vercel

The admin dashboard imports from `../shared/*` (one level up), so Vercel
must be told that the project root is the `admin-dashboard` folder of the
monorepo — but it still needs access to the `shared/` directory at the
repo root. Vercel handles this automatically because it builds with the
**entire repo** uploaded.

### 2.1 First-time setup

```bash
cd admin-dashboard
vercel link
```

Answer the prompts:

| Prompt | Answer |
|---|---|
| Set up and deploy "~/admin-dashboard"? | **Y** |
| Which scope? | your team / personal |
| Link to existing project? | **N** (first time) |
| Project name? | `gmm-admin` (or your choice) |
| In which directory is your code located? | **`./`** (you're already inside `admin-dashboard`) |
| Override settings? | **N** — Vercel auto-detects Next.js 16 |

This creates `.vercel/project.json` linking the folder to a Vercel project.

### 2.2 Environment variables

Set every variable the dashboard needs. The `firebase-admin` private key
contains literal `\n` escape sequences — paste it **exactly as it appears**
in the JSON service-account file (Vercel preserves the escapes).

```bash
cd admin-dashboard

# Public Firebase (client SDK) — for all 3 environments
for ENV in production preview development; do
  vercel env add NEXT_PUBLIC_FIREBASE_API_KEY              $ENV
  vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN          $ENV
  vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID           $ENV
  vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET       $ENV
  vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID  $ENV
  vercel env add NEXT_PUBLIC_FIREBASE_APP_ID               $ENV
  vercel env add NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID       $ENV
done

# Server-only Admin SDK (used by server actions like the push broadcaster)
vercel env add FIREBASE_ADMIN_PROJECT_ID     production
vercel env add FIREBASE_ADMIN_CLIENT_EMAIL   production
vercel env add FIREBASE_ADMIN_PRIVATE_KEY    production   # paste the full key with \n escapes
```

You can also paste them through the Vercel dashboard:
**Settings → Environment Variables**.

### 2.3 Deploy

```bash
# Preview build (every push gets one automatically once Git is connected)
vercel

# Production
vercel --prod
```

### 2.4 (Recommended) Hook up Git

In the Vercel dashboard → **Settings → Git** → connect the GitHub repo. Set:

- **Root directory:** `admin-dashboard`
- **Framework preset:** Next.js (auto-detected)
- **Build command:** `next build` (default)
- **Install command:** `npm install --legacy-peer-deps`
  (needed because React 19 still has peer-dep conflicts with some deps)
- **Output directory:** `.next` (default)
- **Node.js version:** `20.x`

After this, every push to `main` deploys to production and PRs get
preview URLs automatically.

---

## 3. Build the Mobile App with EAS

### 3.1 One-time project setup

```bash
cd mobile-app

# Creates the EAS project, writes the projectId into app.json under
# `expo.extra.eas.projectId`, and stores credentials in EAS.
eas init

# Configure native build profiles (skip if eas.json is already committed).
# We've already added eas.json — but re-running this is harmless.
eas build:configure
```

After `eas init`, open `app.json` and confirm a block like:

```jsonc
"extra": {
  "eas": {
    "projectId": "00000000-0000-0000-0000-000000000000"
  }
}
```

This is the same id `notifications.ts` reads via `Constants.expoConfig?.extra?.eas?.projectId`.

### 3.2 Bump app metadata for stores

In `mobile-app/app.json`, ensure:

```jsonc
{
  "expo": {
    "name": "Gey Mati Mata Ji",
    "slug": "mobile-app",
    "version": "1.0.0",                 // user-facing version
    "android": {
      "package": "com.geymatimataji.app",
      "versionCode": 1                  // auto-incremented by EAS
    },
    "ios": {
      "bundleIdentifier": "com.geymatimataji.app",
      "buildNumber": "1"
    }
  }
}
```

### 3.3 Provide environment variables to native builds

EAS does **not** read `.env` files at build time. Push the Expo public
keys to EAS as secrets:

```bash
cd mobile-app

eas env:create production --name EXPO_PUBLIC_FIREBASE_API_KEY              --value "..."
eas env:create production --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN          --value "..."
eas env:create production --name EXPO_PUBLIC_FIREBASE_PROJECT_ID           --value "..."
eas env:create production --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET       --value "..."
eas env:create production --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID  --value "..."
eas env:create production --name EXPO_PUBLIC_FIREBASE_APP_ID               --value "..."
eas env:create production --name EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID       --value "..."
```

(Repeat with `--environment preview` / `--environment development` as needed.)

### 3.4 Profiles defined in `eas.json`

| Profile          | Android output | iOS output         | Use case |
|------------------|----------------|--------------------|----------|
| `development`    | `.apk`         | Simulator build    | Dev client with hot reload |
| `preview`        | `.apk`         | Ad-hoc `.ipa`      | Internal QA on real devices |
| `production`     | `.aab`         | Store-ready `.ipa` | Play Store + App Store |
| `production-apk` | `.apk`         | —                  | Side-loadable APK for direct distribution |

### 3.5 Run a build

```bash
cd mobile-app

# Store-ready bundles (recommended for release)
eas build --platform android --profile production
eas build --platform ios     --profile production

# Or both in one shot
eas build --platform all --profile production

# Side-loadable APK (for sharing a link without a store)
eas build --platform android --profile production-apk

# Internal QA build (still real binaries, but distributed via EAS share link)
eas build --platform all --profile preview
```

Each invocation queues a cloud build, prints a URL, and on success offers a
download link for the `.aab`, `.apk`, or `.ipa`.

For iOS, EAS will ask once to create / store an Apple distribution
certificate and a provisioning profile. Approve the prompts and it will
manage them automatically for future builds.

### 3.6 Submit to the stores

After a production build finishes, submit straight from the CLI:

```bash
# Google Play (uses the `.aab` from the last production build)
eas submit --platform android --profile production --latest

# Apple App Store
eas submit --platform ios     --profile production --latest
```

For iOS, fill in the placeholders in `eas.json → submit.production.ios`
(`appleId`, `ascAppId`, `appleTeamId`) before submitting.

For Android, the first submit will ask for the path to a Google Play
service-account JSON file. Save that path in `eas.json` once configured:

```jsonc
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./google-play-service-account.json",
      "track": "internal"
    }
  }
}
```

Add the JSON file to `.gitignore`.

### 3.7 OTA updates (after a build is in production)

Many small changes (JS, assets, Firestore queries) don't require a new
native build. Push them over-the-air to whichever channel is live:

```bash
eas update --branch production --message "Daily quote tweak"
```

Devices on the `production` channel will pick up the update on next launch.

---

## 4. Smoke test checklist

After deployment:

1. **Admin** at `https://<your-project>.vercel.app/login` — sign in with the
   bootstrap admin account, confirm the sidebar loads and every page renders.
2. Push a test broadcast from `/admin/notifications` and confirm at least
   one device receives it.
3. Open the mobile app, accept the notification prompt on Home, and verify a
   document appears in Firestore at `push_tokens/<token>`.
4. Submit an Aahar Daan form and confirm it shows up in `/admin/registrations`.
