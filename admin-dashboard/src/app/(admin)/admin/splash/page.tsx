"use client";

// filepath: /Users/a200200348/Documents/AajaPadteHai/GeyMatiMataJiApp/admin-dashboard/src/app/(admin)/admin/splash/page.tsx
// Intelligent Splash Screen editor. Single doc at `app_config/splash`.
// Bumping `updatedAt` (server timestamp) on every save tells the mobile
// app to re-download the cached image + audio.

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  ImageIcon,
  Loader2,
  Music2,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { Banner, Button, Card, Field, Input } from "@/lib/ui";
import {
  deleteStorageObject,
  uploadFile,
  type UploadProgress,
} from "@/lib/uploads";

type SplashDraft = {
  imageUrl?: string;
  imageStoragePath?: string;
  audioUrl?: string;
  audioStoragePath?: string;
  targetRoute: string;
  enabled: boolean;
};

const EMPTY: SplashDraft = {
  targetRoute: "/",
  enabled: true,
};

// Same set the Home Stories / Carousel pages expose.
const ROUTE_TARGETS = [
  { value: "/", label: "Home tab (/)" },
  { value: "/library", label: "Library tab (/library)" },
  { value: "/audio", label: "Audio tab (/audio)" },
  { value: "/gallery", label: "Gallery tab (/gallery)" },
  { value: "/jaap", label: "Jaap tab (/jaap)" },
  { value: "/pratiyogita", label: "Pratiyogita (/pratiyogita)" },
  { value: "/kratiyas", label: "Guru Maa ki Kratiya (/kratiyas)" },
  { value: "/news", label: "News list (/news)" },
  { value: "/biography", label: "Biography (/biography)" },
  { value: "/contact", label: "Aahar Daan / Contact (/contact)" },
  { value: "/profile", label: "My Profile (/profile)" },
];

