// Shared Firestore data model types used by both apps.
// Add your domain types here so the mobile + admin stay in sync.
//
// We intentionally avoid importing from "firebase/firestore" here so this file
// can be consumed from any project without forcing it to depend on Firebase.

/** Minimal structural type compatible with firebase/firestore `Timestamp`. */
export interface TimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

export type ContentCategory =
  | "bhajan"
  | "lecture"
  | "article"
  | "video"
  | "audio";

export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  category: ContentCategory;
  mediaUrl?: string;
  thumbnailUrl?: string;
  publishedAt: TimestampLike;
  authorId: string;
  tags?: string[];
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: "devotee" | "moderator" | "admin";
  createdAt: TimestampLike;
}

export interface SatsangEvent {
  id: string;
  title: string;
  location: string;
  startsAt: TimestampLike;
  endsAt: TimestampLike;
  description?: string;
  bannerUrl?: string;
}

/**
 * Today's banner — one document stored at `app_state/today`.
 * Updated daily by the admin dashboard.
 */
export interface DailyBanner {
  /** Jain Panchang date, e.g. "Vaishakh Shukla 7, Vir Samvat 2552" */
  panchangDate: string;
  /** Optional english/gregorian date label */
  gregorianDate?: string;
  updatedAt: TimestampLike;
}

/**
 * Thought of the day (Gyeyvani). One document per calendar date in
 * the `gyeyvani` collection (docId = YYYY-MM-DD).
 */
export interface Gyeyvani {
  id: string;
  /** Devanagari quote */
  quote: string;
  /** Optional English translation */
  translation?: string;
  /** Attribution, e.g. "— Acharya Shree" */
  author?: string;
  /** Optional illustration shown above the quote. */
  imageUrl?: string;
  /** Storage path so the image can be cleaned up on replace/delete. */
  imageStoragePath?: string;
  date: TimestampLike;
}

/**
 * Announcement / news document in `news_events` collection.
 */
export interface NewsEvent {
  id: string;
  title: string;
  summary?: string;
  body?: string;
  imageUrl?: string;
  /** "announcement" | "event" | "news" */
  kind?: "announcement" | "event" | "news";
  publishedAt: TimestampLike;
}

/**
 * A devotional audio track stored in the `bhajans` collection.
 */
export interface Bhajan {
  id: string;
  title: string;
  artist?: string;
  /** Public HTTPS URL to the audio file (mp3/m4a). */
  audioUrl: string;
  /** Optional cover art URL. */
  artworkUrl?: string;
  /** Duration in seconds (optional, mostly informational). */
  durationSec?: number;
  /** Display order — lower numbers first. */
  order?: number;
  createdAt?: TimestampLike;
}

/**
 * A single readable text in the `texts_library` collection
 * (Poojan, Aarti, Chalisa, etc).
 */
export interface LibraryText {
  id: string;
  /** e.g. "Mahaveer Chalisa" */
  title: string;
  /** e.g. "Chalisa" / "Aarti" / "Poojan" */
  category: string;
  /** Optional short description shown in the list. */
  subtitle?: string;
  /** Full text body in Devanagari (or any language). Stored as plain text
   *  with `\n` line breaks. */
  body: string;
  /** Optional language tag, e.g. "hi", "en". */
  language?: string;
  /** Display order within a category. */
  order?: number;
  updatedAt?: TimestampLike;
}

/**
 * A gallery album in the `gallery_albums` collection.
 * Photos in `gallery_photos` reference an album by `albumId`.
 */
