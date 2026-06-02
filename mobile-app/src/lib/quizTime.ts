// Helpers shared by Pratiyogita screens to compute a quiz's live status and
// the countdown to its end time. Centralised so the home card, the
// Running tab, and the player can all stay in sync without re-implementing.

import type { Quiz, QuizStatus, TimestampLike } from "../../../shared/types";

export function tsToDate(ts: TimestampLike | undefined | null): Date | null {
  if (!ts) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
}

/** Recompute status from the schedule (don't trust the mirrored value blindly). */
export function liveStatus(q: Quiz, now: Date = new Date()): QuizStatus {
  const starts = tsToDate(q.startsAt);
  const ends = tsToDate(q.endsAt);
  if (!starts || !ends) return q.status ?? "upcoming";
  if (now < starts) return "upcoming";
  if (now > ends) return "past";
  return "running";
}

/** Milliseconds remaining until midnight at the *device's* local zone.
 *  Used as the canonical "Daily reset" timer per the spec. */
export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0); // tomorrow 00:00:00.000 local
  return Math.max(0, next.getTime() - now.getTime());
}

/** Milliseconds remaining until a specific instant. */
export function msUntil(target: Date | null, now: Date = new Date()): number {
  if (!target) return 0;
  return Math.max(0, target.getTime() - now.getTime());
}

/** Format ms as HH:MM:SS (clamped at 99:59:59). */
export function formatHMS(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.min(99, Math.floor(total / 3600));
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
