"use client";

// User Registrations — App Users only.
// Lists mandatory onboarding profiles stored at `users/{uid}` with search,
// gender / marital filters, summary tiles, CSV export and per-row actions.
// (The earlier "Aahar Daan" tab has been removed; Aahar Daan submissions
// live on their own page in the dashboard.)

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import {
  Download,
  Eye,
  Heart,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { Banner, Button, Card, EmptyState, Input } from "@/lib/ui";

function formatTimestamp(ts?: Timestamp): string {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

function telLink(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

type Gender = "male" | "female" | "other";
type MaritalStatus = "married" | "unmarried";
type JaapByMantra = {
  count?: number;
  malas?: number;
  target?: number;
  label?: string;
};
type JaapActivity = {
  selectedMantraLabel?: string;
  target?: number;
  totalCount?: number;
  totalMalas?: number;
  byMantra?: Record<string, JaapByMantra>;
};

type AppUser = {
  id: string;
  uid?: string;
  name: string;
  location: string;
  mobile: string;
  email?: string;
  dob: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  marriageDate?: string;
  createdAt?: Timestamp;
  jaapActivity?: JaapActivity;
};

function getTopMantra(activity?: JaapActivity): {
  id: string;
  label: string;
  count: number;
} | null {
  const entries = Object.entries(activity?.byMantra ?? {});
  if (entries.length === 0) return null;
  let top: { id: string; label: string; count: number } | null = null;
  for (const [id, v] of entries) {
    const count = Math.max(0, Number(v?.count) || 0);
    if (!top || count > top.count) {
      top = {
        id,
        label: (v?.label || id || "—").trim(),
        count,
      };
    }
  }
  return top;
}

function getMantraRows(activity?: JaapActivity): Array<{
  id: string;
  label: string;
  count: number;
  malas: number;
  target: number | null;
}> {
  return Object.entries(activity?.byMantra ?? {})
      .map(([id, v]) => ({
        id,
        label: (v?.label || id || "—").trim(),
        count: Math.max(0, Number(v?.count) || 0),
        malas: Math.max(0, Number(v?.malas) || 0),
        target:
            Number.isFinite(Number(v?.target)) && Number(v?.target) >= 2
                ? Math.floor(Number(v?.target))
                : Number.isFinite(Number(activity?.target)) &&
                Number(activity?.target) >= 2
                    ? Math.floor(Number(activity?.target))
                    : null,
      }))
      .sort((a, b) => b.count - a.count || b.malas - a.malas);
}

function ageFromDob(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split("-").map((n) => Number(n));
  const birth = new Date(y, m - 1, d);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const mDiff = now.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export default function RegistrationsPage() {
  const [items, setItems] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | Gender>("all");
  const [maritalFilter, setMaritalFilter] = useState<"all" | MaritalStatus>(
      "all",
  );
  const [jaapPopupUser, setJaapPopupUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
        q,
        (snap) => {
          setItems(
              snap.docs.map(
                  (d) =>
                      ({ id: d.id, ...(d.data() as Omit<AppUser, "id">) }) as AppUser,
              ),
          );
          setLoading(false);
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        },
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (genderFilter !== "all" && it.gender !== genderFilter) return false;
      if (maritalFilter !== "all" && it.maritalStatus !== maritalFilter)
        return false;
      if (!q) return true;
      return (
          (it.name ?? "").toLowerCase().includes(q) ||
          (it.mobile ?? "").toLowerCase().includes(q) ||
          (it.email ?? "").toLowerCase().includes(q) ||
          (it.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, genderFilter, maritalFilter]);

  const counts = useMemo(() => {
    const c = {
      male: 0,
      female: 0,
      other: 0,
      married: 0,
      unmarried: 0,
      totalJaapCount: 0,
      totalJaapMalas: 0,
    };
    items.forEach((it) => {
      if (it.gender) c[it.gender]++;
      if (it.maritalStatus) c[it.maritalStatus]++;
      c.totalJaapCount += Math.max(
          0,
          Number(it.jaapActivity?.totalCount) || 0,
      );
      c.totalJaapMalas += Math.max(
          0,
          Number(it.jaapActivity?.totalMalas) || 0,
      );
    });
    return c;
  }, [items]);

  async function removeItem(it: AppUser) {
    if (!confirm(`Delete profile of ${it.name}? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "users", it.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function exportCsv() {
    const headers = [
      "Registered",
      "Name",
      "Mobile",
      "Email",
      "Location",
      "DOB",
      "Age",
      "Gender",
      "Marital Status",
      "Marriage Date",
      "Jaap Total Count",
      "Jaap Total Malas",
      "Most Chanted Mantra",
      "Most Chanted Count",
      "UID",
    ];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = filtered.map((it) => {
      const top = getTopMantra(it.jaapActivity);
      return [
        formatTimestamp(it.createdAt),
        it.name,
        it.mobile,
        it.email ?? "",
        it.location,
        it.dob,
        ageFromDob(it.dob)?.toString() ?? "",
        it.gender,
        it.maritalStatus,
        it.marriageDate ?? "",
        it.jaapActivity?.totalCount?.toString() ?? "0",
        it.jaapActivity?.totalMalas?.toString() ?? "0",
        top?.label ?? "",
        top?.count?.toString() ?? "0",
        it.uid ?? it.id,
      ]
          .map((c) => escape(String(c)))
          .join(",");
    });
    const csv = [headers.map(escape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `app-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
      <div className="space-y-6">
        <header className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-primary sm:text-2xl">
            <Users size={24} /> App Users
          </h1>
          <p className="text-sm text-neutral-600">
            Devotees who completed the mandatory registration on first app launch.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <SummaryTile label="Total Users" value={items.length} tone="primary" />
          <SummaryTile label="Male" value={counts.male} tone="saffron" />
          <SummaryTile label="Female" value={counts.female} tone="green" />
          <SummaryTile label="Married" value={counts.married} tone="primary" />
          <SummaryTile
              label="Unmarried"
              value={counts.unmarried}
              tone="neutral"
          />
          <SummaryTile
              label="Jaap Count"
              value={counts.totalJaapCount}
              tone="saffron"
          />
        </div>

        <Card
            title="All App Users"
            description="Live list from the `users` collection. Use the actions to contact or remove a devotee."
            actions={
              <Button
                  variant="secondary"
                  onClick={exportCsv}
                  disabled={filtered.length === 0}
              >
                <Download size={16} /> Export CSV
              </Button>
            }
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, mobile, email, location…"
                  className="pl-8"
              />
            </div>
            <div className="flex gap-1 rounded-lg bg-cream p-1">
              {(["all", "male", "female", "other"] as const).map((g) => (
                  <button
                      key={g}
                      type="button"
                      onClick={() => setGenderFilter(g)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${
                          genderFilter === g
                              ? "bg-primary text-white"
                              : "text-neutral-600 hover:text-primary"
                      }`}
                  >
                    {g}
                  </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg bg-cream p-1">
              {(["all", "married", "unmarried"] as const).map((m) => (
                  <button
                      key={m}
                      type="button"
                      onClick={() => setMaritalFilter(m)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${
                          maritalFilter === m
                              ? "bg-primary text-white"
                              : "text-neutral-600 hover:text-primary"
                      }`}
                  >
                    {m}
                  </button>
              ))}
            </div>
          </div>

          {error && (
              <div className="mb-3">
                <Banner kind="error">{error}</Banner>
              </div>
          )}

          {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-primary" />
              </div>
          ) : filtered.length === 0 ? (
              <EmptyState
                  title={
                    items.length === 0
                        ? "No app users yet."
                        : "No matches for your filters."
                  }
                  description={
                    items.length === 0
                        ? "Devotees who complete the onboarding form will appear here."
                        : undefined
                  }
              />
          ) : (
              <div className="overflow-x-auto rounded-lg border border-neutral-100">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="bg-cream text-xs uppercase tracking-wider text-neutral-600">
                  <tr>
                    <th className="px-3 py-2">Registered</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Mobile</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">DOB / Age</th>
                    <th className="px-3 py-2">Gender</th>
                    <th className="px-3 py-2">Marital</th>
                    <th className="px-3 py-2">Jaap Activity</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                  {filtered.map((it) => {
                    const age = ageFromDob(it.dob);
                    const jaapTotalCount = Math.max(
                        0,
                        Number(it.jaapActivity?.totalCount) || 0,
                    );
                    const jaapTotalMalas = Math.max(
                        0,
                        Number(it.jaapActivity?.totalMalas) || 0,
                    );
                    const jaapTop = getTopMantra(it.jaapActivity);
                    return (
                        <tr key={it.id} className="hover:bg-cream/50">
                          <td className="px-3 py-3 align-top text-xs text-neutral-500">
                            {formatTimestamp(it.createdAt)}
                          </td>
                          <td className="px-3 py-3 align-top font-medium text-neutral-900">
                            {it.name}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <a
                                href={telLink(it.mobile)}
                                className="text-primary hover:underline"
                            >
                              {it.mobile}
                            </a>
                          </td>
                          <td className="px-3 py-3 align-top text-xs">
                            {it.email ? (
                                <a
                                    href={`mailto:${it.email}`}
                                    className="text-primary hover:underline"
                                >
                                  {it.email}
                                </a>
                            ) : (
                                <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-neutral-700">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} className="text-neutral-400" />
                          {it.location}
                        </span>
                          </td>
                          <td className="px-3 py-3 align-top text-xs">
                            <div>{it.dob}</div>
                            {age !== null && (
                                <div className="text-neutral-500">{age} yrs</div>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top text-xs capitalize">
                            {it.gender}
                          </td>
                          <td className="px-3 py-3 align-top text-xs">
                            <span className="capitalize">{it.maritalStatus}</span>
                            {it.maritalStatus === "married" && it.marriageDate && (
                                <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                                  <Heart size={10} /> {it.marriageDate}
                                </div>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top text-xs">
                            <div className="flex items-center gap-2">
                              <button
                                  type="button"
                                  onClick={() => setJaapPopupUser(it)}
                                  className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-primary hover:bg-cream"
                              >
                                <Eye size={13} />
                                View
                              </button>
                              {jaapTotalCount > 0 || jaapTotalMalas > 0 ? (
                                  <span className="text-neutral-500">
                              {jaapTotalCount} • {jaapTotalMalas}
                            </span>
                              ) : (
                                  <span className="text-neutral-400">No jaap</span>
                              )}
                              {jaapTop && jaapTop.count > 0 && (
                                  <span className="text-neutral-400">
                              {jaapTop.label}
                            </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex justify-end gap-1">
                              <a
                                  href={whatsappLink(it.mobile)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-md p-1.5 text-neutral-500 hover:bg-green-50 hover:text-green-600"
                                  title="WhatsApp"
                              >
                                <MessageCircle size={16} />
                              </a>
                              <a
                                  href={telLink(it.mobile)}
                                  className="rounded-md p-1.5 text-neutral-500 hover:bg-cream hover:text-primary"
                                  title="Call"
                              >
                                <Phone size={16} />
                              </a>
                              {it.email && (
                                  <a
                                      href={`mailto:${it.email}`}
                                      className="rounded-md p-1.5 text-neutral-500 hover:bg-cream hover:text-primary"
                                      title="Email"
                                  >
                                    <Mail size={16} />
                                  </a>
                              )}
                              <button
                                  type="button"
                                  onClick={() => removeItem(it)}
                                  className="rounded-md p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-600"
                                  title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
          )}
        </Card>

        {jaapPopupUser && (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                onClick={() => setJaapPopupUser(null)}
            >
              <div
                  className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl sm:p-5"
                  onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">
                      Jaap Activity
                    </h2>
                    <p className="text-sm text-neutral-600">
                      {jaapPopupUser.name} • {jaapPopupUser.mobile}
                    </p>
                  </div>
                  <button
                      type="button"
                      onClick={() => setJaapPopupUser(null)}
                      className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
                      aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded-lg bg-cream px-3 py-2">
                    <p className="text-neutral-500">Total chants</p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {Math.max(
                          0,
                          Number(jaapPopupUser.jaapActivity?.totalCount) || 0,
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg bg-cream px-3 py-2">
                    <p className="text-neutral-500">Total malas</p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {Math.max(
                          0,
                          Number(jaapPopupUser.jaapActivity?.totalMalas) || 0,
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg bg-cream px-3 py-2">
                    <p className="text-neutral-500">Selected mantra</p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {jaapPopupUser.jaapActivity?.selectedMantraLabel || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-cream px-3 py-2">
                    <p className="text-neutral-500">Current target</p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {Number(jaapPopupUser.jaapActivity?.target) || "—"}
                    </p>
                  </div>
                </div>

                {getMantraRows(jaapPopupUser.jaapActivity).length === 0 ? (
                    <EmptyState
                        title="No jaap activity yet"
                        description="This devotee has not synced mantra counters yet."
                    />
                ) : (
                    <div className="max-h-[55vh] overflow-auto rounded-lg border border-neutral-200">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="bg-cream text-xs uppercase tracking-wider text-neutral-600">
                        <tr>
                          <th className="px-3 py-2">Mantra</th>
                          <th className="px-3 py-2">Target</th>
                          <th className="px-3 py-2">Count</th>
                          <th className="px-3 py-2">Malas</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                        {getMantraRows(jaapPopupUser.jaapActivity).map((row) => (
                            <tr key={row.id}>
                              <td className="px-3 py-2">
                                <div className="font-medium text-neutral-900">
                                  {row.label}
                                </div>
                                <div className="text-xs text-neutral-500">
                                  {row.id}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-neutral-700">
                                {row.target ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-neutral-700">
                                {row.count}
                              </td>
                              <td className="px-3 py-2 text-neutral-700">
                                {row.malas}
                              </td>
                            </tr>
                        ))}
                        </tbody>
                      </table>
                    </div>
                )}
              </div>
            </div>
        )}
      </div>
  );
}

function SummaryTile({
                       label,
                       value,
                       tone,
                     }: {
  label: string;
  value: number;
  tone: "primary" | "saffron" | "green" | "neutral";
}) {
  const toneClass =
      tone === "primary"
          ? "border-primary/30 bg-primary/5 text-primary"
          : tone === "saffron"
              ? "border-saffron/40 bg-saffron/10 text-primary"
              : tone === "green"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-neutral-200 bg-white text-neutral-600";
  return (
      <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
        <p className="text-xs font-medium uppercase tracking-wider opacity-80">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </div>
  );
}