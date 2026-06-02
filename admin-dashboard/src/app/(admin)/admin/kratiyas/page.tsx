"use client";

// Guru Maa ki Kratiya — admin uploads PDFs (with a cover image + title).
// Stored in Firestore at `kratiyas/{autoId}` and Firebase Storage under
// `kratiyas/`. The mobile Home tab shows a "Guru Maa ki Kratiya" card that
// opens a searchable list; tapping a row opens the PDF full-screen with a
// download action.

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
  FileText,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { deleteStorageObject, formatBytes, uploadFile } from "@/lib/uploads";
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

type KratiyaDoc = {
  id: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  coverStoragePath?: string | null;
  pdfUrl: string;
  pdfStoragePath?: string | null;
  pdfFileName?: string;
  pdfSize?: number;
  order?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export default function KratiyasPage() {
  const [items, setItems] = useState<KratiyaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<KratiyaDoc | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "kratiyas"), orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map(
            (d) =>
              ({ id: d.id, ...(d.data() as Omit<KratiyaDoc, "id">) }) as KratiyaDoc,
          ),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  function startCreate() {
    setEditing(null);
    setShowForm(true);
  }
  function startEdit(item: KratiyaDoc) {
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
        title="कृतियाँ"
        description="Upload PDF kratiyas. They appear on the mobile Home tab and on a dedicated reading screen with search + download."
        actions={
          <Button onClick={startCreate}>
            <Plus size={16} /> New Kratiya
          </Button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No kratiyas yet"
            description="Click “New Kratiya” to upload your first PDF."
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
        <KratiyaForm
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
  item: KratiyaDoc;
  onEdit: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete kratiya “${item.title}”?`)) return;
    setDeleting(true);
    try {
      if (item.pdfStoragePath) await deleteStorageObject(item.pdfStoragePath);
      if (item.coverStoragePath)
        await deleteStorageObject(item.coverStoragePath);
      await deleteDoc(doc(db, "kratiyas", item.id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="flex items-start gap-4 py-3">
      <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-cream">
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-saffron">
            <FileText size={22} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-neutral-900">
          {item.title}
        </h3>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">
            {item.description}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
          {item.pdfFileName && <span>📄 {item.pdfFileName}</span>}
          {item.pdfSize ? <span>· {formatBytes(item.pdfSize)}</span> : null}
          {typeof item.order === "number" && (
            <span>· order: {item.order}</span>
          )}
        </div>
        {item.pdfUrl && (
          <a
            href={item.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs font-semibold text-primary underline"
          >
            Open PDF
          </a>
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
  description: string;
  order: string;
  coverUrl: string;
  coverStoragePath: string;
  pdfUrl: string;
  pdfStoragePath: string;
  pdfFileName: string;
  pdfSize: number;
};

function KratiyaForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: KratiyaDoc | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState<FormState>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    order: String(initial?.order ?? 0),
    coverUrl: initial?.coverUrl ?? "",
    coverStoragePath: initial?.coverStoragePath ?? "",
    pdfUrl: initial?.pdfUrl ?? "",
    pdfStoragePath: initial?.pdfStoragePath ?? "",
    pdfFileName: initial?.pdfFileName ?? "",
    pdfSize: initial?.pdfSize ?? 0,
  });
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverPct, setCoverPct] = useState(0);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfPct, setPdfPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading = useMemo(
    () => (isEdit ? "Edit kratiya" : "New kratiya"),
    [isEdit],
  );

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingCover(true);
    setCoverPct(0);
    setError(null);
    try {
      if (form.coverStoragePath) {
        await deleteStorageObject(form.coverStoragePath);
      }
      const { promise } = uploadFile({
        folder: "kratiyas/covers",
        file,
        onProgress: (p) => setCoverPct(p.percent),
      });
      const r = await promise;
      setForm((f) => ({
        ...f,
        coverUrl: r.url,
        coverStoragePath: r.storagePath,
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingCover(false);
    }
  }

  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.type !== "application/pdf") {
      setError("Please select a PDF file.");
      return;
    }
    setUploadingPdf(true);
    setPdfPct(0);
    setError(null);
    try {
      if (form.pdfStoragePath) {
        await deleteStorageObject(form.pdfStoragePath);
      }
      const { promise } = uploadFile({
        folder: "kratiyas/pdfs",
        file,
        onProgress: (p) => setPdfPct(p.percent),
      });
      const r = await promise;
      setForm((f) => ({
        ...f,
        pdfUrl: r.url,
        pdfStoragePath: r.storagePath,
        pdfFileName: r.name,
        pdfSize: r.size,
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingPdf(false);
    }
  }

  async function removeCover() {
    if (form.coverStoragePath) {
      try {
        await deleteStorageObject(form.coverStoragePath);
      } catch {
        /* ignore */
      }
    }
    setForm((f) => ({ ...f, coverUrl: "", coverStoragePath: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!form.pdfUrl) {
      setError("Please upload a PDF.");
      return;
    }
    setSaving(true);
    try {
      const order = parseInt(form.order, 10);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        coverUrl: form.coverUrl || null,
        coverStoragePath: form.coverStoragePath || null,
        pdfUrl: form.pdfUrl,
        pdfStoragePath: form.pdfStoragePath || null,
        pdfFileName: form.pdfFileName || null,
        pdfSize: form.pdfSize || 0,
        order: Number.isFinite(order) ? order : 0,
        updatedAt: serverTimestamp(),
      };
      if (isEdit && initial) {
        await setDoc(doc(db, "kratiyas", initial.id), payload, { merge: true });
      } else {
        await addDoc(collection(db, "kratiyas"), {
          ...payload,
          createdAt: serverTimestamp(),
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
      title={heading}
      description="Upload the PDF and a cover image. The mobile app shows the cover + title on a dedicated list."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isEdit ? "Save changes" : "Publish"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Banner kind="error">{error}</Banner>}

        <Field label="Title" required>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="गुरु माँ की कृतिया — Chapter 1"
            required
          />
        </Field>

        <Field label="Description" hint="Optional — shown under the title.">
          <Textarea
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            placeholder="Author, series, or any short summary…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Cover image */}
          <Field label="Cover image" hint="Recommended portrait (3:4).">
            {form.coverUrl ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.coverUrl}
                  alt=""
                  className="h-48 w-36 rounded-lg border border-neutral-200 object-cover"
                />
                <div className="flex gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-saffron/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-saffron/25">
                    <Upload size={14} /> Replace
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCoverChange}
                      disabled={uploadingCover}
                    />
                  </label>
                  <Button variant="danger" onClick={removeCover}>
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex h-48 w-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-cream text-neutral-500 hover:border-primary hover:text-primary">
                <ImageIcon size={22} />
                <span className="text-xs font-semibold">Upload cover</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverChange}
                  disabled={uploadingCover}
                />
              </label>
            )}
            {uploadingCover && (
              <div className="mt-2 text-xs text-neutral-500">
                Uploading… {coverPct.toFixed(0)}%
              </div>
            )}
          </Field>

          {/* PDF file */}
          <Field label="PDF file" required hint="Up to 50 MB.">
            {form.pdfUrl ? (
              <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText size={18} className="text-primary" />
                  <span className="truncate font-medium">
                    {form.pdfFileName || "PDF"}
                  </span>
                </div>
                <div className="text-xs text-neutral-500">
                  {form.pdfSize ? formatBytes(form.pdfSize) : ""}
                </div>
                <div className="flex gap-2">
                  <a
                    href={form.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary underline"
                  >
                    Preview
                  </a>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-saffron/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-saffron/25">
                    <Upload size={12} /> Replace PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handlePdfChange}
                      disabled={uploadingPdf}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-cream text-neutral-500 hover:border-primary hover:text-primary">
                <Upload size={22} />
                <span className="text-xs font-semibold">Upload PDF</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handlePdfChange}
                  disabled={uploadingPdf}
                />
              </label>
            )}
            {uploadingPdf && (
              <div className="mt-2 text-xs text-neutral-500">
                Uploading… {pdfPct.toFixed(0)}%
              </div>
            )}
          </Field>
        </div>

        <Field
          label="Display order"
          hint="Lower numbers appear first. Defaults to 0."
        >
          <Input
            type="number"
            value={form.order}
            onChange={(e) => setForm({ ...form, order: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}
