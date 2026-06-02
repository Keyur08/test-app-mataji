"use client";

// App branding & static content editor — single doc at `app_config/branding`.
// Manages the in-app logo, display name, About Us card and Contact Us card
// that previously were hardcoded in the mobile app.

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  ImageIcon,
  Loader2,
  Palette,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import {
  Banner,
  Button,
  Card,
  Field,
  Input,
  Textarea,
} from "@/lib/ui";
import {
  deleteStorageObject,
  uploadFile,
  type UploadProgress,
} from "@/lib/uploads";

type BrandingDraft = {
  appName: string;
  appSubtitle: string;
  logoUrl?: string;
  logoStoragePath?: string;
  aboutTitleHindi: string;
  aboutTitleEnglish: string;
  aboutParagraphs: string[];
  aboutFlourish: string;
  contactTitle: string;
  contactHeadlineHindi: string;
  contactHeadlineEnglish: string;
  contactPhone: string;
  contactPhoneLabel: string;
  contactHoursText: string;
  phoneNumber: string;
  whatsappNumber: string;
  whatsappGroupUrl: string;
  whatsappChannelUrl: string;
  googleMapsUrl: string;
  locationTitle: string;
  youtubeUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  shareAppUrl: string;
  themePrimary: string;
  themePrimaryDark: string;
  themeSaffron: string;
  themeCream: string;
  themeAccent: string;
  themeTextOnPrimary: string;
  themeHeaderBg: string;
};

const DEFAULTS: BrandingDraft = {
  appName: "ज्ञेयश्री माताजी",
  appSubtitle: "105 Aryika Ratna Gyey Shree Mataji",
  aboutTitleHindi: "❋ हमारे बारे में ❋",
  aboutTitleEnglish: "About Us",
  aboutParagraphs: [
    "परम पूज्य ज्ञेयश्री माताजी एक महान जैन साध्वी हैं, जो जैन दर्शन और सत्य के मार्ग पर अपना जीवन समर्पित किए हुए हैं। उनकी दिव्य वाणी और ज्ञान से लाखों भक्तों का जीवन प्रकाशमय हो रहा है।",
    "यह पवित्र मंच आत्म-जागृति, अनुशासन और करुणा की भावना से समर्पित है — समता के शाश्वत सिद्धांत पर आधारित। माताजी की कृपा से यह मंच आपको आध्यात्मिक मार्ग पर आगे ले जाएगा।",
  ],
  aboutFlourish: "✦ ✦ ✦",
  contactTitle: "Contact Us",
  contactHeadlineHindi: "गुरु माँ से हमेशा कनेक्ट रहिये",
  contactHeadlineEnglish: "सिर्फ 1 नंबर के जरिए",
  contactPhone: "+917600122404",
  contactPhoneLabel: "+91 76001 22404",
  contactHoursText: "हर दिन • सुबह 6 बजे से रात 9 बजे तक",
  phoneNumber: "",
  whatsappNumber: "",
  whatsappGroupUrl: "",
  whatsappChannelUrl: "",
  googleMapsUrl: "",
  locationTitle: "",
  youtubeUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  shareAppUrl: "",
  themePrimary: "#B8336A",
  themePrimaryDark: "#A02D5F",
  themeSaffron: "#F4A261",
  themeCream: "#FFF8F0",
  themeAccent: "#A0522D",
  themeTextOnPrimary: "#FFFFFF",
  themeHeaderBg: "#FFF8F0",
};

function setAt<T>(arr: T[], i: number, v: T): T[] {
  const next = arr.slice();
  next[i] = v;
  return next;
}
function removeAt<T>(arr: T[], i: number): T[] {
  return arr.filter((_, idx) => idx !== i);
}

