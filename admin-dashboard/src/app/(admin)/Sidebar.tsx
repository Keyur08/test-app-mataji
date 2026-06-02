"use client";

// filepath: /Users/a200200348/Documents/AajaPadteHai/GeyMatiMataJiApp/admin-dashboard/src/app/(admin)/Sidebar.tsx
// Admin sidebar with brand styling, grouped nav items, and sign-out.
//
// Items are organised into themed sections (Home Screen, Content, Daily &
// Spiritual, Engagement, Users & Outreach, App Settings) so the list
// doesn't read like one long undifferentiated stream. Each section is a
// collapsible accordion that auto-expands when one of its links matches
// the current route, and the user's manual expand/collapse state is
// persisted to `localStorage` so it survives navigations + reloads.
//
// Desktop: static left rail. Mobile: off-canvas drawer triggered by a top bar.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Users,
  LogOut,
  LayoutDashboard,
  Bell,
  Megaphone,
  Menu,
  X,
  Video,
  Film,
  Circle,
  GalleryHorizontalEnd,
  QrCode,
  User,
  Palette,
  NotebookPen,
  FileText,
  Trophy,
  Sparkles,
  Disc3,
  Home,
  Library,
  Sunrise,
  PartyPopper,
  Megaphone as MegaphoneIcon,
  Cog,
} from "lucide-react";

import { useAuth } from "@/lib/AuthProvider";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

type NavSection = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
};

/** Top-level items shown above the sections (no group header). */
const TOP_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
];

const NAV_SECTIONS: NavSection[] = [
  {
    id: "home",
    label: "Home Screen",
    icon: Home,
    items: [
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/stories", label: "Home Stories", icon: Circle },
      {
        href: "/admin/slides",
        label: "Home Carousel",
        icon: GalleryHorizontalEnd,
      },
    ],
  },
  {
    id: "content",
    label: "Content Library",
    icon: Library,
    items: [
      { href: "/admin/pravachans", label: "Pravachans", icon: Video },
      { href: "/admin/reels", label: "Reels", icon: Film },
      { href: "/admin/media", label: "Manage Media", icon: ImageIcon },
      { href: "/admin/texts", label: "Manage Texts", icon: BookOpen },
      { href: "/admin/biography", label: "Biography", icon: User },
      {
        href: "/admin/kratiyas",
        label: "कृतियाँ",
        icon: FileText,
      },
    ],
  },
  {
    id: "daily",
    label: "Daily & Spiritual",
    icon: Sunrise,
    items: [
      { href: "/admin/daily", label: "Daily Updates", icon: CalendarDays },
      { href: "/admin/daily-niyam", label: "Daily नियम", icon: NotebookPen },
      { href: "/admin/jaap", label: "जाप मंत्र", icon: Disc3 },
    ],
  },
  {
    id: "engagement",
    label: "Engagement",
    icon: PartyPopper,
    items: [
      { href: "/admin/pratiyogita", label: "प्रतियोगिता", icon: Trophy },
      { href: "/admin/aahar-daan", label: "Aahar Daan QR", icon: QrCode },
    ],
  },
  {
    id: "outreach",
    label: "Users & Outreach",
    icon: MegaphoneIcon,
    items: [
      {
        href: "/admin/registrations",
        label: "User Registrations",
        icon: Users,
      },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    id: "settings",
    label: "App Settings",
    icon: Cog,
    items: [
      { href: "/admin/branding", label: "Branding", icon: Palette },
      { href: "/admin/splash", label: "Splash Screen", icon: Sparkles },
    ],
  },
];

const STORAGE_KEY = "gyey.admin.sidebar.open-sections";

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function loadOpenSections(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : null;
  } catch {
    return null;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOutUser } = useAuth();
  const [open, setOpen] = useState(false);

  // Which sections are currently expanded. Each section that contains
  // the active route is force-expanded on every render; sections the
  // user has explicitly toggled are remembered via localStorage.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => {
      const stored = loadOpenSections();
      if (stored) return stored;
      // Default: collapse everything; the effect below will expand the
      // section containing the active route on first paint.
      return Object.fromEntries(NAV_SECTIONS.map((s) => [s.id, false]));
    },
  );

  // Force-expand the section that owns the current pathname.
  const activeSectionId = useMemo(() => {
    return (
      NAV_SECTIONS.find((s) =>
        s.items.some((it) => isItemActive(pathname, it)),
      )?.id ?? null
    );
  }, [pathname]);

  useEffect(() => {
    if (!activeSectionId) return;
    setOpenSections((prev) =>
      prev[activeSectionId] ? prev : { ...prev, [activeSectionId]: true },
    );
  }, [activeSectionId]);

  // Persist user toggles.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openSections));
    } catch {
      /* ignore */
    }
  }, [openSections]);

  // Close mobile drawer on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer open (mobile)
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  async function handleSignOut() {
    await signOutUser();
    router.replace("/login");
  }

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function renderLink(item: NavItem) {
    const active = isItemActive(pathname, item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active
            ? "bg-primary text-white shadow-sm"
            : "text-neutral-700 hover:bg-cream hover:text-primary"
        }`}
      >
        <Icon size={16} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  const navContent = (
    <>
      <div className="border-b border-saffron/30 px-5 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-saffron">
            Admin
          </p>
          <h1 className="mt-1 text-lg font-semibold text-primary">
            ज्ञेयश्री माताजी
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="md:hidden rounded-md p-2 text-neutral-600 hover:bg-cream"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {/* Pinned top items (no section header) */}
        <div className="space-y-1">{TOP_ITEMS.map(renderLink)}</div>

        {NAV_SECTIONS.map((section) => {
          const SectionIcon = section.icon;
          const isOpen = !!openSections[section.id];
          const hasActive = section.id === activeSectionId;
          return (
            <div key={section.id} className="">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isOpen}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                  hasActive
                    ? "text-primary"
                    : "text-neutral-500 hover:text-primary"
                }`}
              >
                <SectionIcon size={14} className="text-saffron" />
                <span className="flex-1 text-left">{section.label}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${
                    isOpen ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>
              {isOpen && (
                <div className="mt-1 space-y-1 pl-2">
                  {section.items.map(renderLink)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-saffron/30 px-3 py-4">
        {user?.email && (
          <p className="mb-2 truncate px-3 text-xs text-neutral-500">
            {user.email}
          </p>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-saffron/15 hover:text-primary"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar (hamburger) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-saffron/30 bg-white px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-primary hover:bg-cream"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-base font-semibold text-primary">
          ज्ञेयश्री माताजी
        </h1>
        <span className="w-9" />
      </header>

      {/* Desktop static sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-saffron/30 bg-white">
        {navContent}
      </aside>

      {/* Mobile drawer + backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85%] flex-col border-r border-saffron/30 bg-white shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
