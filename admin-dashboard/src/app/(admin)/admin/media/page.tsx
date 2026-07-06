"use client";

// filepath: /Users/a200200348/Documents/AajaPadteHai/GeyMatiMataJiApp/admin-dashboard/src/app/(admin)/admin/media/page.tsx
// Manage Media — upload MP3 bhajans to `bhajans` and gallery images to
// `gallery_photos`. Files are stored in Firebase Storage and the public
// download URL is written into the matching Firestore collection.

import {
  useEffect,
  useMemo,
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
  FolderOpen,
  Headphones,
  Image as ImageIcon,
  Loader2,
  Music,
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

type Tab = "bhajans" | "albums" | "photos";

export default function ManageMediaPage() {
  const [tab, setTab] = useState<Tab>("bhajans");

  return (
      <div className="space-y-6">
        <header className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-primary sm:text-2xl">
            <UploadCloud size={24} /> Manage Media
          </h1>
          <p className="text-sm text-neutral-600">
            Upload audio bhajans, create gallery albums and upload photos. Files
            are stored in Firebase Storage; metadata lives in Firestore.
          </p>
        </header>

        <div className="flex gap-2 border-b border-saffron/30">
          <TabButton
              active={tab === "bhajans"}
              onClick={() => setTab("bhajans")}
              icon={<Headphones size={16} />}
              label="Bhajans (MP3)"
          />
          <TabButton
              active={tab === "albums"}
              onClick={() => setTab("albums")}
              icon={<FolderOpen size={16} />}
              label="Albums"
          />
          <TabButton
              active={tab === "photos"}
              onClick={() => setTab("photos")}
              icon={<ImageIcon size={16} />}
              label="Gallery Photos"
          />
        </div>

        {tab === "bhajans" ? (
            <BhajansSection />
        ) : tab === "albums" ? (
            <AlbumsSection />
        ) : (
            <PhotosSection />
        )}
      </div>
  );
}

function TabButton({
                     active,
                     onClick,
                     icon,
                     label,
                   }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
      <button
          type="button"
          onClick={onClick}
          className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${
              active
                  ? "border-primary text-primary"
                  : "border-transparent text-neutral-600 hover:text-primary"
          }`}
      >
        {icon} {label}
      </button>
  );
}

/* ============================================================
 * Bhajans
 * ========================================================== */

type BhajanDoc = {
  id: string;
  title: string;
  artist?: string;
  categoryId?: string;
  categoryName?: string;
  audioUrl: string;
  storagePath?: string;
  artworkUrl?: string;
  artworkStoragePath?: string;
  durationSec?: number;
  order?: number;
  sizeBytes?: number;
  createdAt?: Timestamp;
};

type BhajanDraft = {
  id?: string;
  title: string;
  artist: string;
  categoryId: string;
  order: number;
  audioUrl?: string;
  storagePath?: string;
  artworkUrl?: string;
  artworkStoragePath?: string;
  sizeBytes?: number;
};

const EMPTY_BHAJAN: BhajanDraft = {
  title: "",
  artist: "",
  categoryId: "",
  order: 0,
};

type BhajanCategoryDoc = {
  id: string;
  name: string;
  order?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type BhajanCategoryDraft = {
  id?: string;
  name: string;
  order: number;
};

const EMPTY_BHAJAN_CATEGORY: BhajanCategoryDraft = {
  name: "",
  order: 0,
};

function normalizeCategoryId(name: string) {
  return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
}

function BhajansSection() {
  const [items, setItems] = useState<BhajanDoc[]>([]);
  const [categories, setCategories] = useState<BhajanCategoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [draft, setDraft] = useState<BhajanDraft>(EMPTY_BHAJAN);
  const [categoryDraft, setCategoryDraft] = useState<BhajanCategoryDraft>(
      EMPTY_BHAJAN_CATEGORY
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "bhajans"), orderBy("order"));
    const unsub = onSnapshot(
        q,
        (snap) => {
          setItems(
              snap.docs.map(
                  (d) =>
                      ({ id: d.id, ...(d.data() as Omit<BhajanDoc, "id">) }) as BhajanDoc
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

  useEffect(() => {
    const q = query(collection(db, "bhajan_categories"), orderBy("order"));
    const unsub = onSnapshot(
        q,
        (snap) => {
          setCategories(
              snap.docs.map(
                  (d) =>
                      ({ id: d.id, ...(d.data() as Omit<BhajanCategoryDoc, "id">) }) as BhajanCategoryDoc
              )
          );
          setCategoriesLoading(false);
        },
        (e) => {
          setError(e.message);
          setCategoriesLoading(false);
        }
    );
    return unsub;
  }, []);

  const isEditing = !!draft.id;
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const key =
          item.categoryId || normalizeCategoryId(item.categoryName || "uncategorized");
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [items]);

  const categoryById = useMemo(() => {
    return Object.fromEntries(categories.map((cat) => [cat.id, cat]));
  }, [categories]);

  function resetForm() {
    setDraft(EMPTY_BHAJAN);
    setAudioFile(null);
    setArtworkFile(null);
    setProgress(null);
    setError(null);
    setSuccess(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (artworkInputRef.current) artworkInputRef.current.value = "";
  }

  function editItem(it: BhajanDoc) {
    setDraft({
      id: it.id,
      title: it.title,
      artist: it.artist ?? "",
      categoryId: it.categoryId ?? "",
      order: it.order ?? 0,
      audioUrl: it.audioUrl,
      storagePath: it.storagePath,
      artworkUrl: it.artworkUrl,
      artworkStoragePath: it.artworkStoragePath,
      sizeBytes: it.sizeBytes,
    });
    setAudioFile(null);
    setArtworkFile(null);
    setError(null);
    setSuccess(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (artworkInputRef.current) artworkInputRef.current.value = "";
  }

  async function handleDelete(it: BhajanDoc) {
    if (!confirm(`Delete bhajan "${it.title}"? Audio file will be removed.`))
      return;
    try {
      await deleteDoc(doc(db, "bhajans", it.id));
      if (it.storagePath) await deleteStorageObject(it.storagePath);
      if (it.artworkStoragePath)
        await deleteStorageObject(it.artworkStoragePath);
      if (draft.id === it.id) resetForm();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function resetCategoryForm() {
    setCategoryDraft(EMPTY_BHAJAN_CATEGORY);
    setError(null);
    setSuccess(null);
  }

  function editCategory(it: BhajanCategoryDoc) {
    setCategoryDraft({
      id: it.id,
      name: it.name,
      order: it.order ?? 0,
    });
    setError(null);
    setSuccess(null);
  }

  async function handleDeleteCategory(it: BhajanCategoryDoc) {
    const count = categoryCounts[it.id] ?? 0;
    if (count > 0) {
      alert(
          `Cannot delete "${it.name}" — it is still used by ${count} bhajan${count === 1 ? "" : "s"}. Reassign those bhajans first.`
      );
      return;
    }
    if (!confirm(`Delete category "${it.name}"?`)) return;
    try {
      await deleteDoc(doc(db, "bhajan_categories", it.id));
      if (categoryDraft.id === it.id) resetCategoryForm();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleCategorySubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const name = categoryDraft.name.trim();
    if (!name) {
      setError("Category name is required.");
      return;
    }
    const id = categoryDraft.id || normalizeCategoryId(name);
    if (!id) {
      setError("Category name must contain letters or numbers.");
      return;
    }
    setCategorySaving(true);
    try {
      await setDoc(
          doc(db, "bhajan_categories", id),
          {
            name,
            order: Number(categoryDraft.order) || 0,
            updatedAt: serverTimestamp(),
            ...(categoryDraft.id ? {} : { createdAt: serverTimestamp() }),
          },
          { merge: true }
      );
      setSuccess(categoryDraft.id ? "Category updated." : "Category created.");
      resetCategoryForm();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCategorySaving(false);
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
    if (!draft.categoryId.trim()) {
      setError("Category is required. Create a category first if needed.");
      return;
    }
    const categoryName =
        categoryById[draft.categoryId]?.name?.trim() || draft.categoryId;
    if (!isEditing && !audioFile) {
      setError("Please choose an MP3 file.");
      return;
    }

    setSaving(true);
    try {
      let audioUrl = draft.audioUrl;
      let storagePath = draft.storagePath;
      let sizeBytes = draft.sizeBytes;

      if (audioFile) {
        const { promise } = uploadFile({
          folder: "bhajans/audio",
          file: audioFile,
          onProgress: setProgress,
        });
        const res = await promise;
        // Old file cleanup if replacing.
        if (storagePath && storagePath !== res.storagePath) {
          await deleteStorageObject(storagePath);
        }
        audioUrl = res.url;
        storagePath = res.storagePath;
        sizeBytes = res.size;
      }

      let artworkUrl = draft.artworkUrl;
      let artworkStoragePath = draft.artworkStoragePath;
      if (artworkFile) {
        const { promise } = uploadFile({
          folder: "bhajans/artwork",
          file: artworkFile,
        });
        const res = await promise;
        if (artworkStoragePath && artworkStoragePath !== res.storagePath) {
          await deleteStorageObject(artworkStoragePath);
        }
        artworkUrl = res.url;
        artworkStoragePath = res.storagePath;
      }

      const payload = {
        title: draft.title.trim(),
        artist: draft.artist.trim() || null,
        categoryId: draft.categoryId.trim(),
        categoryName,
        order: Number(draft.order) || 0,
        audioUrl,
        storagePath,
        artworkUrl: artworkUrl ?? null,
        artworkStoragePath: artworkStoragePath ?? null,
        sizeBytes: sizeBytes ?? null,
        updatedAt: serverTimestamp(),
      };

      if (isEditing && draft.id) {
        await setDoc(doc(db, "bhajans", draft.id), payload, { merge: true });
        setSuccess("Bhajan updated.");
      } else {
        await addDoc(collection(db, "bhajans"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setSuccess("Bhajan uploaded.");
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
        <Card
            title="Bhajan Categories"
            description="Create categories like Jain Bhajan, Stavan, or Aarti. Each bhajan must belong to one category."
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category name" required>
                  <Input
                      required
                      value={categoryDraft.name}
                      onChange={(e) =>
                          setCategoryDraft({ ...categoryDraft, name: e.target.value })
                      }
                      placeholder="Jain Bhajan"
                  />
                </Field>
                <Field label="Display order" hint="Lower numbers appear first">
                  <Input
                      type="number"
                      value={categoryDraft.order}
                      onChange={(e) =>
                          setCategoryDraft({
                            ...categoryDraft,
                            order: Number(e.target.value),
                          })
                      }
                  />
                </Field>
              </div>

              {error && <Banner kind="error">{error}</Banner>}
              {success && <Banner kind="success">{success}</Banner>}

              <div className="flex justify-end gap-2">
                {categoryDraft.id ? (
                    <Button type="button" variant="ghost" onClick={resetCategoryForm}>
                      <X size={16} /> Cancel
                    </Button>
                ) : null}
                <Button type="submit" disabled={categorySaving}>
                  {categorySaving ? (
                      <Loader2 size={16} className="animate-spin" />
                  ) : (
                      <Save size={16} />
                  )}
                  {categoryDraft.id ? "Save category" : "Create category"}
                </Button>
              </div>
            </form>

            <div>
              {categoriesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-primary" />
                  </div>
              ) : categories.length === 0 ? (
                  <EmptyState
                      title="No categories yet."
                      description="Create at least one category before uploading bhajans."
                  />
              ) : (
                  <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {categories.map((cat) => (
                        <li
                            key={cat.id}
                            className={`flex items-center gap-3 rounded-lg border border-neutral-100 bg-white p-3 ${
                                categoryDraft.id === cat.id ? "ring-2 ring-primary/40" : ""
                            }`}
                        >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-saffron/15 text-primary">
                      {categoryCounts[cat.id] ?? 0}
                    </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-neutral-900">
                              {cat.name}
                            </p>
                            <p className="truncate text-xs text-neutral-500">
                              {categoryCounts[cat.id] ?? 0} bhajan
                              {(categoryCounts[cat.id] ?? 0) === 1 ? "" : "s"}
                              {cat.order !== undefined ? ` · order ${cat.order}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <button
                                type="button"
                                onClick={() => editCategory(cat)}
                                className="rounded-md p-1.5 text-neutral-500 hover:bg-cream hover:text-primary"
                                title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat)}
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
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card
              title={isEditing ? "Edit Bhajan" : "Upload Bhajan"}
              description="Upload an MP3 file; we'll store it in Firebase Storage and add a record to the `bhajans` collection."
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
                <Field label="Title" required>
                  <Input
                      required
                      value={draft.title}
                      onChange={(e) =>
                          setDraft({ ...draft, title: e.target.value })
                      }
                      placeholder="Jai Jinendra"
                  />
                </Field>
                <Field label="Artist / Singer">
                  <Input
                      value={draft.artist}
                      onChange={(e) =>
                          setDraft({ ...draft, artist: e.target.value })
                      }
                  />
                </Field>
              </div>

              <Field
                  label="Category"
                  required
                  hint="Choose one category for this bhajan."
              >
                <select
                    required
                    value={draft.categoryId}
                    onChange={(e) =>
                        setDraft({ ...draft, categoryId: e.target.value })
                    }
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                  ))}
                </select>
              </Field>

              <Field label="Display Order" hint="Lower numbers play first">
                <Input
                    type="number"
                    value={draft.order}
                    onChange={(e) =>
                        setDraft({ ...draft, order: Number(e.target.value) })
                    }
                />
              </Field>

              <Field
                  label={isEditing ? "Replace audio (optional)" : "Audio file (MP3)"}
                  required={!isEditing}
                  hint={
                    draft.audioUrl
                        ? "Currently linked: leave empty to keep the existing file."
                        : "Accepted: .mp3, .m4a, .aac, .wav"
                  }
              >
                <Input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,.mp3,.m4a,.aac,.wav"
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setAudioFile(e.target.files?.[0] ?? null)
                    }
                />
                {audioFile && (
                    <p className="mt-1 text-xs text-neutral-500">
                      {audioFile.name} · {formatBytes(audioFile.size)}
                    </p>
                )}
                {!audioFile && draft.audioUrl && (
                    <a
                        href={draft.audioUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-primary hover:underline"
                    >
                      Open current file ↗
                    </a>
                )}
              </Field>

              <Field
                  label="Artwork (optional)"
                  hint="Square JPG/PNG recommended (~500x500)."
              >
                <Input
                    ref={artworkInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setArtworkFile(e.target.files?.[0] ?? null)
                    }
                />
                {(artworkFile || draft.artworkUrl) && (
                    <div className="mt-2 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                          src={
                            artworkFile
                                ? URL.createObjectURL(artworkFile)
                                : draft.artworkUrl!
                          }
                          alt="Artwork preview"
                          className="h-16 w-16 rounded-md border border-saffron/30 object-cover"
                      />
                      <span className="text-xs text-neutral-500">
                  {artworkFile?.name ?? "Current artwork"}
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
                      <Save size={16} />
                  )}
                  {isEditing ? "Save changes" : "Upload bhajan"}
                </Button>
              </div>
            </form>
          </Card>

          <Card
              title="Bhajans"
              description={`${items.length} track${items.length === 1 ? "" : "s"}`}
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
                    title="No bhajans yet."
                    description="Upload your first MP3 to get started."
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
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-saffron/15 text-primary">
                  {it.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                          src={it.artworkUrl}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                      />
                  ) : (
                      <Music size={18} />
                  )}
                </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-neutral-900">
                            {it.title}
                          </p>
                          <p className="truncate text-xs text-neutral-500">
                            {categoryById[it.categoryId ?? ""]?.name ??
                                it.categoryName ??
                                "Uncategorized"}
                            {" · "}
                            {it.artist || "—"}{" "}
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

