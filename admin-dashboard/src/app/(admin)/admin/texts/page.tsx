"use client";

// filepath: /Users/a200200348/Documents/AajaPadteHai/GeyMatiMataJiApp/admin-dashboard/src/app/(admin)/admin/texts/page.tsx
// Manage Texts — full CRUD for the `texts_library` collection used by the
// mobile app's Library tab. Provides a master/detail layout with a large
// formatted textarea for pasting long Poojan / Aarti / Chalisa texts.

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
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
  BookOpen,
  Bold,
  Eye,
  EyeOff,
  FileText,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
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
import { uploadFile, type UploadProgress } from "@/lib/uploads";

type TextDoc = {
  id: string;
  title: string;
  category: string;
  subtitle?: string;
  body: string;
  language?: string;
  order?: number;
  updatedAt?: Timestamp;
};

type DraftDoc = Omit<TextDoc, "id" | "updatedAt"> & { id?: string };

const EMPTY_DRAFT: DraftDoc = {
  title: "",
  category: "",
  subtitle: "",
  body: "",
  language: "hi",
  order: 0,
};

export default function ManageTextsPage() {
  const [items, setItems] = useState<TextDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftDoc>(EMPTY_DRAFT);
  const [isNew, setIsNew] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  // For auto-scroll + focus when entering edit/new mode
  const editorRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Inline image upload (inserted as `![image](url)` into the body)
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState<UploadProgress | null>(
    null,
  );

  function focusEditor() {
    // Use rAF to ensure layout is committed (e.g. after state-driven swap)
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Slight delay so the smooth-scroll starts before we steal focus
      setTimeout(() => titleInputRef.current?.focus({ preventScroll: true }), 250);
    });
  }

  /** Wrap the current selection in the body textarea with `left`/`right`.
   *  If nothing is selected, inserts the markers and places the caret between
   *  them. Used by the Bold / Italic / Highlight toolbar buttons. */
  function wrapBodySelection(left: string, right: string = left) {
    const el = bodyTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = draft.body.slice(0, start);
    const selected = draft.body.slice(start, end);
    const after = draft.body.slice(end);
    const next = `${before}${left}${selected}${right}${after}`;
    setDraft({ ...draft, body: next });
    // Restore selection / caret around the newly wrapped text
    requestAnimationFrame(() => {
      el.focus();
      const newStart = start + left.length;
      const newEnd = newStart + selected.length;
      el.setSelectionRange(newStart, newEnd);
    });
  }

  /** Insert arbitrary text at the current caret (replacing any selection). */
  function insertAtCaret(text: string) {
    const el = bodyTextareaRef.current;
    if (!el) {
      setDraft((d) => ({ ...d, body: `${d.body}${text}` }));
      return;
    }
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? draft.body.length;
    const before = draft.body.slice(0, start);
    const after = draft.body.slice(end);
    const next = `${before}${text}${after}`;
    setDraft({ ...draft, body: next });
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + text.length;
      el.setSelectionRange(caret, caret);
    });
  }

  /** Upload a picked image and insert `![image](url)` at the caret. */
  async function onPickInlineImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setImageUploading(true);
    setImageProgress(null);
    try {
      const { promise } = uploadFile({
        folder: "texts_library/images",
        file,
        onProgress: setImageProgress,
      });
      const r = await promise;
      // Surround with blank lines so it renders as its own block.
      insertAtCaret(`\n\n![image](${r.url})\n\n`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImageUploading(false);
      setImageProgress(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  // Live subscription to the collection.
  useEffect(() => {
    const q = query(
      collection(db, "texts_library"),
      orderBy("category"),
      orderBy("order")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<TextDoc, "id">) }) as TextDoc
        );
        setItems(next);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // Sync draft when selection changes.
  useEffect(() => {
    if (selectedId == null) return;
    const found = items.find((i) => i.id === selectedId);
    if (found) {
      setDraft({
        id: found.id,
        title: found.title,
        category: found.category,
        subtitle: found.subtitle ?? "",
        body: found.body,
        language: found.language ?? "hi",
        order: found.order ?? 0,
      });
      setIsNew(false);
      setError(null);
      setSuccess(null);
    }
  }, [selectedId, items]);

  const grouped = useMemo(() => {
    const filtered = items.filter((it) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        it.title.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        (it.subtitle ?? "").toLowerCase().includes(q)
      );
    });
    const byCat: Record<string, TextDoc[]> = {};
    for (const it of filtered) {
      const key = it.category || "Uncategorized";
      (byCat[key] ||= []).push(it);
    }
    return byCat;
  }, [items, search]);

  function handleNew() {
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setIsNew(true);
    setError(null);
    setSuccess(null);
    setPreview(false);
    focusEditor();
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!draft.title.trim() || !draft.category.trim() || !draft.body.trim()) {
      setError("Title, Category, and Body are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: draft.title.trim(),
        category: draft.category.trim(),
        subtitle: draft.subtitle?.trim() || "",
        body: draft.body,
        language: draft.language?.trim() || "hi",
        order: Number(draft.order) || 0,
        updatedAt: serverTimestamp(),
      };

      if (isNew || !draft.id) {
        const ref = await addDoc(collection(db, "texts_library"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setSelectedId(ref.id);
        setIsNew(false);
        setSuccess("Text created.");
      } else {
        await setDoc(doc(db, "texts_library", draft.id), payload, {
          merge: true,
        });
        setSuccess("Text saved.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft.id) return;
    if (!confirm(`Delete "${draft.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "texts_library", draft.id));
      handleNew();
      setSuccess("Deleted.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => it.category && set.add(it.category));
    return Array.from(set).sort();
  }, [items]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary sm:text-2xl">
          <BookOpen size={24} /> Manage Texts
        </h1>
        <p className="text-sm text-neutral-600">
          Create, edit, and organize Poojan, Aarti, Chalisa and other library
          texts. Paste long passages directly into the body — line breaks are
          preserved.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* List */}
        <Card
          title="Library"
          description={`${items.length} text${items.length === 1 ? "" : "s"}`}
          actions={
            <Button onClick={handleNew}>
              <Plus size={16} /> New
            </Button>
          }
        >
          <div className="mb-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or category…"
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <EmptyState
              title="No texts yet."
              description="Click “New” to add your first library text."
            />
          ) : (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {Object.entries(grouped).map(([cat, list]) => (
                <div key={cat}>
                  <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-saffron">
                    {cat}
                  </p>
                  <ul className="space-y-0.5">
                    {list.map((it) => (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(it.id);
                            focusEditor();
                          }}
                          className={`flex w-full flex-col items-start rounded-md px-2 py-2 text-left text-sm transition ${
                            selectedId === it.id
                              ? "bg-primary text-white"
                              : "hover:bg-cream text-neutral-800"
                          }`}
                        >
                          <span className="font-medium">{it.title}</span>
                          {it.subtitle && (
                            <span
                              className={`line-clamp-1 text-xs ${
                                selectedId === it.id
                                  ? "text-white/80"
                                  : "text-neutral-500"
                              }`}
                            >
                              {it.subtitle}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Editor */}
        <div ref={editorRef} className="scroll-mt-20">
          <Card
            title={isNew ? "New Text" : "Edit Text"}
            description={
              isNew
                ? "Fill in the fields below and save."
                : `Document: texts_library/${draft.id}`
            }
            actions={
              <Button
                variant="secondary"
                onClick={() => setPreview((p) => !p)}
                disabled={!draft.body}
              >
                {preview ? <EyeOff size={16} /> : <Eye size={16} />}
                {preview ? "Edit" : "Preview"}
              </Button>
            }
          >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required>
                <Input
                  ref={titleInputRef}
                  required
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="Mahaveer Chalisa"
                />
              </Field>
              <Field
                label="Category"
                required
                hint={
                  categories.length > 0
                    ? `Existing: ${categories.join(", ")}`
                    : undefined
                }
              >
                <Input
                  required
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                  list="text-categories"
                  placeholder="Chalisa / Aarti / Poojan"
                />
                <datalist id="text-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>

            <Field label="Subtitle (optional)">
              <Input
                value={draft.subtitle ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, subtitle: e.target.value })
                }
                placeholder="Short description shown in the list"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Language">
                <Input
                  value={draft.language ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, language: e.target.value })
                  }
                  placeholder="hi / en"
                />
              </Field>
              <Field label="Order" hint="Lower numbers appear first">
                <Input
                  type="number"
                  value={draft.order ?? 0}
                  onChange={(e) =>
                    setDraft({ ...draft, order: Number(e.target.value) })
                  }
                />
              </Field>
            </div>

            <Field
              label="Body"
              required
              hint="Use the toolbar to format selected text. **bold**, *italic*, ==highlight== and ![image](url) are also rendered in the mobile app. Line breaks and blank lines are preserved."
            >
              {preview ? (
                <BodyPreview body={draft.body} />
              ) : (
                <div className="rounded-lg border border-neutral-300 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  {/* Formatting toolbar */}
                  <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50/60 px-2 py-1.5">
                    <button
                      type="button"
                      title="Bold (wraps with **)"
                      onClick={() => wrapBodySelection("**")}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-white hover:text-primary"
                    >
                      <Bold size={14} /> Bold
                    </button>
                    <button
                      type="button"
                      title="Italic (wraps with *)"
                      onClick={() => wrapBodySelection("*")}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-white hover:text-primary"
                    >
                      <Italic size={14} /> Italic
                    </button>
                    <button
                      type="button"
                      title="Highlight (wraps with ==)"
                      onClick={() => wrapBodySelection("==")}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-white hover:text-primary"
                    >
                      <Highlighter size={14} /> Highlight
                    </button>
                    <button
                      type="button"
                      title="Insert image at caret"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={imageUploading}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-white hover:text-primary disabled:opacity-60"
                    >
                      {imageUploading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ImageIcon size={14} />
                      )}
                      {imageUploading
                        ? imageProgress
                          ? `${Math.round(imageProgress.percent)}%`
                          : "Uploading…"
                        : "Image"}
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={onPickInlineImage}
                      className="hidden"
                    />
                    <span className="ml-auto hidden text-[11px] text-neutral-400 sm:inline">
                      Select text, then click a button
                    </span>
                  </div>
                  <textarea
                    ref={bodyTextareaRef}
                    required
                    rows={18}
                    value={draft.body}
                    onChange={(e) =>
                      setDraft({ ...draft, body: e.target.value })
                    }
                    placeholder={"॥ आत्म-जागृति, अनुशासन और करुणा ॥"}
                    className="block w-full resize-y rounded-b-lg border-0 bg-white px-3 py-2 text-base leading-loose text-neutral-900 placeholder:text-neutral-400 outline-none"
                    style={{
                      fontFamily:
                        'ui-serif, "Noto Serif Devanagari", "Hind", Georgia, serif',
                    }}
                  />
                </div>
              )}
              {/* Live inline preview — shown below the textarea whenever the
                  body contains image tokens, so admins can see uploaded
                  images without flipping to Preview mode. */}
              {!preview && /!\[[^\]]*\]\([^)\s]+\)/.test(draft.body) && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-saffron">
                    Inline preview
                  </p>
                  <BodyPreview body={draft.body} />
                </div>
              )}
              <div className="mt-1 flex justify-between text-xs text-neutral-500">
                <span>
                  {draft.body.length.toLocaleString()} chars ·{" "}
                  {draft.body.split(/\n/).length} lines
                </span>
                {draft.body && (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      if (
                        confirm(
                          "Clear the body text? This only clears the form — nothing is saved until you press Save."
                        )
                      ) {
                        setDraft({ ...draft, body: "" });
                      }
                    }}
                  >
                    Clear body
                  </button>
                )}
              </div>
            </Field>

            {error && <Banner kind="error">{error}</Banner>}
            {success && <Banner kind="success">{success}</Banner>}

            <div className="flex justify-between border-t border-neutral-100 pt-4">
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={isNew || saving}
              >
                <Trash2 size={16} /> Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleNew} disabled={saving}>
                  <FileText size={16} /> New
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {isNew ? "Create" : "Save"}
                </Button>
              </div>
            </div>
          </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BodyPreview({ body }: { body: string }) {
  // Split into paragraphs on blank lines, keep single line breaks inside.
  const paragraphs = body.split(/\n{2,}/);
  const imgRe = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;

  // Full-screen image viewer (admin-side). Closes on Escape / backdrop click.
  const [zoomed, setZoomed] = useState<{ url: string; alt: string } | null>(
    null,
  );
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  return (
    <>
      <div
        className="max-h-[60vh] overflow-y-auto rounded-lg border border-saffron/30 bg-cream px-6 py-5 text-base leading-loose text-neutral-900"
        style={{
          fontFamily:
            'ui-serif, "Noto Serif Devanagari", "Hind", Georgia, serif',
        }}
      >
        {paragraphs.map((p, i) => {
          const trimmed = p.trim();
          const m = trimmed.match(imgRe);
          if (m) {
            const [, alt, url] = m;
            return (
              <div key={i} className="mb-4 flex justify-center last:mb-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={alt}
                  onClick={() => setZoomed({ url, alt })}
                  className="max-h-[400px] cursor-zoom-in rounded-lg border border-saffron/30 object-contain transition hover:opacity-90"
                />
              </div>
            );
          }
          return (
            <p key={i} className="mb-4 whitespace-pre-wrap last:mb-0">
              {renderInline(p)}
            </p>
          );
        })}
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6"
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(null);
            }}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomed.url}
            alt={zoomed.alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] cursor-default rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}

/**
 * Parse minimal inline markup the same way the mobile FormattedText does.
 *   **bold**  *italic*  ==highlight==
 */
function renderInline(input: string): ReactNode[] {
  const re = /(\*\*[^*]+\*\*|==[^=]+==|\*[^*\n]+\*)/g;
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(input)) !== null) {
    if (m.index > lastIndex) {
      out.push(input.slice(lastIndex, m.index));
    }
    const chunk = m[0];
    if (chunk.startsWith("**")) {
      out.push(
        <strong key={i++} className="font-bold">
          {chunk.slice(2, -2)}
        </strong>
      );
    } else if (chunk.startsWith("==")) {
      out.push(
        <mark
          key={i++}
          className="rounded bg-amber-200 px-1 font-semibold text-amber-900"
        >
          {chunk.slice(2, -2)}
        </mark>
      );
    } else {
      out.push(
        <em key={i++} className="italic">
          {chunk.slice(1, -1)}
        </em>
      );
    }
    lastIndex = m.index + chunk.length;
  }
  if (lastIndex < input.length) {
    out.push(input.slice(lastIndex));
  }
  return out;
}
