"use client";

// Manage Pravachans — discourses stored in `pravachans`. Each entry is
// either a **YouTube video** (admin pastes a URL) or an **audio recording**
// (admin uploads an MP3 / M4A). The mobile app picks the right renderer.

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  Headphones,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Video,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import {
  deleteStorageObject,
  formatBytes,
  uploadFile,
  type UploadProgress,
} from "@/lib/uploads";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Textarea,
} from "@/lib/ui";

type PravachanType = "video" | "audio";

type PravachanDoc = {
  id: string;
  title: string;
  // Video fields
  youtubeUrl?: string;
  // Audio fields
  audioUrl?: string;
  audioStoragePath?: string;
  audioSizeBytes?: number;
  thumbnailUrl?: string;
  thumbnailStoragePath?: string;
  durationSec?: number;
  // Shared
  speaker?: string;
  description?: string;
  order?: number;
  publishedAt?: Timestamp;
};

type PravachanDraft = {
  id?: string;
  type: PravachanType;
  title: string;
  // Video
  youtubeUrl: string;
  // Audio (existing remote values, used when editing)
  audioUrl?: string;
  audioStoragePath?: string;
  audioSizeBytes?: number;
  thumbnailUrl?: string;
  thumbnailStoragePath?: string;
  // Shared
  speaker: string;
  description: string;
  order: number;
};

const EMPTY: PravachanDraft = {
  type: "video",
  title: "",
  youtubeUrl: "",
  speaker: "",
  description: "",
  order: 0,
};

/** Extract an 11-character YouTube id from any common URL form, including
 *  a full `<iframe ...>` embed snippet pasted from YouTube's Share → Embed. */
function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Bare 11-char id
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // Common patterns inside URLs OR inside an <iframe src="..."> snippet:
  //   youtu.be/<id>
  //   youtube.com/watch?v=<id>
  //   youtube(-nocookie).com/embed/<id>
  //   youtube.com/shorts/<id>
  //   youtube.com/v/<id>
  const m = trimmed.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

