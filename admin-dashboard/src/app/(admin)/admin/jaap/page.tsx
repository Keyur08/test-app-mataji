"use client";

// Standalone admin page for the Jaap (mala / japa) mantra list. Lifted
// out of `/admin/daily` so it gets its own sidebar entry — keeps the
// "Daily Updates" page focused on the date-specific quote / panchang
// content while jaap mantras live across all days.

import { JaapMantrasEditor } from "../daily/JaapMantrasEditor";

export default function JaapAdminPage() {
  return (
    <div className="space-y-6">
      <JaapMantrasEditor />
    </div>
  );
}
