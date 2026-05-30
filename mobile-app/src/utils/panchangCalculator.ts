//
// Offline Daily Panchang calculator.
//
// Uses `astronomy-engine` (pure JS, MIT — works in React Native) for
// rigorous solar/lunar ephemerides + rise/set, and a layered Lahiri
// ayanamsa to derive Vedic sidereal values (Tithi, Nakshatra, Yoga,
// Karana, Rashi). All other panchang items (Paksha, Maas, Samvat,
// Ritu, Rahu kalam, Ayan) are derived purely from the calculated
// longitudes and the local weekday — no API calls, no Firestore.
//
//   generateDailyPanchang(new Date(), 18.56, 73.78, "बालेवाडी");
//

import * as Astro from "astronomy-engine";

/* ── Devanagari lookup sets (frozen public output) ──────────────────── */

const TITHIS_SHUKLA: readonly string[] = [
  "प्रतिपदा",
  "द्वितीया",
  "तृतीया",
  "चतुर्थी",
  "पंचमी",
  "षष्ठी",
  "सप्तमी",
  "अष्टमी",
  "नवमी",
  "दशमी",
  "एकादशी",
  "द्वादशी",
  "त्रयोदशी",
  "चतुर्दशी",
  "पूर्णिमा",
];

const TITHIS_KRISHNA: readonly string[] = [
  "प्रतिपदा",
  "द्वितीया",
  "तृतीया",
  "चतुर्थी",
  "पंचमी",
  "षष्ठी",
  "सप्तमी",
  "अष्टमी",
  "नवमी",
  "दशमी",
  "एकादशी",
  "द्वादशी",
  "त्रयोदशी",
  "चतुर्दशी",
  "अमावस्या",
];

/** Flat tithi list (16 entries) — exposed in the `sets` output. */
const TITHIS_FLAT: readonly string[] = [
  "प्रतिपदा",
  "द्वितीया",
  "तृतीया",
  "चतुर्थी",
  "पंचमी",
  "षष्ठी",
  "सप्तमी",
  "अष्टमी",
  "नवमी",
  "दशमी",
  "एकादशी",
  "द्वादशी",
  "त्रयोदशी",
  "चतुर्दशी",
  "पूर्णिमा",
  "अमावस्या",
];

const NAKSHATRAS: readonly string[] = [
  "अश्विनी",
  "भरणी",
  "कृत्तिका",
  "रोहिणी",
  "मृगशिरा",
  "आर्द्रा",
  "पुनर्वसु",
  "पुष्य",
  "अश्लेषा",
  "मघा",
  "पूर्वा फाल्गुनी",
  "उत्तरा फाल्गुनी",
  "हस्त",
  "चित्रा",
  "स्वाति",
  "विशाखा",
  "अनुराधा",
  "ज्येष्ठा",
  "मूल",
  "पूर्वाषाढ़ा",
  "उत्तराषाढ़ा",
  "श्रवण",
  "धनिष्ठा",
  "शतभिषा",
  "पूर्वा भाद्रपद",
  "उत्तरा भाद्रपद",
  "रेवती",
];

const YOGAS: readonly string[] = [
  "विष्कुम्भ",
  "प्रीति",
  "आयुष्मान्",
  "सौभाग्य",
  "शोभन",
  "अतिगण्ड",
  "सुकर्मा",
  "धृति",
  "शूल",
  "गण्ड",
  "वृद्धि",
  "ध्रुव",
  "व्याघात",
  "हर्षण",
  "वज्र",
  "सिद्धि",
  "व्यतीपात",
  "वरीयान",
  "परिघ",
  "शिव",
  "सिद्ध",
  "साध्य",
  "शुभ",
  "शुक्ल",
  "ब्रह्म",
  "इन्द्र",
  "वैधृति",
];

const KARANAS_MOVABLE: readonly string[] = [
  "बव",
  "बालव",
  "कौलव",
  "तैतिल",
  "गर",
  "वणिज",
  "विष्टि",
];

const KARANAS_FIXED: readonly string[] = [
  "शकुनि",
  "चतुष्पाद",
  "नाग",
  "किंस्तुघ्न",
];

const RASHIS: readonly string[] = [
  "मेष",
  "वृषभ",
  "मिथुन",
  "कर्क",
  "सिंह",
  "कन्या",
  "तुला",
  "वृश्चिक",
  "धनु",
  "मकर",
  "कुम्भ",
  "मीन",
];

