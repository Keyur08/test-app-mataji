"use client";

// Manage Reels — short vertical video stories stored in `reels`.
// Video file is uploaded to Firebase Storage; metadata lives in Firestore.

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import {
  Film,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Textarea,
} from "@/lib/ui";
import {
  deleteStorageObject,
  formatBytes,
  uploadFile,
  type UploadProgress,
} from "@/lib/uploads";

type ReelDoc = {
  id: string;
  title?: string;
  caption?: string;
  videoUrl: string;
  storagePath?: string;
  thumbnailUrl?: string;
  thumbnailStoragePath?: string;
  order?: number;
  sizeBytes?: number;
  createdAt?: Timestamp;
};

type ReelDraft = {
  id?: string;
  title: string;
  caption: string;
  order: number;
  videoUrl?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  thumbnailStoragePath?: string;
  sizeBytes?: number;
};

const EMPTY: ReelDraft = {
  title: "",
  caption: "",
  order: 0,
};

export default function ManageReelsPage() {
  const [items, setItems] = useState<ReelDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ReelDraft>(EMPTY);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "reels"), orderBy("order"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map(
            (d) =>
              ({ id: d.id, ...(d.data() as Omit<ReelDoc, "id">) }) as ReelDoc
          )
        );
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const isEditing = !!draft.id;

  function resetForm() {
    setDraft(EMPTY);
    setVideoFile(null);
    setThumbFile(null);
    setProgress(null);
    setError(null);
    setSuccess(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  }

  function editItem(it: ReelDoc) {
    setDraft({
      id: it.id,
      title: it.title ?? "",
      caption: it.caption ?? "",
      order: it.order ?? 0,
      videoUrl: it.videoUrl,
      storagePath: it.storagePath,
      thumbnailUrl: it.thumbnailUrl,
      thumbnailStoragePath: it.thumbnailStoragePath,
      sizeBytes: it.sizeBytes,
    });
    setVideoFile(null);
    setThumbFile(null);
    setError(null);
    setSuccess(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  }

  async function handleDelete(it: ReelDoc) {
    if (!confirm("Delete this reel? The video file will be removed.")) return;
    try {
      await deleteDoc(doc(db, "reels", it.id));
      if (it.storagePath) await deleteStorageObject(it.storagePath);
      if (it.thumbnailStoragePath)
        await deleteStorageObject(it.thumbnailStoragePath);
      if (draft.id === it.id) resetForm();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isEditing && !videoFile) {
      setError("Please choose a video file.");
      return;
    }

    setSaving(true);
    try {
      let videoUrl = draft.videoUrl;
      let storagePath = draft.storagePath;
      let sizeBytes = draft.sizeBytes;

      if (videoFile) {
        const { promise } = uploadFile({
          folder: "reels/video",
          file: videoFile,
          onProgress: setProgress,
        });
        const res = await promise;
        if (storagePath && storagePath !== res.storagePath) {
          await deleteStorageObject(storagePath);
        }
        videoUrl = res.url;
        storagePath = res.storagePath;
        sizeBytes = res.size;
      }

      let thumbnailUrl = draft.thumbnailUrl;
      let thumbnailStoragePath = draft.thumbnailStoragePath;
      if (thumbFile) {
        const { promise } = uploadFile({
          folder: "reels/thumb",
          file: thumbFile,
        });
        const res = await promise;
        if (thumbnailStoragePath && thumbnailStoragePath !== res.storagePath) {
          await deleteStorageObject(thumbnailStoragePath);
        }
        thumbnailUrl = res.url;
        thumbnailStoragePath = res.storagePath;
      }

      const payload = {
        title: draft.title.trim() || null,
        caption: draft.caption.trim() || null,
        order: Number(draft.order) || 0,
        videoUrl,
        storagePath,
        thumbnailUrl: thumbnailUrl ?? null,
        thumbnailStoragePath: thumbnailStoragePath ?? null,
        sizeBytes: sizeBytes ?? null,
        updatedAt: serverTimestamp(),
      };

      if (isEditing && draft.id) {
        await setDoc(doc(db, "reels", draft.id), payload, { merge: true });
        setSuccess("Reel updated.");
      } else {
        await addDoc(collection(db, "reels"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setSuccess("Reel uploaded.");
        resetForm();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary sm:text-2xl">
          <Film size={24} /> Manage Reels
        </h1>
        <p className="text-sm text-neutral-600">
          Upload short vertical videos (stories). Stored in the{" "}
          <code>reels</code> collection.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title={isEditing ? "Edit Reel" : "Upload Reel"}
          description="Recommended: portrait MP4, ≤ 60s, under 25 MB."
          actions={
            isEditing ? (
              <Button variant="ghost" onClick={resetForm}>
                <X size={16} /> Cancel
              </Button>
            ) : undefined
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title (optional)">
                <Input
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="Mataji ki vaani"
                />
              </Field>
              <Field label="Display Order" hint="Lower numbers first">
                <Input
                  type="number"
                  value={draft.order}
                  onChange={(e) =>
                    setDraft({ ...draft, order: Number(e.target.value) })
                  }
                />
              </Field>
            </div>

            <Field label="Caption (optional)">
              <Textarea
                rows={3}
                value={draft.caption}
                onChange={(e) =>
                  setDraft({ ...draft, caption: e.target.value })
                }
                placeholder="Short caption shown under the reel."
              />
            </Field>

            <Field
              label={isEditing ? "Replace video (optional)" : "Video file"}
              required={!isEditing}
              hint={
                draft.videoUrl
                  ? "Currently linked: leave empty to keep the existing video."
                  : "Accepted: .mp4, .mov, .webm"
              }
            >
              <Input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setVideoFile(e.target.files?.[0] ?? null)
                }
              />
              {videoFile && (
                <p className="mt-1 text-xs text-neutral-500">
                  {videoFile.name} · {formatBytes(videoFile.size)}
                </p>
              )}
              {!videoFile && draft.videoUrl && (
                <a
                  href={draft.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-primary hover:underline"
                >
                  Open current video ↗
                </a>
              )}
            </Field>

            <Field
              label="Thumbnail (optional)"
              hint="Portrait JPG/PNG (~720×1280). Helps load faster."
            >
              <Input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setThumbFile(e.target.files?.[0] ?? null)
                }
              />
              {(thumbFile || draft.thumbnailUrl) && (
                <div className="mt-2 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      thumbFile
                        ? URL.createObjectURL(thumbFile)
                        : draft.thumbnailUrl!
                    }
                    alt="Thumbnail preview"
                    className="h-24 w-14 rounded-md border border-saffron/30 object-cover"
                  />
                  <span className="text-xs text-neutral-500">
                    {thumbFile?.name ?? "Current thumbnail"}
                  </span>
                </div>
              )}
            </Field>

            {progress && (
              <div>
                <div className="mb-1 flex justify-between text-xs text-neutral-600">
                  <span>Uploading…</span>
                  <span>{Math.round(progress.percent)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full bg-primary transition-[width]"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {error && <Banner kind="error">{error}</Banner>}
            {success && <Banner kind="success">{success}</Banner>}

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <UploadCloud size={16} />
                )}
                {isEditing ? "Save changes" : "Upload reel"}
              </Button>
            </div>
          </form>
        </Card>

        <Card
          title="Reels"
          description={`${items.length} reel${items.length === 1 ? "" : "s"}`}
          actions={
            <Button variant="secondary" onClick={resetForm}>
              <Plus size={16} /> New
            </Button>
          }
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="No reels yet."
              description="Upload your first vertical video to get started."
            />
          ) : (
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {items.map((it) => (
                <li
                  key={it.id}
                  className={`flex items-center gap-3 rounded-lg border border-neutral-100 bg-white p-3 ${
                    draft.id === it.id ? "ring-2 ring-primary/40" : ""
                  }`}
                >
                  <span className="flex h-16 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-saffron/15 text-primary">
                    {it.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Film size={18} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {it.title || "Untitled reel"}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {it.caption || "—"}{" "}
                      {it.sizeBytes ? `· ${formatBytes(it.sizeBytes)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => editItem(it)}
                      className="rounded-md p-1.5 text-neutral-500 hover:bg-cream hover:text-primary"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(it)}
                      className="rounded-md p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
