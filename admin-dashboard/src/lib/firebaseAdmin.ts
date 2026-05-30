// Server-only Firebase Admin SDK initialization for the Next.js admin dashboard.
// Use this in route handlers, server actions, and getServerSideProps — NEVER
// import it from a client component (it relies on a service-account key).

import "server-only";
import {
    initializeApp,
    getApps,
    cert,
    type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

function initializeAdmin(): App | null {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    // 1. Return null instead of throwing an error during the Next.js build pre-rendering phase
    if (!projectId || !clientEmail || !rawPrivateKey) {
        console.warn(
            "⚠️ [firebase-admin] Environment variables are missing. " +
            "Skipping initialization execution during build phase."
        );
        return null;
    }

    // 2. Return the existing instance if already initialized to prevent duplicate errors
    if (getApps().length > 0) {
        return getApps()[0];
    }

    // 3. Robust clean: Strip out accidental enclosing quotes AND fix newline formatting
    const privateKey = rawPrivateKey
        .replace(/^["']|["']$/g, "") // Removes wrapper quotes introduced by cloud dashboards
        .replace(/\\n/g, "\n");       // Rebuilds real binary newlines for the OpenSSL decoder

    try {
        return initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
    } catch (error) {
        console.error("❌ Failed to initialize Firebase Admin SDK:", error);
        return null;
    }
}

// Safely invoke the initialization process
const adminApp = initializeAdmin();

// Export layout objects conditionally so the build compiler passes cleanly
export const adminAuth: Auth = adminApp ? getAuth(adminApp) : (null as unknown as Auth);
export const adminDb: Firestore = adminApp ? getFirestore(adminApp) : (null as unknown as Firestore);
export const adminStorage: Storage = adminApp ? getStorage(adminApp) : (null as unknown as Storage);
export { adminApp };
