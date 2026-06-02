// Tiny helper that opens the native share sheet for a Pratiyogita (quiz)
// using React Native's built-in `Share` API. The message is composed in
// Hindi and ends with the admin-configured `shareAppUrl` (set in
// `app_config/branding`) so devotees can forward it on WhatsApp / SMS /
// etc. and the receiver gets a direct link to install or open the app.

import { Share } from "react-native";
import type { Quiz } from "../../../shared/types";
import { tsToDate } from "./quizTime";

type ShareKind = "running" | "upcoming" | "past";

/**
 * Build a Hindi share message for a Pratiyogita and open the OS share sheet.
 * `appUrl` should be the resolved `BrandingConfig.shareAppUrl` — empty
 * string is fine, in which case the link line is omitted.
 */
export async function sharePratiyogita(opts: {
  quiz: Quiz;
  kind: ShareKind;
  appUrl?: string;
  appName?: string;
}) {
  const { quiz, kind, appUrl, appName } = opts;

  const lines: string[] = [];
  lines.push("✦ प्रतियोगिता — दैनिक प्रश्नोत्तरी ✦");
  lines.push(quiz.title);

  if (quiz.description?.trim()) {
    lines.push("");
    lines.push(quiz.description.trim());
  }

  const totalQ = quiz.questions?.length ?? quiz.totalQuestions ?? 0;
  if (totalQ > 0) lines.push(`प्रश्न: ${totalQ}`);

  if (quiz.prize?.title?.trim()) {
    lines.push(`पुरस्कार: ${quiz.prize.title.trim()}`);
  }

  const starts = tsToDate(quiz.startsAt);
  const ends = tsToDate(quiz.endsAt);
  if (kind === "running" && ends) {
    lines.push(`समाप्ति: ${ends.toLocaleString()}`);
  } else if (kind === "upcoming" && starts) {
    lines.push(`प्रारंभ: ${starts.toLocaleString()}`);
  } else if (kind === "past" && ends) {
    lines.push(`समाप्त हुई: ${ends.toLocaleString()}`);
  }

  if (quiz.imageUrl) {
    lines.push("");
    lines.push(quiz.imageUrl);
  }

  if (appUrl?.trim()) {
    lines.push("");
    lines.push(
      `${appName?.trim() || "ऐप"} डाउनलोड करें और भाग लें:`,
    );
    lines.push(appUrl.trim());
  }

  const message = lines.join("\n");

  try {
    await Share.share(
      {
        title: quiz.title,
        message,
      },
      { dialogTitle: "प्रतियोगिता साझा करें" },
    );
  } catch {
    /* user cancelled or share unavailable — silently ignore */
  }
}
