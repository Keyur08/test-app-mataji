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
import { doc, onSnapshot } from "firebase/firestore";
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
  ready: false,
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

  // 1) Hydrate from AsyncStorage so the very first paint of /splash has
  //    something to show, even before the Firestore snapshot arrives.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readCache();
      if (cancelled) return;
      hydratedRef.current = true;
      if (cached) {
        const imgOk = fileLooksValid(cached.localImageUri);
        const audOk = fileLooksValid(cached.localAudioUri);
        setState((prev) => ({
          ...prev,
          enabled: cached.enabled,
          localImageUri: imgOk ? cached.localImageUri : null,
          localAudioUri: audOk ? cached.localAudioUri : null,
          targetRoute: cached.targetRoute || "/",
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
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

        // No doc / disabled / no assets → publish what we have but mark ready.
        if (!data || !enabled || (!data.imageUrl && !data.audioUrl)) {
          const cached = await readCache();
          setState({
            ready: true,
            enabled,
            localImageUri:
              cached && fileLooksValid(cached.localImageUri)
                ? cached.localImageUri
                : null,
            localAudioUri:
              cached && fileLooksValid(cached.localAudioUri)
                ? cached.localAudioUri
                : null,
            targetRoute,
          });
          return;
        }

        // Compare `updatedAt` against the persisted marker.
        // `TimestampLike` from Firestore exposes `toMillis()`.
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
          // Switching to a remote URL we haven't downloaded yet.
          (!!data.imageUrl && !cached.localImageUri) ||
          (!!data.audioUrl && !cached.localAudioUri);

        if (!needsRefresh && cached) {
          setState({
            ready: true,
            enabled,
            localImageUri: cached.localImageUri,
            localAudioUri: cached.localAudioUri,
            targetRoute,
          });
          return;
        }

        // Download fresh copies. Fall back to remote URL if the download
        // failed but a URL is present, so the splash can still render.
        const dir = ensureSplashDir();
        const [newImg, newAud] = await Promise.all([
          data.imageUrl
            ? downloadInto(dir, data.imageUrl, fileNameFor("image", data.imageUrl))
            : Promise.resolve(null),
          data.audioUrl
            ? downloadInto(dir, data.audioUrl, fileNameFor("audio", data.audioUrl))
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

        setState({
          ready: true,
          enabled,
          localImageUri: finalImg,
          localAudioUri: finalAud,
          targetRoute,
        });
      },
      async () => {
        // On Firestore error, still mark ready so the app doesn't hang
        // on the splash gate forever.
        setState((prev) => ({ ...prev, ready: true }));
      },
    );
    return unsub;
  }, []);

  return state;
}
