"use client";

// Home Stories — Instagram-style circles on the mobile Home screen.
// Each story has an image, a label, and a tap target (tab / route / URL).

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
  Circle,
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
} from "@/lib/ui";
import {
  deleteStorageObject,
  uploadFile,
  type UploadProgress,
} from "@/lib/uploads";

type LinkType = "tab" | "gallery-section" | "route" | "url";

type StoryDoc = {
  id: string;
  name: string;
  imageUrl: string;
  imageStoragePath?: string;
  linkType: LinkType;
  linkTarget: string;
  ringColor?: string;
  order?: number;
  active?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type StoryDraft = {
  id?: string;
  name: string;
  linkType: LinkType;
  linkTarget: string;
  ringColor: string;
  order: number;
  active: boolean;
  imageUrl?: string;
  imageStoragePath?: string;
};

const EMPTY: StoryDraft = {
  name: "",
  linkType: "tab",
  linkTarget: "gallery",
  ringColor: "#F4A261",
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

/**
 * All static in-app screens that don't take a dynamic id. Dynamic routes
 * like `/news/[id]` or `/library/[id]` are not listed because they require
 * a specific document id — admins can still type those manually by
 * switching to "External URL" or by extending this list later.
 */
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

export default function ManageStoriesPage() {
  const [items, setItems] = useState<StoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<StoryDraft>(EMPTY);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "home_stories"), orderBy("order"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map(
            (d) =>
              ({ id: d.id, ...(d.data() as Omit<StoryDoc, "id">) }) as StoryDoc
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

  function startEdit(item: StoryDoc) {
    setDraft({
      id: item.id,
      name: item.name,
      linkType: item.linkType,
      linkTarget: item.linkTarget,
      ringColor: item.ringColor || "#F4A261",
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
    const f = e.target.files?.[0] || null;
    setImageFile(f);
  }

  function onChangeLinkType(value: LinkType) {
    // Reset target to a sensible default for the new type
    const defaults: Record<LinkType, string> = {
      tab: "gallery",
      "gallery-section": "photos",
      route: "/news",
      url: "https://",
    };
    setDraft((d) => ({ ...d, linkType: value, linkTarget: defaults[value] }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!draft.linkTarget.trim()) {
      setError("Link target is required.");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = draft.imageUrl;
      let imageStoragePath = draft.imageStoragePath;

      if (imageFile) {
        // If replacing an existing image, schedule the old one for deletion
        const oldPath = draft.imageStoragePath;
        const { promise } = uploadFile({
          folder: "home_stories",
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
        name: draft.name.trim(),
        imageUrl: imageUrl || null,
        imageStoragePath: imageStoragePath || null,
        linkType: draft.linkType,
        linkTarget: draft.linkTarget.trim(),
        ringColor: draft.ringColor || null,
        order: Number(draft.order) || 0,
        active: draft.active,
        updatedAt: serverTimestamp(),
      };

      if (isEditing && draft.id) {
        await setDoc(doc(db, "home_stories", draft.id), payload, {
          merge: true,
        });
        setSuccess("Story updated.");
      } else {
        await addDoc(collection(db, "home_stories"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setSuccess("Story created.");
      }
      resetForm();
    } catch (err) {
      const e = err as Error;
      setError(e.message || "Failed to save story.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  async function onDelete(item: StoryDoc) {
    if (!confirm(`Delete story "${item.name}"?`)) return;
    try {
      await deleteDoc(doc(db, "home_stories", item.id));
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
        title={isEditing ? "Edit Home Story" : "New Home Story"}
        description="Instagram-style circles shown at the top of the mobile Home screen."
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Name" required hint="Shown under the circle.">
              <Input
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="e.g. News"
                maxLength={20}
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

            <Field label="Link type" required>
              <select
                value={draft.linkType}
                onChange={(e) =>
                  onChangeLinkType(e.target.value as LinkType)
                }
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="tab">Bottom tab</option>
                <option value="gallery-section">Gallery section</option>
                <option value="route">In-app route</option>
                <option value="url">External URL</option>
              </select>
            </Field>

            <Field
              label="Link target"
              required
              hint={
                draft.linkType === "tab"
                  ? "home / library / audio / gallery"
                  : draft.linkType === "gallery-section"
                  ? "photos / pravachans / reels"
                  : draft.linkType === "route"
                  ? "Pick a built-in screen, or choose “Custom route…” for dynamic paths."
                  : "e.g. https://example.com"
              }
            >
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
              ) : (
                <Input
                  value={draft.linkTarget}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, linkTarget: e.target.value }))
                  }
                  placeholder="https://example.com"
                />
              )}
              {/* When "Custom route…" is selected, show a free-text input so
                  admins can enter dynamic routes like /news/abc123. */}
              {draft.linkType === "route" &&
                !ROUTE_TARGETS.some((r) => r.value === draft.linkTarget) && (
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
            </Field>

            <Field
              label="Ring color"
              hint="Hex color for the circle ring (optional)."
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.ringColor}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, ringColor: e.target.value }))
                  }
                  className="h-10 w-14 cursor-pointer rounded border border-neutral-300 bg-white"
                />
                <Input
                  value={draft.ringColor}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, ringColor: e.target.value }))
                  }
                  placeholder="#F4A261"
                />
              </div>
            </Field>

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

          <Field
            label="Circle image"
            hint="Optional — if you skip this, the app shows a beautiful religious fallback (lotus icon over the chosen ring color)."
          >
            <div className="flex items-center gap-4">
              {(imageFile || draft.imageUrl) && (
                <div
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2"
                  style={{ borderColor: draft.ringColor || "#F4A261" }}
                >
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

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : isEditing ? (
                <Save size={16} />
              ) : (
                <Plus size={16} />
              )}
              {isEditing ? "Save changes" : "Create story"}
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
        title="Home Stories"
        description="Newest order first. These appear at the top of the mobile Home screen."
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No stories yet"
            description="Use the form above to create your first home story circle."
          />
        ) : (
          <ul className="divide-y divide-neutral-200">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 py-3"
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2"
                  style={{ borderColor: item.ringColor || "#F4A261" }}
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-xl"
                      role="img"
                      aria-label="story fallback"
                    >
                      🪷
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-neutral-900">
                      {item.name}
                    </p>
                    {item.active === false && (
                      <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                        Hidden
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-neutral-500">
                    <span className="font-medium text-neutral-700">
                      {item.linkType}
                    </span>{" "}
                    → {item.linkTarget}
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    order {item.order ?? 0}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
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
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