const thumbFor = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export default function ManagePravachansPage() {
  const [items, setItems] = useState<PravachanDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<PravachanDraft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "pravachans"), orderBy("order"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map(
            (d) =>
              ({ id: d.id, ...(d.data() as Omit<PravachanDoc, "id">) }) as PravachanDoc
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
  const parsedId = useMemo(
    () => (draft.type === "video" ? parseYouTubeId(draft.youtubeUrl) : null),
    [draft.type, draft.youtubeUrl]
  );

  // --- Audio upload state (only used when draft.type === "audio") ---
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  // Embeddability check via YouTube's public oEmbed endpoint. If the video
  // is removed / private / has embedding disabled, the request returns
  // 401/403/404 — we surface that to the admin BEFORE they save, so they
  // don't end up with a pravachan that just shows error 152 in the app.
  type EmbedStatus =
    | { state: "idle" }
    | { state: "checking" }
    | { state: "ok"; title: string; author: string }
    | { state: "blocked"; reason: string };
  const [embedStatus, setEmbedStatus] = useState<EmbedStatus>({
    state: "idle",
  });

  useEffect(() => {
    if (!parsedId) {
      setEmbedStatus({ state: "idle" });
      return;
    }
    let cancelled = false;
    setEmbedStatus({ state: "checking" });
    const watchUrl = `https://www.youtube.com/watch?v=${parsedId}`;
    fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`
    )
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { title: string; author_name: string };
          setEmbedStatus({
            state: "ok",
            title: data.title,
            author: data.author_name,
          });
        } else {
          setEmbedStatus({
            state: "blocked",
            reason:
              res.status === 401
                ? "The uploader has disabled embedding for this video. It can't be played in-app."
                : res.status === 404
                  ? "Video not found (removed, private, or wrong id)."
                  : `YouTube returned status ${res.status}.`,
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Network error — we don't want to block saving on that.
        setEmbedStatus({ state: "idle" });
      });
    return () => {
      cancelled = true;
    };
  }, [parsedId]);

  function resetForm() {
    setDraft(EMPTY);
    setAudioFile(null);
    setThumbnailFile(null);
    setProgress(null);
    setError(null);
    setSuccess(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  }

  function editItem(it: PravachanDoc) {
    const type: PravachanType = it.audioUrl ? "audio" : "video";
    setDraft({
      id: it.id,
      type,
      title: it.title,
      youtubeUrl: it.youtubeUrl ?? "",
      audioUrl: it.audioUrl,
      audioStoragePath: it.audioStoragePath,
      audioSizeBytes: it.audioSizeBytes,
      thumbnailUrl: it.thumbnailUrl,
      thumbnailStoragePath: it.thumbnailStoragePath,
      speaker: it.speaker ?? "",
      description: it.description ?? "",
      order: it.order ?? 0,
    });
    setAudioFile(null);
    setThumbnailFile(null);
    setError(null);
    setSuccess(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  }

  async function handleDelete(it: PravachanDoc) {
    if (!confirm(`Delete pravachan "${it.title}"?`)) return;
    try {
      await deleteDoc(doc(db, "pravachans", it.id));
      if (it.audioStoragePath) await deleteStorageObject(it.audioStoragePath);
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

    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }

    if (draft.type === "video") {
      if (!parsedId) {
        setError("Please enter a valid YouTube URL or 11-character video id.");
        return;
      }
      if (embedStatus.state === "blocked") {
        setError(embedStatus.reason);
        return;
      }
    } else {
      // Audio mode — require an existing or newly-picked audio file.
      if (!draft.audioUrl && !audioFile) {
        setError("Please choose an audio file (MP3 / M4A).");
        return;
      }
    }

    setSaving(true);
    try {
      // Resolve audio fields when we're in audio mode.
      let audioUrl = draft.audioUrl;
      let audioStoragePath = draft.audioStoragePath;
      let audioSizeBytes = draft.audioSizeBytes;
      let thumbnailUrl = draft.thumbnailUrl;
      let thumbnailStoragePath = draft.thumbnailStoragePath;

      if (draft.type === "audio" && audioFile) {
        const { promise } = uploadFile({
          folder: "pravachans/audio",
          file: audioFile,
          onProgress: setProgress,
        });
        const res = await promise;
        if (audioStoragePath && audioStoragePath !== res.storagePath) {
          await deleteStorageObject(audioStoragePath);
        }
        audioUrl = res.url;
        audioStoragePath = res.storagePath;
        audioSizeBytes = res.size;
      }

      if (draft.type === "audio" && thumbnailFile) {
        const { promise } = uploadFile({
          folder: "pravachans/thumbnails",
          file: thumbnailFile,
        });
        const res = await promise;
        if (thumbnailStoragePath && thumbnailStoragePath !== res.storagePath) {
          await deleteStorageObject(thumbnailStoragePath);
        }
        thumbnailUrl = res.url;
        thumbnailStoragePath = res.storagePath;
      }

      // Build the doc payload. We always clear the fields that don't belong
      // to the chosen type so toggling video↔audio replaces them cleanly.
      const sharedPayload = {
        title: draft.title.trim(),
        speaker: draft.speaker.trim() || null,
        description: draft.description.trim() || null,
        order: Number(draft.order) || 0,
        updatedAt: serverTimestamp(),
      };

      let typePayload: Record<string, unknown>;
      if (draft.type === "video") {
        // Switching to video → wipe any previously-uploaded audio.
        if (draft.audioStoragePath) {
          await deleteStorageObject(draft.audioStoragePath);
        }
        if (draft.thumbnailStoragePath) {
          await deleteStorageObject(draft.thumbnailStoragePath);
        }
        typePayload = {
          youtubeUrl: `https://www.youtube.com/watch?v=${parsedId}`,
          audioUrl: null,
          audioStoragePath: null,
          audioSizeBytes: null,
          thumbnailUrl: null,
          thumbnailStoragePath: null,
        };
      } else {
        typePayload = {
          youtubeUrl: null,
          audioUrl: audioUrl ?? null,
          audioStoragePath: audioStoragePath ?? null,
          audioSizeBytes: audioSizeBytes ?? null,
          thumbnailUrl: thumbnailUrl ?? null,
          thumbnailStoragePath: thumbnailStoragePath ?? null,
        };
      }

      const payload = { ...sharedPayload, ...typePayload };

      if (isEditing && draft.id) {
        await setDoc(doc(db, "pravachans", draft.id), payload, { merge: true });
        setSuccess("Pravachan updated.");
      } else {
        await addDoc(collection(db, "pravachans"), {
          ...payload,
          publishedAt: serverTimestamp(),
        });
        setSuccess("Pravachan added.");
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
          <Video size={24} /> Manage Pravachans
        </h1>
        <p className="text-sm text-neutral-600">
          Add discourses as either YouTube videos or uploaded audio files.
          Stored in the <code>pravachans</code>{" "}
          collection.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title={isEditing ? "Edit Pravachan" : "Add Pravachan"}
          actions={
            isEditing ? (
              <Button variant="ghost" onClick={resetForm}>
                <X size={16} /> Cancel
              </Button>
            ) : undefined
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type toggle — Video / Audio */}
            <Field label="Type" required>
              <div className="inline-flex overflow-hidden rounded-lg border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, type: "video" })}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition ${
                    draft.type === "video"
                      ? "bg-primary text-white"
                      : "bg-white text-neutral-600 hover:bg-cream"
                  }`}
                >
                  <Video size={14} /> YouTube Video
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, type: "audio" })}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition ${
                    draft.type === "audio"
                      ? "bg-primary text-white"
                      : "bg-white text-neutral-600 hover:bg-cream"
                  }`}
                >
                  <Headphones size={14} /> Audio
                </button>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Choose <strong>YouTube Video</strong> to embed a video, or{" "}
                <strong>Audio</strong> to upload an MP3 that plays in the
                background like a bhajan.
              </p>
            </Field>

            <Field label="Title" required>
              <Input
                required
                value={draft.title}
                onChange={(e) =>
                  setDraft({ ...draft, title: e.target.value })
                }
                placeholder="Pravachan on Samta"
              />
            </Field>

            {draft.type === "video" ? (
              <Field
                label="YouTube URL"
                required
                hint="Paste any YouTube URL (watch / youtu.be / shorts / embed), the 11-char id, or a full <iframe …> embed snippet."
              >
                <Input
                  required
                  value={draft.youtubeUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, youtubeUrl: e.target.value })
                  }
                  placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                />
                {draft.youtubeUrl && !parsedId && (
                  <p className="mt-1 text-xs text-red-600">
                    Could not detect a video id from this URL.
                  </p>
                )}
                {parsedId && (
                  <div className="mt-2 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbFor(parsedId)}
                      alt="YouTube thumbnail"
                      className="h-16 w-28 rounded-md border border-saffron/30 object-cover"
                    />
                    <div className="flex-1 text-xs text-neutral-500">
                      <div>
                        Detected id: <code>{parsedId}</code>
                      </div>
                      {embedStatus.state === "checking" && (
                        <div className="mt-1 flex items-center gap-1 text-neutral-500">
                          <Loader2 size={12} className="animate-spin" />
                          Checking embed permission…
                        </div>
                      )}
                      {embedStatus.state === "ok" && (
                        <div className="mt-1 text-green-700">
                          ✓ Embeddable · {embedStatus.title} ·{" "}
                          <span className="text-neutral-500">
                            {embedStatus.author}
                          </span>
                        </div>
                      )}
                      {embedStatus.state === "blocked" && (
                        <div className="mt-1 text-red-600">
                          ✗ {embedStatus.reason}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Field>
            ) : (
              <>
                <Field
                  label="Audio file"
                  required={!draft.audioUrl}
                  hint="MP3 or M4A. Plays through the global background player on mobile."
                >
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/mpeg,audio/mp4,audio/m4a,audio/x-m4a,audio/*"
                    onChange={(e) =>
                      setAudioFile(e.target.files?.[0] ?? null)
                    }
                    className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-primary/90"
                  />
                  {audioFile ? (
                    <p className="mt-1 text-xs text-neutral-500">
                      Selected: {audioFile.name} ({formatBytes(audioFile.size)})
                    </p>
                  ) : draft.audioUrl ? (
                    <p className="mt-1 text-xs text-neutral-500">
                      Current file kept{" "}
                      {draft.audioSizeBytes
                        ? `(${formatBytes(draft.audioSizeBytes)})`
                        : ""}{" "}
                      — choose a new file only to replace it.
                    </p>
                  ) : null}
                  {progress && (
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        Uploading… {progress.percent.toFixed(0)}%
                      </p>
                    </div>
                  )}
                </Field>

                <Field
                  label="Thumbnail (optional)"
                  hint="Shown as the cover art in the app + lock screen."
                >
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setThumbnailFile(e.target.files?.[0] ?? null)
                    }
                    className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-saffron/80 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-saffron"
                  />
                  {thumbnailFile ? (
                    <p className="mt-1 text-xs text-neutral-500">
                      Selected: {thumbnailFile.name}
                    </p>
                  ) : draft.thumbnailUrl ? (
                    <div className="mt-2 flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={draft.thumbnailUrl}
                        alt="Current thumbnail"
                        className="h-12 w-12 rounded-md border border-saffron/30 object-cover"
                      />
                      <span className="text-xs text-neutral-500">
                        Current thumbnail kept — choose a new file to replace.
                      </span>
                    </div>
                  ) : null}
                </Field>
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Speaker">
                <Input
                  value={draft.speaker}
                  onChange={(e) =>
                    setDraft({ ...draft, speaker: e.target.value })
                  }
                  placeholder="Pujya Mataji"
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

            <Field label="Description">
              <Textarea
                rows={4}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder="Short description shown under the video."
              />
            </Field>

            {error && <Banner kind="error">{error}</Banner>}
            {success && <Banner kind="success">{success}</Banner>}

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {isEditing ? "Save changes" : "Add pravachan"}
              </Button>
            </div>
          </form>
        </Card>

        <Card
          title="Pravachans"
          description={`${items.length} video${items.length === 1 ? "" : "s"}`}
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
              title="No pravachans yet."
              description="Add your first video or audio pravachan to get started."
            />
          ) : (
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {items.map((it) => {
                const isAudio = !!it.audioUrl;
                const vid = it.youtubeUrl ? parseYouTubeId(it.youtubeUrl) : null;
                return (
                  <li
                    key={it.id}
                    className={`flex items-center gap-3 rounded-lg border border-neutral-100 bg-white p-3 ${
                      draft.id === it.id ? "ring-2 ring-primary/40" : ""
                    }`}
                  >
                    <span className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-saffron/15 text-primary">
                      {isAudio && it.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : isAudio ? (
                        <Headphones size={18} />
                      ) : vid ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbFor(vid)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Video size={18} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {it.title}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        <span
                          className={`mr-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            isAudio
                              ? "bg-saffron/20 text-amber-700"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {isAudio ? (
                            <>
                              <Headphones size={10} /> Audio
                            </>
                          ) : (
                            <>
                              <Video size={10} /> Video
                            </>
                          )}
                        </span>
                        {it.speaker || "—"}
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
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