export default function BrandingAdminPage() {
  const [draft, setDraft] = useState<BrandingDraft>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoProgress, setLogoProgress] = useState<UploadProgress | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    getDoc(doc(db, "app_config", "branding"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<BrandingDraft>;
          setDraft({
            ...DEFAULTS,
            ...data,
            aboutParagraphs:
              data.aboutParagraphs && data.aboutParagraphs.length > 0
                ? data.aboutParagraphs
                : DEFAULTS.aboutParagraphs,
          });
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  function onPickLogo(e: ChangeEvent<HTMLInputElement>) {
    setLogoFile(e.target.files?.[0] || null);
  }

  async function removeSavedLogo() {
    if (!draft.logoUrl && !draft.logoStoragePath) {
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }
    if (!confirm("Remove the saved logo? The app will fall back to the default.")) {
      return;
    }
    try {
      const oldPath = draft.logoStoragePath;
      await setDoc(
        doc(db, "app_config", "branding"),
        {
          logoUrl: null,
          logoStoragePath: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      if (oldPath) deleteStorageObject(oldPath).catch(() => {});
      setDraft((d) => ({ ...d, logoUrl: undefined, logoStoragePath: undefined }));
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      setSuccess("Logo removed.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      let logoUrl = draft.logoUrl;
      let logoStoragePath = draft.logoStoragePath;

      if (logoFile) {
        const oldPath = logoStoragePath;
        const { promise } = uploadFile({
          folder: "app_config/branding",
          file: logoFile,
          onProgress: setLogoProgress,
        });
        const r = await promise;
        logoUrl = r.url;
        logoStoragePath = r.storagePath;
        if (oldPath && oldPath !== logoStoragePath) {
          deleteStorageObject(oldPath).catch(() => {});
        }
      }

      const payload = {
        appName: draft.appName.trim() || DEFAULTS.appName,
        appSubtitle: draft.appSubtitle.trim(),
        logoUrl: logoUrl || null,
        logoStoragePath: logoStoragePath || null,
        aboutTitleHindi: draft.aboutTitleHindi.trim(),
        aboutTitleEnglish: draft.aboutTitleEnglish.trim(),
        aboutParagraphs: draft.aboutParagraphs
          .map((s) => s.trim())
          .filter(Boolean),
        aboutFlourish: draft.aboutFlourish.trim(),
        contactTitle: draft.contactTitle.trim(),
        contactHeadlineHindi: draft.contactHeadlineHindi.trim(),
        contactHeadlineEnglish: draft.contactHeadlineEnglish.trim(),
        contactPhone: draft.contactPhone.trim(),
        contactPhoneLabel: draft.contactPhoneLabel.trim(),
        contactHoursText: draft.contactHoursText.trim(),
        phoneNumber: draft.phoneNumber.trim(),
        whatsappNumber: draft.whatsappNumber.trim(),
        whatsappGroupUrl: draft.whatsappGroupUrl.trim(),
        whatsappChannelUrl: draft.whatsappChannelUrl.trim(),
        googleMapsUrl: draft.googleMapsUrl.trim(),
        locationTitle: draft.locationTitle.trim(),
        youtubeUrl: draft.youtubeUrl.trim(),
        facebookUrl: draft.facebookUrl.trim(),
        instagramUrl: draft.instagramUrl.trim(),
        shareAppUrl: draft.shareAppUrl.trim(),
        themePrimary: draft.themePrimary.trim() || DEFAULTS.themePrimary,
        themePrimaryDark:
          draft.themePrimaryDark.trim() || DEFAULTS.themePrimaryDark,
        themeSaffron: draft.themeSaffron.trim() || DEFAULTS.themeSaffron,
        themeCream: draft.themeCream.trim() || DEFAULTS.themeCream,
        themeAccent: draft.themeAccent.trim() || DEFAULTS.themeAccent,
        themeTextOnPrimary:
          draft.themeTextOnPrimary.trim() || DEFAULTS.themeTextOnPrimary,
        themeHeaderBg: draft.themeHeaderBg.trim() || DEFAULTS.themeHeaderBg,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "app_config", "branding"), payload, {
        merge: true,
      });

      setDraft((d) => ({ ...d, logoUrl: logoUrl ?? undefined, logoStoragePath: logoStoragePath ?? undefined }));
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      setSuccess("Branding saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
      setLogoProgress(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary sm:text-2xl">
          <Palette size={24} /> App Branding
        </h1>
        <p className="text-sm text-neutral-600">
          One document at <code>app_config/branding</code>. Controls the in-app
          logo, app name, About Us and Contact Us cards. The native app
          icon and Android/iOS app name are baked into the binary and need a
          rebuild — only the in-app display is configurable here.
        </p>
      </header>

      {error && <Banner kind="error">{error}</Banner>}
      {success && <Banner kind="success">{success}</Banner>}

      {/* Identity */}
      <Card
        title="App Identity"
        description="Shown in the top header bar of the Home tab."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="App Name (Devanagari)" required>
            <Input
              required
              value={draft.appName}
              onChange={(e) =>
                setDraft((d) => ({ ...d, appName: e.target.value }))
              }
              placeholder={DEFAULTS.appName}
            />
          </Field>
          <Field label="Subtitle (English / transliteration)">
            <Input
              value={draft.appSubtitle}
              onChange={(e) =>
                setDraft((d) => ({ ...d, appSubtitle: e.target.value }))
              }
              placeholder={DEFAULTS.appSubtitle}
            />
          </Field>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-neutral-700">
            In-app Logo
          </p>
          <div className="flex items-start gap-4">
            {(logoFile || draft.logoUrl) && (
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-saffron/40 bg-cream p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    logoFile ? URL.createObjectURL(logoFile) : draft.logoUrl!
                  }
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={onPickLogo}
                className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-saffron/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-saffron/30"
              />
              {logoProgress && (
                <p className="text-xs text-neutral-500">
                  Uploading… {Math.round(logoProgress.percent)}%
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {logoFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null);
                      if (logoInputRef.current)
                        logoInputRef.current.value = "";
                    }}
                    className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-primary hover:underline"
                  >
                    <X size={12} /> Cancel selection
                  </button>
                )}
                {draft.logoUrl && (
                  <button
                    type="button"
                    onClick={removeSavedLogo}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                  >
                    <Trash2 size={12} /> Remove uploaded logo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* About Us */}
      <Card
        title="About Us Card"
        description="Scripture-style card on the mobile Home screen."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Hindi heading">
            <Input
              value={draft.aboutTitleHindi}
              onChange={(e) =>
                setDraft((d) => ({ ...d, aboutTitleHindi: e.target.value }))
              }
              placeholder={DEFAULTS.aboutTitleHindi}
            />
          </Field>
          <Field label="English heading">
            <Input
              value={draft.aboutTitleEnglish}
              onChange={(e) =>
                setDraft((d) => ({ ...d, aboutTitleEnglish: e.target.value }))
              }
              placeholder={DEFAULTS.aboutTitleEnglish}
            />
          </Field>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-neutral-700">
            Paragraphs (in display order)
          </p>
          <div className="space-y-2">
            {draft.aboutParagraphs.map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <Textarea
                  rows={3}
                  value={p}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      aboutParagraphs: setAt(
                        d.aboutParagraphs,
                        i,
                        e.target.value,
                      ),
                    }))
                  }
                  placeholder="Paragraph…"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      aboutParagraphs: removeAt(d.aboutParagraphs, i),
                    }))
                  }
                  className="mt-1 rounded-md p-2 text-red-600 hover:bg-red-50"
                  aria-label="Remove paragraph"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  aboutParagraphs: [...d.aboutParagraphs, ""],
                }))
              }
            >
              <Plus size={14} /> Add paragraph
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Field label="Closing flourish">
            <Input
              value={draft.aboutFlourish}
              onChange={(e) =>
                setDraft((d) => ({ ...d, aboutFlourish: e.target.value }))
              }
              placeholder={DEFAULTS.aboutFlourish}
            />
          </Field>
        </div>
      </Card>

      {/* Contact Us */}
      <Card
        title="Contact Us Card"
        description="Pink CTA card at the bottom of the Home screen."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Card title (English)">
            <Input
              value={draft.contactTitle}
              onChange={(e) =>
                setDraft((d) => ({ ...d, contactTitle: e.target.value }))
              }
              placeholder={DEFAULTS.contactTitle}
            />
          </Field>
          <Field label="Hours / footer text">
            <Input
              value={draft.contactHoursText}
              onChange={(e) =>
                setDraft((d) => ({ ...d, contactHoursText: e.target.value }))
              }
              placeholder={DEFAULTS.contactHoursText}
            />
          </Field>
          <Field label="Headline (Hindi)">
            <Input
              value={draft.contactHeadlineHindi}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  contactHeadlineHindi: e.target.value,
                }))
              }
              placeholder={DEFAULTS.contactHeadlineHindi}
            />
          </Field>
          <Field label="Sub-headline">
            <Input
              value={draft.contactHeadlineEnglish}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  contactHeadlineEnglish: e.target.value,
                }))
              }
              placeholder={DEFAULTS.contactHeadlineEnglish}
            />
          </Field>
          <Field
            label="Phone (E.164 — used for tel: link)"
            hint="Include the + and country code, no spaces"
          >
            <Input
              value={draft.contactPhone}
              onChange={(e) =>
                setDraft((d) => ({ ...d, contactPhone: e.target.value }))
              }
              placeholder={DEFAULTS.contactPhone}
            />
          </Field>
          <Field label="Phone label (display formatting)">
            <Input
              value={draft.contactPhoneLabel}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  contactPhoneLabel: e.target.value,
                }))
              }
              placeholder={DEFAULTS.contactPhoneLabel}
            />
          </Field>
        </div>
      </Card>

      {/* Social & reach */}
      <Card
        title="Social & Reach Links"
        description="Optional fields. Leave empty to hide the corresponding button/link in the mobile app."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="General phone number (E.164)"
            hint='e.g. "+917600122404" — used for tel: links elsewhere in the app'
          >
            <Input
              value={draft.phoneNumber}
              onChange={(e) =>
                setDraft((d) => ({ ...d, phoneNumber: e.target.value }))
              }
              placeholder="+917600122404"
            />
          </Field>
          <Field
            label="WhatsApp number (direct message)"
            hint="Digits only with country code, e.g. 917600122404"
          >
            <Input
              value={draft.whatsappNumber}
              onChange={(e) =>
                setDraft((d) => ({ ...d, whatsappNumber: e.target.value }))
              }
              placeholder="917600122404"
            />
          </Field>
          <Field label="WhatsApp group invite URL">
            <Input
              type="url"
              value={draft.whatsappGroupUrl}
              onChange={(e) =>
                setDraft((d) => ({ ...d, whatsappGroupUrl: e.target.value }))
              }
              placeholder="https://chat.whatsapp.com/..."
            />
          </Field>
          <Field label="WhatsApp channel URL">
            <Input
              type="url"
              value={draft.whatsappChannelUrl}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  whatsappChannelUrl: e.target.value,
                }))
              }
              placeholder="https://whatsapp.com/channel/..."
            />
          </Field>
          <Field label="Google Maps URL">
            <Input
              type="url"
              value={draft.googleMapsUrl}
              onChange={(e) =>
                setDraft((d) => ({ ...d, googleMapsUrl: e.target.value }))
              }
              placeholder="https://maps.google.com/?q=..."
            />
          </Field>
          <Field
            label="Location title"
            hint='e.g. "ज्ञेयश्री माताजी — मार्ग देखें"'
          >
            <Input
              value={draft.locationTitle}
              onChange={(e) =>
                setDraft((d) => ({ ...d, locationTitle: e.target.value }))
              }
              placeholder="ज्ञेयश्री माताजी — मार्ग देखें"
            />
          </Field>
          <Field label="YouTube URL">
            <Input
              type="url"
              value={draft.youtubeUrl}
              onChange={(e) =>
                setDraft((d) => ({ ...d, youtubeUrl: e.target.value }))
              }
              placeholder="https://youtube.com/@..."
            />
          </Field>
          <Field label="Facebook URL">
            <Input
              type="url"
              value={draft.facebookUrl}
              onChange={(e) =>
                setDraft((d) => ({ ...d, facebookUrl: e.target.value }))
              }
              placeholder="https://facebook.com/..."
            />
          </Field>
          <Field label="Instagram URL">
            <Input
              type="url"
              value={draft.instagramUrl}
              onChange={(e) =>
                setDraft((d) => ({ ...d, instagramUrl: e.target.value }))
              }
              placeholder="https://instagram.com/..."
            />
          </Field>
          <Field
            label="App share link"
            hint="Public Play Store / app landing URL appended to share messages (e.g. Pratiyogita share button)."
          >
            <Input
              type="url"
              value={draft.shareAppUrl}
              onChange={(e) =>
                setDraft((d) => ({ ...d, shareAppUrl: e.target.value }))
              }
              placeholder="https://play.google.com/store/apps/details?id=..."
            />
          </Field>
        </div>
      </Card>

      {/* Theme palette */}
      <Card
        title="Theme Palette"
        description="Colors used throughout the mobile app — header, About Us card, Contact Us card, buttons and accents. Use hex values like #B8336A."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ColorField
            label="Primary"
            hint="CTA backgrounds, headings, active states"
            value={draft.themePrimary}
            onChange={(v) => setDraft((d) => ({ ...d, themePrimary: v }))}
            placeholder={DEFAULTS.themePrimary}
          />
          <ColorField
            label="Primary (dark)"
            hint="Pressed / shadow tint for primary"
            value={draft.themePrimaryDark}
            onChange={(v) => setDraft((d) => ({ ...d, themePrimaryDark: v }))}
            placeholder={DEFAULTS.themePrimaryDark}
          />
          <ColorField
            label="Saffron accent"
            hint="Badges, ornament dividers, secondary highlights"
            value={draft.themeSaffron}
            onChange={(v) => setDraft((d) => ({ ...d, themeSaffron: v }))}
            placeholder={DEFAULTS.themeSaffron}
          />
          <ColorField
            label="Accent (subtitle)"
            hint="Warm brown — header subtitle, ornament text"
            value={draft.themeAccent}
            onChange={(v) => setDraft((d) => ({ ...d, themeAccent: v }))}
            placeholder={DEFAULTS.themeAccent}
          />
          <ColorField
            label="Cream background"
            hint="Off-white page background"
            value={draft.themeCream}
            onChange={(v) => setDraft((d) => ({ ...d, themeCream: v }))}
            placeholder={DEFAULTS.themeCream}
          />
          <ColorField
            label="Header background"
            hint="Top navigation bar background"
            value={draft.themeHeaderBg}
            onChange={(v) => setDraft((d) => ({ ...d, themeHeaderBg: v }))}
            placeholder={DEFAULTS.themeHeaderBg}
          />
          <ColorField
            label="Text on primary"
            hint="Foreground color over primary buttons"
            value={draft.themeTextOnPrimary}
            onChange={(v) =>
              setDraft((d) => ({ ...d, themeTextOnPrimary: v }))
            }
            placeholder={DEFAULTS.themeTextOnPrimary}
          />
        </div>

        {/* Live preview */}
        <ThemePreview draft={draft} />
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Save Branding
        </Button>
      </div>
    </form>
  );
}