/* ============================================================
 * Gallery Albums
 * ========================================================== */

type AlbumDoc = {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  coverStoragePath?: string;
  order?: number;
  createdAt?: Timestamp;
};

type AlbumDraft = {
  id?: string;
  name: string;
  description: string;
  order: number;
  coverUrl?: string;
  coverStoragePath?: string;
};

const EMPTY_ALBUM: AlbumDraft = { name: "", description: "", order: 0 };

function AlbumsSection() {
  const [items, setItems] = useState<AlbumDoc[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<AlbumDraft>(EMPTY_ALBUM);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "gallery_albums"), orderBy("order"));
    const unsub = onSnapshot(
        q,
        (snap) => {
          setItems(
              snap.docs.map(
                  (d) =>
                      ({ id: d.id, ...(d.data() as Omit<AlbumDoc, "id">) }) as AlbumDoc
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

  // Track how many photos live in each album (for UI + safe delete).
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "gallery_photos"), (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as { albumId?: string };
        if (data.albumId) counts[data.albumId] = (counts[data.albumId] ?? 0) + 1;
      });
      setPhotoCounts(counts);
    });
    return unsub;
  }, []);

  const isEditing = !!draft.id;

  function resetForm() {
    setDraft(EMPTY_ALBUM);
    setCoverFile(null);
    setError(null);
    setSuccess(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  function editItem(it: AlbumDoc) {
    setDraft({
      id: it.id,
      name: it.name,
      description: it.description ?? "",
      order: it.order ?? 0,
      coverUrl: it.coverUrl,
      coverStoragePath: it.coverStoragePath,
    });
    setCoverFile(null);
    setError(null);
    setSuccess(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  async function handleDelete(it: AlbumDoc) {
    const count = photoCounts[it.id] ?? 0;
    if (count > 0) {
      alert(
          `Cannot delete "${it.name}" — it still contains ${count} photo${
              count === 1 ? "" : "s"
          }. Move or delete those photos first.`
      );
      return;
    }
    if (!confirm(`Delete album "${it.name}"?`)) return;
    try {
      await deleteDoc(doc(db, "gallery_albums", it.id));
      if (it.coverStoragePath) await deleteStorageObject(it.coverStoragePath);
      if (draft.id === it.id) resetForm();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!draft.name.trim()) {
      setError("Album name is required.");
      return;
    }
    setSaving(true);
    try {
      let coverUrl = draft.coverUrl;
      let coverStoragePath = draft.coverStoragePath;
      if (coverFile) {
        const { promise } = uploadFile({
          folder: "gallery/album-covers",
          file: coverFile,
        });
        const res = await promise;
        if (coverStoragePath && coverStoragePath !== res.storagePath) {
          await deleteStorageObject(coverStoragePath);
        }
        coverUrl = res.url;
        coverStoragePath = res.storagePath;
      }

      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        order: Number(draft.order) || 0,
        coverUrl: coverUrl ?? null,
        coverStoragePath: coverStoragePath ?? null,
        updatedAt: serverTimestamp(),
      };

      if (isEditing && draft.id) {
        await setDoc(doc(db, "gallery_albums", draft.id), payload, {
          merge: true,
        });
        setSuccess("Album updated.");
      } else {
        await addDoc(collection(db, "gallery_albums"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setSuccess("Album created.");
        resetForm();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card
            title={isEditing ? "Edit Album" : "Create Album"}
            description="Albums group photos in the mobile app's Gallery tab."
            actions={
              isEditing ? (
                  <Button variant="ghost" onClick={resetForm}>
                    <X size={16} /> Cancel
                  </Button>
              ) : undefined
            }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Album name" required>
              <Input
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Vihar 2026, Diwali 2025"
              />
            </Field>

            <Field label="Description (optional)">
              <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                  }
                  placeholder="Short subtitle shown under the album name"
              />
            </Field>

            <Field label="Display order" hint="Lower numbers appear first">
              <Input
                  type="number"
                  value={draft.order}
                  onChange={(e) =>
                      setDraft({ ...draft, order: Number(e.target.value) })
                  }
              />
            </Field>

            <Field
                label="Cover image (optional)"
                hint="If empty, the app shows the first photo in this album."
            >
              <Input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setCoverFile(e.target.files?.[0] ?? null)
                  }
              />
              {(coverFile || draft.coverUrl) && (
                  <div className="mt-2 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={
                          coverFile
                              ? URL.createObjectURL(coverFile)
                              : draft.coverUrl!
                        }
                        alt="Cover preview"
                        className="h-20 w-20 rounded-md border border-saffron/30 object-cover"
                    />
                    <span className="text-xs text-neutral-500">
                  {coverFile?.name ?? "Current cover"}
                </span>
                  </div>
              )}
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
                {isEditing ? "Save changes" : "Create album"}
              </Button>
            </div>
          </form>
        </Card>

        <Card
            title="Albums"
            description={`${items.length} album${items.length === 1 ? "" : "s"}`}
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
                  title="No albums yet."
                  description="Create your first album to start organising photos."
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
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-saffron/15 text-primary">
                  {it.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                          src={it.coverUrl}
                          alt=""
                          className="h-10 w-10 object-cover"
                      />
                  ) : (
                      <FolderOpen size={18} />
                  )}
                </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {it.name}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {photoCounts[it.id] ?? 0} photo
                          {(photoCounts[it.id] ?? 0) === 1 ? "" : "s"}
                          {it.description ? ` · ${it.description}` : ""}
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
  );
}

/* ============================================================
 * Gallery Photos
 * ========================================================== */

type PhotoDoc = {
  id: string;
  imageUrl: string;
  storagePath?: string;
  caption?: string;
  album?: string;
  albumId?: string;
  order?: number;
  sizeBytes?: number;
  createdAt?: Timestamp;
};

type PhotoDraft = {
  caption: string;
  albumId: string;
  order: number;
};

function PhotosSection() {
  const [items, setItems] = useState<PhotoDoc[]>([]);
  const [albums, setAlbums] = useState<AlbumDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<PhotoDraft>({
    caption: "",
    albumId: "",
    order: 0,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{
    index: number;
    total: number;
    percent: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterAlbumId, setFilterAlbumId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "gallery_photos"), orderBy("order"));
    const unsub = onSnapshot(
        q,
        (snap) => {
          setItems(
              snap.docs.map(
                  (d) =>
                      ({ id: d.id, ...(d.data() as Omit<PhotoDoc, "id">) }) as PhotoDoc
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

  useEffect(() => {
    const q = query(collection(db, "gallery_albums"), orderBy("order"));
    const unsub = onSnapshot(q, (snap) => {
      setAlbums(
          snap.docs.map(
              (d) =>
                  ({ id: d.id, ...(d.data() as Omit<AlbumDoc, "id">) }) as AlbumDoc
          )
      );
    });
    return unsub;
  }, []);

  const albumNameById = useMemo(() => {
    const m: Record<string, string> = {};
    albums.forEach((a) => (m[a.id] = a.name));
    return m;
  }, [albums]);

  const filteredItems = useMemo(() => {
    if (!filterAlbumId) return items;
    if (filterAlbumId === "__none__") return items.filter((it) => !it.albumId);
    return items.filter((it) => it.albumId === filterAlbumId);
  }, [items, filterAlbumId]);

  function resetForm() {
    setDraft({ caption: "", albumId: "", order: 0 });
    setFiles([]);
    setProgress(null);
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (files.length === 0) {
      setError("Please choose at least one image.");
      return;
    }
    if (!draft.albumId) {
      setError("Please select an album. Create one in the Albums tab first.");
      return;
    }

    const albumName = albumNameById[draft.albumId] ?? null;

    setSaving(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ index: i + 1, total: files.length, percent: 0 });
        const { promise } = uploadFile({
          folder: "gallery",
          file,
          onProgress: (p) =>
              setProgress({ index: i + 1, total: files.length, percent: p.percent }),
        });
        const res = await promise;
        await addDoc(collection(db, "gallery_photos"), {
          imageUrl: res.url,
          storagePath: res.storagePath,
          caption: draft.caption.trim() || null,
          albumId: draft.albumId,
          album: albumName,
          order: Number(draft.order) || 0,
          sizeBytes: res.size,
          contentType: res.contentType,
          createdAt: serverTimestamp(),
        });
      }
      setSuccess(
          `Uploaded ${files.length} photo${files.length === 1 ? "" : "s"}.`
      );
      // Keep album/order selection so admins can upload more easily.
      setFiles([]);
      setDraft((d) => ({ ...d, caption: "" }));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  async function handleDelete(it: PhotoDoc) {
    if (!confirm("Delete this photo?")) return;
    try {
      await deleteDoc(doc(db, "gallery_photos", it.id));
      if (it.storagePath) await deleteStorageObject(it.storagePath);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function updateCaption(it: PhotoDoc, caption: string) {
    try {
      await setDoc(
          doc(db, "gallery_photos", it.id),
          { caption: caption || null, updatedAt: serverTimestamp() },
          { merge: true }
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function updateAlbum(it: PhotoDoc, albumId: string) {
    try {
      const name = albumId ? albumNameById[albumId] ?? null : null;
      await setDoc(
          doc(db, "gallery_photos", it.id),
          {
            albumId: albumId || null,
            album: name,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
      <div className="space-y-6">
        <Card
            title="Upload Photos"
            description="Add multiple images at once. Each one is uploaded to Storage and added to `gallery_photos`."
        >
          <form onSubmit={handleUpload} className="space-y-4">
            <Field
                label="Images"
                required
                hint="Tip: you can click 'Add images' multiple times to keep adding files from different folders."
            >
              <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
                        f.type.startsWith("image/")
                    );
                    if (dropped.length === 0) return;
                    setFiles((prev) => {
                      const map = new Map<string, File>();
                      [...prev, ...dropped].forEach((f) =>
                          map.set(`${f.name}-${f.size}-${f.lastModified}`, f)
                      );
                      return Array.from(map.values());
                    });
                  }}
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-saffron/40 bg-cream/40 px-4 py-6 text-center"
              >
                <UploadCloud size={22} className="text-primary" />
                <p className="text-sm text-neutral-700">
                  Drag &amp; drop images here, or
                </p>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                >
                  <Plus size={16} /> Add images
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const picked = Array.from(e.target.files ?? []);
                      if (picked.length === 0) return;
                      // Append + dedupe so re-opening the picker doesn't clobber.
                      setFiles((prev) => {
                        const map = new Map<string, File>();
                        [...prev, ...picked].forEach((f) =>
                            map.set(`${f.name}-${f.size}-${f.lastModified}`, f)
                        );
                        return Array.from(map.values());
                      });
                      // Reset the input so selecting the same file again still fires onChange.
                      e.target.value = "";
                    }}
                />
                <p className="text-xs text-neutral-500">
                  {files.length === 0
                      ? "No images selected yet."
                      : `${files.length} image${files.length === 1 ? "" : "s"} ready to upload`}
                </p>
              </div>
            </Field>

            {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-600">
                  {files.length} selected
                </span>
                    <button
                        type="button"
                        onClick={() => setFiles([])}
                        className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {files.map((f, i) => (
                        <div
                            key={`${f.name}-${f.size}-${f.lastModified}`}
                            className="group relative aspect-square overflow-hidden rounded-md border border-saffron/30 bg-cream"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                              src={URL.createObjectURL(f)}
                              alt={f.name}
                              className="h-full w-full object-cover"
                          />
                          <button
                              type="button"
                              onClick={() =>
                                  setFiles((prev) => prev.filter((_, idx) => idx !== i))
                              }
                              className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 opacity-0 shadow transition group-hover:opacity-100 hover:bg-white"
                              title="Remove"
                          >
                            <X size={12} />
                          </button>
                        </div>
                    ))}
                  </div>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Caption (applies to all)">
                <Input
                    value={draft.caption}
                    onChange={(e) =>
                        setDraft({ ...draft, caption: e.target.value })
                    }
                />
              </Field>
              <Field label="Album" required>
                <select
                    required
                    value={draft.albumId}
                    onChange={(e) =>
                        setDraft({ ...draft, albumId: e.target.value })
                    }
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">— Select an album —</option>
                  {albums.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                  ))}
                </select>
                {albums.length === 0 && (
                    <span className="mt-1 block text-xs text-red-600">
                  No albums yet. Create one in the Albums tab first.
                </span>
                )}
              </Field>
              <Field label="Order">
                <Input
                    type="number"
                    value={draft.order}
                    onChange={(e) =>
                        setDraft({ ...draft, order: Number(e.target.value) })
                    }
                />
              </Field>
            </div>

            {progress && (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-neutral-600">
                <span>
                  Uploading {progress.index} of {progress.total}…
                </span>
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

            <div className="flex justify-end">
              <Button type="submit" disabled={saving || files.length === 0}>
                {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                ) : (
                    <UploadCloud size={16} />
                )}
                Upload {files.length || ""}
              </Button>
            </div>
          </form>
        </Card>

        <Card
            title="Gallery"
            description={`${items.length} photo${items.length === 1 ? "" : "s"}${
                filterAlbumId && filterAlbumId !== "__none__"
                    ? ` · showing ${filteredItems.length} in "${albumNameById[filterAlbumId] ?? "album"}"`
                    : filterAlbumId === "__none__"
                        ? ` · showing ${filteredItems.length} without an album`
                        : ""
            }`}
            actions={
              <select
                  value={filterAlbumId}
                  onChange={(e) => setFilterAlbumId(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All albums</option>
                {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                ))}
                <option value="__none__">— Without album —</option>
              </select>
            }
        >
          {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" />
              </div>
          ) : filteredItems.length === 0 ? (
              <EmptyState title="No photos yet." />
          ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {filteredItems.map((it) => (
                    <div
                        key={it.id}
                        className="group overflow-hidden rounded-xl border border-saffron/20 bg-white"
                    >
                      <div className="relative aspect-square overflow-hidden bg-cream">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={it.imageUrl}
                            alt={it.caption ?? ""}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                        <button
                            type="button"
                            onClick={() => handleDelete(it)}
                            className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-red-600 opacity-0 shadow transition group-hover:opacity-100 hover:bg-white"
                            title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="p-2">
                        <input
                            defaultValue={it.caption ?? ""}
                            onBlur={(e) => {
                              if (e.target.value !== (it.caption ?? "")) {
                                void updateCaption(it, e.target.value);
                              }
                            }}
                            placeholder="Add caption…"
                            className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-xs outline-none hover:border-neutral-200 focus:border-primary"
                        />
                        <select
                            value={it.albumId ?? ""}
                            onChange={(e) => void updateAlbum(it, e.target.value)}
                            className="mt-1 w-full rounded border border-transparent bg-transparent px-1 py-1 text-[10px] uppercase tracking-wider text-saffron outline-none hover:border-neutral-200 focus:border-primary"
                        >
                          <option value="">— No album —</option>
                          {albums.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                          ))}
                        </select>
                      </div>
                    </div>
                ))}
              </div>
          )}
        </Card>
      </div>
  );
}