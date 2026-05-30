"use client";

// Admin editor for the mobile Jaap (japa / mala) screen's mantra list.
// Stored at Firestore `app_config/jaap_mantras` as { mantras: JaapMantra[] }.

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  Loader2,
  Music,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Volume2,
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

type JaapMantra = {
  id: string;
  label: string;
  text: string;
  audioUrl?: string;
  audioStoragePath?: string;
};

const DEFAULT_JAAP_MANTRAS: JaapMantra[] = [
  {
    id: "namokar",
    label: "णमोकार",
    text:
      "णमो अरिहंताणं\n" +
      "णमो सिद्धाणं\n" +
      "णमो आयरियाणं\n" +
      "णमो उवज्झायाणं\n" +
      "णमो लोए सव्व साहूणं",
  },
  { id: "om", label: "ॐ", text: "ॐ" },
  { id: "arham", label: "अर्हम्", text: "अर्हम्" },
  { id: "siddha", label: "सिद्ध", text: "णमो सिद्धाणं" },
];

export function JaapMantrasEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mantras, setMantras] = useState<JaapMantra[]>([]);
  // Per-row upload progress, keyed by row index.
  const [uploadProgress, setUploadProgress] = useState<
    Record<number, UploadProgress>
  >({});
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  // One hidden <input type="file"> per row.
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setLoading(true);
    getDoc(doc(db, "app_config", "jaap_mantras"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as { mantras?: JaapMantra[] };
          setMantras(
            Array.isArray(data.mantras) && data.mantras.length > 0
              ? data.mantras
              : DEFAULT_JAAP_MANTRAS,
          );
        } else {
          setMantras(DEFAULT_JAAP_MANTRAS);
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  function updateMantra(idx: number, patch: Partial<JaapMantra>) {
    setMantras((list) =>
      list.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    );
    setSuccess(null);
  }

  function removeMantra(idx: number) {
    if (!confirm("Remove this mantra from the list?")) return;
    setMantras((list) => list.filter((_, i) => i !== idx));
    setSuccess(null);
  }

  function moveMantra(idx: number, dir: -1 | 1) {
    setMantras((list) => {
      const next = [...list];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return list;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setSuccess(null);
  }

  function addMantra() {
    setMantras((list) => [
      ...list,
      { id: `mantra-${Date.now()}`, label: "", text: "" },
    ]);
    setSuccess(null);
  }

  async function handleAudioPick(
    idx: number,
    e: ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so the same file can be re-selected after removal.
    if (fileInputRefs.current[idx]) {
      fileInputRefs.current[idx]!.value = "";
    }
    setError(null);
    setSuccess(null);
    setUploadingIdx(idx);

    const oldPath = mantras[idx]?.audioStoragePath;

    try {
      const { promise } = uploadFile({
        folder: "app_config/jaap_mantras",
        file,
        onProgress: (p) =>
          setUploadProgress((prev) => ({ ...prev, [idx]: p })),
      });
      const res = await promise;
      setMantras((list) =>
        list.map((m, i) =>
          i === idx
            ? { ...m, audioUrl: res.url, audioStoragePath: res.storagePath }
            : m,
        ),
      );
      if (oldPath && oldPath !== res.storagePath) {
        deleteStorageObject(oldPath).catch(() => {});
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingIdx(null);
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[idx];
        return next;
      });
    }
  }

  function handleAudioRemove(idx: number) {
    if (!confirm("Remove the audio for this mantra?")) return;
    const oldPath = mantras[idx]?.audioStoragePath;
    setMantras((list) =>
      list.map((m, i) =>
        i === idx
          ? { ...m, audioUrl: undefined, audioStoragePath: undefined }
          : m,
      ),
    );
    if (oldPath) deleteStorageObject(oldPath).catch(() => {});
    setSuccess(null);
  }

  function resetToDefaults() {
    if (
      !confirm(
        "Replace the current list with the built-in defaults? Your custom mantras will be lost.",
      )
    ) {
      return;
    }
    setMantras(DEFAULT_JAAP_MANTRAS);
    setSuccess(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleaned: JaapMantra[] = [];
    const seenIds = new Set<string>();
    for (const m of mantras) {
      const id = (m.id || "").trim();
      const label = (m.label || "").trim();
      const text = (m.text || "").trim();
      if (!id || !label || !text) {
        setError(
          "Each mantra needs an id, a chip label, and the full mantra text.",
        );
        return;
      }
      if (seenIds.has(id)) {
        setError(`Duplicate mantra id "${id}". Each id must be unique.`);
        return;
      }
      seenIds.add(id);
      cleaned.push({
        id,
        label,
        text,
        ...(m.audioUrl ? { audioUrl: m.audioUrl } : {}),
        ...(m.audioStoragePath
          ? { audioStoragePath: m.audioStoragePath }
          : {}),
      });
    }
    if (cleaned.length === 0) {
      setError("Please add at least one mantra.");
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "app_config", "jaap_mantras"),
        { mantras: cleaned, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setMantras(cleaned);
      setSuccess(
        "Jaap mantras saved. Devotees' apps will update on next open.",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Jaap Mantras"
      description="Configure the mantra chips shown on the mobile Jaap (japa / mala) screen. The order here is the order devotees see; the first item is selected by default."
      actions={
        <span className="flex items-center gap-1 rounded-full bg-saffron/15 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles size={14} /> Jaap
        </span>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {mantras.length === 0 ? (
            <EmptyState
              title="No mantras yet"
              description="Add a mantra to show on the mobile Jaap screen."
            />
          ) : (
            <ul className="space-y-3">
              {mantras.map((m, idx) => (
                <li
                  key={idx}
                  className="rounded-xl border border-neutral-200 bg-white p-3"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveMantra(idx, -1)}
                        disabled={idx === 0}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <span className="text-xs font-semibold text-neutral-400">
                        {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveMantra(idx, 1)}
                        disabled={idx === mantras.length - 1}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Field label="Chip label" hint="Short text on the chip">
                          <Input
                            value={m.label}
                            onChange={(e) =>
                              updateMantra(idx, { label: e.target.value })
                            }
                            placeholder="णमोकार"
                          />
                        </Field>
                        <Field label="Internal id" hint="Lowercase, no spaces">
                          <Input
                            value={m.id}
                            onChange={(e) =>
                              updateMantra(idx, {
                                id: e.target.value.replace(/\s+/g, "_"),
                              })
                            }
                            placeholder="namokar"
                          />
                        </Field>
                      </div>
                      <Field
                        label="Mantra text"
                        hint="Shown inside the counter ring. Press Enter for line breaks."
                      >
                        <Textarea
                          value={m.text}
                          onChange={(e) =>
                            updateMantra(idx, { text: e.target.value })
                          }
                          rows={Math.max(2, m.text.split("\n").length)}
                          placeholder={"णमो अरिहंताणं\nणमो सिद्धाणं\n…"}
                        />
                      </Field>

                      <Field
                        label="Mantra audio (optional)"
                        hint="MP3 / M4A / WAV recitation. Loops continuously on the mobile Jaap screen."
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            ref={(el) => {
                              fileInputRefs.current[idx] = el;
                            }}
                            type="file"
                            accept="audio/*"
                            onChange={(e) => handleAudioPick(idx, e)}
                            className="hidden"
                          />
                          <Button
                            variant="secondary"
                            onClick={() =>
                              fileInputRefs.current[idx]?.click()
                            }
                            disabled={uploadingIdx === idx}
                          >
                            {uploadingIdx === idx ? (
                              <Loader2
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <Music size={14} />
                            )}
                            {m.audioUrl ? "Replace audio" : "Upload audio"}
                          </Button>

                          {m.audioUrl && (
                            <>
                              <audio
                                src={m.audioUrl}
                                controls
                                preload="none"
                                className="h-9 max-w-[260px]"
                              />
                              <button
                                type="button"
                                onClick={() => handleAudioRemove(idx)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                              >
                                <X size={12} /> Remove
                              </button>
                            </>
                          )}

                          {uploadingIdx === idx && uploadProgress[idx] && (
                            <span className="text-xs text-neutral-500">
                              Uploading…{" "}
                              {Math.round(uploadProgress[idx].percent)}%
                            </span>
                          )}

                          {!m.audioUrl && uploadingIdx !== idx && (
                            <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                              <Volume2 size={12} /> No audio yet
                            </span>
                          )}
                        </div>
                      </Field>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeMantra(idx)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      aria-label="Remove mantra"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={addMantra}>
              <Plus size={16} /> Add mantra
            </Button>
            <Button variant="ghost" onClick={resetToDefaults}>
              Reset to defaults
            </Button>
          </div>

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