/** Hindu lunar months — Purnimanta (north-Indian) order. */
const MONTHS: readonly string[] = [
  "चैत्र",
  "वैशाख",
  "ज्येष्ठ",
  "आषाढ़",
  "श्रावण",
  "भाद्रपद",
  "अश्विन",
  "कार्तिक",
  "मार्गशीर्ष",
  "पौष",
  "माघ",
  "फाल्गुन",
];

/** Sun's sidereal zodiac sign → Purnimanta month name. */
const SIGN_TO_PURNIMANTA_MONTH_IDX: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0,
];

const WEEKDAYS_HI: readonly string[] = [
  "रविवार",
  "सोमवार",
  "मंगलवार",
  "बुधवार",
  "गुरुवार",
  "शुक्रवार",
  "शनिवार",
];

/** Rahu kalam slot (1..8) for each weekday — Sunday..Saturday. */
const RAHU_SLOT: Record<number, number> = {
  0: 8, // Sun
  1: 2, // Mon
  2: 7, // Tue
  3: 5, // Wed
  4: 6, // Thu
  5: 4, // Fri
  6: 3, // Sat
};

const MOON_EMOJIS: readonly string[] = [
  "🌑", // new
  "🌒", // waxing crescent
  "🌓", // first quarter
  "🌔", // waxing gibbous
  "🌕", // full
  "🌖", // waning gibbous
  "🌗", // last quarter
  "🌘", // waning crescent
];

/* ── Output types ───────────────────────────────────────────────────── */

export interface DailyPanchangItem {
  forDate: string;
  dayLabel: string;
  dateLabel: string;
  tithi: string;
  paksha: string;
  month: string;
  samvat: string;
  location: string;
  moonEmoji: string;
  nak: string;
  yog: string;
  kar: string;
  signs: string;
  rahu: string;
  ritu: string;
  vSamvat: string;
  sunrise: string;
  sunset: string;
  eventText: string;
}

export interface DailyPanchangResponse {
  success: boolean;
  item: DailyPanchangItem;
  labels: Record<string, string>;
  sets: {
    tithis: readonly string[];
    months: readonly string[];
  };
  /** Extra fields used by the expanded UI (not part of the frozen JSON shape). */
  extras: {
    weekdayIdx: number;
    sunriseDate: Date | null;
    sunsetDate: Date | null;
    moonriseDate: Date | null;
    moonsetDate: Date | null;
    moonrise: string;
    moonset: string;
    ayan: string;
    shakaSamvat: string;
    purnimantaMonth: string;
    amantaMonth: string;
    /** Two upcoming tithi changeover windows for UI display. */
    tithiWindows: { name: string; from: Date; to: Date }[];
    nakshatraWindows: { name: string; from: Date; to: Date }[];
    /** Per-activity auspiciousness assessment for the day. */
    muhurat: {
      vivah: MuhuratVerdict;       // विवाह
      namkaran: MuhuratVerdict;    // नामकरण
      yatra: MuhuratVerdict;       // यात्रा
      shubh: MuhuratVerdict;       // शुभ कार्य
      varjit: MuhuratVerdict;      // वर्जित
      samanya: MuhuratVerdict;     // सामान्य कार्य
    };
  };
}

