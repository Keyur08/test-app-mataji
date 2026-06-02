"use client";

// Pratiyogita — per-quiz results dashboard (Hindi). Shows ranking, score
// distribution, top winners and a per-devotee answer viewer. Admin SDK
// rights aren't needed: the security rules let admins list
// `quizzes/{id}/results`.

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import {
  Award,
  Check,
  ChevronLeft,
  Crown,
  Eye,
  Loader2,
  Trophy,
  Users,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { Banner, Card, EmptyState, Modal } from "@/lib/ui";

type Result = {
  id: string;
  mobile: string;
  name?: string;
  uid: string;
  answers: Record<string, number>;
  score: number;
  total: number;
  durationMs?: number;
  submittedAt?: Timestamp;
};

type Question = {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
};

type Quiz = {
  id: string;
  title: string;
  status: "upcoming" | "running" | "past";
  participantCount?: number;
  totalQuestions?: number;
  questions?: Question[];
  startsAt?: Timestamp;
  endsAt?: Timestamp;
};

export default function ResultsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = use(params);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Result | null>(null);

  useEffect(() => {
    const unsubQuiz = onSnapshot(
      doc(db, "quizzes", quizId),
      (snap) =>
        setQuiz(
          snap.exists()
            ? ({ id: snap.id, ...(snap.data() as Omit<Quiz, "id">) } as Quiz)
            : null,
        ),
      (e) => setError(e.message),
    );
    const unsubResults = onSnapshot(
      query(
        collection(db, "quizzes", quizId, "results"),
        orderBy("score", "desc"),
        orderBy("submittedAt", "asc"),
      ),
      (snap) => {
        setResults(
          snap.docs.map(
            (d) =>
              ({ id: d.id, ...(d.data() as Omit<Result, "id">) }) as Result,
          ),
        );
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return () => {
      unsubQuiz();
      unsubResults();
    };
  }, [quizId]);

  const stats = useMemo(() => {
    if (results.length === 0)
      return { avg: 0, top: 0, perfect: 0, total: 0 };
    const total = results.length;
    const sum = results.reduce((a, r) => a + r.score, 0);
    const top = Math.max(...results.map((r) => r.score));
    const perfect = results.filter(
      (r) => r.total > 0 && r.score === r.total,
    ).length;
    return { avg: sum / total, top, perfect, total };
  }, [results]);

  const ranked = results;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/pratiyogita"
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <ChevronLeft size={14} /> प्रतियोगिता पर वापस
      </Link>

      <Card
        title={quiz?.title ?? "परिणाम"}
        description={
          quiz?.startsAt
            ? `अवधि: ${quiz.startsAt.toDate().toLocaleString()} → ${
                quiz.endsAt?.toDate().toLocaleString() ?? ""
              }`
            : undefined
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            icon={<Users size={16} />}
            label="प्रतिभागी"
            value={String(stats.total)}
          />
          <Stat
            icon={<Trophy size={16} />}
            label="उच्चतम अंक"
            value={`${stats.top} / ${quiz?.totalQuestions ?? "?"}`}
          />
          <Stat
            icon={<Crown size={16} />}
            label="पूर्ण अंक"
            value={String(stats.perfect)}
          />
          <Stat
            icon={<Award size={16} />}
            label="औसत अंक"
            value={
              quiz?.totalQuestions
                ? `${stats.avg.toFixed(1)} / ${quiz.totalQuestions}`
                : stats.avg.toFixed(1)
            }
          />
        </div>
      </Card>

      {error && <Banner kind="error">{error}</Banner>}

      <Card
        title="लीडरबोर्ड"
        description="अंक (अधिक से कम) के अनुसार, समान अंक होने पर पहले उत्तर देने वाले ऊपर।"
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : ranked.length === 0 ? (
          <EmptyState
            title="अभी कोई प्रविष्टि नहीं"
            description="भक्तों ने अब तक इस प्रतियोगिता के उत्तर नहीं भेजे हैं।"
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-2 py-2">क्रम</th>
                    <th className="px-2 py-2">भक्त</th>
                    <th className="px-2 py-2">मोबाइल</th>
                    <th className="px-2 py-2">अंक</th>
                    <th className="px-2 py-2">समय</th>
                    <th className="px-2 py-2">अवधि</th>
                    <th className="px-2 py-2 text-right">उत्तर</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {ranked.map((r, i) => (
                    <tr
                      key={r.id}
                      className={i < 3 ? "bg-amber-50/40 font-medium" : ""}
                    >
                      <td className="px-2 py-2">
                        <RankBadge rank={i} />
                      </td>
                      <td className="px-2 py-2">{r.name || "—"}</td>
                      <td className="px-2 py-2 text-neutral-600">{r.mobile}</td>
                      <td className="px-2 py-2 text-primary">
                        {r.score} / {r.total}
                      </td>
                      <td className="px-2 py-2 text-neutral-600">
                        {r.submittedAt?.toDate().toLocaleString() ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-neutral-600">
                        {typeof r.durationMs === "number"
                          ? `${(r.durationMs / 1000).toFixed(1)}से`
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setViewing(r)}
                          className="inline-flex items-center gap-1 rounded-full border border-saffron/50 bg-cream/60 px-3 py-1 text-xs font-semibold text-primary hover:bg-cream"
                        >
                          <Eye size={12} /> उत्तर देखें
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="space-y-3 sm:hidden">
              {ranked.map((r, i) => (
                <div
                  key={r.id}
                  className={`rounded-2xl border p-3 ${
                    i < 3
                      ? "border-saffron/60 bg-amber-50/40"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RankBadge rank={i} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-neutral-900">
                        {r.name || "—"}
                      </div>
                      <div className="truncate text-xs text-neutral-500">
                        {r.mobile}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-primary">
                        {r.score} / {r.total}
                      </div>
                      {typeof r.durationMs === "number" && (
                        <div className="text-[10px] text-neutral-500">
                          {(r.durationMs / 1000).toFixed(1)}से
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="truncate text-[11px] text-neutral-500">
                      {r.submittedAt?.toDate().toLocaleString() ?? ""}
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewing(r)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-saffron/50 bg-cream/60 px-3 py-1 text-xs font-semibold text-primary"
                    >
                      <Eye size={12} /> उत्तर देखें
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <AnswersModal
        result={viewing}
        questions={quiz?.questions ?? []}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
        rank === 0
          ? "bg-amber-300 text-amber-900"
          : rank === 1
            ? "bg-zinc-300 text-zinc-800"
            : rank === 2
              ? "bg-orange-300 text-orange-900"
              : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {rank + 1}
    </span>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-saffron/30 bg-cream/40 p-3">
      <div className="flex items-center gap-2 text-primary">{icon}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold text-neutral-900">{value}</div>
    </div>
  );
}

function AnswersModal({
  result,
  questions,
  onClose,
}: {
  result: Result | null;
  questions: Question[];
  onClose: () => void;
}) {
  const open = !!result;
  const correctCount = useMemo(() => {
    if (!result) return 0;
    return questions.reduce(
      (acc, q) =>
        acc + (result.answers?.[q.id] === q.correctOptionIndex ? 1 : 0),
      0,
    );
  }, [result, questions]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? `${result.name || "भक्त"} के उत्तर` : "उत्तर"}
      description={
        result
          ? `मोबाइल: ${result.mobile} · अंक: ${result.score} / ${result.total}`
          : undefined
      }
      maxWidth="max-w-3xl"
    >
      {!result ? null : questions.length === 0 ? (
        <EmptyState
          title="कोई प्रश्न नहीं मिला"
          description="इस प्रतियोगिता के प्रश्न उपलब्ध नहीं हैं।"
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-saffron/40 bg-cream/40 px-4 py-3 text-sm text-neutral-700">
            कुल सही उत्तर:{" "}
            <span className="font-bold text-primary">
              {correctCount} / {questions.length}
            </span>
          </div>

          {questions.map((q, idx) => {
            const chosen = result.answers?.[q.id];
            const correct = q.correctOptionIndex;
            const wasAnswered = typeof chosen === "number";
            const isRight = wasAnswered && chosen === correct;
            return (
              <div
                key={q.id}
                className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4"
              >
                <div className="flex items-start gap-2">
                  <span className="inline-flex h-6 shrink-0 items-center justify-center rounded-full bg-primary px-2 text-[11px] font-bold text-white">
                    प्रश्न {idx + 1}
                  </span>
                  {wasAnswered ? (
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isRight
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {isRight ? <Check size={10} /> : <X size={10} />}
                      {isRight ? "सही" : "ग़लत"}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                      अनुत्तरित
                    </span>
                  )}
                </div>
                <p className="mt-2 break-words text-sm font-semibold text-neutral-900">
                  {q.question}
                </p>
                <div className="mt-2 space-y-1.5">
                  {q.options.map((opt, j) => {
                    const isCorrect = j === correct;
                    const isChosen = chosen === j;
                    let cls =
                      "border-neutral-200 bg-neutral-50 text-neutral-700";
                    if (isCorrect)
                      cls =
                        "border-emerald-300 bg-emerald-50 text-emerald-800";
                    else if (isChosen)
                      cls = "border-red-300 bg-red-50 text-red-800";
                    return (
                      <div
                        key={j}
                        className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${cls}`}
                      >
                        <span className="mt-0.5 shrink-0">
                          {isCorrect ? (
                            <Check size={14} className="text-emerald-600" />
                          ) : isChosen ? (
                            <X size={14} className="text-red-600" />
                          ) : (
                            <span className="block h-3.5 w-3.5 rounded-full border border-neutral-300" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 break-words">
                          {opt}
                        </span>
                        {isChosen && (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider">
                            चयन
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {q.explanation ? (
                  <div className="mt-2 rounded-xl bg-cream/60 px-3 py-2 text-xs text-neutral-700">
                    <span className="font-bold text-primary">व्याख्या: </span>
                    {q.explanation}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
