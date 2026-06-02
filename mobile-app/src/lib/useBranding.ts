// Thin wrapper around the `app_config/branding` Firestore doc that exposes
// a `BrandingConfig` merged with the original hardcoded defaults, so callers
// can render immediately even before the doc has loaded.

import { useMemo } from "react";
import { useDoc } from "./useFirestore";
import type { BrandingConfig } from "../../../shared/types";

/** Original hardcoded values used as fallbacks. Mirror the admin DEFAULTS. */
export const BRANDING_DEFAULTS: Required<
  Omit<BrandingConfig, "logoUrl" | "logoStoragePath" | "updatedAt">
> = {
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
  // Optional social / reach defaults — empty strings mean "not shown".
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
  // --- Theme palette defaults (mirror tailwind.config.js) ---
  themePrimary: "#B8336A",
  themePrimaryDark: "#A02D5F",
  themeSaffron: "#F4A261",
  themeCream: "#FFF8F0",
  themeAccent: "#A0522D",
  themeTextOnPrimary: "#FFFFFF",
  themeHeaderBg: "#FFF8F0",
};

export type ResolvedBranding = typeof BRANDING_DEFAULTS & {
  logoUrl?: string | null;
  logoStoragePath?: string | null;
};

/** Returns branding fields with sensible defaults applied. */
export function useBranding(): ResolvedBranding {
  const { data } = useDoc<BrandingConfig>("app_config", "branding");

  return useMemo(() => {
    const d = data ?? {};
    return {
      appName: d.appName?.trim() || BRANDING_DEFAULTS.appName,
      appSubtitle: d.appSubtitle?.trim() || BRANDING_DEFAULTS.appSubtitle,
      logoUrl: d.logoUrl || null,
      logoStoragePath: d.logoStoragePath || null,
      aboutTitleHindi:
        d.aboutTitleHindi?.trim() || BRANDING_DEFAULTS.aboutTitleHindi,
      aboutTitleEnglish:
        d.aboutTitleEnglish?.trim() || BRANDING_DEFAULTS.aboutTitleEnglish,
      aboutParagraphs:
        d.aboutParagraphs && d.aboutParagraphs.length > 0
          ? d.aboutParagraphs.filter((p) => p && p.trim().length > 0)
          : BRANDING_DEFAULTS.aboutParagraphs,
      aboutFlourish: d.aboutFlourish?.trim() || BRANDING_DEFAULTS.aboutFlourish,
      contactTitle: d.contactTitle?.trim() || BRANDING_DEFAULTS.contactTitle,
      contactHeadlineHindi:
        d.contactHeadlineHindi?.trim() ||
        BRANDING_DEFAULTS.contactHeadlineHindi,
      contactHeadlineEnglish:
        d.contactHeadlineEnglish?.trim() ||
        BRANDING_DEFAULTS.contactHeadlineEnglish,
      contactPhone: d.contactPhone?.trim() || BRANDING_DEFAULTS.contactPhone,
      contactPhoneLabel:
        d.contactPhoneLabel?.trim() || BRANDING_DEFAULTS.contactPhoneLabel,
      contactHoursText:
        d.contactHoursText?.trim() || BRANDING_DEFAULTS.contactHoursText,
      phoneNumber: d.phoneNumber?.trim() || "",
      whatsappNumber: d.whatsappNumber?.trim() || "",
      whatsappGroupUrl: d.whatsappGroupUrl?.trim() || "",
      whatsappChannelUrl: d.whatsappChannelUrl?.trim() || "",
      googleMapsUrl: d.googleMapsUrl?.trim() || "",
      locationTitle: d.locationTitle?.trim() || "",
      youtubeUrl: d.youtubeUrl?.trim() || "",
      facebookUrl: d.facebookUrl?.trim() || "",
      instagramUrl: d.instagramUrl?.trim() || "",
      shareAppUrl: d.shareAppUrl?.trim() || "",
      themePrimary: normalizeHex(d.themePrimary) || BRANDING_DEFAULTS.themePrimary,
      themePrimaryDark:
        normalizeHex(d.themePrimaryDark) || BRANDING_DEFAULTS.themePrimaryDark,
      themeSaffron: normalizeHex(d.themeSaffron) || BRANDING_DEFAULTS.themeSaffron,
      themeCream: normalizeHex(d.themeCream) || BRANDING_DEFAULTS.themeCream,
      themeAccent: normalizeHex(d.themeAccent) || BRANDING_DEFAULTS.themeAccent,
      themeTextOnPrimary:
        normalizeHex(d.themeTextOnPrimary) ||
        BRANDING_DEFAULTS.themeTextOnPrimary,
      themeHeaderBg:
        normalizeHex(d.themeHeaderBg) || BRANDING_DEFAULTS.themeHeaderBg,
    };
  }, [data]);
}

/** Loosely validate a hex color — accepts #RGB, #RRGGBB, #RRGGBBAA. */
function normalizeHex(v: string | undefined | null): string {
  if (!v) return "";
  const s = v.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s) ? s : "";
}

/** Convenience: just the resolved theme palette. Memoized via useBranding. */
export function useTheme() {
  const b = useBranding();
  return {
    primary: b.themePrimary,
    primaryDark: b.themePrimaryDark,
    saffron: b.themeSaffron,
    cream: b.themeCream,
    accent: b.themeAccent,
    textOnPrimary: b.themeTextOnPrimary,
    headerBg: b.themeHeaderBg,
  };
}

export type AppTheme = ReturnType<typeof useTheme>;
