//
// Daily Panchang card — fully offline, computed locally on every render.
// Shows date nav, location chip + selector, big tithi + moon emoji,
// sunrise/sunset/ayan/moonrise/moonset/ritu pills, and an expandable
// detail panel with tithi/nakshatra windows and grid stats.

import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import * as Location from "expo-location";

import { useBranding, useTheme } from "../src/lib/useBranding";
import {
  DEFAULT_LOCATION,
  PRESET_LOCATIONS,
  type MuhuratVerdict,
  type PanchangLocation,
  generateDailyPanchang,
} from "../src/utils/panchangCalculator";

type Props = {
  /** Optional override of the displayed location label/coords. */
  initialLocation?: PanchangLocation;
};

function fmtShortDateTime(d: Date): string {
  // "May 23, 06:00 AM"
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Convert #RRGGBB / #RGB / #RRGGBBAA to rgba(r,g,b,alpha). */
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  if (h.length === 8) h = h.slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return `rgba(0,0,0,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function PanchangBanner({ initialLocation }: Props) {
  const theme = useTheme();
  const branding = useBranding();

  const [location, setLocation] = useState<PanchangLocation>(
    initialLocation ?? DEFAULT_LOCATION,
  );
  const [offset, setOffset] = useState(0); // days from today
  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  /** Ask for permission, fetch GPS, reverse-geocode to a label, and apply it. */
  const useCurrentLocation = async () => {
    try {
      setGpsLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "स्थान अनुमति",
          "Please grant location permission to use your current position.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;

      // Reverse-geocode for a friendly label; gracefully fall back to coords.
      let label = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
      try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        const p = places?.[0];
        if (p) {
          const parts = [p.city || p.subregion || p.district, p.region || p.country]
            .filter(Boolean)
            .map((s) => String(s).trim());
          if (parts.length) label = parts.join(", ");
        }
      } catch {
        // ignore — keep coord label
      }

      setLocation({
        id: "current",
        label: `📍 ${label}`,
        lat: latitude,
        lon: longitude,
      });
      setPickerOpen(false);
    } catch (e) {
      Alert.alert("Location error", String((e as Error)?.message ?? e));
    } finally {
      setGpsLoading(false);
    }
  };

  const date = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  }, [offset]);

  const panchang = useMemo(
    () =>
      generateDailyPanchang(date, location.lat, location.lon, location.label),
    [date, location],
  );
  const { item, labels, extras } = panchang;

  // Live themed token set — recomputes whenever branding palette changes.
  const t = useMemo(() => {
    // Light "About Us"-style card: cream background, primary-colored text.
    return {
      cardBg: theme.cream, // light cream (≈ #FFF8F0)
      border: theme.saffron,
      textPrimary: theme.primaryDark, // dark pink — readable on cream
      textMuted: hexToRgba(theme.primaryDark, 0.78),
      textSubtle: hexToRgba(theme.primaryDark, 0.6),
      accent: theme.accent, // brownish accent for highlights (month etc.)
      pillBg: hexToRgba(theme.saffron, 0.22),
      pillBorder: hexToRgba(theme.saffron, 0.65),
      pillLabel: hexToRgba(theme.primaryDark, 0.75),
      panelBg: hexToRgba(theme.saffron, 0.1),
      panelBorder: hexToRgba(theme.primaryDark, 0.15),
      ctaBg: hexToRgba(theme.saffron, 0.2),
      ctaBorder: hexToRgba(theme.saffron, 0.65),
      moonBg: hexToRgba(theme.saffron, 0.18),
      moonBorder: hexToRgba(theme.primaryDark, 0.2),
      ribbon: theme.accent,
      ribbonText: theme.textOnPrimary,
      selectBg: hexToRgba(theme.saffron, 0.14),
      selectBorder: hexToRgba(theme.primaryDark, 0.2),
      arrowBg: hexToRgba(theme.saffron, 0.2),
      arrowBorder: hexToRgba(theme.primaryDark, 0.25),
      pickerBg: theme.cream,
    };
  }, [theme]);

  return (
    <View
      className="overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: t.cardBg,
        borderColor: t.border,
        shadowColor: theme.primary,
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      {/* Soft tonal glow blobs */}
      <View
        className="absolute -right-16 -top-16 h-56 w-56 rounded-full"
        style={{ backgroundColor: hexToRgba(theme.saffron, 0.18) }}
      />
      <View
        className="absolute -left-16 -bottom-20 h-60 w-60 rounded-full"
        style={{ backgroundColor: hexToRgba(theme.cream, 0.08) }}
      />

      <View className="px-3 pb-2 pt-3">
        {/* ── Header row: prev | date | location chip | next ─────────── */}
        <View className="flex-row items-start justify-between">
          <Pressable
            onPress={() => setOffset((o) => o - 1)}
            className="h-7 w-7 items-center justify-center rounded-full border"
            style={{ borderColor: t.arrowBorder, backgroundColor: t.arrowBg }}
            accessibilityLabel="Previous day"
          >
            <Text className="text-sm font-bold" style={{ color: t.textPrimary }}>‹</Text>
          </Pressable>

          <View className="flex-1 px-2">
            <Text className="text-2xl font-black leading-none" style={{ color: t.textPrimary }}>
              {item.dayLabel}
            </Text>
            <Text className="mt-1 text-[18px] font-extrabold leading-tight" style={{ color: t.textPrimary }}>
              {item.dateLabel}
            </Text>
          </View>

          <View className="items-end">
            <Text
              className="max-w-[120px] text-right text-[12px] font-semibold"
              style={{ color: t.textMuted }}
              numberOfLines={1}
            >
              📍 {item.location}
            </Text>
            <Pressable
              onPress={() => setOffset((o) => o + 1)}
              className="mt-2 h-7 w-7 items-center justify-center rounded-full border"
              style={{ borderColor: t.arrowBorder, backgroundColor: t.arrowBg }}
              accessibilityLabel="Next day"
            >
              <Text className="text-sm font-bold" style={{ color: t.textPrimary }}>›</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Location picker ────────────────────────────────────────── */}
        <View className="mt-2 flex-row items-center" style={{ gap: 8 }}>
          <Pressable
            onPress={() => setPickerOpen((v) => !v)}
            className="flex-1 rounded-md border px-2 py-1.5"
            style={{ borderColor: t.selectBorder, backgroundColor: t.selectBg }}
          >
            <Text className="text-[12px]" style={{ color: t.textPrimary }}>
              {location.label}  ▾
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setOffset(0)}
            className="rounded-md border px-2.5 py-1.5"
            style={{ borderColor: t.arrowBorder, backgroundColor: t.arrowBg }}
          >
            <Text className="text-[11px] font-semibold" style={{ color: t.textPrimary }}>आज</Text>
          </Pressable>
        </View>

        {pickerOpen && (
          <View
            className="mt-2 overflow-hidden rounded-md border"
            style={{ borderColor: t.selectBorder, backgroundColor: t.pickerBg }}
          >
            {/* Use current location row */}
            <Pressable
              onPress={useCurrentLocation}
              disabled={gpsLoading}
              className="flex-row items-center border-b px-3 py-2.5"
              style={{
                borderColor: t.panelBorder,
                backgroundColor: hexToRgba(theme.saffron, 0.1),
                gap: 8,
                opacity: gpsLoading ? 0.6 : 1,
              }}
            >
              {gpsLoading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={{ fontSize: 14 }}>📍</Text>
              )}
              <Text
                className="text-[12px] font-semibold"
                style={{ color: t.textPrimary }}
              >
                {gpsLoading
                  ? "स्थान खोज रहे हैं…"
                  : "अपना स्थान • Use current location"}
              </Text>
            </Pressable>

            {PRESET_LOCATIONS.map((loc) => {
              const active = loc.id === location.id;
              return (
                <Pressable
                  key={loc.id}
                  onPress={() => {
                    setLocation(loc);
                    setPickerOpen(false);
                  }}
                  className="border-b px-3 py-2"
                  style={{
                    borderColor: t.panelBorder,
                    backgroundColor: active
                      ? hexToRgba(theme.saffron, 0.18)
                      : "transparent",
                  }}
                >
                  <Text className="text-[12px]" style={{ color: t.textPrimary }}>
                    {active ? "✓ " : "   "}
                    {loc.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Big tithi row ──────────────────────────────────────────── */}
        <View className="mt-3 flex-row items-center" style={{ gap: 12 }}>
          {/* Moon emoji disc */}
          <View
            className="items-center justify-center rounded-full border"
            style={{
              height: 68,
              width: 68,
              backgroundColor: t.moonBg,
              borderColor: t.moonBorder,
            }}
          >
            <Text style={{ fontSize: 42 }}>{item.moonEmoji}</Text>
          </View>

          {/* Tithi big text */}
          <View className="flex-1 items-center">
            <Text
              className="font-black"
              style={{ fontSize: 34, lineHeight: 36, letterSpacing: -0.5, color: t.textPrimary }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {item.tithi}
            </Text>
          </View>

          {/* Paksha / Month / Samvat */}
          <View className="items-end pr-0.5" style={{ gap: 2 }}>
            <Text className="text-[13px] font-semibold" style={{ color: t.textPrimary }}>
              {item.paksha}
            </Text>
            <Text
              className="text-[13px] font-semibold"
              style={{ color: t.accent }}
            >
              {item.month}
            </Text>
            <Text className="text-[12px] font-semibold" style={{ color: t.textPrimary }}>
              {item.samvat}
            </Text>
          </View>
        </View>

        {/* ── Pill grid 3x2 ─────────────────────────────────────────── */}
        <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
          <PillStat tokens={t} label="सूर्योदय" value={item.sunrise} />
          <PillStat tokens={t} label="सूर्यास्त" value={item.sunset} />
          <PillStat tokens={t} label="अयन" value={extras.ayan} />
          <PillStat tokens={t} label="चंद्रोदय" value={extras.moonrise} />
          <PillStat tokens={t} label="चन्द्रास्त" value={extras.moonset} />
          <PillStat tokens={t} label="ऋतु" value={item.ritu} />
        </View>

        {/* ── Show more / less ───────────────────────────────────────── */}
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          className="mt-4 flex-row items-center justify-center self-center rounded-full px-6 py-3 active:opacity-90"
          style={{
            backgroundColor: theme.primary,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 3,
          }}
        >
          <Sparkles color={theme.cream} size={16} />
          <Text
            className="ml-2 text-sm font-bold"
            style={{ color: theme.textOnPrimary }}
          >
            {expanded ? "कम देखें • Show less" : "अधिक देखें • Show more"}
          </Text>
        </Pressable>

        {expanded && (
          <>
            {/* Samvat block */}
            <DetailBlock tokens={t}>
              <DetailLine tokens={t}>विक्रम संवत - {item.samvat}</DetailLine>
              <DetailLine tokens={t}>शक संवत - {extras.shakaSamvat}</DetailLine>
              <DetailLine tokens={t}>पूर्णिमांत - {extras.purnimantaMonth}</DetailLine>
              <DetailLine tokens={t}>अमांत - {extras.amantaMonth}</DetailLine>
            </DetailBlock>

            {/* Tithi windows */}
            <DetailBlock tokens={t}>
              <Text className="mb-1 text-[12px] font-bold" style={{ color: t.textPrimary }}>तिथि</Text>
              {extras.tithiWindows.map((w, i) => (
                <DetailLine tokens={t} key={i}>
                  {w.name} - {fmtShortDateTime(w.from)} – {fmtShortDateTime(w.to)}
                </DetailLine>
              ))}
            </DetailBlock>

            {/* Nakshatra windows */}
            <DetailBlock tokens={t}>
              <Text className="mb-1 text-[12px] font-bold" style={{ color: t.textPrimary }}>नक्षत्र</Text>
              {extras.nakshatraWindows.map((w, i) => (
                <DetailLine tokens={t} key={i}>
                  {w.name} - {fmtShortDateTime(w.from)} – {fmtShortDateTime(w.to)}
                </DetailLine>
              ))}
            </DetailBlock>

            {/* Inline 2-col stat grid */}
            <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
              <MiniStat tokens={t} label={labels.nak} value={item.nak} />
              <MiniStat tokens={t} label={labels.yog} value={item.yog} />
              <MiniStat tokens={t} label={labels.kar} value={item.kar} />
              <MiniStat tokens={t} label={labels.signs} value={item.signs} />
              <MiniStat tokens={t} label={labels.rahu} value={item.rahu} />
              <MiniStat tokens={t} label={labels.ritu} value={item.ritu} />
              <MiniStat tokens={t} label={labels.vSamvat} value={item.vSamvat} wide />
            </View>

            {/* Muhurat grid — विवाह / नामकरण / यात्रा / शुभ / वर्जित / सामान्य */}
            <DetailBlock tokens={t}>
              <Text className="mb-2 text-[12px] font-bold" style={{ color: t.textPrimary }}>
                मुहूर्त
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                <MuhuratChip tokens={t} label="विवाह"   v={extras.muhurat.vivah} />
                <MuhuratChip tokens={t} label="नामकरण"  v={extras.muhurat.namkaran} />
                <MuhuratChip tokens={t} label="यात्रा"  v={extras.muhurat.yatra} />
                <MuhuratChip tokens={t} label="शुभ"     v={extras.muhurat.shubh} />
                <MuhuratChip tokens={t} label="वर्जित"  v={extras.muhurat.varjit} />
                <MuhuratChip tokens={t} label="सामान्य" v={extras.muhurat.samanya} />
              </View>
            </DetailBlock>

            {/* Mataji credit row */}
            <View
              className="mt-3 flex-row items-center justify-between rounded-lg border px-2.5 py-2"
              style={{
                borderColor: t.panelBorder,
                backgroundColor: t.panelBg,
              }}
            >
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <View
                  className="h-7 w-7 overflow-hidden rounded-full border"
                  style={{ borderColor: t.panelBorder }}
                >
                  <Image
                    source={
                      branding.logoUrl
                        ? { uri: branding.logoUrl }
                        : require("../../shared/logo/logo.avif")
                    }
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                </View>
                <View>
                  <Text
                    className="text-[11px] font-bold leading-tight"
                    style={{ color: t.textPrimary }}
                  >
                    {branding.appName}
                  </Text>
                  <Text className="text-[9px]" style={{ color: t.textMuted }}>
                    जय जिनेन्द्र
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Red ribbon footer */}
      <View
        className="items-center px-3 py-2.5"
        style={{ backgroundColor: t.ribbon }}
      >
        <Text
          className="text-[12px] font-semibold leading-snug"
          style={{ color: t.ribbonText }}
        >
          {item.eventText}
        </Text>
      </View>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────── */

type Tokens = {
  cardBg: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  pillBg: string;
  pillBorder: string;
  pillLabel: string;
  panelBg: string;
  panelBorder: string;
  ctaBg: string;
  ctaBorder: string;
  moonBg: string;
  moonBorder: string;
  ribbon: string;
  ribbonText: string;
  selectBg: string;
  selectBorder: string;
  arrowBg: string;
  arrowBorder: string;
  pickerBg: string;
};

function PillStat({
  tokens,
  label,
  value,
}: {
  tokens: Tokens;
  label: string;
  value: string;
}) {
  return (
    <View
      className="rounded-lg border px-2 py-1.5"
      style={{
        flexBasis: "31%",
        flexGrow: 1,
        borderColor: tokens.pillBorder,
        backgroundColor: tokens.pillBg,
      }}
    >
      <Text className="text-[10px]" style={{ color: tokens.pillLabel }}>
        {label}
      </Text>
      <Text
        className="text-[12px] font-bold"
        style={{ color: tokens.textPrimary }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function DetailBlock({
  tokens,
  children,
}: {
  tokens: Tokens;
  children: React.ReactNode;
}) {
  return (
    <View
      className="mt-3 rounded-lg border px-2.5 py-2"
      style={{
        borderColor: tokens.panelBorder,
        backgroundColor: tokens.panelBg,
      }}
    >
      {children}
    </View>
  );
}

function DetailLine({
  tokens,
  children,
}: {
  tokens: Tokens;
  children: React.ReactNode;
}) {
  return (
    <Text
      className="text-[12px]"
      style={{ lineHeight: 18, color: tokens.textMuted }}
    >
      {children}
    </Text>
  );
}

function MiniStat({
  tokens,
  label,
  value,
  wide,
}: {
  tokens: Tokens;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View
      className="rounded-lg border px-2 py-1.5"
      style={{
        flexBasis: wide ? "100%" : "48%",
        flexGrow: 1,
        borderColor: tokens.panelBorder,
        backgroundColor: tokens.panelBg,
      }}
    >
      <Text className="text-[11px]" numberOfLines={1}>
        <Text style={{ color: tokens.textSubtle }}>{label}: </Text>
        <Text style={{ color: tokens.textPrimary, fontWeight: "600" }}>
          {value}
        </Text>
      </Text>
    </View>
  );
}

function MuhuratChip({
  tokens,
  label,
  v,
}: {
  tokens: Tokens;
  label: string;
  v: MuhuratVerdict;
}) {
  const toneColor =
    v.tone === "good"
      ? "#22c55e"
      : v.tone === "bad"
        ? "#ef4444"
        : tokens.textPrimary;
  const toneBg =
    v.tone === "good"
      ? "rgba(34,197,94,0.14)"
      : v.tone === "bad"
        ? "rgba(239,68,68,0.14)"
        : tokens.panelBg;
  const toneBorder =
    v.tone === "good"
      ? "rgba(34,197,94,0.45)"
      : v.tone === "bad"
        ? "rgba(239,68,68,0.45)"
        : tokens.panelBorder;

  return (
    <View
      className="rounded-lg border px-2 py-1.5"
      style={{
        flexBasis: "31%",
        flexGrow: 1,
        borderColor: toneBorder,
        backgroundColor: toneBg,
      }}
    >
      <Text className="text-[10px]" style={{ color: tokens.textMuted }}>
        {label}
      </Text>
      <Text
        className="text-[13px] font-bold"
        style={{ color: toneColor }}
        numberOfLines={1}
      >
        {v.label}
      </Text>
      {v.note ? (
        <Text
          className="text-[9px]"
          style={{ color: tokens.textSubtle }}
          numberOfLines={1}
        >
          {v.note}
        </Text>
      ) : null}
    </View>
  );
}
