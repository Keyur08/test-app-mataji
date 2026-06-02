// Quiz player — devotee answers each question, then submits. On submission
// we score locally (correctOptionIndex is present in the public doc) and
// write a result document at `quizzes/{quizId}/results/{mobile}`.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import {
  Award,
  Check,
  ChevronRight,
  Clock3,
  Send,
  Share2,
  Sparkles,
  Trophy,
  X,
} from "lucide-react-native";
import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { ScreenContainer } from "../../components/ScreenContainer";
import { ZoomableImage } from "../../components/ZoomableImage";
import { db } from "../../src/lib/firebase";
import { useDoc } from "../../src/lib/useFirestore";
import { useBranding, useTheme } from "../../src/lib/useBranding";
import { useUserProfile } from "../../src/lib/useUserProfile";
import type { Quiz, QuizResult } from "../../../shared/types";
import { formatHMS, liveStatus, msUntil, tsToDate } from "../../src/lib/quizTime";
import { sharePratiyogita } from "../../src/lib/sharePratiyogita";

export default function QuizPlayerScreen() {
  const theme = useTheme();
  const branding = useBranding();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quizId = id ?? "";

  const { data: quiz, loading } = useDoc<Quiz>("quizzes", quizId);
  const { profile, uid } = useUserProfile();

  /* Countdown ticker. */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  /* Local answer state, keyed by question.id. */
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alreadyResult, setAlreadyResult] = useState<QuizResult | null>(null);
  const [checkingPrior, setCheckingPrior] = useState(true);

  /* Track how long the devotee took (rough — starts when quiz doc loads). */
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    if (quiz && startedAt.current == null) startedAt.current = Date.now();
  }, [quiz]);

  /* Look up any existing submission for this devotee. */
  useEffect(() => {
    if (!quizId || !profile?.mobile) {
      setCheckingPrior(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(
          doc(db, "quizzes", quizId, "results", profile.mobile),
        );
        if (!cancelled) {
          setAlreadyResult(
            snap.exists()
              ? ({ id: snap.id, ...(snap.data() as QuizResult) })
              : null,
          );
        }
      } catch {
        /* ignore — rules allow self-read; failures usually mean network. */
      } finally {
        if (!cancelled) setCheckingPrior(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId, profile?.mobile]);

  const status = quiz ? liveStatus(quiz, now) : "upcoming";
  const remaining =
    status === "running"
      ? msUntil(tsToDate(quiz?.endsAt), now)
      : msUntil(tsToDate(quiz?.startsAt), now);

  const allAnswered = useMemo(() => {
    if (!quiz?.questions?.length) return false;
    return quiz.questions.every(
      (q) => typeof answers[q.id] === "number",
    );
  }, [quiz, answers]);

  async function handleSubmit() {
    if (!quiz || !profile?.mobile || !uid) {
      setSubmitError("कृपया पहले अपना मोबाइल नंबर पंजीकृत करें।");
      return;
    }    if (status !== "running") {
      setSubmitError("यह प्रतियोगिता अब समाप्त हो चुकी है।");
      return;
    }
    if (!allAnswered) {
      setSubmitError("कृपया सभी प्रश्नों के उत्तर दें।");
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      // Score locally — the security rules don't require the server to
      // compute this; the devotee already has access to correctOptionIndex
      // since the doc is public. Admins can always recompute.
      let score = 0;
      for (const q of quiz.questions) {
        if (answers[q.id] === q.correctOptionIndex) score++;
      }
      const durationMs = startedAt.current
        ? Date.now() - startedAt.current
        : undefined;

      const ref = doc(db, "quizzes", quizId, "results", profile.mobile);
      const payload: Record<string, unknown> = {
        mobile: profile.mobile,
        name: profile.name ?? "",
        uid,
        answers,
        score,
        total: quiz.questions.length,
        submittedAt: serverTimestamp(),
      };
      if (typeof durationMs === "number") payload.durationMs = durationMs;
      await setDoc(ref, payload);

      // Best-effort bump of the participant counter on the parent doc.
      try {
        await updateDoc(doc(db, "quizzes", quizId), {
          participantCount: increment(1),
        });
      } catch {
        /* non-fatal — rules may not allow non-admin writes; admins can
           recompute later from the results sub-collection if needed. */
      }

      // Forward to the review screen.
      router.replace({
        pathname: "/pratiyogita/[id]/review",
        params: { id: quizId },
      } as never);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "उत्तर भेजने में त्रुटि हुई, पुनः प्रयास करें।",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- render ---------------- */

  if (loading || checkingPrior) {
    return (
      <>
        <Stack.Screen options={{ title: "प्रतियोगिता" }} />
        <ScreenContainer>
          <View className="items-center pt-20">
            <ActivityIndicator color={theme.primary} />
          </View>
        </ScreenContainer>
      </>
    );
  }

  if (!quiz) {
    return (
      <>
        <Stack.Screen options={{ title: "प्रतियोगिता" }} />
        <ScreenContainer>
          <View className="items-center pt-20">
            <Text className="text-base font-semibold text-zinc-700">
              प्रतियोगिता नहीं मिली।
            </Text>
          </View>
        </ScreenContainer>
      </>
    );
  }

  /* If they've already submitted, send them to the review screen. */
  if (alreadyResult) {
    return (
      <>
        <Stack.Screen
          options={{
            title: quiz.title,
            headerStyle: { backgroundColor: theme.headerBg },
            headerTintColor: theme.primary,
            headerTitleStyle: { fontWeight: "800" },
          }}
        />
        <ScreenContainer>
          <SubmittedBanner
            score={alreadyResult.score}
            total={alreadyResult.total}
            onReview={() =>
              router.replace({
                pathname: "/pratiyogita/[id]/review",
                params: { id: quizId },
              } as never)
            }
          />
        </ScreenContainer>
      </>
    );
  }

  if (status !== "running") {
    return (
      <>
        <Stack.Screen
          options={{
            title: quiz.title,
            headerStyle: { backgroundColor: theme.headerBg },
            headerTintColor: theme.primary,
            headerTitleStyle: { fontWeight: "800" },
          }}
        />
        <ScreenContainer>
          <View
            className="mt-6 items-center rounded-3xl bg-white px-6 py-10"
            style={{ borderWidth: 1, borderColor: theme.saffron + "66" }}
          >
            <Clock3 color={theme.saffron} size={28} />
            <Text
              className="mt-3 text-base font-bold"
              style={{ color: theme.primary }}
            >
              {status === "upcoming"
                ? "यह प्रतियोगिता अभी प्रारंभ नहीं हुई है।"
                : "यह प्रतियोगिता समाप्त हो चुकी है।"}
            </Text>
            {status === "upcoming" && (
              <Text
                className="mt-2 text-sm text-zinc-600"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                प्रारंभ में {formatHMS(remaining)}
              </Text>
            )}
            {status === "past" && (
              <Pressable
                onPress={() =>
                  router.replace({
                    pathname: "/pratiyogita/[id]/review",
                    params: { id: quizId },
                  } as never)
                }
                className="mt-4 rounded-full px-5 py-2.5"
                style={{ backgroundColor: theme.primary }}
              >
                <Text className="text-sm font-bold text-white">
                  परिणाम देखें
                </Text>
              </Pressable>
            )}
          </View>
        </ScreenContainer>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: quiz.title,
          headerStyle: { backgroundColor: theme.headerBg },
          headerTintColor: theme.primary,
          headerTitleStyle: { fontWeight: "800" },
        }}
      />
      <ScreenContainer scroll>
        {/* Sticky countdown header */}
        <View
          className="mt-2 flex-row items-center justify-between rounded-2xl px-4 py-3"
          style={{
            backgroundColor: theme.cream,
            borderWidth: 1,
            borderColor: theme.saffron + "66",
          }}
        >
          <View className="flex-row items-center">
            <Trophy color={theme.saffron} size={16} />
            <Text
              className="ml-2 text-[11px] font-bold uppercase tracking-widest"
              style={{ color: theme.saffron }}
            >
              समाप्ति में
            </Text>
          </View>
          <Text
            className="text-[14px] font-bold"
            style={{
              color: theme.primary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatHMS(remaining)}
          </Text>
        </View>

        {/* Cover image (tap to zoom) + share */}
        {quiz.imageUrl ? (
          <ZoomableImage
            uri={quiz.imageUrl}
            caption={quiz.title}
            style={{
              width: "100%",
              height: 180,
              borderRadius: 18,
              marginTop: 12,
            }}
            resizeMode="cover"
          />
        ) : null}

        <Pressable
          onPress={() =>
            sharePratiyogita({
              quiz,
              kind: "running",
              appUrl: branding.shareAppUrl,
              appName: branding.appName,
            })
          }
          accessibilityRole="button"
          accessibilityLabel="प्रतियोगिता साझा करें"
          className="mt-3 flex-row items-center justify-center rounded-full py-2.5 active:opacity-80"
          style={{
            backgroundColor: theme.cream,
            borderWidth: 1.5,
            borderColor: theme.saffron,
          }}
        >
          <Share2 color={theme.primary} size={15} />
          <Text
            className="ml-2 text-[12px] font-bold"
            style={{ color: theme.primary }}
          >
            प्रतियोगिता साझा करें
          </Text>
        </Pressable>

        {/* Prize teaser */}
        {quiz.prize?.title ? (
          <View
            className="mt-3 flex-row items-center rounded-2xl p-3"
            style={{
              backgroundColor: theme.saffron + "18",
              borderWidth: 1,
              borderColor: theme.saffron + "55",
            }}
          >
            <Award color={theme.saffron} size={18} />
            <Text
              className="ml-2 text-[12px] font-bold"
              style={{ color: theme.primary }}
            >
              {quiz.prize.title}
            </Text>
          </View>
        ) : null}

        {/* Questions */}
        <View className="mt-4">
          {quiz.questions.map((q, idx) => {
            const selected = answers[q.id];
            return (
              <View
                key={q.id}
                className="mb-4 rounded-3xl bg-white p-4"
                style={{
                  borderWidth: 1,
                  borderColor: theme.saffron + "55",
                }}
              >
                <View className="flex-row items-center">
                  <View
                    className="h-7 w-7 items-center justify-center rounded-full"
                    style={{ backgroundColor: theme.primary }}
                  >
                    <Text className="text-[11px] font-bold text-white">
                      प्र{idx + 1}
                    </Text>
                  </View>
                  <Text
                    className="ml-2 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: theme.saffron }}
                  >
                    {selected != null ? "उत्तर दिया" : "एक चुनें"}
                  </Text>
                </View>
                <Text
                  className="mt-3 text-[15px] font-semibold leading-6 text-zinc-900"
                >
                  {q.question}
                </Text>
                <View className="mt-3">
                  {q.options.map((opt, j) => {
                    const isSelected = selected === j;
                    return (
                      <Pressable
                        key={j}
                        onPress={() =>
                          setAnswers((s) => ({ ...s, [q.id]: j }))
                        }
                        className="mt-2 flex-row items-center rounded-2xl px-3 py-3 active:opacity-80"
                        style={{
                          backgroundColor: isSelected
                            ? theme.primary + "12"
                            : theme.cream,
                          borderWidth: 1.5,
                          borderColor: isSelected
                            ? theme.primary
                            : theme.saffron + "44",
                        }}
                      >
                        <View
                          className="h-5 w-5 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: isSelected
                              ? theme.primary
                              : "#FFFFFF",
                            borderWidth: 1.5,
                            borderColor: isSelected
                              ? theme.primary
                              : "#D4D4D8",
                          }}
                        >
                          {isSelected && (
                            <Check color="#fff" size={12} />
                          )}
                        </View>
                        <Text
                          className="ml-3 flex-1 text-[14px]"
                          style={{
                            color: isSelected ? theme.primary : "#27272A",
                            fontWeight: isSelected ? "700" : "500",
                          }}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        {submitError ? (
          <View
            className="mb-3 flex-row items-center rounded-2xl px-3 py-2.5"
            style={{
              backgroundColor: "#FEF2F2",
              borderWidth: 1,
              borderColor: "#FECACA",
            }}
          >
            <X color="#DC2626" size={14} />
            <Text className="ml-2 flex-1 text-[12px] text-red-700">
              {submitError}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !allAnswered}
          className="mb-12 flex-row items-center justify-center rounded-full py-3.5 active:opacity-90"
          style={{
            backgroundColor:
              !allAnswered || submitting ? theme.primary + "55" : theme.primary,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Send color="#fff" size={16} />
              <Text className="ml-2 text-sm font-bold text-white">
                उत्तर भेजें
              </Text>
            </>
          )}
        </Pressable>
      </ScreenContainer>
    </>
  );
}

/* ------------------------------------------------------------------ */

function SubmittedBanner({
  score,
  total,
  onReview,
}: {
  score: number;
  total: number;
  onReview: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      className="mt-6 items-center rounded-3xl bg-white px-6 py-10"
      style={{
        borderWidth: 1.5,
        borderColor: theme.saffron,
      }}
    >
      <View
        className="h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.saffron + "33" }}
      >
        <Sparkles color={theme.saffron} size={26} />
      </View>
      <Text
        className="mt-3 text-base font-bold"
        style={{ color: theme.primary }}
      >
        आपने पहले ही उत्तर भेज दिए हैं।
      </Text>
      <Text className="mt-1 text-sm text-zinc-600">
        आपका स्कोर: {score} / {total}
      </Text>
      <Pressable
        onPress={onReview}
        className="mt-4 flex-row items-center rounded-full px-5 py-2.5"
        style={{ backgroundColor: theme.primary }}
      >
        <Text className="text-sm font-bold text-white">उत्तर देखें</Text>
        <ChevronRight color="#fff" size={16} style={{ marginLeft: 4 }} />
      </Pressable>
    </View>
  );
}
