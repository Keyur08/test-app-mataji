"use client";

// filepath: /Users/a200200348/Documents/AajaPadteHai/GeyMatiMataJiApp/admin-dashboard/src/app/(admin)/admin/texts/page.tsx
// Manage Texts — full CRUD for the `texts_library` collection used by the
// mobile app's Library tab. Provides a master/detail layout with a large
// formatted textarea for pasting long Poojan / Aarti / Chalisa texts.

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
  BookOpen,
  FileText,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { Banner, Button, Card, EmptyState, Field, Input } from "@/lib/ui";
import { uploadFile } from "@/lib/uploads";
import { RichTextEditor } from "@/components/RichTextEditor";
import { looksLikeHtml, legacyBodyToHtml } from "@shared/richText";

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

/** True when the TipTap HTML body has no visible text and no image — e.g.
 *  the empty-editor state `<p></p>`. */
function isBodyEffectivelyEmpty(html: string): boolean {
  if (!html) return true;
  if (/<img[\s>]/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

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

  // For auto-scroll + focus when entering edit/new mode
  const editorRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  function focusEditor() {
    // Use rAF to ensure layout is committed (e.g. after state-driven swap)
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Slight delay so the smooth-scroll starts before we steal focus
      setTimeout(() => titleInputRef.current?.focus({ preventScroll: true }), 250);
    });
  }

  /** Upload an image dropped into the rich text editor to Firebase Storage
   *  and return its public URL for `RichTextEditor` to insert. */
  async function onUploadBodyImage(file: File): Promise<string> {
    const { promise } = uploadFile({ folder: "texts_library/images", file });
    const r = await promise;
    return r.url;
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
        // Older docs were saved with the hand-typed `**bold**`/`==highlight==`
        // syntax as plain text. Convert on load so they open correctly in
        // the rich text editor — they'll be re-saved as HTML from here on.
        body: looksLikeHtml(found.body)
          ? found.body
          : legacyBodyToHtml(found.body),
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
    focusEditor();
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (
      !draft.title.trim() ||
      !draft.category.trim() ||
      isBodyEffectivelyEmpty(draft.body)
    ) {
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
              as="div"
              label="Body"
              required
              hint="Use the toolbar to format text — headings, font size, bold/italic/underline/strikethrough, alignment, lists, quotes, color and images. What you see here is what appears in the app."
            >
              <RichTextEditor
                value={draft.body}
                onChange={(html) => setDraft((d) => ({ ...d, body: html }))}
                onUploadImage={onUploadBodyImage}
              />
              {draft.body && (
                <div className="mt-1 flex justify-end text-xs text-neutral-500">
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
                </div>
              )}
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