export interface GalleryAlbum {
  id: string;
  /** Free-text album name, e.g. "Vihar 2026", "Diwali 2025". */
  name: string;
  /** Optional short description shown under the title. */
  description?: string;
  /** Optional cover image URL (else first photo is used in the app). */
  coverUrl?: string;
  /** Display order — lower numbers first. */
  order?: number;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

/**
 * A single photo in the `gallery_photos` collection.
 */
export interface GalleryPhoto {
  id: string;
  /** Public HTTPS URL for the full-size image. */
  imageUrl: string;
  /** Optional smaller URL for grid thumbnails (falls back to imageUrl). */
  thumbnailUrl?: string;
  caption?: string;
  /** Album document id (preferred). */
  albumId?: string;
  /** Album display name (denormalised copy of GalleryAlbum.name). */
  album?: string;
  order?: number;
  createdAt?: TimestampLike;
}

/**
 * A pravachan / discourse stored in the `pravachans` collection.
 *
 * Each entry is **either** a YouTube video (`youtubeUrl`) **or** an audio
 * recording (`audioUrl`) — never both. The mobile app picks the right
 * renderer based on which field is set:
 *   - Video → embedded / opens in YouTube.
 *   - Audio → plays through the global background audio player (same as
 *     bhajans, with lock-screen controls).
 */
export interface Pravachan {
  id: string;
  title: string;
  /** YouTube URL or 11-char video id. Set when this is a video pravachan. */
  youtubeUrl?: string;
  /** Public HTTPS URL of the uploaded audio (mp3/m4a). Set when this is an
   *  audio pravachan. */
  audioUrl?: string;
  /** Storage path for cleanup on replace/delete. */
  audioStoragePath?: string;
  /** Optional cover art shown in lists / lock screen for audio pravachans. */
  thumbnailUrl?: string;
  thumbnailStoragePath?: string;
  /** Size of the audio file in bytes (optional, informational). */
  audioSizeBytes?: number;
  speaker?: string;
  description?: string;
  /** Duration in seconds (optional). */
  durationSec?: number;
  publishedAt?: TimestampLike;
  order?: number;
}

/**
 * A short vertical reel / story video stored in the `reels` collection.
 * Video file lives in Firebase Storage (typically a portrait MP4 ≤ 60s).
 */
export interface Reel {
  id: string;
  /** Short title shown over the reel. */
  title?: string;
  /** Caption / description shown below the title. */
  caption?: string;
  /** Public HTTPS URL of the uploaded video (mp4/mov). */
  videoUrl: string;
  /** Storage path for cleanup on delete. */
  storagePath?: string;
  /** Optional thumbnail image URL (e.g. first-frame poster). */
  thumbnailUrl?: string;
  thumbnailStoragePath?: string;
  /** Display order — lower numbers first. */
  order?: number;
  sizeBytes?: number;
  durationSec?: number;
  createdAt?: TimestampLike;
}

/**
 * Aahar Daan registration submitted from the mobile app.
 * Stored in the `registrations` collection.
 */
export interface AaharDaanRegistration {
  id: string;
  /** Devotee's full name. */
  name: string;
  /** Phone number with country code (digits only or with +). */
  phone: string;
  /** Address / city where aahar daan is being offered. */
  location: string;
  /** Selected calendar date as ISO string (YYYY-MM-DD). */
  date: string;
  /** Optional notes from the devotee. */
  notes?: string;
  /** Server-set on write. */
  createdAt: TimestampLike;
  status?: "pending" | "confirmed" | "cancelled";
}

/**
 * A configurable Instagram-style "story" circle shown at the top of the
 * mobile Home screen. Admins configure these from /admin/stories.
 */
export type HomeStoryLinkType =
  | "tab"
  | "gallery-section"
  | "route"
  | "url";

export interface HomeStory {
  id: string;
  /** Short label shown under the circle, e.g. "News", "Gallery". */
  name: string;
  /**
   * Optional public HTTPS URL of the circular avatar image. When omitted,
   * the mobile app renders a religious lotus icon fallback inside the
   * configured ring color.
   */
  imageUrl?: string;
  /** Storage path so the image can be cleaned up on delete. */
  imageStoragePath?: string;
  /** What happens on tap. */
  linkType: HomeStoryLinkType;
  /**
   * Target for the link:
   *  - linkType "tab"             → "home" | "library" | "audio" | "gallery"
   *  - linkType "gallery-section" → "photos" | "pravachans" | "reels"
   *  - linkType "route"           → expo-router path, e.g. "/news"
   *  - linkType "url"             → full https URL
   */
  linkTarget: string;
  /** Optional accent color (hex) for the ring around the circle. */
  ringColor?: string;
  /** Display order — lower numbers first. */
  order?: number;
  /** Whether the story is visible in the app. */
  active?: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

/**
 * A configurable hero carousel slide shown on the mobile Home screen,
 * just below the greeting. Admins manage these in /admin/slides.
 */
export interface HomeSlide {
  id: string;
  /** Public HTTPS URL of the slide image (landscape works best, ~16:9). */
  imageUrl: string;
  /** Storage path for cleanup on delete. */
  imageStoragePath?: string;
  /** Optional headline shown over the image. */
  title?: string;
  /** Optional subtitle / supporting text. */
  subtitle?: string;
  /**
   * Optional tap action — same shape as HomeStory's link fields.
   * If `linkType` is unset the slide is not tappable.
   */
  linkType?: HomeStoryLinkType;
  linkTarget?: string;
  /** Display order — lower numbers first. */
  order?: number;
  /** Whether the slide is visible in the app. */
  active?: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

/**
 * Aahar Daan QR card configuration — single document stored at
 * `app_config/aahar_daan`. Admins manage it from /admin/aahar-daan.
 */
export interface AaharDaanConfig {
  /** Public HTTPS URL of the QR code image. */
  qrImageUrl?: string;
  /** Storage path so the image can be cleaned up on replace/delete. */
  qrImageStoragePath?: string;
  /** Devanagari title shown on the card (e.g. "आहार दान"). */
  title?: string;
  /** Short Devanagari subtitle / tagline. */
  subtitle?: string;
  /** Longer descriptive paragraph shown above the QR. */
  description?: string;
  /** Optional override for the download button label. */
  downloadLabel?: string;
  updatedAt?: TimestampLike;
}

/**
 * Daily startup popup configuration — single document stored at
 * `app_config/daily_popup`. When `active` is true and `imageUrl` is set,
 * the mobile app shows the image in a full-screen modal on launch. Each
 * device dismisses it for the day; if the admin updates the image, the
 * `updatedAt` timestamp changes and devices show it again on next launch.
 */
export interface DailyPopupConfig {
  /** Public HTTPS URL of the popup image. */
  imageUrl?: string;
  /** Storage path for cleanup on replace/delete. */
  imageStoragePath?: string;
  /** Master switch — when false, the popup is never shown. */
  active?: boolean;
  /** Optional tap target. When set, tapping the image opens this URL. */
  linkUrl?: string;
  updatedAt?: TimestampLike;
}

/* ------------------------------------------------------------------ */
/* Jaap (japa / mala) mantras — admin-configurable list                */
/* ------------------------------------------------------------------ */

/**
 * A single mantra entry shown in the mobile Jaap screen's mantra picker.
 * `label` is the short chip label (e.g. "णमोकार"); `text` is the full
 * mantra body displayed inside the counter ring — may span multiple
 * lines (separated by `\n`).
 */
export interface JaapMantra {
  id: string;
  label: string;
  text: string;
  /** Optional audio recitation of the mantra; loops on the mobile screen. */
  audioUrl?: string;
  /** Storage path for cleanup when audio is replaced/removed. */
  audioStoragePath?: string;
}

/**
 * Admin-configurable list of mantras, stored at
 * `app_config/jaap_mantras` as `{ mantras: JaapMantra[] }`.
 */
export interface JaapMantrasConfig {
  mantras?: JaapMantra[];
  updatedAt?: TimestampLike;
}

/* ------------------------------------------------------------------ */
/* Biography — single document at `app_config/biography`              */
/* ------------------------------------------------------------------ */

export interface BiographyAudio {
  title?: string;
  url?: string;
  storagePath?: string;
}

export interface BiographyChaturmas {
  year?: string;
  location?: string;
}

export interface BiographyBasicDetails {
  formerName?: string;
  parents?: string;
  city?: string;
  birthPlace?: string;
  dob?: string;
  timeOfBirth?: string;
  education?: string;
  family?: string;
  vairagyaInspiration?: string;
  brahmacharyaVratDate?: string;
  dikshaDate?: string;
  dikshaPlace?: string;
  dikshaGuru?: string;
  interests?: string;
}

export interface BiographyAchievementImage {
  url: string;
  storagePath?: string;
  caption?: string;
}

/**
 * Full biography document for the saint. Single Firestore document at
 * `app_config/biography`, edited from /admin/biography and read on the
 * mobile Biography screen.
 */
export interface Biography {
  heroImageUrl?: string;
  heroImageStoragePath?: string;
  designations?: string[];
  basicDetails?: BiographyBasicDetails;
  chaturmasList?: BiographyChaturmas[];
  spiritualJourney?: string[];
  teachings?: string[];
  achievementImages?: BiographyAchievementImage[];
  introAudio?: BiographyAudio;
  footerQuote?: string;
  footerQuoteAuthor?: string;
  updatedAt?: TimestampLike;
}

/**
 * App-wide branding & static content edited from `/admin/branding` and
 * stored at `app_config/branding`. Read on the mobile app at boot — every
 * field is optional and the UI falls back to the original hardcoded values
 * when a field is missing.
 */
export interface BrandingConfig {
  /** Devanagari display name shown in the top header. */
  appName?: string;
  /** Small English / transliterated subtitle below the name. */
  appSubtitle?: string;
  /** Public HTTPS URL for the in-app logo (top-header circle). */
  logoUrl?: string;
  logoStoragePath?: string;

