// Intelligent splash manager.
// ---------------------------
// Subscribes to the singleton Firestore doc `app_config/splash`, and
// keeps a locally-cached copy of the image + audio in the app's document
// directory so the splash always renders instantly (even offline).
//
// Cache invalidation strategy:
//   - The admin dashboard bumps `updatedAt` (serverTimestamp) on every save.
//   - We persist the last applied `updatedAt.toMillis()` in AsyncStorage.
//   - When the Firestore value differs (or local files are missing/empty),
//     we re-download both assets via `File.downloadFileAsync` into
//     `Paths.document/splash/`, then persist the new local URIs.
//
// The hook never throws — on any failure it falls back to the previously
// cached values (if any) so the splash UI still has something to show.

import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { Directory, File, Paths } from "expo-file-system";

import { db } from "./firebase";
import type { SplashConfig } from "../../../shared/types";

const CACHE_KEY = "@gyey/splash_cache_v1";
const SPLASH_DIR = "splash";

export type SplashState = {
  /** True once we've resolved the first Firestore snapshot (or timed out). */
  ready: boolean;
  /** Mirrors `SplashConfig.enabled` (defaults to true when unset). */
  enabled: boolean;
  /** `file://` URI of the cached image, or the remote URL as a fallback. */
  localImageUri: string | null;
  /** `file://` URI of the cached audio, or the remote URL as a fallback. */
  localAudioUri: string | null;
  /** Where to send the user when they press "Begin". */
  targetRoute: string;
};

type PersistedCache = {
  lastSavedSplashUpdate: number | null;
  localImageUri: string | null;
  localAudioUri: string | null;
  enabled: boolean;
  targetRoute: string;
};

const EMPTY_STATE: SplashState = {
  ready: true,
  enabled: true,
  localImageUri: null,
  localAudioUri: null,
  targetRoute: "/",
};

async function readCache(): Promise<PersistedCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCache;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(c: PersistedCache): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

/** Best-effort `exists && size > 0` check for a `file://` URI. */
function fileLooksValid(uri: string | null | undefined): boolean {
  if (!uri) return false;
  try {
    const f = new File(uri);
    return f.exists && (f.size ?? 0) > 0;
  } catch {
    return false;
  }
}

function ensureSplashDir(): Directory {
  const dir = new Directory(Paths.document, SPLASH_DIR);
  try {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  } catch {
    /* ignore — downloadFileAsync will surface a clearer error */
  }
  return dir;
}

/** Pick a sensible filename from a URL (keeps the extension if present). */
function fileNameFor(kind: "image" | "audio", url: string): string {
  // Strip query string, take last path segment.
  const clean = url.split("?")[0]!;
  const segs = clean.split("/");
  const last = segs[segs.length - 1] || "";
  const dot = last.lastIndexOf(".");
  const ext = dot > 0 ? last.slice(dot) : kind === "image" ? ".jpg" : ".mp3";
  return `${kind}${ext}`;
}

async function downloadInto(
  dir: Directory,
  url: string,
  name: string,
): Promise<string | null> {
  try {
    const target = new File(dir, name);
    // Overwrite any previous version.
    try {
      if (target.exists) target.delete();
    } catch {
      /* ignore */
    }
    const result = await File.downloadFileAsync(url, target);
    if (!fileLooksValid(result.uri)) return null;
    return result.uri;
  } catch {
    return null;
  }
}

