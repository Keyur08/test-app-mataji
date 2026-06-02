// Past-quiz review — shows the devotee's own answer sheet, marks correct vs
// chosen answers, and lists the leaderboard. Devotees can only read their
// OWN result (by Firestore rules), so we fetch it as a single doc and
// surface a friendly "submission not found" state otherwise. The
// leaderboard relies on an admin-only list — for devotees we instead show
// the top scores reported via the per-quiz `participantCount` and (when
// admins open the same screen) the full ranking.

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  Award,
  Check,
  Crown,
  Share2,
  Trophy,
  Users as UsersIcon,
  X,
} from "lucide-react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";

import { ScreenContainer } from "../../../components/ScreenContainer";
import { ZoomableImage } from "../../../components/ZoomableImage";
import { db } from "../../../src/lib/firebase";
import { useDoc } from "../../../src/lib/useFirestore";
import { useBranding, useTheme } from "../../../src/lib/useBranding";
import { useUserProfile } from "../../../src/lib/useUserProfile";
import type { Quiz, QuizResult } from "../../../../shared/types";
import { sharePratiyogita } from "../../../src/lib/sharePratiyogita";

export default function QuizReviewScreen() {
  const theme = useTheme();
  const branding = useBranding();
  const { id } = useLocalSearchParams<{ id: string }>();
  const quizId = id ?? "";

  const { data: quiz, loading } = useDoc<Quiz>("quizzes", quizId);
  const { profile } = useUserProfile();

  const [myResult, setMyResult] = useState<QuizResult | null>(null);
  const [resultLoading, setResultLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<QuizResult[]>([]);
  const [leaderboardError, setLeaderboardError] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [showAllRanks, setShowAllRanks] = useState(false);

  /* Fetch the devotee's own result (rules allow self-read). */
  useEffect(() => {
    if (!quizId || !profile?.mobile) {
      setResultLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(
          doc(db, "quizzes", quizId, "results", profile.mobile),
        );
        if (!cancelled) {
          setMyResult(
            snap.exists()
              ? ({ id: snap.id, ...(snap.data() as QuizResult) })
              : null,
          );
        }
      } finally {
        if (!cancelled) setResultLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId, profile?.mobile]);

  /* Leaderboard — public for `past` quizzes (see firestore.rules).
     For `running` / `upcoming` quizzes the listing is admin-only and
     this will silently fall back to the participant-count blurb. */
  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, "quizzes", quizId, "results"),
          orderBy("score", "desc"),
          orderBy("submittedAt", "asc"),
          limit(100),
        );
        const snap = await getDocs(q);
        if (!cancelled) {
          setLeaderboard(
            snap.docs.map(
              (d) => ({ id: d.id, ...(d.data() as QuizResult) }) as QuizResult,
            ),
          );
        }
      } catch {
        if (!cancelled) setLeaderboardError(true);
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  const showWinners = useMemo(
    () => !leaderboardError && leaderboard.length > 0,
    [leaderboardError, leaderboard],
  );

  /** Index of the current devotee inside the leaderboard, or -1. */
  const myRank = useMemo(() => {
    if (!profile?.mobile || leaderboard.length === 0) return -1;
    return leaderboard.findIndex((r) => r.mobile === profile.mobile);
  }, [leaderboard, profile?.mobile]);

  if (loading || resultLoading) {
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
        {/* Cover image (tap to zoom) */}
        {quiz.imageUrl ? (
          <ZoomableImage
            uri={quiz.imageUrl}
            caption={quiz.title}
            style={{
              width: "100%",
              height: 170,
              borderRadius: 18,
              marginTop: 8,
            }}
            resizeMode="cover"
          />
        ) : null}

        {/* Share button */}
        <Pressable
          onPress={() =>
            sharePratiyogita({
              quiz,
              kind: "past",
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

        {/* Score banner */}
        <View
          className="mt-2 flex-row items-center rounded-3xl bg-white p-4"
          style={{
            borderWidth: 1.5,
            borderColor: theme.saffron,
          }}
        >
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.saffron + "33" }}
          >
            <Trophy color={theme.saffron} size={22} />
          </View>
          <View className="ml-3 flex-1">
            <Text
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: theme.saffron }}
            >
              आपका स्कोर
            </Text>
            {myResult ? (
              <Text
                className="text-2xl font-bold"
                style={{ color: theme.primary }}
              >
                {myResult.score} / {myResult.total}
              </Text>
            ) : (
              <Text className="mt-1 text-sm italic text-zinc-500">
                आपने इस प्रतियोगिता में भाग नहीं लिया।
              </Text>
            )}
          </View>
        </View>

        {/* Prize recap */}
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
            <View className="ml-2 flex-1">
              <Text
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: theme.saffron }}
              >
                पुरस्कार
              </Text>
              <Text
                className="text-[14px] font-bold"
                style={{ color: theme.primary }}
              >
                {quiz.prize.title}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Answer sheet */}
        <View className="mt-6">
          <Text
            className="mb-3 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: theme.saffron }}
          >
            उत्तर पत्र
          </Text>

          {quiz.questions.map((q, idx) => {
            const chosen = myResult?.answers?.[q.id];
            const correct = q.correctOptionIndex;
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
                  {chosen != null && (
                    <View
                      className="ml-2 flex-row items-center rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor:
                          chosen === correct ? "#D1FAE5" : "#FEE2E2",
                      }}
                    >
                      {chosen === correct ? (
                        <Check color="#047857" size={11} />
                      ) : (
                        <X color="#B91C1C" size={11} />
                      )}
                      <Text
                        className="ml-1 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          color: chosen === correct ? "#047857" : "#B91C1C",
                        }}
                      >
                        {chosen === correct ? "सही" : "ग़लत"}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="mt-3 text-[15px] font-semibold leading-6 text-zinc-900">
                  {q.question}
                </Text>
                <View className="mt-3">
                  {q.options.map((opt, j) => {
                    const isCorrect = j === correct;
                    const isChosen = chosen === j;
                    let bg = theme.cream;
                    let border = theme.saffron + "44";
                    let textColor = "#27272A";
                    if (isCorrect) {
                      bg = "#D1FAE5";
                      border = "#10B98166";
                      textColor = "#065F46";
                    } else if (isChosen) {
                      bg = "#FEE2E2";
                      border = "#FCA5A5";
                      textColor = "#991B1B";
                    }
                    return (
                      <View
                        key={j}
                        className="mt-2 flex-row items-center rounded-2xl px-3 py-3"
                        style={{
                          backgroundColor: bg,
                          borderWidth: 1.5,
                          borderColor: border,
                        }}
                      >
                        <View
                          className="h-5 w-5 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: isCorrect
                              ? "#10B981"
                              : isChosen
                                ? "#EF4444"
                                : "#FFFFFF",
                            borderWidth: 1.5,
                            borderColor: isCorrect
                              ? "#10B981"
                              : isChosen
                                ? "#EF4444"
                                : "#D4D4D8",
                          }}
                        >
                          {isCorrect ? (
                            <Check color="#fff" size={12} />
                          ) : isChosen ? (
                            <X color="#fff" size={12} />
                          ) : null}
                        </View>
                        <Text
                          className="ml-3 flex-1 text-[14px]"
                          style={{
                            color: textColor,
                            fontWeight: isCorrect || isChosen ? "700" : "500",
                          }}
                        >
                          {opt}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {q.explanation ? (
                  <View
                    className="mt-3 rounded-2xl p-3"
                    style={{ backgroundColor: theme.cream }}
                  >
                    <Text
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: theme.saffron }}
                    >
                      व्याख्या
                    </Text>
                    <Text className="mt-1 text-[12px] leading-5 text-zinc-700">
                      {q.explanation}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Winners / leaderboard */}
        <View className="mt-5">
          <View className="mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Crown color={theme.saffron} size={16} />
              <Text
                className="ml-2 text-[11px] font-bold uppercase tracking-widest"
                style={{ color: theme.saffron }}
              >
                लीडरबोर्ड
              </Text>
            </View>
            {showWinners ? (
              <Text className="text-[11px] font-semibold text-zinc-600">
                {leaderboard.length} भक्त
              </Text>
            ) : null}
          </View>

          {leaderboardLoading ? (
            <View
              className="items-center rounded-2xl p-4"
              style={{
                backgroundColor: theme.cream,
                borderWidth: 1,
                borderColor: theme.saffron + "55",
              }}
            >
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : showWinners ? (
            <>
              {/* "Your rank" pill */}
              {myRank >= 0 ? (
                <View
                  className="mb-2 flex-row items-center rounded-2xl p-3"
                  style={{
                    backgroundColor: theme.primary + "10",
                    borderWidth: 1.5,
                    borderColor: theme.primary,
                  }}
                >
                  <Trophy color={theme.primary} size={16} />
                  <Text
                    className="ml-2 flex-1 text-[12px] font-bold"
                    style={{ color: theme.primary }}
                  >
                    आपका स्थान: #{myRank + 1} / {leaderboard.length}
                  </Text>
                  <Text
                    className="text-[12px] font-bold"
                    style={{ color: theme.primary }}
                  >
                    {leaderboard[myRank].score} / {leaderboard[myRank].total}
                  </Text>
                </View>
              ) : null}

              {(showAllRanks ? leaderboard : leaderboard.slice(0, 10)).map(
                (r, i) => {
                  const isMe = profile?.mobile && r.mobile === profile.mobile;
                  return (
                    <View
                      key={r.id}
                      className="mb-2 flex-row items-center rounded-2xl bg-white p-3"
                      style={{
                        borderWidth: isMe ? 1.5 : 1,
                        borderColor: isMe
                          ? theme.primary
                          : theme.saffron + "55",
                        backgroundColor: isMe
                          ? theme.primary + "08"
                          : "#FFFFFF",
                      }}
                    >
                      <View
                        className="h-8 w-8 items-center justify-center rounded-full"
                        style={{
                          backgroundColor:
                            i === 0
                              ? "#FCD34D"
                              : i === 1
                                ? "#D4D4D8"
                                : i === 2
                                  ? "#FDBA74"
                                  : theme.cream,
                        }}
                      >
                        <Text className="text-[11px] font-bold text-zinc-900">
                          {i + 1}
                        </Text>
                      </View>
                      <View className="ml-3 flex-1">
                        <Text
                          className="text-[13px] font-bold text-zinc-900"
                          numberOfLines={1}
                        >
                          {r.name?.trim() || "भक्त"}
                          {isMe ? "  (आप)" : ""}
                        </Text>
                        <View className="mt-0.5 flex-row items-center">
                          <Text className="text-[10px] text-zinc-500">
                            {maskMobile(r.mobile)}
                          </Text>
                          {typeof r.durationMs === "number" ? (
                            <Text className="ml-2 text-[10px] text-zinc-500">
                              · {formatDuration(r.durationMs)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View className="items-end">
                        <Text
                          className="text-[14px] font-bold"
                          style={{ color: theme.primary }}
                        >
                          {r.score}
                          <Text className="text-[11px] text-zinc-500">
                            {" "}
                            / {r.total}
                          </Text>
                        </Text>
                        <Text
                          className="text-[9px] font-semibold uppercase tracking-wider"
                          style={{ color: theme.saffron }}
                        >
                          {Math.round((r.score / Math.max(1, r.total)) * 100)}%
                        </Text>
                      </View>
                    </View>
                  );
                },
              )}

              {leaderboard.length > 10 ? (
                <Pressable
                  onPress={() => setShowAllRanks((v) => !v)}
                  className="mt-1 flex-row items-center justify-center rounded-full py-2 active:opacity-80"
                  style={{
                    backgroundColor: theme.cream,
                    borderWidth: 1,
                    borderColor: theme.saffron + "66",
                  }}
                >
                  <Text
                    className="text-[12px] font-bold"
                    style={{ color: theme.primary }}
                  >
                    {showAllRanks
                      ? "केवल शीर्ष 10 दिखाएँ"
                      : `सभी ${leaderboard.length} दिखाएँ`}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <View
              className="flex-row items-center rounded-2xl p-3"
              style={{
                backgroundColor: theme.cream,
                borderWidth: 1,
                borderColor: theme.saffron + "55",
              }}
            >
              <UsersIcon color={theme.primary} size={14} />
              <Text className="ml-2 flex-1 text-[12px] text-zinc-700">
                {quiz.participantCount ?? 0} भक्तों ने भाग लिया। लीडरबोर्ड
                प्रतियोगिता समाप्त होने पर दिखाई देगा।
              </Text>
            </View>
          )}
        </View>

      </ScreenContainer>
    </>
  );
}

/* ------------------------------------------------------------------ */

/** Mask a 10-digit Indian mobile as `98••••3210` to preserve privacy. */
function maskMobile(mobile: string | undefined | null): string {
  if (!mobile) return "";
  const m = mobile.replace(/\D/g, "");
  if (m.length < 6) return m;
  if (m.length === 10) return `${m.slice(0, 2)}••••${m.slice(-4)}`;
  return `${m.slice(0, 2)}••${m.slice(-4)}`;
}

/** Format a millisecond duration as `MM:SS` (or `H:MM:SS` if long). */
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
