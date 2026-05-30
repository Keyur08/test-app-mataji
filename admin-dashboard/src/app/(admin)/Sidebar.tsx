"use client";

// filepath: /Users/a200200348/Documents/AajaPadteHai/GeyMatiMataJiApp/admin-dashboard/src/app/(admin)/Sidebar.tsx
// Admin sidebar with brand styling, nav items, and sign-out.
// Desktop: static left rail. Mobile: off-canvas drawer triggered by a top bar.

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Image as ImageIcon,
  BookOpen,
  CalendarDays,
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
} from "lucide-react";

import { useAuth } from "@/lib/AuthProvider";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/stories", label: "Home Stories", icon: Circle },
  { href: "/admin/slides", label: "Home Carousel", icon: GalleryHorizontalEnd },
  { href: "/admin/aahar-daan", label: "Aahar Daan QR", icon: QrCode },
  { href: "/admin/biography", label: "Biography", icon: User },
  { href: "/admin/media", label: "Manage Media", icon: ImageIcon },
  { href: "/admin/pravachans", label: "Pravachans", icon: Video },
  { href: "/admin/reels", label: "Reels", icon: Film },
  { href: "/admin/texts", label: "Manage Texts", icon: BookOpen },
  { href: "/admin/daily", label: "Daily Updates", icon: CalendarDays },
  { href: "/admin/daily-niyam", label: "Daily नियम", icon: NotebookPen },
  { href: "/admin/registrations", label: "User Registrations", icon: Users },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/branding", label: "Branding", icon: Palette },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOutUser } = useAuth();
  const [open, setOpen] = useState(false);

  // Close drawer on navigation
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

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              <Icon size={18} />
              {item.label}
            </Link>
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
