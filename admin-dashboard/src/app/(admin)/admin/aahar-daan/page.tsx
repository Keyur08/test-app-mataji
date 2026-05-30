"use client";

// Aahar Daan QR — single-doc config edited at `app_config/aahar_daan`.
// Admins upload the QR image and customise the Devanagari title/subtitle/
// description shown on the mobile Home screen card.

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { Loader2, QrCode, Save, Trash2, Upload, X } from "lucide-react";

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

type ConfigDoc = {
  qrImageUrl?: string;
  qrImageStoragePath?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  downloadLabel?: string;
  updatedAt?: Timestamp;
};

const DEFAULTS = {
  title: "आहार दान",
  subtitle: "साध्वी माताजी के आहार दान में सहभागी बनें",
  description:
    "आहार दान — दान का सर्वोच्च रूप। QR कोड स्कैन करें और पुण्य के भागी बनें।",
  downloadLabel: "QR डाउनलोड करें",
};

export default function AaharDaanConfigPage() {
  const [config, setConfig] = useState<ConfigDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({
    title: DEFAULTS.title,
    subtitle: DEFAULTS.subtitle,
    description: DEFAULTS.description,
    downloadLabel: DEFAULTS.downloadLabel,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "app_config", "aahar_daan"),
      (snap) => {
        const data = snap.exists() ? (snap.data() as ConfigDoc) : null;
        setConfig(data);
        if (data) {
          setDraft({
            title: data.title || DEFAULTS.title,
            subtitle: data.subtitle || DEFAULTS.subtitle,
            description: data.description || DEFAULTS.description,
            downloadLabel: data.downloadLabel || DEFAULTS.downloadLabel,
          });
        }
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    setImageFile(e.target.files?.[0] || null);
  }

  /** Clear the pending file selection (does not touch the saved doc). */
  function clearPendingImage() {
    setImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  /** Remove the currently-saved QR image from Firestore + Storage. */
  async function removeSavedImage() {
    if (!config?.qrImageUrl && !config?.qrImageStoragePath) return;
    if (
      !confirm(
        "Remove the saved QR image? The mobile card will hide the QR until a new one is uploaded.",
      )
    ) {
      return;
    }
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const oldPath = config?.qrImageStoragePath;
      await setDoc(
        doc(db, "app_config", "aahar_daan"),
        {
          qrImageUrl: null,
          qrImageStoragePath: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      if (oldPath) {
        deleteStorageObject(oldPath).catch(() => {});
      }
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setSuccess("QR image removed.");
    } catch (err) {
      setError((err as Error).message || "Failed to remove image.");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    try {
      let qrImageUrl = config?.qrImageUrl;
      let qrImageStoragePath = config?.qrImageStoragePath;

      if (imageFile) {
        const oldPath = qrImageStoragePath;
        const { promise } = uploadFile({
          folder: "app_config/aahar_daan",
          file: imageFile,
          onProgress: setProgress,
        });
        const uploaded = await promise;
        qrImageUrl = uploaded.url;
        qrImageStoragePath = uploaded.storagePath;
        if (oldPath && oldPath !== qrImageStoragePath) {
          deleteStorageObject(oldPath).catch(() => {});
        }
      }

      const payload = {
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        description: draft.description.trim(),
        downloadLabel: draft.downloadLabel.trim() || DEFAULTS.downloadLabel,
        qrImageUrl: qrImageUrl,
        qrImageStoragePath: qrImageStoragePath,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "app_config", "aahar_daan"), payload, {
        merge: true,
      });
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setSuccess("Saved.");
    } catch (err) {
      setError((err as Error).message || "Failed to save.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="Aahar Daan QR"
        description="Configurable card shown on the mobile Home screen. Upload the QR image and edit the Devanagari text."
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Banner kind="error">{error}</Banner>}
            {success && <Banner kind="success">{success}</Banner>}

            <Field
              label="QR code image"
              hint="Square PNG/JPG works best. Will be shown ~220×220 px in the app."
            >
              <div className="flex items-center gap-4">
                {(imageFile || config?.qrImageUrl) && (
                  <div className="h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        imageFile
                          ? URL.createObjectURL(imageFile)
                          : config!.qrImageUrl!
                      }
                      alt=""
                      className="h-full w-full object-contain"
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
                  {!config?.qrImageUrl && !imageFile && (
                    <p className="mt-1 text-xs text-amber-600">
                      No QR image uploaded yet — the card will hide the QR until
                      one is added.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3">
                    {imageFile && (
                      <button
                        type="button"
                        onClick={clearPendingImage}
                        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-primary hover:underline"
                      >
                        <X size={12} /> Cancel selection
                      </button>
                    )}
                    {config?.qrImageUrl && (
                      <button
                        type="button"
                        onClick={removeSavedImage}
                        disabled={saving}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Remove uploaded image
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Title" required>
                <Input
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  placeholder={DEFAULTS.title}
                  maxLength={50}
                />
              </Field>
              <Field label="Download button label">
                <Input
                  value={draft.downloadLabel}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, downloadLabel: e.target.value }))
                  }
                  placeholder={DEFAULTS.downloadLabel}
                  maxLength={40}
                />
              </Field>
            </div>

            <Field label="Subtitle">
              <Input
                value={draft.subtitle}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, subtitle: e.target.value }))
                }
                placeholder={DEFAULTS.subtitle}
                maxLength={100}
              />
            </Field>

            <Field label="Description">
              <Textarea
                rows={3}
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                placeholder={DEFAULTS.description}
                maxLength={400}
              />
            </Field>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Save changes
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Live preview */}
      <Card
        title="Preview"
        description="How the card will look on the mobile Home screen."
      >
        <div className="mx-auto max-w-sm rounded-3xl border border-saffron/40 bg-gradient-to-br from-[#FFF8F0] to-[#FCE9D2] p-6 shadow-lg">
          <div className="text-center text-3xl">🌸</div>
          <h3 className="mt-2 text-center text-2xl font-bold text-primary">
            {draft.title || DEFAULTS.title}
          </h3>
          {draft.subtitle && (
            <p className="mt-1 text-center text-sm font-medium text-saffron">
              {draft.subtitle}
            </p>
          )}
          {draft.description && (
            <p className="mt-3 text-center text-sm leading-relaxed text-neutral-700">
              {draft.description}
            </p>
          )}

          {(imageFile || config?.qrImageUrl) && (
            <div className="mt-4 flex justify-center">
              <div className="rounded-2xl border-2 border-saffron/40 bg-white p-3 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    imageFile
                      ? URL.createObjectURL(imageFile)
                      : config!.qrImageUrl!
                  }
                  alt="QR"
                  className="h-44 w-44 object-contain"
                />
              </div>
            </div>
          )}

          <p className="mt-3 text-center text-xs font-semibold text-primary">
            📲 स्कैन करें और दान करें
          </p>

          {(config?.qrImageUrl || imageFile) && (
            <div className="mt-4 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
                <QrCode size={16} />
                {draft.downloadLabel || DEFAULTS.downloadLabel}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
