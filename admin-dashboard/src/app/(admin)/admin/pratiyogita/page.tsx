"use client";

// Pratiyogita (Daily Quiz) — admin list view with create / edit modal,
// quick status pill, and links to per-quiz results dashboards. Reusable
// settings (default rules + prize) live at `/admin/pratiyogita/settings`.

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import {
  Award,
  CalendarClock,
  ChevronRight,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { deleteStorageObject, uploadFile } from "@/lib/uploads";
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

/* ------------------------------------------------------------------ */
/* Local types — mirror `shared/types.ts#Quiz` but use Firestore's
   admin-dashboard `Timestamp` for the date fields so we can use the
   built-in HTML datetime-local inputs. */

type Status = "upcoming" | "running" | "past";

type QuestionDraft = {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
};

type PrizeDraft = {
  title: string;
  description: string;
  imageUrl: string;
  imageStoragePath: string;
};

type QuizDoc = {
  id: string;
  date?: Timestamp;
  startsAt?: Timestamp;
  endsAt?: Timestamp;
  status: Status;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  rules?: string | null;
  prize?: {
    title?: string;
    description?: string;
    imageUrl?: string | null;
    imageStoragePath?: string | null;
  } | null;
  questions: QuestionDraft[];
  participantCount?: number;
  totalQuestions?: number;
};

type QuizSettings = {
  rules?: string;
  prize?: PrizeDraft;
};

const STATUS_BADGE: Record<Status, string> = {
  upcoming: "bg-amber-100 text-amber-800 border-amber-200",
  running: "bg-emerald-100 text-emerald-800 border-emerald-200",
  past: "bg-neutral-200 text-neutral-700 border-neutral-300",
};

const STATUS_LABEL: Record<Status, string> = {
  upcoming: "आगामी",
  running: "चालू",
  past: "पूर्ण",
};

/* ------------------------------------------------------------------ */

function newQuestion(): QuestionDraft {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `q_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    question: "",
    options: ["", ""],
    correctOptionIndex: 0,
    explanation: "",
  };
}

function toDatetimeLocal(ts?: Timestamp): string {
  const d = ts ? ts.toDate() : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function computeStatus(starts: Date, ends: Date, now = new Date()): Status {
  if (now < starts) return "upcoming";
  if (now > ends) return "past";
  return "running";
}

/* ============================================================================
 * Page
 * ========================================================================== */

export default function PratiyogitaPage() {
  const [items, setItems] = useState<QuizDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<QuizDoc | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "quizzes"), orderBy("startsAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as Omit<QuizDoc, "id">) }) as QuizDoc,
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
  function startEdit(item: QuizDoc) {
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
        title="प्रतियोगिता — दैनिक प्रश्नोत्तरी"
        description="प्रतिदिन की प्रश्नोत्तरी, नियम और पुरस्कार यहाँ से प्रकाशित करें। भक्तजन मोबाइल ऐप से भाग ले सकेंगे।"
        actions={
          <>
            <Link href="/admin/pratiyogita/settings">
              <Button variant="secondary">
                <Settings size={16} /> नियम व पुरस्कार
              </Button>
            </Link>
            <Button onClick={startCreate}>
              <Plus size={16} /> नई प्रतियोगिता
            </Button>
          </>
        }
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="अभी कोई प्रतियोगिता नहीं"
            description="‘नई प्रतियोगिता’ पर क्लिक करके पहली दैनिक प्रतियोगिता निर्धारित करें।"
          />
        ) : (
          <ul className="divide-y divide-neutral-200">
            {items.map((q) => (
              <QuizRow key={q.id} item={q} onEdit={() => startEdit(q)} />
            ))}
          </ul>
        )}
      </Card>

      {showForm && (
        <QuizForm initial={editing} onClose={closeForm} onSaved={closeForm} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function QuizRow({ item, onEdit }: { item: QuizDoc; onEdit: () => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !confirm(
        `“${item.title}” प्रतियोगिता हटाएँ?\n\nयह क्रिया स्थायी है — प्रश्न, कवर चित्र, पुरस्कार चित्र और सभी भक्तों के परिणाम (results) सब हट जाएँगे।`,
      )
    )
      return;
    setDeleting(true);
    try {
      // 1) Delete every result document under quizzes/{id}/results/* in
      //    chunks of 400 (Firestore batch hard-limit is 500). This is
      //    safe because the rules grant admins full read+delete access
      //    to the sub-collection.
      const resultsCol = collection(db, "quizzes", item.id, "results");
      // Keep looping in case there are more than one batch worth.
      // `getDocs` returns up to the natural collection size; we batch the
      // returned docs in groups of 400.
      const snap = await getDocs(resultsCol);
      const allDocs = snap.docs;
      for (let i = 0; i < allDocs.length; i += 400) {
        const batch = writeBatch(db);
        for (const d of allDocs.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
      }

      // 2) Remove cover + prize images from Storage (best-effort).
      if (item.imageStoragePath)
        await deleteStorageObject(item.imageStoragePath);
      if (item.prize?.imageStoragePath)
        await deleteStorageObject(item.prize.imageStoragePath);

      // 3) Finally, delete the parent quiz document.
      await deleteDoc(doc(db, "quizzes", item.id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const starts = item.startsAt?.toDate();
  const ends = item.endsAt?.toDate();

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-cream sm:h-20 sm:w-20">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-saffron">
              <Trophy size={22} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 sm:hidden">
          <RowHeader item={item} />
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 sm:block">
        <RowHeader item={item} />
      </div>

      <div className="flex flex-wrap gap-2 sm:flex-col sm:flex-nowrap">
        <Link
          href={`/admin/pratiyogita/${item.id}/results`}
          className="flex-1 sm:flex-none"
        >
          <Button variant="secondary" className="w-full sm:w-auto">
            परिणाम <ChevronRight size={14} />
          </Button>
        </Link>
        <Button
          variant="secondary"
          onClick={onEdit}
          className="flex-1 sm:w-auto sm:flex-none"
        >
          संपादन
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 sm:w-auto sm:flex-none"
        >
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

function RowHeader({ item }: { item: QuizDoc }) {
  const starts = item.startsAt?.toDate();
  const ends = item.endsAt?.toDate();
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 break-words text-sm font-semibold text-neutral-900">
          {item.title}
        </h3>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[item.status]}`}
        >
          {STATUS_LABEL[item.status]}
        </span>
      </div>
      {item.description && (
        <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">
          {item.description}
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
        {starts && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock size={11} /> {starts.toLocaleString()}
            {ends && ` → ${ends.toLocaleTimeString()}`}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Sparkles size={11} /> {item.questions?.length ?? 0} प्रश्न
        </span>
        <span className="inline-flex items-center gap-1">
          <Users size={11} /> {item.participantCount ?? 0} प्रतिभागी
        </span>
        {item.prize?.title && (
          <span className="inline-flex items-center gap-1 text-primary">
            <Award size={11} /> {item.prize.title}
          </span>
        )}
      </div>
    </>
  );
}

/* ============================================================================
 * Form
 * ========================================================================== */

type FormState = {
  title: string;
  description: string;
  startsAt: string; // datetime-local
  endsAt: string;
  imageUrl: string;
  imageStoragePath: string;
  rules: string;
  prizeTitle: string;
  prizeDescription: string;
  prizeImageUrl: string;
  prizeImageStoragePath: string;
  questions: QuestionDraft[];
};

function midnightTonightLocal(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function QuizForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: QuizDoc | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;

  const [form, setForm] = useState<FormState>(() => ({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    startsAt: initial?.startsAt
      ? toDatetimeLocal(initial.startsAt)
      : nowLocal(),
    endsAt: initial?.endsAt
      ? toDatetimeLocal(initial.endsAt)
      : midnightTonightLocal(),
    imageUrl: initial?.imageUrl ?? "",
    imageStoragePath: initial?.imageStoragePath ?? "",
    rules: initial?.rules ?? "",
    prizeTitle: initial?.prize?.title ?? "",
    prizeDescription: initial?.prize?.description ?? "",
    prizeImageUrl: initial?.prize?.imageUrl ?? "",
    prizeImageStoragePath: initial?.prize?.imageStoragePath ?? "",
    questions:
      initial?.questions && initial.questions.length > 0
        ? initial.questions.map((q) => ({ ...q }))
        : [newQuestion()],
  }));

  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverPct, setCoverPct] = useState(0);
  const [uploadingPrize, setUploadingPrize] = useState(false);
  const [prizePct, setPrizePct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  const heading = useMemo(
    () => (isEdit ? "प्रतियोगिता संपादित करें" : "नई प्रतियोगिता"),
    [isEdit],
  );

  /* ----------------- uploads ----------------- */

  async function uploadCover(
    file: File,
    folder: string,
    onProgress: (p: number) => void,
    onResult: (url: string, path: string) => void,
    onDone: () => void,
  ) {
    try {
      const { promise } = uploadFile({
        folder,
        file,
        onProgress: (p) => onProgress(p.percent),
      });
      const r = await promise;
      onResult(r.url, r.storagePath);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      onDone();
    }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingCover(true);
    setCoverPct(0);
    if (form.imageStoragePath) {
      try {
        await deleteStorageObject(form.imageStoragePath);
      } catch {
        /* ignore */
      }
    }
    await uploadCover(
      file,
      "quizzes/covers",
      setCoverPct,
      (url, path) =>
        setForm((f) => ({ ...f, imageUrl: url, imageStoragePath: path })),
      () => setUploadingCover(false),
    );
  }

  async function handlePrizeImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingPrize(true);
    setPrizePct(0);
    if (form.prizeImageStoragePath) {
      try {
        await deleteStorageObject(form.prizeImageStoragePath);
      } catch {
        /* ignore */
      }
    }
    await uploadCover(
      file,
      "quizzes/prizes",
      setPrizePct,
      (url, path) =>
        setForm((f) => ({
          ...f,
          prizeImageUrl: url,
          prizeImageStoragePath: path,
        })),
      () => setUploadingPrize(false),
    );
  }

  /* ----------------- defaults from settings ----------------- */

  async function loadDefaults() {
    setLoadingDefaults(true);
    try {
      const { getDoc, doc: docFn } = await import("firebase/firestore");
      const rulesSnap = await getDoc(docFn(db, "quiz_settings", "default_rules"));
      const prizeSnap = await getDoc(docFn(db, "quiz_settings", "default_prize"));
      const rules = (rulesSnap.data() as QuizSettings | undefined)?.rules;
      const prize = (prizeSnap.data() as QuizSettings | undefined)?.prize;
      setForm((f) => ({
        ...f,
        rules: rules ?? f.rules,
        prizeTitle: prize?.title ?? f.prizeTitle,
        prizeDescription: prize?.description ?? f.prizeDescription,
        prizeImageUrl: prize?.imageUrl ?? f.prizeImageUrl,
        prizeImageStoragePath: prize?.imageStoragePath ?? f.prizeImageStoragePath,
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingDefaults(false);
    }
  }

  /* ----------------- question helpers ----------------- */

  function patchQuestion(idx: number, patch: Partial<QuestionDraft>) {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    }));
  }
  function addOption(idx: number) {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) =>
        i === idx ? { ...q, options: [...q.options, ""] } : q,
      ),
    }));
  }
  function removeOption(idx: number, optIdx: number) {
    setForm((f) => ({
      ...f,
      questions: f.questions.map((q, i) => {
        if (i !== idx) return q;
        if (q.options.length <= 2) return q;
        const options = q.options.filter((_, k) => k !== optIdx);
        const correctOptionIndex =
          optIdx === q.correctOptionIndex
            ? 0
            : optIdx < q.correctOptionIndex
              ? q.correctOptionIndex - 1
              : q.correctOptionIndex;
        return { ...q, options, correctOptionIndex };
      }),
    }));
  }
  function addQuestion() {
    setForm((f) => ({ ...f, questions: [...f.questions, newQuestion()] }));
  }
  function removeQuestion(idx: number) {
    setForm((f) => ({
      ...f,
      questions:
        f.questions.length === 1
          ? f.questions
          : f.questions.filter((_, i) => i !== idx),
    }));
  }

  /* ----------------- submit ----------------- */

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) return setError("शीर्षक आवश्यक है।");

    const startsDate = new Date(form.startsAt);
    const endsDate = new Date(form.endsAt);
    if (isNaN(startsDate.getTime()) || isNaN(endsDate.getTime()))
      return setError("कृपया वैध आरंभ व समाप्ति समय चुनें।");
    if (endsDate <= startsDate)
      return setError("समाप्ति समय आरंभ के बाद होना चाहिए।");

    const cleanedQuestions: QuestionDraft[] = [];
    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i];
      if (!q.question.trim())
        return setError(`प्रश्न ${i + 1} रिक्त है।`);
      const options = q.options.map((o) => o.trim());
      if (options.length < 2)
        return setError(`प्रश्न ${i + 1} में कम-से-कम 2 विकल्प होने चाहिए।`);
      if (options.some((o) => !o))
        return setError(`प्रश्न ${i + 1} में कोई विकल्प रिक्त है।`);
      if (
        q.correctOptionIndex < 0 ||
        q.correctOptionIndex >= options.length
      )
        return setError(`प्रश्न ${i + 1} का सही उत्तर चुना नहीं गया।`);
      const explanation = q.explanation?.trim();
      cleanedQuestions.push({
        id: q.id,
        question: q.question.trim(),
        options,
        correctOptionIndex: q.correctOptionIndex,
        // Firestore rejects `undefined`; only include the field when present.
        ...(explanation ? { explanation } : {}),
      });
    }

    setSaving(true);
    try {
      const status = computeStatus(startsDate, endsDate);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        imageUrl: form.imageUrl || null,
        imageStoragePath: form.imageStoragePath || null,
        rules: form.rules.trim() || null,
        prize: form.prizeTitle.trim()
          ? {
              title: form.prizeTitle.trim(),
              description: form.prizeDescription.trim() || "",
              imageUrl: form.prizeImageUrl || null,
              imageStoragePath: form.prizeImageStoragePath || null,
            }
          : null,
        date: Timestamp.fromDate(startsDate),
        startsAt: Timestamp.fromDate(startsDate),
        endsAt: Timestamp.fromDate(endsDate),
        status,
        questions: cleanedQuestions,
        totalQuestions: cleanedQuestions.length,
        updatedAt: serverTimestamp(),
      };

      if (isEdit && initial) {
        await setDoc(doc(db, "quizzes", initial.id), payload, { merge: true });
      } else {
        await addDoc(collection(db, "quizzes"), {
          ...payload,
          participantCount: 0,
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

  /* ----------------- render ----------------- */

  return (
    <Modal
      open
      onClose={onClose}
      title={heading}
      description="चालू अवस्था में प्रश्न भक्तजनों को दिखेंगे; समाप्ति के बाद सही उत्तर भी प्रकट हो जाएँगे।"
      maxWidth="max-w-4xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            रद्द करें
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isEdit ? "परिवर्तन सहेजें" : "प्रकाशित करें"}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Banner kind="error">{error}</Banner>}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={loadDefaults}
            disabled={loadingDefaults}
          >
            {loadingDefaults ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            पूर्व-निर्धारित नियम व पुरस्कार लाएँ
          </Button>
          <span className="text-xs text-neutral-500">
            <code>/admin/pratiyogita/settings</code> से लिए जाएँगे।
          </span>
        </div>

        <Field label="शीर्षक" required>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="आज की पवित्र प्रतियोगिता"
            required
          />
        </Field>

        <Field label="विवरण" hint="कार्ड पर दिखने वाला संक्षिप्त परिचय।">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="आज के प्रवचन पर आधारित प्रश्नोत्तरी…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="आरंभ समय" required>
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              required
            />
          </Field>
          <Field label="समाप्ति समय" required hint="भक्तजन इसी समय तक उत्तर भेज सकेंगे।">
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              required
            />
          </Field>
        </div>

        {/* Cover */}
        <Field label="कवर चित्र" hint="अनुशंसित आकार (16:9), अधिकतम 10 MB।">
          {form.imageUrl ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.imageUrl}
                alt=""
                className="h-40 w-full max-w-md rounded-lg border border-neutral-200 object-cover"
              />
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-saffron/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-saffron/25">
                  <Upload size={14} /> बदलें
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverChange}
                    disabled={uploadingCover}
                  />
                </label>
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (form.imageStoragePath) {
                      try {
                        await deleteStorageObject(form.imageStoragePath);
                      } catch {
                        /* ignore */
                      }
                    }
                    setForm((f) => ({ ...f, imageUrl: "", imageStoragePath: "" }));
                  }}
                >
                  हटाएँ
                </Button>
              </div>
            </div>
          ) : (
            <label className="flex h-32 w-full max-w-md cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-cream text-neutral-500 hover:border-primary hover:text-primary">
              <ImageIcon size={22} />
              <span className="text-xs font-semibold">कवर चित्र चढ़ाएँ</span>
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
              अपलोड हो रहा है… {coverPct.toFixed(0)}%
            </div>
          )}
        </Field>

        {/* Rules */}
        <Field
          label="नियम"
          hint="मोबाइल स्क्रीन पर दिखाए जाएँगे। ऊपर ‘पूर्व-निर्धारित लाएँ’ बटन से टेम्पलेट लिया जा सकता है।"
        >
          <Textarea
            rows={4}
            value={form.rules}
            onChange={(e) => setForm({ ...form, rules: e.target.value })}
            placeholder={`1. एक बार ही उत्तर सबमिट करें।\n2. विजेता की घोषणा रात्रि में होगी।`}
          />
        </Field>

        {/* Prize */}
        <Card title="पुरस्कार" description="चालू टैब पर मुख्य रूप से दिखाया जाएगा।">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <Field label="पुरस्कार शीर्षक">
                <Input
                  value={form.prizeTitle}
                  onChange={(e) =>
                    setForm({ ...form, prizeTitle: e.target.value })
                  }
                  placeholder="चाँदी का सिक्का"
                />
              </Field>
              <Field label="पुरस्कार विवरण">
                <Textarea
                  rows={3}
                  value={form.prizeDescription}
                  onChange={(e) =>
                    setForm({ ...form, prizeDescription: e.target.value })
                  }
                  placeholder="शीर्ष 3 विजेताओं को…"
                />
              </Field>
            </div>
            <Field label="पुरस्कार चित्र" hint="वैकल्पिक, अधिकतम 10 MB।">
              {form.prizeImageUrl ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.prizeImageUrl}
                    alt=""
                    className="h-32 w-32 rounded-lg border border-neutral-200 object-cover"
                  />
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-saffron/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-saffron/25">
                      <Upload size={14} /> बदलें
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePrizeImage}
                        disabled={uploadingPrize}
                      />
                    </label>
                    <Button
                      variant="danger"
                      onClick={async () => {
                        if (form.prizeImageStoragePath) {
                          try {
                            await deleteStorageObject(form.prizeImageStoragePath);
                          } catch {
                            /* ignore */
                          }
                        }
                        setForm((f) => ({
                          ...f,
                          prizeImageUrl: "",
                          prizeImageStoragePath: "",
                        }));
                      }}
                    >
                      हटाएँ
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="flex h-32 w-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-cream text-neutral-500 hover:border-primary hover:text-primary">
                  <Award size={22} />
                  <span className="text-[11px] font-semibold">चित्र जोड़ें</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePrizeImage}
                    disabled={uploadingPrize}
                  />
                </label>
              )}
              {uploadingPrize && (
                <div className="mt-2 text-xs text-neutral-500">
                  अपलोड हो रहा है… {prizePct.toFixed(0)}%
                </div>
              )}
            </Field>
          </div>
        </Card>

        {/* Questions */}
        <Card
          title={`प्रश्न (${form.questions.length})`}
          description="बहु-विकल्पीय प्रश्न जोड़ें और सही उत्तर चिह्नित करें।"
          actions={
            <Button type="button" variant="secondary" onClick={addQuestion}>
              <Plus size={14} /> प्रश्न जोड़ें
            </Button>
          }
        >
          <ul className="space-y-4">
            {form.questions.map((q, i) => (
              <li
                key={q.id}
                className="rounded-xl border border-saffron/30 bg-cream/40 p-3 sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                    प्रश्न {i + 1}
                  </span>
                  {form.questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(i)}
                      className="rounded-full p-1 text-neutral-500 hover:bg-white hover:text-red-600"
                      aria-label="प्रश्न हटाएँ"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="mt-2">
                  <Textarea
                    rows={2}
                    value={q.question}
                    onChange={(e) =>
                      patchQuestion(i, { question: e.target.value })
                    }
                    placeholder="प्रश्न यहाँ लिखें…"
                  />
                </div>
                <ul className="mt-3 space-y-2">
                  {q.options.map((opt, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctOptionIndex === j}
                        onChange={() =>
                          patchQuestion(i, { correctOptionIndex: j })
                        }
                        className="h-4 w-4 shrink-0 accent-primary"
                        aria-label={`विकल्प ${j + 1} सही चिह्नित करें`}
                      />
                      <Input
                        value={opt}
                        onChange={(e) =>
                          patchQuestion(i, {
                            options: q.options.map((o, k) =>
                              k === j ? e.target.value : o,
                            ),
                          })
                        }
                        placeholder={`विकल्प ${j + 1}`}
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(i, j)}
                          className="rounded-full p-1 text-neutral-500 hover:bg-white hover:text-red-600"
                          aria-label="विकल्प हटाएँ"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => addOption(i)}
                    disabled={q.options.length >= 6}
                  >
                    <Plus size={12} /> विकल्प जोड़ें
                  </Button>
                  <span className="text-[11px] text-neutral-500">
                    सही उत्तर: विकल्प {q.correctOptionIndex + 1}
                  </span>
                </div>
                <div className="mt-2">
                  <Field label="व्याख्या (वैकल्पिक)">
                    <Input
                      value={q.explanation ?? ""}
                      onChange={(e) =>
                        patchQuestion(i, { explanation: e.target.value })
                      }
                      placeholder="समाप्ति के बाद उत्तर-पत्र पर दिखाई जाएगी।"
                    />
                  </Field>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </form>
    </Modal>
  );
}
