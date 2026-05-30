# GeyMatiMataJi App — Workspace

Side-by-side workspace for a spiritual content platform.

## Structure

```
GeyMatiMataJiApp/
├── mobile-app/        # React Native (Expo + NativeWind + Firebase)
├── admin-dashboard/   # Next.js 16 (App Router + Tailwind v4 + Firebase)
└── shared/            # Shared TypeScript code (Firebase config, types)
```

## Getting started

### 1. Configure Firebase
Copy the example env files and fill in your Firebase project credentials:

```zsh
cp mobile-app/.env.example mobile-app/.env
cp admin-dashboard/.env.example admin-dashboard/.env.local
```

### 2. Run the mobile app (Expo)

```zsh
cd mobile-app
npm install            # only the first time
npm run start          # then press i / a / w
```

### 3. Run the admin dashboard (Next.js)

```zsh
cd admin-dashboard
npm install            # only the first time
npm run dev            # http://localhost:3000
```

## Tech stack

| Layer       | Mobile (`mobile-app`)            | Web (`admin-dashboard`)        |
| ----------- | -------------------------------- | ------------------------------ |
| Framework   | Expo (React Native, TypeScript)  | Next.js 16 App Router (TS)     |
| Styling     | NativeWind v4 + Tailwind v3      | Tailwind CSS v4                |
| Backend     | Firebase (Auth/Firestore/Storage) | Firebase + firebase-admin     |
| Shared code | `../shared/firebaseConfig.ts`    | `../shared/firebaseConfig.ts`  |
