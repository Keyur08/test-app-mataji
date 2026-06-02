"use client";

// filepath: /Users/a200200348/Documents/AajaPadteHai/GeyMatiMataJiApp/admin-dashboard/src/app/(admin)/admin/daily/page.tsx
// Daily Updates — CRUD for `panchang_updates/{YYYY-MM-DD}` and
// `daily_quotes/{YYYY-MM-DD}` collections. One document per calendar day,
// keyed by ISO date. Upserts via setDoc({merge:true}).

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
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
  Quote as QuoteIcon,
  Save,
  Sun,
  Trash2,
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
  uploadFile,
  type UploadProgress,
} from "@/lib/uploads";
import { broadcastNotification } from "../notifications/actions";


type PanchangDoc = {
  date: string;
  panchangDate: string;
  gregorianDate?: string;
  notes?: string;
  updatedAt?: Timestamp;
};

type QuoteDoc = {
  date: string;
  quote: string;
  translation?: string;
  author?: string;
  imageUrl?: string;
  imageStoragePath?: string;
  updatedAt?: Timestamp;
};

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatRelative(ts?: Timestamp): string {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return "";
  }
}

export default function DailyUpdatesPage() {
  const [date, setDate] = useState(todayISO());

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary sm:text-2xl">
          <CalendarDays size={24} /> Daily Updates
        </h1>
        <p className="text-sm text-neutral-600">
          Publish the day&apos;s Gyeyvani quote. One document per day,
          identified by date. (Panchang is now calculated offline on
          the mobile app — no admin entry required.)
        </p>
      </header>

      <Card title="Select date" description="All edits below apply to this day.">
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="secondary" onClick={() => setDate(todayISO())}>
            Today
          </Button>
        </div>
      </Card>

      <QuoteEditor date={date} />

      <DailyPopupEditor />

      <RecentQuotesList onSelect={setDate} activeDate={date} />
    </div>
  );
}

/* -------------------- Panchang -------------------- */