export default function SplashAdminPage() {
  const [draft, setDraft] = useState<SplashDraft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageProgress, setImageProgress] = useState<UploadProgress | null>(
    null,
  );
  const [audioProgress, setAudioProgress] = useState<UploadProgress | null>(
    null,
  );
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    getDoc(doc(db, "app_config", "splash"))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data() as Partial<SplashDraft>;
          setDraft({
            ...EMPTY,
            ...d,
            targetRoute: d.targetRoute || "/",
            enabled: d.enabled !== false,
          });
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    setImageFile(e.target.files?.[0] || null);
  }
  function onPickAudio(e: ChangeEvent<HTMLInputElement>) {
    setAudioFile(e.target.files?.[0] || null);
  }

  async function removeSavedAsset(kind: "image" | "audio") {
    const url = kind === "image" ? draft.imageUrl : draft.audioUrl;
    const path =
      kind === "image" ? draft.imageStoragePath : draft.audioStoragePath;
    if (!url && !path) return;
    if (!confirm("Remove the saved file?")) return;
    try {
      await setDoc(
        doc(db, "app_config", "splash"),
        {
          ...(kind === "image"
            ? { imageUrl: null, imageStoragePath: null }
            : { audioUrl: null, audioStoragePath: null }),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      if (path) deleteStorageObject(path).catch(() => {});
      setDraft((d) => ({
        ...d,
        ...(kind === "image"
          ? { imageUrl: undefined, imageStoragePath: undefined }
          : { audioUrl: undefined, audioStoragePath: undefined }),
      }));
      setSuccess(kind === "image" ? "Image removed." : "Audio removed.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      let imageUrl = draft.imageUrl;
      let imageStoragePath = draft.imageStoragePath;
      let audioUrl = draft.audioUrl;
      let audioStoragePath = draft.audioStoragePath;

      if (imageFile) {
        const oldPath = imageStoragePath;
        const { promise } = uploadFile({
          folder: "app_config/splash",
          file: imageFile,
          onProgress: setImageProgress,
        });
        const uploaded = await promise;
        imageUrl = uploaded.url;
        imageStoragePath = uploaded.storagePath;
        if (oldPath && oldPath !== imageStoragePath) {
          deleteStorageObject(oldPath).catch(() => {});
        }
      }

      if (audioFile) {
        const oldPath = audioStoragePath;
        const { promise } = uploadFile({
          folder: "app_config/splash",
          file: audioFile,
          onProgress: setAudioProgress,
        });
        const uploaded = await promise;
        audioUrl = uploaded.url;
        audioStoragePath = uploaded.storagePath;
        if (oldPath && oldPath !== audioStoragePath) {
          deleteStorageObject(oldPath).catch(() => {});
        }
      }

      await setDoc(
        doc(db, "app_config", "splash"),
        {
          imageUrl: imageUrl || null,
          imageStoragePath: imageStoragePath || null,
          audioUrl: audioUrl || null,
          audioStoragePath: audioStoragePath || null,
          targetRoute: draft.targetRoute.trim() || "/",
          enabled: draft.enabled,
          // Bumping updatedAt invalidates the cached files on every device.
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setDraft((d) => ({
        ...d,
        imageUrl,
        imageStoragePath,
        audioUrl,
        audioStoragePath,
      }));
      setImageFile(null);
      setAudioFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (audioInputRef.current) audioInputRef.current.value = "";
      setSuccess("Splash saved. Devotee devices will refresh on next launch.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
      setImageProgress(null);
      setAudioProgress(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary sm:text-2xl">
          <Sparkles size={22} /> Splash Screen
        </h1>
        <p className="text-sm text-neutral-600">
          Shown the moment the app opens. Image + audio are cached locally on
          each device and refreshed only when this page is saved (i.e. when
          <code className="mx-1 rounded bg-cream px-1">updatedAt</code> changes).
        </p>
      </header>

      {error && <Banner kind="error">{error}</Banner>}
      {success && <Banner kind="success">{success}</Banner>}

      <Card
        title="Splash image"
        description="Portrait works best (~9:16). Will be displayed full-screen."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {(imageFile || draft.imageUrl) && (
            <div className="h-40 w-28 shrink-0 overflow-hidden rounded-xl border border-saffron/40 bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  imageFile
                    ? URL.createObjectURL(imageFile)
                    : draft.imageUrl!
                }
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={onPickImage}
              className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-saffron/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-saffron/30"
            />
            {imageProgress && (
              <p className="text-xs text-neutral-500">
                Uploading… {Math.round(imageProgress.percent)}%
              </p>
            )}
            {draft.imageUrl && !imageFile && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeSavedAsset("image")}
              >
                <Trash2 size={14} /> Remove saved image
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card
        title="Splash audio"
        description="Plays automatically when the splash mounts. mp3 / m4a, up to 30 MB."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {(audioFile || draft.audioUrl) && (
            <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl border border-saffron/40 bg-cream/60">
              <Music2 className="text-primary" />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={onPickAudio}
              className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-saffron/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-saffron/30"
            />
            {draft.audioUrl && !audioFile && (
              <audio
                src={draft.audioUrl}
                controls
                className="w-full max-w-sm"
              />
            )}
            {audioProgress && (
              <p className="text-xs text-neutral-500">
                Uploading… {Math.round(audioProgress.percent)}%
              </p>
            )}
            {draft.audioUrl && !audioFile && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeSavedAsset("audio")}
              >
                <Trash2 size={14} /> Remove saved audio
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card title="Behaviour">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="“Begin” target route"
            hint="Where the user lands after tapping the Begin button (if logged in). Custom routes are also accepted."
          >
            <select
              value={
                ROUTE_TARGETS.some((r) => r.value === draft.targetRoute)
                  ? draft.targetRoute
                  : "__custom"
              }
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({
                  ...d,
                  targetRoute: v === "__custom" ? "" : v,
                }));
              }}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {ROUTE_TARGETS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
              <option value="__custom">Custom route…</option>
            </select>
            {!ROUTE_TARGETS.some((r) => r.value === draft.targetRoute) && (
              <div className="mt-2">
                <Input
                  value={draft.targetRoute}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, targetRoute: e.target.value }))
                  }
                  placeholder="/jaap"
                />
              </div>
            )}
          </Field>

          <Field label="Enabled">
            <label className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, enabled: e.target.checked }))
                }
                className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary/30"
              />
              <span className="text-sm text-neutral-700">
                Show splash on every app launch
              </span>
            </label>
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Save splash
        </Button>
        <span className="text-xs text-neutral-500">
          <ImageIcon size={12} className="inline" /> Devices re-download cached
          assets the next time they open the app.
        </span>
      </div>
    </form>
  );
}
