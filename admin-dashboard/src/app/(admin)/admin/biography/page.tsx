"use client";

// filepath: /Users/a200200348/Documents/AajaPadteHai/GeyMatiMataJiApp/admin-dashboard/src/app/(admin)/admin/biography/page.tsx
// Single-document editor for the saint's biography stored at
// `app_config/biography`. Supports hero image, audio intro and an
// achievement gallery via Firebase Storage uploads.

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  Image as ImageIcon,
  Loader2,
  Music,
  Plus,
  Save,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import {
  Banner,
  Button,
  Card,
  Field,
  Input,
  Textarea,
} from "@/lib/ui";
import {
  deleteStorageObject,
  uploadFile,
  type UploadProgress,
} from "@/lib/uploads";

/* -------------------------------- Types -------------------------------- */

type AudioAsset = { title?: string; url?: string; storagePath?: string };
type Chaturmas = { year: string; location: string };
type AchievementImg = { url: string; storagePath?: string; caption?: string };

type BasicDetails = {
  formerName?: string;
  parents?: string;
  city?: string;
  birthPlace?: string;
  dob?: string;
  timeOfBirth?: string;
  education?: string;
  family?: string;
  vairagyaInspiration?: string;
  brahmacharyaVratDate?: string;
  dikshaDate?: string;
  dikshaPlace?: string;
  dikshaGuru?: string;
  interests?: string;
};

type BioDraft = {
  heroImageUrl?: string;
  heroImageStoragePath?: string;
  designations: string[];
  basicDetails: BasicDetails;
  chaturmasList: Chaturmas[];
  spiritualJourney: string[];
  teachings: string[];
  achievementImages: AchievementImg[];
  introAudio: AudioAsset;
  footerQuote?: string;
  footerQuoteAuthor?: string;
};

const EMPTY: BioDraft = {
  heroImageUrl: "",
  heroImageStoragePath: "",
  designations: [""],
  basicDetails: {},
  chaturmasList: [{ year: "", location: "" }],
  spiritualJourney: [""],
  teachings: [""],
  achievementImages: [],
  introAudio: { title: "परिचय" },
  footerQuote: "",
  footerQuoteAuthor: "",
};

const BASIC_FIELDS: {
  key: keyof BasicDetails;
  label: string;
  placeholder?: string;
}[] = [
  { key: "formerName", label: "Former Name (पूर्व नाम)" },
  { key: "parents", label: "Parents (माता-पिता)" },
  { key: "city", label: "City (नगर)" },
  { key: "birthPlace", label: "Birth Place (जन्म स्थान)" },
  { key: "dob", label: "DOB (जन्म तिथि)" },
  { key: "timeOfBirth", label: "Time of Birth (जन्म समय)" },
  { key: "education", label: "Education (शिक्षा)" },
  { key: "family", label: "Family (परिवार)" },
  { key: "vairagyaInspiration", label: "Vairagya Inspiration (वैराग्य प्रेरणा)" },
  { key: "brahmacharyaVratDate", label: "Brahmacharya Vrat Date (ब्रह्मचर्य व्रत तिथि)" },
  { key: "dikshaDate", label: "Diksha Date (दीक्षा तिथि)" },
  { key: "dikshaPlace", label: "Diksha Place (दीक्षा स्थल)" },
  { key: "dikshaGuru", label: "Diksha Guru (दीक्षा गुरु)" },
  { key: "interests", label: "Interests (रुचियाँ)" },
];

/* ------------------------------- Helpers ------------------------------- */

function setAt<T>(arr: T[], index: number, value: T): T[] {
  const next = arr.slice();
  next[index] = value;
  return next;
}

function removeAt<T>(arr: T[], index: number): T[] {
  return arr.filter((_, i) => i !== index);
}

/* --------------------------------- Page -------------------------------- */