function PanchangEditor({ date }: { date: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<PanchangDoc>({
    date,
    panchangDate: "",
    gregorianDate: "",
    notes: "",
  });

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    getDoc(doc(db, "panchang_updates", date))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as PanchangDoc;
          setForm({ ...data, date });
        } else {
          setForm({
            date,
            panchangDate: "",
            gregorianDate: "",
            notes: "",
          });
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [date]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await setDoc(
        doc(db, "panchang_updates", date),
        { ...form, date, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setSuccess("Panchang update saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete panchang update for ${date}?`)) return;
    setError(null);
    setSuccess(null);
    try {
      await deleteDoc(doc(db, "panchang_updates", date));
      setForm({
        date,
        panchangDate: "",
        gregorianDate: "",
        notes: "",
      });
      setSuccess("Deleted.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card
      title="Panchang Update"
      description={`Document: panchang_updates/${date}`}
      actions={
        <span className="flex items-center gap-1 rounded-full bg-saffron/15 px-3 py-1 text-xs font-medium text-primary">
          <Sun size={14} /> Banner
        </span>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <Field
            label="Panchang Date"
            hint="e.g. Vaishakh Shukla 7, Vir Samvat 2552"
            required
          >
            <Input
              required
              value={form.panchangDate}
              onChange={(e) =>
                setForm({ ...form, panchangDate: e.target.value })
              }
            />
          </Field>
          <Field label="Gregorian Date Label">
            <Input
              value={form.gregorianDate ?? ""}
              onChange={(e) =>
                setForm({ ...form, gregorianDate: e.target.value })
              }
              placeholder="May 21, 2026"
            />
          </Field>
          <Field label="Internal Notes (optional)">
            <Textarea
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          {error && <Banner kind="error">{error}</Banner>}
          {success && <Banner kind="success">{success}</Banner>}

          <div className="flex justify-between">
            <Button variant="danger" onClick={handleDelete} disabled={saving}>
              <Trash2 size={16} /> Delete
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/* -------------------- Quote -------------------- */

function QuoteEditor({ date }: { date: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteDoc>({
    date,
    quote: "",
    translation: "",
    author: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setImageFile(null);
    setProgress(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    getDoc(doc(db, "daily_quotes", date))
      .then((snap) => {
        if (snap.exists()) {
          setForm({ ...(snap.data() as QuoteDoc), date });
        } else {
          setForm({ date, quote: "", translation: "", author: "" });
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [date]);

  function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setImageFile(f);
  }

  async function handleRemoveImage() {
    if (!form.imageStoragePath && !form.imageUrl) {
      // Local preview only — just clear the file picker.
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    if (!confirm("Remove the saved image for this day's quote?")) return;
    try {
      const oldPath = form.imageStoragePath;
      await setDoc(
        doc(db, "daily_quotes", date),
        {
          imageUrl: null,
          imageStoragePath: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (oldPath) deleteStorageObject(oldPath).catch(() => {});
      setForm((f) => ({
        ...f,
        imageUrl: undefined,
        imageStoragePath: undefined,
      }));
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setSuccess("Image removed.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let imageUrl = form.imageUrl;
      let imageStoragePath = form.imageStoragePath;

      if (imageFile) {
        const oldPath = imageStoragePath;
        const { promise } = uploadFile({
          folder: "daily_quotes",
          file: imageFile,
          onProgress: setProgress,
        });
        const uploaded = await promise;
        imageUrl = uploaded.url;
        imageStoragePath = uploaded.storagePath;
        if (oldPath && oldPath !== imageStoragePath) {
          deleteStorageObject(oldPath).catch(() => {});
        }
      }

      const payload = {
        ...form,
        date,
        imageUrl: imageUrl ?? null,
        imageStoragePath: imageStoragePath ?? null,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "daily_quotes", date), payload, { merge: true });
      setForm((f) => ({ ...f, imageUrl, imageStoragePath }));
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setSuccess("Quote saved.");

      // Fire-and-forget broadcast — taps open the Home tab (Gyeyvani card).
      const todayId = new Date().toISOString().slice(0, 10);
      if (date === todayId) {
        const quoteText = (payload.quote || "").trim();
        const author = (payload.author || "").trim();
        broadcastNotification({
          title: "✦ आज का विचार ✦",
          body:
            quoteText.length > 160
              ? quoteText.slice(0, 157) + "…"
              : quoteText + (author ? `\n— ${author}` : ""),
          data: {
            type: "quote",
            date,
            url: "gmmapp://",
          },
        }).catch((err) => console.warn("Push broadcast failed:", err));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete daily quote for ${date}?`)) return;
    try {
      const oldPath = form.imageStoragePath;
      await deleteDoc(doc(db, "daily_quotes", date));
      if (oldPath) deleteStorageObject(oldPath).catch(() => {});
      setForm({ date, quote: "", translation: "", author: "" });
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setSuccess("Deleted.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card
      title="Daily Quote (Gyeyvani)"
      description={`Document: daily_quotes/${date}`}
      actions={
        <span className="flex items-center gap-1 rounded-full bg-saffron/15 px-3 py-1 text-xs font-medium text-primary">
          <QuoteIcon size={14} /> Thought
        </span>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Quote (Devanagari / source)" required>
            <Textarea
              required
              rows={4}
              value={form.quote}
              onChange={(e) => setForm({ ...form, quote: e.target.value })}
              placeholder="जिनवाणी ही श्रेष्ठ है..."
            />
          </Field>
          <Field label="Translation (optional)">
            <Textarea
              rows={3}
              value={form.translation ?? ""}
              onChange={(e) =>
                setForm({ ...form, translation: e.target.value })
              }
            />
          </Field>
          <Field label="Attribution">
            <Input
              value={form.author ?? ""}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              placeholder="— Acharya Shree"
            />
          </Field>

          <Field
            label="Illustration (optional)"
            hint="Shown above the quote in the mobile app. Square / 4:3 images look best."
          >
            <div className="flex items-start gap-4">
              {(imageFile || form.imageUrl) && (
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      imageFile
                        ? URL.createObjectURL(imageFile)
                        : form.imageUrl!
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickImage}
                  className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-saffron/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-saffron/30"
                />
                {progress && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Uploading… {Math.round(progress.percent)}%
                  </p>
                )}
                {(imageFile || form.imageUrl) && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                  >
                    <X size={12} /> Remove image
                  </button>
                )}
              </div>
            </div>
          </Field>

          {error && <Banner kind="error">{error}</Banner>}
          {success && <Banner kind="success">{success}</Banner>}

          <div className="flex justify-between">
            <Button variant="danger" onClick={handleDelete} disabled={saving}>
              <Trash2 size={16} /> Delete
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/* -------------------- Recent lists -------------------- */

function useRecent<T extends { date?: string; updatedAt?: Timestamp }>(
  collectionName: string
) {
  const [items, setItems] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, collectionName),
      orderBy("updatedAt", "desc"),
      limit(10)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [collectionName]);

  return { items, loading };
}

function RecentPanchangList({
  onSelect,
  activeDate,
}: {
  onSelect: (date: string) => void;
  activeDate: string;
}) {
  const { items, loading } = useRecent<PanchangDoc>("panchang_updates");

  return (
    <Card title="Recent Panchang Updates" description="Last 10 entries">
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No panchang updates yet." />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onSelect(it.id)}
                className={`flex w-full flex-col gap-0.5 px-2 py-3 text-left transition hover:bg-cream ${
                  activeDate === it.id ? "bg-saffron/10" : ""
                }`}
              >
                <span className="text-sm font-medium text-primary">
                  {it.id}
                </span>
                <span className="line-clamp-1 text-sm text-neutral-700">
                  {it.panchangDate}
                </span>
                <span className="line-clamp-1 text-xs text-neutral-500">
                  {formatRelative(it.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentQuotesList({
  onSelect,
  activeDate,
}: {
  onSelect: (date: string) => void;
  activeDate: string;
}) {
  const { items, loading } = useRecent<QuoteDoc>("daily_quotes");
  const sorted = useMemo(() => items, [items]);

  return (
    <Card title="Recent Daily Quotes" description="Last 10 entries">
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState title="No quotes yet." />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {sorted.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onSelect(it.id)}
                className={`flex w-full flex-col gap-0.5 px-2 py-3 text-left transition hover:bg-cream ${
                  activeDate === it.id ? "bg-saffron/10" : ""
                }`}
              >
                <span className="text-sm font-medium text-primary">
                  {it.id}
                </span>
                <span className="line-clamp-2 text-sm text-neutral-700">
                  &ldquo;{it.quote}&rdquo;
                </span>
                {it.author && (
                  <span className="text-xs text-neutral-500">{it.author}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* -------------------- Daily Startup Popup -------------------- */

type PopupDoc = {
  imageUrl?: string;
  imageStoragePath?: string;
  active?: boolean;
  linkUrl?: string;
  updatedAt?: Timestamp;
};

function DailyPopupEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<PopupDoc>({ active: true });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    getDoc(doc(db, "app_config", "daily_popup"))
      .then((snap) => {
        if (snap.exists()) {
          setForm({ active: true, ...(snap.data() as PopupDoc) });
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setImageFile(f);
    setSuccess(null);
  }

  async function handleRemoveImage() {
    if (!confirm("Remove the saved popup image?")) return;
    setError(null);
    try {
      const oldPath = form.imageStoragePath;
      await setDoc(
        doc(db, "app_config", "daily_popup"),
        {
          imageUrl: null,
          imageStoragePath: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (oldPath) deleteStorageObject(oldPath).catch(() => {});
      setForm((f) => ({
        ...f,
        imageUrl: undefined,
        imageStoragePath: undefined,
      }));
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setSuccess("Popup image removed.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let imageUrl = form.imageUrl;
      let imageStoragePath = form.imageStoragePath;

      if (imageFile) {
        const oldPath = imageStoragePath;
        const { promise } = uploadFile({
          folder: "app_config/daily_popup",
          file: imageFile,
          onProgress: setProgress,
        });
        const res = await promise;
        imageUrl = res.url;
        imageStoragePath = res.storagePath;
        if (oldPath && oldPath !== imageStoragePath) {
          deleteStorageObject(oldPath).catch(() => {});
        }
      }

      const payload = {
        active: !!form.active,
        imageUrl: imageUrl ?? null,
        imageStoragePath: imageStoragePath ?? null,
        linkUrl: form.linkUrl?.trim() || null,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "app_config", "daily_popup"), payload, {
        merge: true,
      });
      setForm((f) => ({
        ...f,
        imageUrl: payload.imageUrl ?? undefined,
        imageStoragePath: payload.imageStoragePath ?? undefined,
        linkUrl: payload.linkUrl ?? undefined,
      }));
      setImageFile(null);
      setProgress(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setSuccess(
        form.active
          ? "Saved. The popup will be shown to all devotees once per day until they dismiss it."
          : "Saved. Popup is disabled — devotees will not see it."
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  return (
    <Card
      title="Daily Startup Popup"
      description="Single image shown as a full-screen modal when devotees open the app. Each device shows it at most once per day — dismissing closes it for the rest of the day."
      actions={
        <span className="flex items-center gap-1 rounded-full bg-saffron/15 px-3 py-1 text-xs font-medium text-primary">
          <ImageIcon size={14} /> Popup
        </span>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <Field
            label="Popup Image"
            hint="Recommended 3:4 or 4:5 portrait. PNG / JPG up to 10 MB."
          >
            <div className="flex items-start gap-4">
              {(imageFile || form.imageUrl) && (
                <div className="h-32 w-24 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      imageFile
                        ? URL.createObjectURL(imageFile)
                        : form.imageUrl!
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickImage}
                  className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-saffron/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-saffron/30"
                />
                {progress && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Uploading… {Math.round(progress.percent)}%
                  </p>
                )}
                {(imageFile || form.imageUrl) && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                  >
                    <X size={12} /> Remove image
                  </button>
                )}
              </div>
            </div>
          </Field>

          <Field
            label="Optional tap link"
            hint="If set, tapping the popup image opens this URL (e.g. announcement page)."
          >
            <Input
              value={form.linkUrl ?? ""}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              placeholder="https://example.com/announcement"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={!!form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary/30"
            />
            Active — show this popup to devotees
          </label>

          {error && <Banner kind="error">{error}</Banner>}
          {success && <Banner kind="success">{success}</Banner>}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
