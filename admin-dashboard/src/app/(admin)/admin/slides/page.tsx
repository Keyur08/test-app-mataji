"use client";

// Home Carousel — hero slides shown on the mobile Home screen, just below
// the greeting. Each slide has an image, optional title/subtitle, and an
// optional tap action (same shape as Home Stories links).

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
  GalleryHorizontalEnd,
  Loader2,
  Pencil,
  Plus,
  Save,
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

type LinkType = "tab" | "gallery-section" | "route" | "url" | "";

type SlideDoc = {
  id: string;
  imageUrl: string;
  imageStoragePath?: string;
  title?: string;
  subtitle?: string;
  linkType?: Exclude<LinkType, "">;
  linkTarget?: string;
  order?: number;
  active?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type SlideDraft = {
  id?: string;
  title: string;
  subtitle: string;
  linkType: LinkType;
  linkTarget: string;
  order: number;
  active: boolean;
  imageUrl?: string;
  imageStoragePath?: string;
};

const EMPTY: SlideDraft = {
  title: "",
  subtitle: "",
  linkType: "",
  linkTarget: "",
  order: 0,
  active: true,
};

const TAB_TARGETS = [
  { value: "home", label: "Home" },
  { value: "library", label: "Library" },
  { value: "audio", label: "Audio" },
  { value: "gallery", label: "Gallery" },
];

const GALLERY_TARGETS = [
  { value: "photos", label: "Gallery → Photos" },
  { value: "pravachans", label: "Gallery → Pravachans" },
  { value: "reels", label: "Gallery → Reels" },
];

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

export default function ManageSlidesPage() {
  const [items, setItems] = useState<SlideDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<SlideDraft>(EMPTY);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "home_slides"), orderBy("order"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map(
            (d) =>
              ({ id: d.id, ...(d.data() as Omit<SlideDoc, "id">) }) as SlideDoc
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
    setImageFile(null);
    setProgress(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function startEdit(item: SlideDoc) {
    setDraft({
      id: item.id,
      title: item.title || "",
      subtitle: item.subtitle || "",
      linkType: item.linkType || "",
      linkTarget: item.linkTarget || "",
      order: item.order ?? 0,
      active: item.active !== false,
      imageUrl: item.imageUrl,
      imageStoragePath: item.imageStoragePath,
    });
    setImageFile(null);
    setProgress(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    setImageFile(e.target.files?.[0] || null);
  }

  function onChangeLinkType(value: LinkType) {
    const defaults: Record<Exclude<LinkType, "">, string> = {
      tab: "gallery",
      "gallery-section": "photos",
      route: "/news",
      url: "https://",
    };
    setDraft((d) => ({
      ...d,
      linkType: value,
      linkTarget: value === "" ? "" : defaults[value],
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isEditing && !imageFile) {
      setError("Please choose an image for the slide.");
      return;
    }
    if (draft.linkType !== "" && !draft.linkTarget.trim()) {
      setError("Please enter a link target, or remove the link type.");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = draft.imageUrl;
      let imageStoragePath = draft.imageStoragePath;

      if (imageFile) {
        const oldPath = draft.imageStoragePath;
        const { promise } = uploadFile({
          folder: "home_slides",
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
        imageUrl: imageUrl!,
        imageStoragePath: imageStoragePath || null,
        title: draft.title.trim() || null,
        subtitle: draft.subtitle.trim() || null,
        linkType: draft.linkType === "" ? null : draft.linkType,
        linkTarget:
          draft.linkType === "" ? null : draft.linkTarget.trim() || null,
        order: Number(draft.order) || 0,
        active: draft.active,
        updatedAt: serverTimestamp(),
      };

      if (isEditing && draft.id) {
        await setDoc(doc(db, "home_slides", draft.id), payload, {
          merge: true,
        });
        setSuccess("Slide updated.");
      } else {
        await addDoc(collection(db, "home_slides"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setSuccess("Slide created.");
      }
      resetForm();
    } catch (err) {
      setError((err as Error).message || "Failed to save slide.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  async function onDelete(item: SlideDoc) {
    if (!confirm(`Delete this slide?`)) return;
    try {
      await deleteDoc(doc(db, "home_slides", item.id));
      if (item.imageStoragePath) {
        deleteStorageObject(item.imageStoragePath).catch(() => {});
      }
      if (draft.id === item.id) resetForm();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title={isEditing ? "Edit Slide" : "New Slide"}
        description="Hero carousel shown on the mobile Home screen, below the greeting."
        actions={
          isEditing ? (
            <Button variant="ghost" onClick={resetForm} type="button">
              <X size={16} /> Cancel edit
            </Button>
          ) : undefined
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Banner kind="error">{error}</Banner>}
          {success && <Banner kind="success">{success}</Banner>}

          <Field
            label="Slide image"
            required={!isEditing}
            hint="Landscape works best (~16:9). Will be displayed full-width."
          >
            <div className="flex items-center gap-4">
              {(imageFile || draft.imageUrl) && (
                <div className="h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
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
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Title" hint="Optional headline overlaid on the image.">
              <Input
                value={draft.title}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
                placeholder="e.g. Vihar 2026"
                maxLength={80}
              />
            </Field>

            <Field label="Display order" hint="Lower numbers appear first.">
              <Input
                type="number"
                value={String(draft.order)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    order: Number(e.target.value) || 0,
                  }))
                }
              />
            </Field>
          </div>

          <Field label="Subtitle" hint="Optional supporting text.">
            <Textarea
              rows={2}
              value={draft.subtitle}
              onChange={(e) =>
                setDraft((d) => ({ ...d, subtitle: e.target.value }))
              }
              placeholder="e.g. Join the upcoming vihar from Indore to Ujjain"
              maxLength={200}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Link type"
              hint="Leave blank for non-tappable slides."
            >
              <select
                value={draft.linkType}
                onChange={(e) =>
                  onChangeLinkType(e.target.value as LinkType)
                }
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">No link (not tappable)</option>
                <option value="tab">Bottom tab</option>
                <option value="gallery-section">Gallery section</option>
                <option value="route">In-app route</option>
                <option value="url">External URL</option>
              </select>
            </Field>

            {draft.linkType !== "" && (
              <Field label="Link target" required>
                {draft.linkType === "tab" ? (
                  <select
                    value={draft.linkTarget}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, linkTarget: e.target.value }))
                    }
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {TAB_TARGETS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                ) : draft.linkType === "gallery-section" ? (
                  <select
                    value={draft.linkTarget}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, linkTarget: e.target.value }))
                    }
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {GALLERY_TARGETS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                ) : draft.linkType === "route" ? (
                  <>
                    <select
                      value={
                        ROUTE_TARGETS.some((r) => r.value === draft.linkTarget)
                          ? draft.linkTarget
                          : "__custom"
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraft((d) => ({
                          ...d,
                          linkTarget: v === "__custom" ? "" : v,
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
                    {!ROUTE_TARGETS.some(
                      (r) => r.value === draft.linkTarget
                    ) && (
                      <div className="mt-2">
                        <Input
                          value={draft.linkTarget}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              linkTarget: e.target.value,
                            }))
                          }
                          placeholder="/news/abc123"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <Input
                    value={draft.linkTarget}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, linkTarget: e.target.value }))
                    }
                    placeholder="https://example.com"
                  />
                )}
              </Field>
            )}

            <Field label="Active">
              <label className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, active: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary/30"
                />
                <span className="text-sm text-neutral-700">
                  Visible in the app
                </span>
              </label>
            </Field>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : isEditing ? (
                <Save size={16} />
              ) : (
                <Plus size={16} />
              )}
              {isEditing ? "Save changes" : "Create slide"}
            </Button>
            {!isEditing && (
              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                disabled={saving}
              >
                Reset
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card
        title="Home Carousel Slides"
        description="Drag-free ordering via the order number. Lowest order appears first."
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No slides yet"
            description="Use the form above to add your first carousel slide."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
              >
                <div className="relative aspect-[16/9] w-full bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {item.active === false && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                      Hidden
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate font-semibold text-neutral-900">
                    {item.title || (
                      <span className="italic text-neutral-400">
                        (no title)
                      </span>
                    )}
                  </p>
                  {item.subtitle && (
                    <p className="line-clamp-2 text-xs text-neutral-600">
                      {item.subtitle}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-neutral-400">
                    order {item.order ?? 0}
                    {item.linkType && (
                      <>
                        {" · "}
                        <span className="font-medium text-neutral-600">
                          {item.linkType}
                        </span>
                        {" → "}
                        {item.linkTarget}
                      </>
                    )}
                  </p>
                  <div className="mt-3 flex gap-1">
                    <Button
                      variant="secondary"
                      onClick={() => startEdit(item)}
                      type="button"
                    >
                      <Pencil size={14} /> Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => onDelete(item)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
