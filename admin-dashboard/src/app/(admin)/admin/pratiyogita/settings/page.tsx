"use client";

// Pratiyogita — reusable defaults the admin can drop into any new quiz.
// Stored at `quiz_settings/default_rules` and `quiz_settings/default_prize`.

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Award, ChevronLeft, ImageIcon, Loader2, Save, Upload } from "lucide-react";

import { db } from "@/lib/firebase";
import { deleteStorageObject, uploadFile } from "@/lib/uploads";
import { Banner, Button, Card, Field, Input, Textarea } from "@/lib/ui";

export default function PratiyogitaSettingsPage() {
  const [rules, setRules] = useState("");
  const [prizeTitle, setPrizeTitle] = useState("");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [prizeImageUrl, setPrizeImageUrl] = useState("");
  const [prizeImageStoragePath, setPrizeImageStoragePath] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [savingPrize, setSavingPrize] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await getDoc(doc(db, "quiz_settings", "default_rules"));
        const p = await getDoc(doc(db, "quiz_settings", "default_prize"));
        if (r.exists()) setRules((r.data().rules as string) ?? "");
        const prize = p.exists() ? (p.data().prize as Record<string, string>) : null;
        if (prize) {
          setPrizeTitle(prize.title ?? "");
          setPrizeDescription(prize.description ?? "");
          setPrizeImageUrl(prize.imageUrl ?? "");
          setPrizeImageStoragePath(prize.imageStoragePath ?? "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveRules() {
    setSavingRules(true);
    setMsg(null);
    try {
      await setDoc(
        doc(db, "quiz_settings", "default_rules"),
        { rules: rules.trim(), updatedAt: serverTimestamp() },
        { merge: true },
      );
      setMsg({ kind: "success", text: "Default rules saved." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setSavingRules(false);
    }
  }

  async function savePrize() {
    setSavingPrize(true);
    setMsg(null);
    try {
      await setDoc(
        doc(db, "quiz_settings", "default_prize"),
        {
          prize: {
            title: prizeTitle.trim(),
            description: prizeDescription.trim(),
            imageUrl: prizeImageUrl || null,
            imageStoragePath: prizeImageStoragePath || null,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setMsg({ kind: "success", text: "Default prize saved." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setSavingPrize(false);
    }
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setPct(0);
    if (prizeImageStoragePath) {
      try {
        await deleteStorageObject(prizeImageStoragePath);
      } catch {
        /* ignore */
      }
    }
    try {
      const { promise } = uploadFile({
        folder: "quizzes/prizes",
        file,
        onProgress: (p) => setPct(p.percent),
      });
      const r = await promise;
      setPrizeImageUrl(r.url);
      setPrizeImageStoragePath(r.storagePath);
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/pratiyogita"
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <ChevronLeft size={14} /> प्रतियोगिता पर वापस
      </Link>

      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

      <Card
        title="पूर्व-निर्धारित नियम"
        description="नई प्रतियोगिता बनाते समय ‘पूर्व-निर्धारित लाएँ’ बटन से उपयोग किए जाएँगे।"
        actions={
          <Button onClick={saveRules} disabled={savingRules}>
            {savingRules ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            नियम सहेजें
          </Button>
        }
      >
        <Field label="नियमों का पाठ">
          <Textarea
            rows={8}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder={`1. एक बार ही उत्तर सबमिट करें।\n2. विजेता घोषणा रात्रि 10 बजे।\n3. परिणाम का निर्णय अंतिम होगा।`}
          />
        </Field>
      </Card>

      <Card
        title="पूर्व-निर्धारित पुरस्कार"
        description="चालू टैब पर दिखाया जाता है; प्रत्येक प्रतियोगिता में बदला जा सकता है।"
        actions={
          <Button onClick={savePrize} disabled={savingPrize}>
            {savingPrize ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            पुरस्कार सहेजें
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <Field label="पुरस्कार शीर्षक">
              <Input
                value={prizeTitle}
                onChange={(e) => setPrizeTitle(e.target.value)}
                placeholder="चाँदी का सिक्का"
              />
            </Field>
            <Field label="पुरस्कार विवरण">
              <Textarea
                rows={4}
                value={prizeDescription}
                onChange={(e) => setPrizeDescription(e.target.value)}
                placeholder="शीर्ष 3 विजेताओं को…"
              />
            </Field>
          </div>
          <Field label="पुरस्कार चित्र" hint="वैकल्पिक, अधिकतम 10 MB।">
            {prizeImageUrl ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={prizeImageUrl}
                  alt=""
                  className="h-40 w-40 rounded-lg border border-neutral-200 object-cover"
                />
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-saffron/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-saffron/25">
                    <Upload size={14} /> बदलें
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImage}
                      disabled={uploading}
                    />
                  </label>
                  <Button
                    variant="danger"
                    onClick={async () => {
                      if (prizeImageStoragePath) {
                        try {
                          await deleteStorageObject(prizeImageStoragePath);
                        } catch {
                          /* ignore */
                        }
                      }
                      setPrizeImageUrl("");
                      setPrizeImageStoragePath("");
                    }}
                  >
                    हटाएँ
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex h-40 w-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-cream text-neutral-500 hover:border-primary hover:text-primary">
                <ImageIcon size={22} />
                <Award size={14} />
                <span className="text-[11px] font-semibold">चित्र जोड़ें</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImage}
                  disabled={uploading}
                />
              </label>
            )}
            {uploading && (
              <div className="mt-2 text-xs text-neutral-500">
                अपलोड हो रहा है… {pct.toFixed(0)}%
              </div>
            )}
          </Field>
        </div>
      </Card>
    </div>
  );
}