export default function BiographyAdminPage() {
  const [draft, setDraft] = useState<BioDraft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroProgress, setHeroProgress] = useState<UploadProgress | null>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioProgress, setAudioProgress] = useState<UploadProgress | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const achInputRef = useRef<HTMLInputElement>(null);
  const [achUploading, setAchUploading] = useState(false);
  const [achProgress, setAchProgress] = useState<UploadProgress | null>(null);

  useEffect(() => {
    setLoading(true);
    getDoc(doc(db, "app_config", "biography"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<BioDraft>;
          setDraft({
            ...EMPTY,
            ...data,
            designations:
              data.designations && data.designations.length > 0
                ? data.designations
                : [""],
            basicDetails: data.basicDetails ?? {},
            chaturmasList:
              data.chaturmasList && data.chaturmasList.length > 0
                ? data.chaturmasList
                : [{ year: "", location: "" }],
            spiritualJourney:
              data.spiritualJourney && data.spiritualJourney.length > 0
                ? data.spiritualJourney
                : [""],
            teachings:
              data.teachings && data.teachings.length > 0
                ? data.teachings
                : [""],
            achievementImages: data.achievementImages ?? [],
            introAudio: data.introAudio ?? { title: "परिचय" },
          });
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  /* --------------------------- Upload handlers --------------------------- */

  function onPickHero(e: ChangeEvent<HTMLInputElement>) {
    setHeroFile(e.target.files?.[0] || null);
  }

  function onPickAudio(e: ChangeEvent<HTMLInputElement>) {
    setAudioFile(e.target.files?.[0] || null);
  }

  async function uploadAchievementFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError(null);
    setAchUploading(true);
    try {
      const uploaded: AchievementImg[] = [];
      for (const file of files) {
        const { promise } = uploadFile({
          folder: "app_config/biography/achievements",
          file,
          onProgress: setAchProgress,
        });
        const r = await promise;
        uploaded.push({ url: r.url, storagePath: r.storagePath });
      }
      setDraft((d) => ({
        ...d,
        achievementImages: [...d.achievementImages, ...uploaded],
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAchUploading(false);
      setAchProgress(null);
      if (achInputRef.current) achInputRef.current.value = "";
    }
  }

  async function removeAchievementAt(index: number) {
    const item = draft.achievementImages[index];
    if (!confirm("Remove this achievement image?")) return;
    if (item?.storagePath) {
      deleteStorageObject(item.storagePath).catch(() => {});
    }
    setDraft((d) => ({
      ...d,
      achievementImages: removeAt(d.achievementImages, index),
    }));
  }

  async function removeHero() {
    if (!confirm("Remove hero image?")) return;
    if (draft.heroImageStoragePath) {
      deleteStorageObject(draft.heroImageStoragePath).catch(() => {});
    }
    setDraft((d) => ({ ...d, heroImageUrl: "", heroImageStoragePath: "" }));
    setHeroFile(null);
    if (heroInputRef.current) heroInputRef.current.value = "";
  }

  async function removeAudio() {
    if (!confirm("Remove intro audio?")) return;
    if (draft.introAudio.storagePath) {
      deleteStorageObject(draft.introAudio.storagePath).catch(() => {});
    }
    setDraft((d) => ({
      ...d,
      introAudio: { title: d.introAudio.title || "परिचय" },
    }));
    setAudioFile(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
  }

  /* -------------------------------- Save -------------------------------- */

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      let heroImageUrl = draft.heroImageUrl;
      let heroImageStoragePath = draft.heroImageStoragePath;
      if (heroFile) {
        const oldPath = heroImageStoragePath;
        const { promise } = uploadFile({
          folder: "app_config/biography",
          file: heroFile,
          onProgress: setHeroProgress,
        });
        const r = await promise;
        heroImageUrl = r.url;
        heroImageStoragePath = r.storagePath;
        if (oldPath && oldPath !== heroImageStoragePath) {
          deleteStorageObject(oldPath).catch(() => {});
        }
      }

      let introAudio: AudioAsset = {
        ...draft.introAudio,
        title: draft.introAudio.title?.trim() || "परिचय",
      };
      if (audioFile) {
        const oldPath = introAudio.storagePath;
        const { promise } = uploadFile({
          folder: "app_config/biography/audio",
          file: audioFile,
          onProgress: setAudioProgress,
        });
        const r = await promise;
        introAudio = {
          title: introAudio.title,
          url: r.url,
          storagePath: r.storagePath,
        };
        if (oldPath && oldPath !== r.storagePath) {
          deleteStorageObject(oldPath).catch(() => {});
        }
      }

      const payload = {
        heroImageUrl: heroImageUrl || null,
        heroImageStoragePath: heroImageStoragePath || null,
        designations: draft.designations.map((s) => s.trim()).filter(Boolean),
        basicDetails: Object.fromEntries(
          Object.entries(draft.basicDetails).map(([k, v]) => [
            k,
            (v || "").trim(),
          ])
        ),
        chaturmasList: draft.chaturmasList
          .map((c) => ({
            year: (c.year || "").trim(),
            location: (c.location || "").trim(),
          }))
          .filter((c) => c.year || c.location)
          // Sort newest year first (2026, 2025, …). Non-numeric years sink
          // to the bottom but keep their relative order.
          .sort((a, b) => {
            const ya = parseInt(a.year, 10);
            const yb = parseInt(b.year, 10);
            const aNum = Number.isFinite(ya);
            const bNum = Number.isFinite(yb);
            if (aNum && bNum) return yb - ya;
            if (aNum) return -1;
            if (bNum) return 1;
            return 0;
          }),
        spiritualJourney: draft.spiritualJourney
          .map((s) => s.trim())
          .filter(Boolean),
        teachings: draft.teachings.map((s) => s.trim()).filter(Boolean),
        achievementImages: draft.achievementImages,
        introAudio,
        footerQuote: draft.footerQuote?.trim() || null,
        footerQuoteAuthor: draft.footerQuoteAuthor?.trim() || null,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "app_config", "biography"), payload, {
        merge: true,
      });

      setDraft((d) => ({
        ...d,
        heroImageUrl,
        heroImageStoragePath,
        introAudio,
      }));
      setHeroFile(null);
      setAudioFile(null);
      if (heroInputRef.current) heroInputRef.current.value = "";
      if (audioInputRef.current) audioInputRef.current.value = "";
      setSuccess("Biography saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
      setHeroProgress(null);
      setAudioProgress(null);
    }
  }

  /* ------------------------------- Render ------------------------------- */

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary sm:text-2xl">
          <User size={24} /> Biography
        </h1>
        <p className="text-sm text-neutral-600">
          One document at <code>app_config/biography</code>. Used by the
          mobile Biography screen.
        </p>
      </header>

      {error && <Banner kind="error">{error}</Banner>}
      {success && <Banner kind="success">{success}</Banner>}

      {/* Hero image */}
      <Card
        title="Hero Image"
        description="Profile portrait shown at the top of the biography."
      >
        <div className="flex items-start gap-4">
          {(heroFile || draft.heroImageUrl) && (
            <div className="h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-cream">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  heroFile
                    ? URL.createObjectURL(heroFile)
                    : draft.heroImageUrl!
                }
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <input
              ref={heroInputRef}
              type="file"
              accept="image/*"
              onChange={onPickHero}
              className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-saffron/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-saffron/30"
            />
            {heroProgress && (
              <p className="text-xs text-neutral-500">
                Uploading… {Math.round(heroProgress.percent)}%
              </p>
            )}
            {(heroFile || draft.heroImageUrl) && (
              <button
                type="button"
                onClick={removeHero}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
              >
                <X size={12} /> Remove
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Designations */}
      <Card
        title="Designations"
        description="Titles stacked under the name (in display order)."
      >
        <ArrayStringEditor
          values={draft.designations}
          onChange={(designations) =>
            setDraft((d) => ({ ...d, designations }))
          }
          placeholder="e.g. प.पूज्य राष्ट्र गौरव"
          addLabel="Add designation"
        />
      </Card>

      {/* Basic details */}
      <Card
        title="Basic Details"
        description="Personal information shown in the structured table."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {BASIC_FIELDS.map(({ key, label }) => (
            <Field key={key} label={label}>
              <Input
                value={draft.basicDetails[key] ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    basicDetails: {
                      ...d.basicDetails,
                      [key]: e.target.value,
                    },
                  }))
                }
              />
            </Field>
          ))}
        </div>
      </Card>

      {/* Chaturmas list */}
      <Card
        title="Chaturmas List"
        description="Year-wise locations of past Chaturmas."
      >
        <div className="space-y-2">
          {draft.chaturmasList.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                value={row.year}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    chaturmasList: setAt(d.chaturmasList, i, {
                      ...row,
                      year: e.target.value,
                    }),
                  }))
                }
                placeholder="2024"
                className="max-w-[140px]"
              />
              <Input
                value={row.location}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    chaturmasList: setAt(d.chaturmasList, i, {
                      ...row,
                      location: e.target.value,
                    }),
                  }))
                }
                placeholder="Location"
                className="flex-1 min-w-[200px]"
              />
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    chaturmasList: removeAt(d.chaturmasList, i),
                  }))
                }
                className="rounded-md p-2 text-red-600 hover:bg-red-50"
                aria-label="Remove row"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                chaturmasList: [...d.chaturmasList, { year: "", location: "" }],
              }))
            }
          >
            <Plus size={14} /> Add Chaturmas
          </Button>
        </div>
      </Card>

      {/* Spiritual journey */}
      <Card
        title="Spiritual Journey"
        description="Long-form paragraphs in display order."
      >
        <ArrayStringEditor
          values={draft.spiritualJourney}
          onChange={(spiritualJourney) =>
            setDraft((d) => ({ ...d, spiritualJourney }))
          }
          placeholder="A paragraph from her spiritual journey…"
          addLabel="Add paragraph"
          multiline
        />
      </Card>

      {/* Teachings */}
      <Card title="Teachings" description="Notable quotes / teachings.">
        <ArrayStringEditor
          values={draft.teachings}
          onChange={(teachings) => setDraft((d) => ({ ...d, teachings }))}
          placeholder="A teaching or quote…"
          addLabel="Add teaching"
          multiline
        />
      </Card>

      {/* Achievement gallery */}
      <Card
        title="Achievements Gallery"
        description="Photos of awards, honours and achievements."
      >
        <div className="space-y-3">
          {draft.achievementImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {draft.achievementImages.map((img, i) => (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-cream"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeAchievementAt(i)}
                    className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:block"
                    aria-label="Remove"
                  >
                    <X size={14} />
                  </button>
                  <Input
                    value={img.caption ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        achievementImages: setAt(d.achievementImages, i, {
                          ...img,
                          caption: e.target.value,
                        }),
                      }))
                    }
                    placeholder="Caption (optional)"
                    className="rounded-none border-0 border-t border-neutral-200 text-xs"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              ref={achInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={uploadAchievementFiles}
              className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-saffron/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-saffron/30"
            />
            {achUploading ? (
              <span className="flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 size={14} className="animate-spin" />
                {achProgress
                  ? `${Math.round(achProgress.percent)}%`
                  : "Uploading…"}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-neutral-500">
                <ImageIcon size={14} /> Upload multiple
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Intro audio */}
      <Card
        title="Intro Audio (परिचय)"
        description="MP3 played on the biography screen."
      >
        <div className="space-y-3">
          <Field label="Audio title">
            <Input
              value={draft.introAudio.title ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  introAudio: { ...d.introAudio, title: e.target.value },
                }))
              }
              placeholder="परिचय"
            />
          </Field>
          {draft.introAudio.url && !audioFile ? (
            <audio
              controls
              src={draft.introAudio.url}
              className="w-full"
            />
          ) : null}
          <div className="flex items-center gap-3">
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={onPickAudio}
              className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-saffron/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-saffron/30"
            />
            <Music size={16} className="text-saffron" />
          </div>
          {audioFile && (
            <p className="text-xs text-neutral-500">
              New file: <strong>{audioFile.name}</strong> — will replace on save.
            </p>
          )}
          {audioProgress && (
            <p className="text-xs text-neutral-500">
              Uploading… {Math.round(audioProgress.percent)}%
            </p>
          )}
          {(audioFile || draft.introAudio.url) && (
            <button
              type="button"
              onClick={removeAudio}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
            >
              <X size={12} /> Remove audio
            </button>
          )}
        </div>
      </Card>

      {/* Footer quote */}
      <Card
        title="Footer Quote"
        description="Closing quote with attribution."
      >
        <div className="space-y-3">
          <Field label="Quote">
            <Textarea
              rows={3}
              value={draft.footerQuote ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, footerQuote: e.target.value }))
              }
              placeholder="संयम ही जीवन है…"
            />
          </Field>
          <Field label="Author">
            <Input
              value={draft.footerQuoteAuthor ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  footerQuoteAuthor: e.target.value,
                }))
              }
              placeholder="— Dr. ज्ञेयश्री माताजी"
            />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Save Biography
        </Button>
      </div>
    </form>
  );
}

/* --------------------- Reusable array-of-strings editor ------------------ */

function ArrayStringEditor({
  values,
  onChange,
  placeholder,
  addLabel,
  multiline,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-start gap-2">
          {multiline ? (
            <Textarea
              value={v}
              rows={3}
              onChange={(e) => onChange(setAt(values, i, e.target.value))}
              placeholder={placeholder}
              className="flex-1"
            />
          ) : (
            <Input
              value={v}
              onChange={(e) => onChange(setAt(values, i, e.target.value))}
              placeholder={placeholder}
              className="flex-1"
            />
          )}
          <button
            type="button"
            onClick={() => onChange(removeAt(values, i))}
            className="mt-1 rounded-md p-2 text-red-600 hover:bg-red-50"
            aria-label="Remove"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...values, ""])}
      >
        <Plus size={14} /> {addLabel}
      </Button>
    </div>
  );
}
