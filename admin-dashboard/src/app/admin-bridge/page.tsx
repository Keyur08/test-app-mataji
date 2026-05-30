"use client";

// Tiny landing page that consumes a `?ct=<customToken>` minted by
// /api/session-login, signs the browser into Firebase Auth using
// `signInWithCustomToken`, and then forwards to `next` (defaults to /admin).
// The mobile WebView lands here automatically after the redirect chain.

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { Loader2 } from "lucide-react";

import { auth } from "@/lib/firebase";

// 1. Internal component that safely consumes the search params at runtime
function AdminBridgeContent() {
  const router = useRouter();
  const params = useSearchParams();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const ct = params.get("ct");
    const nextParam = params.get("next") || "/admin";
    const safeNext = nextParam.startsWith("/") ? nextParam : "/admin";

    if (!ct) {
      router.replace("/login?error=missing-ct");
      return;
    }

    (async () => {
      try {
        await signInWithCustomToken(auth, ct);
        router.replace(safeNext);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed.");
      }
    })();
  }, [params, router]);

  return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream p-6">
        {error ? (
            <>
              <p className="text-sm font-semibold text-red-600">
                Could not sign in: {error}
              </p>
              <button
                  onClick={() => router.replace("/login")}
                  className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white"
              >
                Back to login
              </button>
            </>
        ) : (
            <>
              <Loader2 className="animate-spin text-primary" size={28} />
              <p className="mt-3 text-sm font-semibold text-zinc-600">
                Signing you in…
              </p>
            </>
        )}
      </div>
  );
}

// 2. The default export that wraps the content component in a Suspense boundary
export default function AdminBridgePage() {
  return (
      <Suspense
          fallback={
            <div className="flex min-h-screen flex-col items-center justify-center bg-cream p-6">
              <Loader2 className="animate-spin text-primary" size={28} />
              <p className="mt-3 text-sm font-semibold text-zinc-600">Loading configurations…</p>
            </div>
          }
      >
        <AdminBridgeContent />
      </Suspense>
  );
}