/* ---------- Theme helpers ---------- */

function ColorField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const isValid = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValid ? value : placeholder || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-neutral-300 bg-white p-1"
          aria-label={`${label} color picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono uppercase"
        />
      </div>
    </Field>
  );
}

function ThemePreview({ draft }: { draft: BrandingDraft }) {
  return (
    <div className="mt-6">
      <p className="mb-2 text-sm font-medium text-neutral-700">Live preview</p>
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: draft.themeCream,
          borderColor: draft.themeSaffron + "55",
        }}
      >
        <div
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{
            backgroundColor: draft.themeHeaderBg,
            borderColor: draft.themeSaffron + "55",
          }}
        >
          <div
            className="h-7 w-7 rounded-full"
            style={{
              backgroundColor: draft.themePrimary,
              border: `2px solid ${draft.themeSaffron}`,
            }}
          />
          <div className="flex flex-col leading-tight">
            <span
              className="text-sm font-bold"
              style={{ color: draft.themePrimary }}
            >
              {draft.appName || "ज्ञेयश्री माताजी"}
            </span>
            <span
              className="text-[10px] font-semibold"
              style={{ color: draft.themeAccent }}
            >
              {draft.appSubtitle || "subtitle"}
            </span>
          </div>
        </div>
        <div className="space-y-2 px-4 py-4">
          <div
            className="rounded-xl px-3 py-2 text-xs font-semibold"
            style={{
              backgroundColor: draft.themeSaffron + "30",
              color: draft.themePrimary,
            }}
          >
            Saffron accent badge
          </div>
          <button
            type="button"
            className="rounded-full px-4 py-2 text-sm font-bold shadow-sm"
            style={{
              backgroundColor: draft.themePrimary,
              color: draft.themeTextOnPrimary,
            }}
          >
            Primary CTA Button
          </button>
          <p
            className="text-xs"
            style={{ color: draft.themePrimaryDark }}
          >
            Pressed / dark accent text
          </p>
        </div>
      </div>
    </div>
  );
}
