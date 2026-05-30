"use client";

// Daily नियम — admin manages one document per calendar day at
// `daily_niyam/{YYYY-MM-DD}`. The mobile Home tab shows this card and lets
// devotees opt-in; their acceptances live in the `accepts` subcollection
// and are surfaced here for the admin to see who has opted in.

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import {
  CalendarDays,
  Download,
  ImageIcon,
  Loader2,
  NotebookPen,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { deleteStorageObject, uploadFile } from "@/lib/uploads";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Textarea,
} from "@/lib/ui";
import { broadcastNotification } from "../notifications/actions";

type NiyamDoc = {
  id: string;
  date: string;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type AcceptDoc = {
  id: string;
  mobile: string;
  name: string;
  uid?: string;
  acceptedAt?: Timestamp;
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function tsFmt(t?: Timestamp): string {
  if (!t) return "—";
  try {
    return t.toDate().toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function DailyNiyamPage() {
  const [date, setDate] = useState<string>(todayISO());
  const [niyam, setNiyam] = useState<NiyamDoc | null>(null);
  const [niyamLoading, setNiyamLoading] = useState(true);

  // Form state (kept separate so the admin can edit without writing).
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageStoragePath, setImageStoragePath] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [banner, setBanner] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  // Acceptances
  const [accepts, setAccepts] = useState<AcceptDoc[]>([]);
  const [acceptsLoading, setAcceptsLoading] = useState(true);
  const [acceptSearch, setAcceptSearch] = useState("");

  // Subscribe to the selected day's niyam doc.
  useEffect(() => {
    setNiyamLoading(true);
    const ref = doc(db, "daily_niyam", date);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<NiyamDoc, "id">;
          const d: NiyamDoc = { id: snap.id, ...data };
          setNiyam(d);
          setTitle(d.title ?? "");
          setBody(d.body ?? "");
          setImageUrl(d.imageUrl ?? "");
          setImageStoragePath(d.imageStoragePath ?? "");
        } else {
          setNiyam(null);
          setTitle("");
          setBody("");
          setImageUrl("");
          setImageStoragePath("");
        }
        setNiyamLoading(false);
      },
      (e) => {
        setBanner({ kind: "error", text: e.message });
        setNiyamLoading(false);
      },
    );
    return unsub;
  }, [date]);

  // Subscribe to acceptances for the selected day.
  useEffect(() => {
    setAcceptsLoading(true);
    const q = query(
      collection(db, "daily_niyam", date, "accepts"),
      orderBy("acceptedAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAccepts(
          snap.docs.map(
            (d) =>
              ({ id: d.id, ...(d.data() as Omit<AcceptDoc, "id">) }) as AcceptDoc,
          ),
        );
        setAcceptsLoading(false);
      },
      () => setAcceptsLoading(false),
    );
    return unsub;
  }, [date]);

  const filteredAccepts = useMemo(() => {
    const q = acceptSearch.trim().toLowerCase();
    if (!q) return accepts;
    return accepts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) || a.mobile.toLowerCase().includes(q),
    );
  }, [accepts, acceptSearch]);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadPct(0);
    setBanner(null);
    try {
      if (imageStoragePath) {
        await deleteStorageObject(imageStoragePath);
      }
      const { promise } = uploadFile({
        folder: "daily_niyam",
        file,
        onProgress: (p) => setUploadPct(p.percent),
      });
      const result = await promise;
      setImageUrl(result.url);
      setImageStoragePath(result.storagePath);
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    if (imageStoragePath) {
      try {
        await deleteStorageObject(imageStoragePath);
      } catch {
        /* ignore */
      }
    }
    setImageUrl("");
    setImageStoragePath("");
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    if (!title.trim()) {
      setBanner({ kind: "error", text: "Title is required." });
      return;
    }
    setSaving(true);
    try {
      const ref = doc(db, "daily_niyam", date);
      const exists = (await getDoc(ref)).exists();
      const payload: Record<string, unknown> = {
        date,
        title: title.trim(),
        body: body.trim() || null,
        imageUrl: imageUrl || null,
        imageStoragePath: imageStoragePath || null,
        updatedAt: serverTimestamp(),
      };
      if (!exists) payload.createdAt = serverTimestamp();
      await setDoc(ref, payload, { merge: true });
      setBanner({
        kind: "success",
        text: exists
          ? "नियम updated for " + prettyDate(date)
          : "नियम published for " + prettyDate(date),
      });
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function handleBroadcast() {
    if (!title.trim()) {
      setBanner({
        kind: "error",
        text: "Save a title first so the notification has something to say.",
      });
      return;
    }
    setBroadcasting(true);
    setBanner(null);
    try {
      const res = await broadcastNotification({
        title: `📿 आज का नियम — ${title.trim()}`,
        body: body.trim()
          ? body.trim().slice(0, 140)
          : "Tap to accept today's niyam.",
        data: {
          type: "niyam",
          date,
          url: `gmmapp://niyam/${date}`,
        },
      });
      setBanner({
        kind: "success",
        text: `Notification sent — ${res.successCount} delivered, ${res.failureCount} failed.`,
      });
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setBroadcasting(false);
    }
  }

  /**
   * Delete the entire niyam document for the selected date, including the
   * cover image in Storage and every acceptance in the `accepts`
   * subcollection. Acceptances are batched 400 at a time (Firestore's
   * per-batch limit is 500 ops; we leave headroom).
   */
  async function handleDeleteNiyam() {
    if (!niyam) return;
    const totalAccepts = accepts.length;
    const confirmMsg =
      `Delete the niyam for ${prettyDate(date)}?\n\n` +
      `This will also remove ${totalAccepts} acceptance${totalAccepts === 1 ? "" : "s"} and the cover image.\n\n` +
      `This cannot be undone.`;
    if (!confirm(confirmMsg)) return;
    setDeleting(true);
    setBanner(null);
    try {
      // 1. Remove the cover image from Storage (if any).
      if (niyam.imageStoragePath) {
        try {
          await deleteStorageObject(niyam.imageStoragePath);
        } catch {
          /* non-fatal */
        }
      }

      // 2. Delete every acceptance doc in batches of 400.
      const acceptsCol = collection(db, "daily_niyam", date, "accepts");
      const snap = await getDocs(acceptsCol);
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // 3. Delete the niyam doc itself.
      await deleteDoc(doc(db, "daily_niyam", date));

      // 4. Reset local form state (the snapshot listener will already
      //    pick up the disappearance, but resetting here avoids a flash).
      setTitle("");
      setBody("");
      setImageUrl("");
      setImageStoragePath("");
      setNiyam(null);

      setBanner({
        kind: "success",
        text:
          totalAccepts > 0
            ? `Deleted niyam and ${totalAccepts} acceptance${totalAccepts === 1 ? "" : "s"} for ${prettyDate(date)}.`
            : `Deleted niyam for ${prettyDate(date)}.`,
      });
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setDeleting(false);
    }
  }

  /** Remove a single devotee's acceptance for the selected day. */
  // (Removed by request — admins only need bulk "Delete niyam" which also
  // wipes acceptances. Per-row and "Clear all" actions were removed to
  // simplify the UI.)

  function exportAcceptsCsv() {
    const rows = filteredAccepts.map((a) => ({
      Mobile: a.mobile,
      Name: a.name,
      AcceptedAt: a.acceptedAt
        ? a.acceptedAt.toDate().toISOString()
        : "",
    }));
    const headers = ["Mobile", "Name", "AcceptedAt"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [
      headers.map(escape).join(","),
      ...rows.map((r) =>
        [r.Mobile, r.Name, r.AcceptedAt].map((c) => escape(String(c))).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-niyam-${date}-accepts.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const isPublished = !!niyam;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary sm:text-2xl">
          <NotebookPen size={24} /> Daily नियम
        </h1>
        <p className="text-sm text-neutral-600">
          Publish one नियम per day with an optional image. Devotees see it on
          the Home tab and tap “नियम स्वीकार करें” to opt in.
        </p>
      </header>

      {banner && (
        <Banner kind={banner.kind}>{banner.text}</Banner>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label="Selected day"
          value={prettyDate(date)}
          tone="primary"
        />
        <SummaryTile
          label="Status"
          value={
            niyamLoading
              ? "Loading…"
              : isPublished
                ? "Published"
                : "Not yet published"
          }
          tone={isPublished ? "green" : "saffron"}
        />
        <SummaryTile
          label="Acceptances"
          value={acceptsLoading ? "…" : String(accepts.length)}
          tone="primary"
        />
      </div>

      <Card
        title={`Edit नियम for ${prettyDate(date)}`}
        description="The same document is overwritten on save (one per calendar day)."
        actions={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
              <CalendarDays size={14} />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDate(todayISO())}
            >
              Today
            </Button>
          </div>
        }
      >
        <form className="space-y-5" onSubmit={handleSave}>
          <Field label="Title" required hint="Shown as the card heading.">
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="आज का नियम — सत्य बोलना"
            />
          </Field>

          <Field
            label="Body"
            hint="Detailed instruction. Plain text, supports line breaks."
          >
            <Textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="आज हम सभी सत्य बोलने का संकल्प लेते हैं…"
            />
          </Field>

          <Field
            label="Cover Image"
            hint="Optional. Shown at the top of the card on the Home tab."
          >
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-cream">
                <Upload size={14} />
                {uploading
                  ? `Uploading… ${uploadPct.toFixed(0)}%`
                  : imageUrl
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
              {imageUrl && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={removeImage}
                  disabled={uploading || saving}
                >
                  <Trash2 size={14} /> Remove
                </Button>
              )}
            </div>
            {imageUrl ? (
              <div className="mt-2 h-40 w-full max-w-md overflow-hidden rounded-lg border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="mt-2 flex h-40 w-full max-w-md items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-cream text-neutral-400">
                <ImageIcon size={24} />
              </div>
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={saving || uploading}>
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {isPublished ? "Save changes" : "Publish niyam"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleBroadcast}
              disabled={broadcasting || saving || !title.trim()}
            >
              {broadcasting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Send notification
            </Button>
            {isPublished && (
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteNiyam}
                disabled={deleting || saving}
              >
                {deleting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Delete niyam
              </Button>
            )}
            {niyam?.updatedAt && (
              <span className="text-xs text-neutral-500">
                Last updated {tsFmt(niyam.updatedAt)}
              </span>
            )}
          </div>
        </form>
      </Card>

      <Card
        title={`Accepted by ${accepts.length} devotee${accepts.length === 1 ? "" : "s"}`}
        description="People who tapped “नियम स्वीकार करें” in the app for this day."
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={acceptSearch}
              onChange={(e) => setAcceptSearch(e.target.value)}
              placeholder="Search name / mobile…"
              className="w-56"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={exportAcceptsCsv}
              disabled={filteredAccepts.length === 0}
            >
              <Download size={14} /> CSV
            </Button>
          </div>
        }
      >
        {acceptsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : filteredAccepts.length === 0 ? (
          <EmptyState
            title={
              accepts.length === 0
                ? "No acceptances yet."
                : "No matches for your search."
            }
            description={
              accepts.length === 0
                ? "Once devotees tap “नियम स्वीकार करें” in the app, they appear here in real time."
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-100">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-wider text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Mobile</th>
                  <th className="px-3 py-2">Accepted at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredAccepts.map((a) => (
                  <tr key={a.id} className="hover:bg-cream/50">
                    <td className="px-3 py-2 font-medium text-neutral-900">
                      {a.name}
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={`tel:${a.mobile}`}
                        className="text-primary hover:underline"
                      >
                        {a.mobile}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {tsFmt(a.acceptedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "saffron" | "green";
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/30 bg-primary/5 text-primary"
      : tone === "saffron"
        ? "border-saffron/40 bg-saffron/10 text-primary"
        : "border-green-200 bg-green-50 text-green-700";
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