  // --- About Us card ---
  aboutTitleHindi?: string;
  aboutTitleEnglish?: string;
  aboutParagraphs?: string[];
  aboutFlourish?: string;

  // --- Contact Us card ---
  contactTitle?: string;
  contactHeadlineHindi?: string;
  contactHeadlineEnglish?: string;
  /** E.164 phone for tel: link, e.g. "+917600122404". */
  contactPhone?: string;
  /** Display-formatted phone label shown on the button. */
  contactPhoneLabel?: string;
  contactHoursText?: string;

  // --- Additional reach / social links (all optional) ---
  /** General-purpose phone number (E.164). Often same as contactPhone. */
  phoneNumber?: string;
  /** Phone for direct WhatsApp message (digits only, country code prefixed). */
  whatsappNumber?: string;
  /** Invite link to the public WhatsApp group. */
  whatsappGroupUrl?: string;
  /** Public WhatsApp channel URL. */
  whatsappChannelUrl?: string;
  /** Google Maps URL for navigation / "Open in Maps". */
  googleMapsUrl?: string;
  /** Display label for the location row, e.g. "ज्ञेयश्री माताजी — मार्ग देखें". */
  locationTitle?: string;
  /** YouTube channel URL. */
  youtubeUrl?: string;
  /** Facebook page URL. */
  facebookUrl?: string;
  /** Instagram profile URL. */
  instagramUrl?: string;
  /**
   * Public link to install / open the mobile app (Play Store, deep link, or
   * web landing). Used by share sheets across the app (e.g. Pratiyogita).
   * If empty, share messages will omit the link.
   */
  shareAppUrl?: string;