/** Single muhurat verdict — `tone` drives the UI color. */
export interface MuhuratVerdict {
  /** "शुभ" / "अशुभ" / "सामान्य" / "हाँ" / "नहीं" */
  label: string;
  /** Free-form short reason (optional, may be empty). */
  note: string;
  tone: "good" | "bad" | "neutral";
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtDateLabel(d: Date): string {
  // शनिवार, 23/05/2026
  const w = WEEKDAYS_HI[d.getDay()];
  return `${w}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fmtTime12(d: Date | null): string {
  if (!d) return "—";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${pad2(m)} ${ampm}`;
}

function fmtTime24(d: Date | null): string {
  if (!d) return "—";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Lahiri ayanamsa (degrees) — accurate to a few arc-seconds for modern dates. */
function lahiriAyanamsa(date: Date): number {
  // J2000.0 = 2000-01-01 12:00 TT. We approximate with UT (~67s offset is negligible).
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const tYears = (date.getTime() - J2000) / (365.2422 * 86400_000);
  // Lahiri at J2000 ≈ 23.85°, drift ≈ 50.2877"/yr.
  return 23.85 + (tYears * 50.2877) / 3600;
}

function normDeg(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

function sunSiderealLongitude(date: Date, ayan: number): number {
  // SunPosition returns true geocentric ecliptic coords of the Sun.
  // (Astro.EclipticLongitude is heliocentric and rejects Body.Sun.)
  return normDeg(Astro.SunPosition(date).elon - ayan);
}

function moonSiderealLongitude(date: Date, ayan: number): number {
  // EclipticGeoMoon returns geocentric ecliptic spherical coords of the Moon.
  return normDeg(Astro.EclipticGeoMoon(date).lon - ayan);
}

/* ── Karana resolver ─────────────────────────────────────────────────── */
//
// 60 half-tithis in a lunar month. Indices 1..56 cycle through 7 movable
// karanas (8 cycles); the last 4 + first 1 (= 57..60, 1) are fixed.
//
function karanaName(halfTithiIdx: number): string {
  // halfTithiIdx is 1..60
  if (halfTithiIdx === 1) return KARANAS_FIXED[3]; // किंस्तुघ्न
  if (halfTithiIdx >= 58) return KARANAS_FIXED[halfTithiIdx - 58]; // 58..60 → शकुनि, चतुष्पाद, नाग
  // 2..57 cycle through 7 movable karanas
  const idx = (halfTithiIdx - 2) % 7;
  return KARANAS_MOVABLE[idx];
}

/* ── Rise/Set search (defensive — astronomy-engine returns AstroTime|null) ── */

function safeRiseSet(
  body: Astro.Body,
  observer: Astro.Observer,
  direction: 1 | -1,
  start: Date,
): Date | null {
  try {
    // Search a 1.5-day window from local midnight so we always find the
    // event for the requested local calendar day.
    const at = Astro.SearchRiseSet(body, observer, direction, start, 1.5);
    return at ? at.date : null;
  } catch {
    return null;
  }
}

/** Return the rise (or set) event whose local date matches `localDay`. */
function findEventOnDay(
  body: Astro.Body,
  observer: Astro.Observer,
  direction: 1 | -1,
  localDay: Date,
): Date | null {
  const dayStart = new Date(
    localDay.getFullYear(),
    localDay.getMonth(),
    localDay.getDate(),
    0,
    0,
    0,
    0,
  );
  // Start a few hours before midnight to catch early-morning events.
  const searchStart = new Date(dayStart.getTime() - 6 * 3600_000);
  let evt = safeRiseSet(body, observer, direction, searchStart);
  // If the first hit is before our target day, search forward.
  let guard = 0;
  while (evt && !isSameDay(evt, localDay) && evt.getTime() < dayStart.getTime() && guard < 3) {
    evt = safeRiseSet(body, observer, direction, new Date(evt.getTime() + 60_000));
    guard++;
  }
  return evt;
}

/* ── Tithi / Nakshatra window finder (boundary by linear interp) ────── */

function findTithiBoundary(after: Date, currentTithiIdx: number): Date {
  // Walk forward in coarse 30-min steps until tithi changes, then refine.
  let t = after.getTime();
  const STEP = 30 * 60_000;
  for (let i = 0; i < 24 * 4; i++) {
    const next = new Date(t + STEP);
    const ay = lahiriAyanamsa(next);
    const sun = sunSiderealLongitude(next, ay);
    const moon = moonSiderealLongitude(next, ay);
    const idx = Math.floor(normDeg(moon - sun) / 12);
    if (idx !== currentTithiIdx) {
      // refine in 1-min bisection
      let lo = t;
      let hi = next.getTime();
      while (hi - lo > 60_000) {
        const mid = (lo + hi) / 2;
        const midDate = new Date(mid);
        const ay2 = lahiriAyanamsa(midDate);
        const sun2 = sunSiderealLongitude(midDate, ay2);
        const moon2 = moonSiderealLongitude(midDate, ay2);
        const mIdx = Math.floor(normDeg(moon2 - sun2) / 12);
        if (mIdx === currentTithiIdx) lo = mid;
        else hi = mid;
      }
      return new Date(hi);
    }
    t = next.getTime();
  }
  return new Date(t);
}

function findNakshatraBoundary(after: Date, currentNakIdx: number): Date {
  let t = after.getTime();
  const STEP = 30 * 60_000;
  for (let i = 0; i < 24 * 4; i++) {
    const next = new Date(t + STEP);
    const ay = lahiriAyanamsa(next);
    const moon = moonSiderealLongitude(next, ay);
    const idx = Math.floor(moon / (360 / 27));
    if (idx !== currentNakIdx) {
      let lo = t;
      let hi = next.getTime();
      while (hi - lo > 60_000) {
        const mid = (lo + hi) / 2;
        const midDate = new Date(mid);
        const ay2 = lahiriAyanamsa(midDate);
        const moon2 = moonSiderealLongitude(midDate, ay2);
        const mIdx = Math.floor(moon2 / (360 / 27));
        if (mIdx === currentNakIdx) lo = mid;
        else hi = mid;
      }
      return new Date(hi);
    }
    t = next.getTime();
  }
  return new Date(t);
}

/* ── Public API ──────────────────────────────────────────────────────── */

/* ── Muhurat (auspiciousness) heuristics ─────────────────────────────── */
//
// Classical rules of thumb (Muhurta Chintamani / Panchang almanacs):
//   • Inauspicious tithis (rikta): 4, 9, 14 of each paksha; also Amavasya (30).
//   • Auspicious tithis: 2, 3, 5, 7, 10, 11, 13 (called Nanda/Bhadra/Jaya/Purna).
//   • Vishti (Bhadra) karana is universally inauspicious for शुभ कार्य.
//   • Inauspicious yogas: विष्कुम्भ(0), अतिगण्ड(5), शूल(8), गण्ड(9), व्याघात(12),
//                         वज्र(14), व्यतीपात(16), परिघ(18), वैधृति(26).
//   • Mool/Jyestha/Ashlesha nakshatras (18, 17, 8) — inauspicious for नामकरण.
//   • Yatra-friendly nakshatras: Ashwini(0), Mrigashira(4), Punarvasu(6),
//     Pushya(7), Hasta(12), Anuradha(16), Shravana(21), Dhanishta(22), Revati(26).
//   • Vivah-friendly nakshatras: Rohini(3), Mrigashira(4), Magha(9),
//     Uttara Phalguni(11), Hasta(12), Swati(14), Anuradha(16), Mula(18),
//     Uttara Ashadha(20), Uttara Bhadrapad(25), Revati(26).
//   • Tuesday/Saturday generally avoided for yatra; Monday/Wed/Thu/Fri preferred.

const RIKTA_TITHIS_IN_PAKSHA = new Set([3, 8, 13]); // 0-indexed within paksha → 4th, 9th, 14th
const NANDA_BHADRA_JAYA_PURNA = new Set([1, 2, 4, 6, 9, 10, 12]); // 0-indexed → 2,3,5,7,10,11,13
const INAUSPICIOUS_YOGAS = new Set([0, 5, 8, 9, 12, 14, 16, 18, 26]);
const NAMKARAN_BAD_NAK = new Set([8, 17, 18]); // अश्लेषा, ज्येष्ठा, मूल
const YATRA_GOOD_NAK = new Set([0, 4, 6, 7, 12, 16, 21, 22, 26]);
const VIVAH_GOOD_NAK = new Set([3, 4, 9, 11, 12, 14, 16, 18, 20, 25, 26]);
const YATRA_BAD_WEEKDAYS = new Set([2, 6]); // Tue, Sat

function computeMuhurat(args: {
  tithiIdx: number;
  nakIdx: number;
  yogIdx: number;
  karana: string;
  paksha: string;
  weekday: number;
}): DailyPanchangResponse["extras"]["muhurat"] {
  const { tithiIdx, nakIdx, yogIdx, karana, weekday } = args;

  const tithiInPaksha = tithiIdx % 15; // 0..14
  const isAmavasya = tithiIdx === 29;
  const isPurnima = tithiIdx === 14;
  const isRikta = RIKTA_TITHIS_IN_PAKSHA.has(tithiInPaksha);
  const isNandaJaya = NANDA_BHADRA_JAYA_PURNA.has(tithiInPaksha);
  const isVishti = karana === "विष्टि"; // Bhadra
  const isBadYoga = INAUSPICIOUS_YOGAS.has(yogIdx);

  // ── शुभ कार्य (general auspicious works) ──
  const shubhBad = isRikta || isAmavasya || isVishti || isBadYoga;
  const shubhGood = !shubhBad && (isNandaJaya || isPurnima);
  const shubh: MuhuratVerdict = shubhBad
    ? {
        label: "अशुभ",
        tone: "bad",
        note: isVishti
          ? "विष्टि (भद्रा) करण"
          : isAmavasya
          ? "अमावस्या"
          : isRikta
          ? "रिक्ता तिथि"
          : "अशुभ योग",
      }
    : shubhGood
    ? { label: "शुभ", tone: "good", note: "तिथि व योग अनुकूल" }
    : { label: "सामान्य", tone: "neutral", note: "" };

  // ── वर्जित (forbidden / strictly avoid) ──
  const varjitFlag = isVishti || isAmavasya || isBadYoga;
  const varjit: MuhuratVerdict = varjitFlag
    ? {
        label: "हाँ",
        tone: "bad",
        note: isVishti ? "भद्रा काल" : isAmavasya ? "अमावस्या" : "अशुभ योग",
      }
    : { label: "नहीं", tone: "good", note: "कोई दोष नहीं" };

  // ── सामान्य कार्य (routine work) ── almost always fine unless severely bad
  const samanya: MuhuratVerdict =
    isVishti && isBadYoga
      ? { label: "अशुभ", tone: "bad", note: "भद्रा + अशुभ योग" }
      : { label: "शुभ", tone: "good", note: "दैनिक कार्य हेतु ठीक" };

  // ── विवाह ──
  const vivahNakOk = VIVAH_GOOD_NAK.has(nakIdx);
  const vivah: MuhuratVerdict = (() => {
    if (isAmavasya || isVishti || isBadYoga)
      return { label: "अशुभ", tone: "bad" as const, note: "तिथि/योग दोष" };
    if (isRikta)
      return { label: "अशुभ", tone: "bad" as const, note: "रिक्ता तिथि" };
    if (vivahNakOk)
      return {
        label: "शुभ",
        tone: "good" as const,
        note: `${NAKSHATRAS[nakIdx]} अनुकूल`,
      };
    return { label: "सामान्य", tone: "neutral" as const, note: "नक्षत्र सामान्य" };
  })();

  // ── नामकरण ──
  const namkaranBadNak = NAMKARAN_BAD_NAK.has(nakIdx);
  const namkaran: MuhuratVerdict = namkaranBadNak
    ? {
        label: "अशुभ",
        tone: "bad",
        note: `${NAKSHATRAS[nakIdx]} त्याज्य`,
      }
    : isVishti || isBadYoga
    ? { label: "अशुभ", tone: "bad", note: "योग/करण दोष" }
    : isRikta
    ? { label: "सामान्य", tone: "neutral", note: "रिक्ता तिथि" }
    : { label: "शुभ", tone: "good", note: "नक्षत्र अनुकूल" };

  // ── यात्रा ──
  const yatraNakOk = YATRA_GOOD_NAK.has(nakIdx);
  const yatraBadDay = YATRA_BAD_WEEKDAYS.has(weekday);
  const yatra: MuhuratVerdict = (() => {
    if (isVishti || isAmavasya)
      return { label: "वर्जित", tone: "bad" as const, note: "भद्रा/अमावस्या" };
    if (yatraBadDay)
      return {
        label: "अशुभ",
        tone: "bad" as const,
        note: `${WEEKDAYS_HI[weekday]} त्याज्य`,
      };
    if (yatraNakOk)
      return {
        label: "शुभ",
        tone: "good" as const,
        note: `${NAKSHATRAS[nakIdx]} अनुकूल`,
      };
    return { label: "सामान्य", tone: "neutral" as const, note: "" };
  })();

  return { vivah, namkaran, yatra, shubh, varjit, samanya };
}

/* ── Public API ──────────────────────────────────────────────────────── */

/**
 * Generate daily panchang for a specific date and location.
 *
 * @param date  Local calendar date (we use its local Y/M/D + the local TZ).
 * @param lat   Latitude in degrees (north positive).
 * @param lon   Longitude in degrees (east positive).
 * @param locationLabel  Human-readable place name (Devanagari preferred).
 */
export function generateDailyPanchang(
  date: Date,
  lat: number,
  lon: number,
  locationLabel: string = "भारत",
): DailyPanchangResponse {
  const observer = new Astro.Observer(lat, lon, 0);

  // Use local-noon for the "snapshot" panchang values that apply across the day.
  const noon = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
    0,
  );

  // Ayanamsa + sidereal longitudes
  const ayan = lahiriAyanamsa(noon);
  const sunSid = sunSiderealLongitude(noon, ayan);
  const moonSid = moonSiderealLongitude(noon, ayan);

  // Tithi
  const diff = normDeg(moonSid - sunSid);
  const tithiIdx = Math.floor(diff / 12); // 0..29
  const paksha = tithiIdx < 15 ? "शुक्ल पक्ष" : "कृष्ण पक्ष";
  const tithi =
    tithiIdx < 15
      ? TITHIS_SHUKLA[tithiIdx]
      : TITHIS_KRISHNA[tithiIdx - 15];

  // Karana — two half-tithis per tithi
  const halfTithi = Math.floor(diff / 6) + 1; // 1..60
  const karana = karanaName(halfTithi);

  // Nakshatra (moon sidereal)
  const nakIdx = Math.floor(moonSid / (360 / 27));
  const nakshatra = NAKSHATRAS[nakIdx];

  // Yoga = (sun + moon) sidereal / (360/27)
  const yogIdx = Math.floor(normDeg(sunSid + moonSid) / (360 / 27));
  const yoga = YOGAS[yogIdx];

  // Rashi (moon sign)
  const rashiIdx = Math.floor(moonSid / 30);
  const rashi = RASHIS[rashiIdx];

  // Month (Purnimanta) — from Sun's sidereal sign
  const sunSignIdx = Math.floor(sunSid / 30);
  const purnimantaMonthIdx = SIGN_TO_PURNIMANTA_MONTH_IDX[sunSignIdx];
  const purnimantaMonth = MONTHS[purnimantaMonthIdx];
  const amantaMonthIdx = (purnimantaMonthIdx + 11) % 12;
  const amantaMonth = MONTHS[amantaMonthIdx];

  // Samvat
  const y = date.getFullYear();
  const month = date.getMonth(); // 0-based
  // Vikram Samvat: starts around mid-April (Chaitra). Approx: from Apr 14 onwards, VS = year + 57.
  const vsYear =
    month > 3 || (month === 3 && date.getDate() >= 14) ? y + 57 : y + 56;
  const shakaYear = vsYear - 135;

  // Ritu (season) — by Purnimanta month index
  const ritu = (() => {
    switch (purnimantaMonthIdx) {
      case 0: // Chaitra
      case 1: // Vaishakh
        return "वसंत";
      case 2: // Jyeshtha
      case 3: // Ashadha
        return "ग्रीष्म";
      case 4: // Shravan
      case 5: // Bhadrapad
        return "वर्षा";
      case 6: // Ashwin
      case 7: // Kartik
        return "शरद";
      case 8: // Margashirsh
      case 9: // Paush
        return "हेमंत";
      default: // Magh, Phalgun
        return "शिशिर";
    }
  })();

  // Ayan — Uttarayan when Sun sign is Makar..Mithun (9,10,11,0,1,2)
  const ayan_dir =
    sunSignIdx >= 9 || sunSignIdx <= 2 ? "उत्तरायण" : "दक्षिणायन";

  // Moon phase emoji (tropical phase angle suffices)
  const moonPhaseDeg = Astro.MoonPhase(noon); // 0..360
  const phaseSlot = Math.round(moonPhaseDeg / 45) % 8;
  const moonEmoji = MOON_EMOJIS[phaseSlot];

  // Sunrise / Sunset / Moonrise / Moonset
  const sunrise = findEventOnDay(Astro.Body.Sun, observer, 1, date);
  const sunset = findEventOnDay(Astro.Body.Sun, observer, -1, date);
  const moonrise = findEventOnDay(Astro.Body.Moon, observer, 1, date);
  const moonset = findEventOnDay(Astro.Body.Moon, observer, -1, date);

  // Rahu kalam — split [sunrise, sunset] into 8 equal parts
  const rahu = (() => {
    if (!sunrise || !sunset) return "—";
    const slot = RAHU_SLOT[date.getDay()];
    const totalMs = sunset.getTime() - sunrise.getTime();
    const partMs = totalMs / 8;
    const start = new Date(sunrise.getTime() + (slot - 1) * partMs);
    const end = new Date(sunrise.getTime() + slot * partMs);
    return `${fmtTime24(start)} - ${fmtTime24(end)}`;
  })();

  // Tithi & Nakshatra changeover windows (current + next)
  const tithiEnd = findTithiBoundary(noon, tithiIdx);
  const tithiStart = (() => {
    // walk backwards
    const back = new Date(noon.getTime() - 24 * 3600_000);
    return findTithiBoundary(back, (tithiIdx + 29) % 30);
  })();
  const nextTithiIdx = (tithiIdx + 1) % 30;
  const nextTithiName =
    nextTithiIdx < 15
      ? `शुक्ल पक्ष ${TITHIS_SHUKLA[nextTithiIdx]}`
      : `कृष्ण पक्ष ${TITHIS_KRISHNA[nextTithiIdx - 15]}`;
  const tithiEnd2 = findTithiBoundary(tithiEnd, nextTithiIdx);

  const currentTithiLabel = `${paksha} ${tithi}`;

  const nakEnd = findNakshatraBoundary(noon, nakIdx);
  const nakStart = (() => {
    const back = new Date(noon.getTime() - 24 * 3600_000);
    return findNakshatraBoundary(back, (nakIdx + 26) % 27);
  })();
  const nextNakIdx = (nakIdx + 1) % 27;
  const nextNakName = NAKSHATRAS[nextNakIdx];
  const nakEnd2 = findNakshatraBoundary(nakEnd, nextNakIdx);

  // Muhurat (auspiciousness) — heuristic but consistent with classical rules.
  const muhurat = computeMuhurat({
    tithiIdx,
    nakIdx,
    yogIdx,
    karana,
    paksha,
    weekday: date.getDay(),
  });

  // Compose label fields
  const today = new Date();
  const dayLabel = isSameDay(date, today)
    ? "आज"
    : isSameDay(
        date,
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
      )
    ? "कल"
    : isSameDay(
        date,
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
      )
    ? "बीता कल"
    : WEEKDAYS_HI[date.getDay()];

  const item: DailyPanchangItem = {
    forDate: fmtISO(date),
    dayLabel,
    dateLabel: fmtDateLabel(date),
    tithi,
    paksha,
    month: purnimantaMonth,
    samvat: `${vsYear} वि.सं.`,
    location: locationLabel,
    moonEmoji,
    nak: nakshatra,
    yog: yoga,
    kar: karana,
    signs: rashi,
    rahu,
    ritu,
    vSamvat: String(vsYear),
    sunrise: fmtTime12(sunrise),
    sunset: fmtTime12(sunset),
    eventText: "🙏 शुभ कार्य हेतु पंचांग देखें",
  };

  return {
    success: true,
    item,
    labels: {
      nak: "नक्षत्र",
      yog: "योग",
      kar: "करण",
      signs: "राशि",
      rahu: "राहु काल",
      ritu: "ऋतु",
      vSamvat: "विक्रम संवत",
    },
    sets: {
      tithis: TITHIS_FLAT,
      months: MONTHS,
    },
    extras: {
      weekdayIdx: date.getDay(),
      sunriseDate: sunrise,
      sunsetDate: sunset,
      moonriseDate: moonrise,
      moonsetDate: moonset,
      moonrise: fmtTime12(moonrise),
      moonset: fmtTime12(moonset),
      ayan: ayan_dir,
      shakaSamvat: String(shakaYear),
      purnimantaMonth,
      amantaMonth,
      tithiWindows: [
        { name: currentTithiLabel, from: tithiStart, to: tithiEnd },
        { name: nextTithiName, from: tithiEnd, to: tithiEnd2 },
      ],
      nakshatraWindows: [
        { name: nakshatra, from: nakStart, to: nakEnd },
        { name: nextNakName, from: nakEnd, to: nakEnd2 },
      ],
      muhurat,
    },
  };
}

/** Preset list of locations exposed to the UI. */
export interface PanchangLocation {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

export const PRESET_LOCATIONS: readonly PanchangLocation[] = [
  { id: "kolkata", label: "Kolkata, India", lat: 22.5726, lon: 88.3639 },
  { id: "ujjain", label: "Ujjain, India", lat: 23.1765, lon: 75.7885 },
  { id: "delhi", label: "Delhi, India", lat: 28.6139, lon: 77.209 },
  { id: "mumbai", label: "Mumbai, India", lat: 19.076, lon: 72.8777 },
  { id: "bangalore", label: "Bengaluru, India", lat: 12.9716, lon: 77.5946 },
  { id: "pune", label: "Pune, India", lat: 18.5204, lon: 73.8567 },
];

/** Default fallback when user hasn't picked a location yet. */
export const DEFAULT_LOCATION: PanchangLocation = PRESET_LOCATIONS[2]; // Delhi