export function useSplashManager(): SplashState {
  const [state, setState] = useState<SplashState>(EMPTY_STATE);
  const hydratedRef = useRef(false);

  // 1) Hydrate from cache, then fall back to a one-shot getDoc.
  //    `getDoc` is a plain Promise (not a subscription) so it is immune to
  //    `onSnapshot` cleanup that React Strict Mode triggers before the
  //    listener callback fires.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // ── Try AsyncStorage cache first (instant, works offline) ──
      const cached = await readCache();
      if (cancelled) return;
      hydratedRef.current = true;
      if (cached) {
        const imgOk = fileLooksValid(cached.localImageUri);
        const audOk = fileLooksValid(cached.localAudioUri);
        if (imgOk || audOk) {
          setState({
            ready: true,
            enabled: cached.enabled,
            localImageUri: imgOk ? cached.localImageUri : null,
            localAudioUri: audOk ? cached.localAudioUri : null,
            targetRoute: cached.targetRoute || "/",
          });
          return; // cache is valid — onSnapshot will refresh in the background
        }
      }

      // ── No usable cache — one-shot getDoc as primary ready source ──
      try {
        const ref = doc(db, "app_config", "splash");
        const snap = await getDoc(ref);
        if (cancelled) return;
        const data = snap.exists() ? (snap.data() as SplashConfig) : null;
        const enabled = data?.enabled !== false;
        const targetRoute = (data?.targetRoute?.trim()) || "/";
        setState({
          ready: true,
          enabled,
          localImageUri: data?.imageUrl ?? null,
          localAudioUri: data?.audioUrl ?? null,
          targetRoute,
        });
      } catch {
        // Even on failure, mark ready so the app never hangs.
        if (!cancelled) {
          setState((prev) => ({ ...prev, ready: true }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Safety timeout — if neither cache nor Firestore has resolved within
  // 5 seconds, force `ready: true` so the app never hangs on the spinner.
  useEffect(() => {
    const timer = setTimeout(() => {
      setState((prev) => {
        if (prev.ready) return prev;
        return { ...prev, ready: true };
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // 2) Subscribe to the Firestore doc and refresh the cache when the
  //    server's `updatedAt` differs from the locally persisted value.
  useEffect(() => {
    const ref = doc(db, "app_config", "splash");
    const unsub = onSnapshot(
        ref,
        async (snap) => {
          const data = (snap.exists() ? (snap.data() as SplashConfig) : null);
          const enabled = data?.enabled !== false; // default true
          const targetRoute =
              (data?.targetRoute && data.targetRoute.trim()) || "/";

          // ── Mark ready IMMEDIATELY with remote URLs ──
          // This must happen BEFORE any `await` so that even if the component
          // unmounts (React Strict Mode) or downloads hang, the splash renders.
          setState({
            ready: true,
            enabled,
            localImageUri: data?.imageUrl ?? null,
            localAudioUri: data?.audioUrl ?? null,
            targetRoute,
          });

          // Nothing to cache if there are no assets.
          if (!data || !data.imageUrl && !data.audioUrl) return;

          // ── Background: try to cache assets locally ──
          try {
            let serverMs: number | null = null;
            const ts = data.updatedAt as unknown as {
              toMillis?: () => number;
              seconds?: number;
            } | null;
            if (ts && typeof ts.toMillis === "function") {
              serverMs = ts.toMillis();
            } else if (ts && typeof ts.seconds === "number") {
              serverMs = ts.seconds * 1000;
            }

            const cached = await readCache();
            const needsRefresh =
                !cached ||
                cached.lastSavedSplashUpdate !== serverMs ||
                !fileLooksValid(cached.localImageUri) ||
                !fileLooksValid(cached.localAudioUri) ||
                (!!data.imageUrl && !cached.localImageUri) ||
                (!!data.audioUrl && !cached.localAudioUri);

            if (!needsRefresh && cached) {
              // Upgrade to local URIs if they are valid.
              const imgOk = fileLooksValid(cached.localImageUri);
              const audOk = fileLooksValid(cached.localAudioUri);
              if (imgOk || audOk) {
                setState((prev) => ({
                  ...prev,
                  localImageUri: imgOk ? cached.localImageUri : prev.localImageUri,
                  localAudioUri: audOk ? cached.localAudioUri : prev.localAudioUri,
                }));
              }
              return;
            }

            // Download fresh copies with a per-file timeout so we never hang.
            const dir = ensureSplashDir();
            const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
                Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

            const [newImg, newAud] = await Promise.all([
              data.imageUrl
                  ? withTimeout(downloadInto(dir, data.imageUrl, fileNameFor("image", data.imageUrl)), 15000)
                  : Promise.resolve(null),
              data.audioUrl
                  ? withTimeout(downloadInto(dir, data.audioUrl, fileNameFor("audio", data.audioUrl)), 15000)
                  : Promise.resolve(null),
            ]);

            const finalImg = newImg ?? (data.imageUrl ?? null);
            const finalAud = newAud ?? (data.audioUrl ?? null);

            await writeCache({
              lastSavedSplashUpdate: serverMs,
              localImageUri: finalImg,
              localAudioUri: finalAud,
              enabled,
              targetRoute,
            });

            // Upgrade URIs to the downloaded local versions.
            setState((prev) => ({
              ...prev,
              localImageUri: finalImg,
              localAudioUri: finalAud,
            }));
          } catch {
            // Already ready with remote URLs — background caching failed, that's OK.
          }
        },
        async () => {
          // On Firestore error, try to use cached assets so the splash can
          // still render. Only mark ready — never leave the app hanging.
          const cached = await readCache();
          if (cached) {
            const imgOk = fileLooksValid(cached.localImageUri);
            const audOk = fileLooksValid(cached.localAudioUri);
            setState({
              ready: true,
              enabled: cached.enabled,
              localImageUri: imgOk ? cached.localImageUri : null,
              localAudioUri: audOk ? cached.localAudioUri : null,
              targetRoute: cached.targetRoute || "/",
            });
          } else {
            setState((prev) => ({ ...prev, ready: true }));
          }
        },
    );
    return unsub;
  }, []);

  return state;
}