  // --- Theme / color palette (all hex strings like "#B8336A") ---
  /** Brand primary color (CTA backgrounds, headings). Default "#B8336A". */
  themePrimary?: string;
  /** Slightly darker primary for hover/pressed states. Default "#A02D5F". */
  themePrimaryDark?: string;
  /** Saffron accent (badges, ornaments). Default "#F4A261". */
  themeSaffron?: string;
  /** Cream / off-white page background. Default "#FFF8F0". */
  themeCream?: string;
  /** Warm brown subtitle text color. Default "#A0522D". */
  themeAccent?: string;
  /** Foreground used on top of primary backgrounds. Default "#FFFFFF". */
  themeTextOnPrimary?: string;
  /** Top header background color. Default "#FFF8F0". */
  themeHeaderBg?: string;
  marqueeString?:string;
  updatedAt?: TimestampLike;
}

/**
 * Intelligent configurable splash screen — single doc at
 * `app_config/splash`. The mobile app downloads the image + audio to
 * `FileSystem.documentDirectory` on first launch and re-downloads only
 * when `updatedAt` changes (compared against AsyncStorage). When the
 * devotee taps "Begin", the app routes to `targetRoute` if logged in,
 * else to `/login`.
 */
export interface SplashConfig {
  /** Public HTTPS image URL (cover artwork). */
  imageUrl?: string;
  imageStoragePath?: string;
  /** Public HTTPS audio URL (mp3 / m4a). Plays on splash mount. */
  audioUrl?: string;
  audioStoragePath?: string;
  /**
   * In-app route to push when devotee taps "Begin" (e.g. `/`, `/jaap`,
   * `/pratiyogita`). Defaults to `/` (Home tab).
   */
  targetRoute?: string;
  /** When false, the splash is skipped entirely. Default true. */
  enabled?: boolean;
  updatedAt?: TimestampLike;
}

export type Gender = "male" | "female" | "other";
export type MaritalStatus = "married" | "unmarried";

/**
 * Devotee profile captured by the mandatory registration screen shown on
 * first app launch (before the Home tab). Stored at `users/{mobile}` where
 * the doc id is the devotee's 10-digit mobile number, so the same person
 * gets a single record across app re-installs, second devices and the web.
 * The `uids` array tracks every anonymous Firebase Auth uid that has
 * claimed this profile (used by Firestore Rules to authorise updates).
 */
export interface UserProfile {
  /** Most recent anonymous Firebase Auth uid that claimed the profile. */
  uid: string;
  /** Every anon uid that has ever claimed this profile (for rules). */
  uids?: string[];
  name: string;
  location: string;
  /** 10-digit Indian mobile (without +91). Doubles as the doc id. */
  mobile: string;
  /** Optional email. */
  email?: string;
  /** ISO date string YYYY-MM-DD. */
  dob: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  /** ISO date string YYYY-MM-DD — only set when maritalStatus === "married". */
  marriageDate?: string;
  createdAt: TimestampLike;
  updatedAt?: TimestampLike;
}

/**
 * Daily नियम (vow / discipline) published by the admin. One document per
 * calendar day at `daily_niyam/{YYYY-MM-DD}`. Devotees see it on the Home
 * tab and tap "नियम स्वीकार करें" to opt in; each acceptance is written to
 * `daily_niyam/{date}/accepts/{mobile}`.
 */
export interface DailyNiyam {
  /** YYYY-MM-DD (also the doc id). */
  date: string;
  title: string;
  body?: string;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

/** A single devotee's acceptance of a day's नियम. */
export interface DailyNiyamAccept {
  /** Doc id == devotee's 10-digit mobile (matches `users/{mobile}`). */
  mobile: string;
  name: string;
  uid: string;
  acceptedAt: TimestampLike;
}

/**
 * Guru Maa ki Kratiya — admin-uploaded PDF library. One Firestore doc per
 * PDF at `kratiyas/{autoId}`. The mobile Home tab has a card that opens
 * `/kratiyas` (list + search). Tapping a row opens `/kratiyas/[id]` which
 * renders the PDF full-screen via WebView and offers a "Download" action.
 */
export interface Kratiya {
  /** Auto-generated Firestore doc id. */
  id?: string;
  /** Display title (Hindi/English). */
  title: string;
  /** Optional short description / author / series. */
  description?: string;
  /** Cover image (shown on the home card + list rows). */
  coverUrl?: string | null;
  coverStoragePath?: string | null;
  /** The actual PDF download URL. */
  pdfUrl: string;
  pdfStoragePath?: string | null;
  /** Original file name (for the "Download as" hint). */
  pdfFileName?: string;
  /** File size in bytes (for the list row). */
  pdfSize?: number;
  /** Manual ordering — lower numbers float to the top. Defaults to 0. */
  order?: number;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

/* ============================================================================
 * Pratiyogita — Daily Quiz Competition
 *
 *   • Collection `quizzes/{quizId}` — one document per quiz (typically one
 *     per day). Public read while running (without `correctOptionIndex`);
 *     admins manage writes.
 *   • Sub-collection `quizzes/{quizId}/results/{mobile}` — devotee
 *     submissions. A devotee can submit at most once per quiz.
 *   • Collection `quiz_settings/{key}` — reusable global defaults (rules,
 *     prize template) the admin can pull into a new quiz with one click.
 *     Suggested doc ids: `default_rules`, `default_prize`.
 * ============================================================================ */

/** A single multiple-choice question stored inside a quiz document. */
export interface QuizQuestion {
  /** Stable id used as the React key + for the per-question answer map. */
  id: string;
  question: string;
  /** 2–6 options. */
  options: string[];
  /** Index into `options` — the correct answer. Stripped client-side while
   *  the quiz is `running` (see security rules / data hygiene below). */
  correctOptionIndex: number;
  /** Optional one-line explanation shown on the "Past" review screen. */
  explanation?: string;
}

export interface QuizPrize {
  title: string;
  description?: string;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
}

/** Mirrored on the doc so Firestore queries (e.g. "list past quizzes ordered
 *  by date desc") stay cheap. The admin form keeps it in sync. */
export type QuizStatus = "upcoming" | "running" | "past";

export interface Quiz {
  id?: string;
  /** The "live" day for this quiz. */
  date: TimestampLike;
  startsAt: TimestampLike;
  endsAt: TimestampLike;
  status: QuizStatus;

  title: string;
  description?: string;
  imageUrl?: string | null;
  imageStoragePath?: string | null;

  rules?: string;
  prize?: QuizPrize;

  questions: QuizQuestion[];

  /** Denormalised counters maintained by the submission flow. */
  participantCount?: number;
  /** Cached questions.length for headline displays. */
  totalQuestions?: number;

  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

/** One submission. Doc id IS the devotee's 10-digit mobile (matches
 *  `users/{mobile}`), so each devotee can submit at most once per quiz. */
export interface QuizResult {
  id?: string;
  mobile: string;
  name?: string;
  uid: string;
  /** Index chosen for each question, keyed by question id. */
  answers: Record<string, number>;
  score: number;
  total: number;
  /** Time the devotee took, in ms (optional client telemetry). */
  durationMs?: number;
  submittedAt: TimestampLike;
}

/** Reusable defaults the admin drops into a new quiz with one click. */
export interface QuizSettings {
  id?: string;
  rules?: string;
  prize?: QuizPrize;
  updatedAt?: TimestampLike;
}

