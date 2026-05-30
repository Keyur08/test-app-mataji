"use client";

// Announcements / News & Events — CRUD for the `news_events` Firestore
// collection. These show up in the mobile app's "Latest Announcements" rail
// on the Home screen, ordered by `publishedAt` DESC.

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  CalendarDays,
  ImageIcon,
  Loader2,
  Megaphone,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { uploadFile, deleteStorageObject } from "@/lib/uploads";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Textarea,
} from "@/lib/ui";
import { broadcastNotification } from "../notifications/actions";

type Kind = "announcement" | "event" | "news";

type NewsDoc = {
  id: string;
  title: string;
  summary?: string;
  body?: string;
  imageUrl?: string;
  imageStoragePath?: string;
  kind?: Kind;
  publishedAt?: Timestamp;
};

const KIND_LABEL: Record<Kind, string> = {
  announcement: "Announcement",
  event: "Event",
  news: "News",
};

const KIND_COLOR: Record<Kind, string> = {
  announcement: "bg-saffron/20 text-primary",
  event: "bg-primary/15 text-primary",
  news: "bg-emerald-100 text-emerald-700",
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<NewsDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<NewsDoc | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "news_events"),
      orderBy("publishedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NewsDoc, "id">) }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  function startCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function startEdit(item: NewsDoc) {
    setEditing(item);
    setShowForm(true);
  }

  function closeForm() {
    setEditing(null);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <Card
        title="Announcements"
        description="Posted to the mobile Home screen as a horizontal rail. Newest first."
        actions={
          <Button onClick={startCreate}>
            <Plus size={16} /> New Announcement
          </Button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No announcements yet"
            description="Click “New Announcement” to publish your first one."
          />
        ) : (
          <ul className="divide-y divide-neutral-200">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onEdit={() => startEdit(item)}
              />
            ))}
          </ul>
        )}
      </Card>

      {showForm && (
        <AnnouncementForm
          initial={editing}
          onClose={closeForm}
          onSaved={closeForm}
        />
      )}
    </div>
  );
}

/* -------------------- Row -------------------- */

function ItemRow({
  item,
  onEdit,
}: {
  item: NewsDoc;
  onEdit: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete announcement “${item.title}”?`)) return;
    setDeleting(true);
    try {
      if (item.imageStoragePath) {
        await deleteStorageObject(item.imageStoragePath);
      }
      await deleteDoc(doc(db, "news_events", item.id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const kind: Kind = item.kind ?? "announcement";

  return (
    <li className="flex items-start gap-4 py-3">
      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-cream">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-saffron">
            <Megaphone size={20} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_COLOR[kind]}`}
          >
            {KIND_LABEL[kind]}
          </span>
          {item.publishedAt && (
            <span className="text-xs text-neutral-500">
              <CalendarDays size={12} className="mr-1 inline" />
              {item.publishedAt.toDate().toLocaleString()}
            </span>
          )}
        </div>
        <h3 className="mt-1 truncate text-sm font-semibold text-neutral-900">
          {item.title}
        </h3>
        {item.summary && (
          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">
            {item.summary}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
        </Button>
      </div>
    </li>
  );
}

/* -------------------- Form -------------------- */

type FormState = {
  title: string;
  summary: string;
  body: string;
  kind: Kind;
  imageUrl: string;
  imageStoragePath: string;
};

function AnnouncementForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: NewsDoc | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    title: initial?.title ?? "",
    summary: initial?.summary ?? "",
    body: initial?.body ?? "",
    kind: initial?.kind ?? "announcement",
    imageUrl: initial?.imageUrl ?? "",
    imageStoragePath: initial?.imageStoragePath ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!initial;
  const title = useMemo(
    () => (isEdit ? "Edit announcement" : "New announcement"),
    [isEdit]
  );

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow re-selecting the same file later
    setUploading(true);
    setUploadPct(0);
    setError(null);
    try {
      // Replace previous image if any.
      if (form.imageStoragePath) {
        await deleteStorageObject(form.imageStoragePath);
      }
      const { promise } = uploadFile({
        folder: "news_events",
        file,
        onProgress: (p) => setUploadPct(p.percent),
      });
      const result = await promise;
      setForm((f) => ({
        ...f,
        imageUrl: result.url,
        imageStoragePath: result.storagePath,
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    if (!form.imageStoragePath) {
      setForm((f) => ({ ...f, imageUrl: "", imageStoragePath: "" }));
      return;
    }
    try {
      await deleteStorageObject(form.imageStoragePath);
    } catch {
      /* ignore */
    }
    setForm((f) => ({ ...f, imageUrl: "", imageStoragePath: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        body: form.body.trim() || null,
        kind: form.kind,
        imageUrl: form.imageUrl || null,
        imageStoragePath: form.imageStoragePath || null,
        updatedAt: serverTimestamp(),
      };
      if (isEdit && initial) {
        await setDoc(doc(db, "news_events", initial.id), payload, {
          merge: true,
        });
      } else {
        const ref = await addDoc(collection(db, "news_events"), {
          ...payload,
          publishedAt: serverTimestamp(),
        });
        // Fire-and-forget push broadcast on first publish only — kind drives
        // the notification copy and the deep link the mobile app uses on tap.
        const kindLabel =
          form.kind === "event"
            ? "📅 New Event"
            : form.kind === "news"
              ? "📰 New News"
              : "📣 New Announcement";
        broadcastNotification({
          title: `${kindLabel}: ${payload.title}`,
          body:
            payload.summary ||
            (payload.body
              ? payload.body.slice(0, 140)
              : "Tap to open in the app."),
          data: {
            type: "news",
            kind: form.kind,
            id: ref.id,
            url: `gmmapp://news/${ref.id}`,
          },
        }).catch((err) => {
          console.warn("Push broadcast failed:", err);
        });
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description="Shown on the mobile Home screen's announcements rail."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="announcement-form"
            disabled={saving || uploading}
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {isEdit ? "Save changes" : "Publish"}
          </Button>
        </>
      }
    >
      <form
        id="announcement-form"
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {error && <Banner kind="error">{error}</Banner>}

        <Field label="Title" required>
          <Input
            autoFocus
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Annual Paryushan Mahotsav"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Kind"
            hint="Drives the chip color on the rail card."
          >
            <select
              value={form.kind}
              onChange={(e) =>
                setForm({ ...form, kind: e.target.value as Kind })
              }
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="announcement">Announcement</option>
              <option value="event">Event</option>
              <option value="news">News</option>
            </select>
          </Field>

          <Field label="Cover Image" hint="Optional. Shown at top of card.">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-cream">
                <Upload size={14} />
                {uploading
                  ? `Uploading… ${uploadPct.toFixed(0)}%`
                  : form.imageUrl
                  ? "Replace"
                  : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                  disabled={uploading || saving}
                />
              </label>
              {form.imageUrl && (
                <Button
                  variant="ghost"
                  onClick={removeImage}
                  disabled={uploading || saving}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
            {form.imageUrl ? (
              <div className="mt-2 h-28 w-44 overflow-hidden rounded-lg border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="mt-2 flex h-28 w-44 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-cream text-neutral-400">
                <ImageIcon size={20} />
              </div>
            )}
          </Field>
        </div>

        <Field
          label="Summary"
          hint="One-line teaser shown on the rail card. ~2 lines max."
        >
          <Textarea
            rows={2}
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="Join us for 8 days of pravachan, prayer, and seva."
          />
        </Field>

        <Field
          label="Body"
          hint="Full content shown when the user taps the card."
        >
          <Textarea
            rows={6}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Full announcement text…"
          />
        </Field>
      </form>
    </Modal>
  );
}
