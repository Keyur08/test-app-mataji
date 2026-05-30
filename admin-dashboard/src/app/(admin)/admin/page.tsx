"use client";

// Minimal, futuristic admin overview.
// Focus: what needs attention TODAY + sleek shortcuts to manage content.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import {
  NotebookPen,
  CalendarDays,
  Bell,
  Megaphone,
  ImageIcon,
  Video,
  Film,
  GalleryHorizontalEnd,
  QrCode,
  BookOpen,
  ArrowUpRight,
  Circle,
} from "lucide-react";

import { db } from "@/lib/firebase";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminOverviewPage() {
  const today = todayISO();

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Today's signals
  const [niyam, setNiyam] = useState<{ title?: string } | null | undefined>(
    undefined,
  );
  const [niyamAccepts, setNiyamAccepts] = useState<number | null>(null);
  const [quote, setQuote] = useState<boolean | undefined>(undefined);

  // Content counts
  const [counts, setCounts] = useState<Record<string, number | null>>({
    news_events: null,
    pravachans: null,
    reels: null,
    gallery_photos: null,
    bhajans: null,
    texts_library: null,
  });

  useEffect(() => {
    const unsubs = [
      onSnapshot(doc(db, "daily_niyam", today), (s) =>
        setNiyam(s.exists() ? (s.data() as { title?: string }) : null),
      ),
      onSnapshot(collection(db, "daily_niyam", today, "accepts"), (s) =>
        setNiyamAccepts(s.size),
      ),
      onSnapshot(doc(db, "daily_quotes", today), (s) =>
        setQuote(s.exists()),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [today]);

  useEffect(() => {
    const names = [
      "news_events",
      "pravachans",
      "reels",
      "gallery_photos",
      "bhajans",
      "texts_library",
    ];
    const unsubs = names.map((n) =>
      onSnapshot(collection(db, n), (s) =>
        setCounts((prev) => ({ ...prev, [n]: s.size })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const timeLabel = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  // Today checklist items
  const todayItems: TodayItem[] = [
    {
      key: "niyam",
      label: "दैनिक नियम",
      hint:
        niyam === undefined
          ? "Checking…"
          : niyam
            ? niyam.title || "Published"
            : "Not set for today",
      done: !!niyam,
      meta:
        niyam && niyamAccepts !== null ? `${niyamAccepts} accepted` : undefined,
      href: "/admin/daily-niyam",
    },
    {
      key: "quote",
      label: "दैनिक उद्धरण",
      hint:
        quote === undefined
          ? "Checking…"
          : quote
            ? "Published"
            : "Not set for today",
      done: !!quote,
      href: "/admin/daily",
    },
  ];

  const doneCount = todayItems.filter((i) => i.done).length;
  const progressPct = Math.round((doneCount / todayItems.length) * 100);

  return (
    <div className="space-y-8">
      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
            Overview
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 sm:text-xs">
            {dateLabel} · {timeLabel}
          </p>
        </div>
        <p className="text-sm text-neutral-500">
          {doneCount}/{todayItems.length} daily tasks complete
        </p>
      </header>

      {/* ── TODAY COMMAND PANEL ─────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-saffron/40 bg-gradient-to-br from-cream via-white to-saffron/20 p-4 text-primary shadow-sm sm:p-6 md:p-8">
        {/* warm glows */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-saffron/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
        {/* mandala-style radial rings */}
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 opacity-[0.12]"
          style={{
            backgroundImage:
              "repeating-radial-gradient(circle at center, rgba(193,39,45,0.55) 0 1px, transparent 1px 18px)",
          }}
        />
        {/* subtle dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(193,39,45,0.6) 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        {/* top accent line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="relative grid gap-6 lg:grid-cols-[1fr,auto] lg:items-center">
          <div className="space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">
              Today · Command Panel
            </p>

            <div className="space-y-2">
              {todayItems.map((it) => (
                <TodayRow key={it.key} item={it} />
              ))}
            </div>
          </div>

          {/* Progress ring */}
          <ProgressRing pct={progressPct} done={doneCount} total={todayItems.length} />
        </div>
      </section>

      {/* ── CONTENT LIBRARY RAIL ────────────────────────────────────── */}
      <section>
        <SectionLabel label="Content Library" />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCell
            icon={<Megaphone size={14} />}
            label="Announcements"
            value={counts.news_events}
            href="/admin/announcements"
          />
          <KpiCell
            icon={<Video size={14} />}
            label="Pravachans"
            value={counts.pravachans}
            href="/admin/pravachans"
          />
          <KpiCell
            icon={<Film size={14} />}
            label="Reels"
            value={counts.reels}
            href="/admin/reels"
          />
          <KpiCell
            icon={<ImageIcon size={14} />}
            label="Photos"
            value={counts.gallery_photos}
            href="/admin/media"
          />
          <KpiCell
            icon={<NotebookPen size={14} />}
            label="Bhajans"
            value={counts.bhajans}
            href="/admin/media"
          />
          <KpiCell
            icon={<BookOpen size={14} />}
            label="Texts"
            value={counts.texts_library}
            href="/admin/texts"
          />
        </div>
      </section>

      {/* ── SHORTCUTS ───────────────────────────────────────────────── */}
      <section>
        <SectionLabel label="Shortcuts" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Shortcut href="/admin/daily-niyam" icon={<NotebookPen size={16} />} label="नियम" />
          <Shortcut href="/admin/daily" icon={<CalendarDays size={16} />} label="Daily" />
          <Shortcut href="/admin/notifications" icon={<Bell size={16} />} label="Notify" />
          <Shortcut href="/admin/announcements" icon={<Megaphone size={16} />} label="News" />
          <Shortcut href="/admin/media" icon={<ImageIcon size={16} />} label="Media" />
          <Shortcut href="/admin/slides" icon={<GalleryHorizontalEnd size={16} />} label="Slides" />
          <Shortcut href="/admin/pravachans" icon={<Video size={16} />} label="Pravachans" />
          <Shortcut href="/admin/reels" icon={<Film size={16} />} label="Reels" />
          <Shortcut href="/admin/texts" icon={<BookOpen size={16} />} label="Texts" />
          <Shortcut href="/admin/aahar-daan" icon={<QrCode size={16} />} label="Aahar Daan" />
        </div>
      </section>
    </div>
  );
}

/* ─── Today row ────────────────────────────────────────────────────── */

type TodayItem = {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  meta?: string;
  href: string;
};

function TodayRow({ item }: { item: TodayItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-4 rounded-xl border border-saffron/30 bg-white/70 px-4 py-3 backdrop-blur-sm transition hover:border-primary/40 hover:bg-white"
    >
      <span
        className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          item.done
            ? "bg-emerald-100 text-emerald-600"
            : "bg-neutral-100 text-neutral-400"
        }`}
      >
        {item.done ? (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
            <Circle size={8} fill="currentColor" />
          </>
        ) : (
          <Circle size={8} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">{item.label}</p>
        <p className="truncate text-xs text-neutral-500">{item.hint}</p>
      </div>

      {item.meta && (
        <span className="hidden font-mono text-[10px] uppercase tracking-widest text-primary/80 sm:inline">
          {item.meta}
        </span>
      )}

      <ArrowUpRight
        size={14}
        className="text-neutral-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </Link>
  );
}

/* ─── Progress ring ────────────────────────────────────────────────── */

function ProgressRing({
  pct,
  done,
  total,
}: {
  pct: number;
  done: number;
  total: number;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative mx-auto flex h-32 w-32 items-center justify-center lg:h-36 lg:w-36">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={r}
          stroke="rgba(193,39,45,0.12)"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          stroke="url(#ring)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#C1272D" />
            <stop offset="100%" stopColor="#FF9933" />
          </linearGradient>
        </defs>
      </svg>
      <div className="relative text-center">
        <p className="font-mono text-2xl font-semibold text-primary">{pct}%</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60">
          {done}/{total} done
        </p>
      </div>
    </div>
  );
}

/* ─── KPI cell (flat, grid-line look) ──────────────────────────────── */

function KpiCell({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 bg-white px-4 py-4 transition hover:bg-cream"
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-500">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums text-neutral-900 transition group-hover:text-primary">
        {value === null ? (
          <span className="inline-block h-7 w-10 animate-pulse rounded bg-neutral-100" />
        ) : (
          value
        )}
      </span>
    </Link>
  );
}

/* ─── Shortcut chip ────────────────────────────────────────────────── */

function Shortcut({
  href,
  icon,
  label,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-4 py-3 transition hover:-translate-y-0.5 ${
        accent
          ? "border-transparent bg-gradient-to-br from-primary to-saffron text-white shadow-sm hover:shadow-md"
          : "border-neutral-200 bg-white text-neutral-800 hover:border-primary/30 hover:text-primary"
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          accent
            ? "bg-white/15 ring-1 ring-inset ring-white/25"
            : "bg-cream text-primary"
        }`}
      >
        {icon}
      </span>
      <span className="truncate text-sm font-medium">{label}</span>
      <ArrowUpRight
        size={12}
        className={`ml-auto transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${
          accent ? "text-white/70" : "text-neutral-400"
        }`}
      />
    </Link>
  );
}

/* ─── Section label ────────────────────────────────────────────────── */

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-400">
        {label}
      </span>
      <span className="h-px flex-1 bg-neutral-200" />
    </div>
  );
}
