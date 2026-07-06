import { useEffect } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import {
  Camera,
  Globe,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  Sparkles,
  Sun,
  Users,
  Video,
} from "lucide-react-native";
import { Link } from "expo-router";

import { ScreenContainer } from "../../components/ScreenContainer";
import { PanchangBanner } from "../../components/PanchangBanner";
import { GyeyvaniCard } from "../../components/GyeyvaniCard";
import { AnnouncementsRail } from "../../components/AnnouncementsRail";
import { HomeStoriesRail } from "../../components/HomeStoriesRail";
import { HomeCarousel } from "../../components/HomeCarousel";
import { AaharDaanCard } from "../../components/AaharDaanCard";
import { DailyNiyamCard } from "../../components/DailyNiyamCard";
import { KratiyasCard } from "../../components/KratiyasCard";
import { PratiyogitaCard } from "../../components/PratiyogitaCard";

import { useCollection, useDoc } from "../../src/lib/useFirestore";
import { useBranding, useTheme } from "../../src/lib/useBranding";
import {
  registerForPushNotificationsAsync,
  savePushToken,
} from "../../src/lib/notifications";
import type {
  Gyeyvani,
  NewsEvent,
} from "../../../shared/types";
import {Marquee} from "../../components/Marquee";

const todayId = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const prettyDate = () =>
  new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const greet = () => "✦ जय जिनेन्द्र ✦";

export default function HomeScreen() {
  const branding = useBranding();
  const theme = useTheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = await registerForPushNotificationsAsync();
      if (!cancelled && info) {
        await savePushToken(info);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    data: gyeyvani,
    loading: gyeyvaniLoading,
    refresh: refreshGyeyvani,
  } = useDoc<Gyeyvani>("daily_quotes", todayId());
  const {
    data: news,
    loading: newsLoading,
    refresh: refreshNews,
  } = useCollection<NewsEvent>("news_events", {
    orderByField: "publishedAt",
    orderDir: "desc",
    limit: 10,
  });

  const onRefresh = async () => {
    await Promise.all([refreshGyeyvani(), refreshNews()]);
  };

  return (
    <ScreenContainer scroll onRefresh={onRefresh}>
      {/* Instagram-style configurable story circles — sits in the gap
          between the navigation header and the rest of the home content. */}
      <HomeStoriesRail />
        {/* Marquee  */}
      {branding.marqueeString && branding.marqueeString.trim().length > 0 && (
          <Marquee text={branding.marqueeString} />
      )}
      {/* Greeting hero */}
      <View className="pt-7">
        <View className="flex-row items-center">
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{
              backgroundColor: theme.saffron + "33",
              borderWidth: 1,
              borderColor: theme.saffron + "59",
            }}
          >
            <Sun color={theme.saffron} size={18} />
          </View>
          <View className="ml-3">
            <Text
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: theme.saffron }}
            >
              {greet()}
            </Text>
            <Text className="text-[11px] text-gray-500">{prettyDate()}</Text>
          </View>
        </View>

        {/* <Text className="mt-4 text-3xl font-bold text-primary">
          🙏 Jai Shree Mataji
        </Text>
        <Text className="mt-1 text-sm leading-5 text-gray-600">
          May your day be filled with peace, devotion and blessings.
        </Text> */}
      </View>

      {/* Admin-configurable hero carousel */}
      <HomeCarousel />

     {/* 1. Thought of the day */}
      <View className="mt-6">
        <GyeyvaniCard gyeyvani={gyeyvani} loading={gyeyvaniLoading} />
      </View>

      {/* 2. Daily नियम — admin-published vow with opt-in counter */}
      <View className="mt-6">
        <DailyNiyamCard />
      </View>

      {/* 3. Guru Maa ki Kratiya — admin PDF library (renders nothing if empty) */}
      <KratiyasCard />

      {/* 4. Pratiyogita — Daily Quiz Competition (renders nothing if none) */}
      <PratiyogitaCard />
     

 

      {/* About Us — scripture-style card */}
      <View
        className="mt-8 overflow-hidden rounded-3xl bg-white"
        style={{
          borderWidth: 1.5,
          borderColor: theme.saffron,
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1,
          shadowRadius: 14,
          elevation: 3,
        }}
      >
        <View
          className="m-2 rounded-[20px] px-5 py-6"
          style={{
            borderWidth: 1,
            borderColor: theme.primary + "33",
            borderStyle: "dashed",
          }}
        >
          {/* Ornament + heading */}
          <View className="flex-row items-center justify-center">
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: theme.saffron + "80",
              }}
            />
            <View
              className="mx-3 h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: theme.cream,
                borderWidth: 1.5,
                borderColor: theme.saffron,
              }}
            >
              <Sparkles color={theme.primary} size={18} />
            </View>
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: theme.saffron + "80",
              }}
            />
          </View>

          <Text
            className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[3px]"
            style={{ color: theme.saffron }}
          >
            {branding.aboutTitleHindi}
          </Text>
          <Text
            className="mt-1 text-center text-2xl font-bold"
            style={{ color: theme.primary }}
          >
            {branding.aboutTitleEnglish}
          </Text>

          {branding.aboutParagraphs.map((para, idx) => (
            <Text
              key={idx}
              className={`${idx === 0 ? "mt-5" : "mt-4"} text-[15px] text-zinc-800`}
              style={{ lineHeight: 26 }}
            >
              {para}
            </Text>
          ))}

          {/* View Biography button */}
          <Link href={"/biography" as any} asChild>
            <Pressable
              className="mt-6 flex-row items-center justify-center self-center rounded-full px-6 py-3 active:opacity-90"
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
                जीवनी देखें • View Biography
              </Text>
            </Pressable>
          </Link>

          <Text
            className="mt-5 text-center text-base"
            style={{ color: theme.saffron, letterSpacing: 6 }}
          >
            {branding.aboutFlourish}
          </Text>
        </View>
      </View>
       {/* 2. Top banner */}
      <View className="mt-6">
        <PanchangBanner />
      </View>

    

      {/* 3. Horizontal announcements rail */}
      <View className="mt-8">
        <AnnouncementsRail
          items={news}
          loading={newsLoading}
          filterKind="announcement"
          title="Announcements"
          emptyText="No announcements yet."
        />
      </View>

      <View className="mt-8">
        <AnnouncementsRail
          items={news}
          loading={newsLoading}
          filterKind="news"
          title="News"
          emptyText="No news yet."
        />
      </View>

      <View className="mt-8">
        <AnnouncementsRail
          items={news}
          loading={newsLoading}
          filterKind="event"
          title="Events"
          emptyText="No upcoming events."
        />
      </View>
  {/* Contact Us — call card */}
      <View
        className="mt-6 overflow-hidden rounded-3xl"
        style={{
          backgroundColor: theme.primary,
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 6,
        }}
      >
        {/* Decorative blobs */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -30,
            top: -30,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: theme.saffron + "2E",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -40,
            bottom: -40,
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        />

        <View className="px-6 py-7">
          <Text className="text-center text-3xl">🙏🙏</Text>
          <Text
            className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[3px]"
            style={{ color: theme.saffron }}
          >
            {branding.contactTitle}
          </Text>
          <Text
            className="mt-2 text-center text-xl font-bold"
            style={{ color: theme.textOnPrimary }}
          >
            {branding.contactHeadlineHindi}
          </Text>
          <Text
            className="mt-1 text-center text-sm"
            style={{ color: theme.textOnPrimary + "CC" }}
          >
            {branding.contactHeadlineEnglish}
          </Text>

          <Pressable
            onPress={() => Linking.openURL(`tel:${branding.contactPhone}`)}
            className="mt-5 flex-row items-center justify-center self-center rounded-full bg-white px-6 py-3.5 active:opacity-90"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <View
              className="mr-3 h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.primary + "1A" }}
            >
              <Phone color={theme.primary} size={18} />
            </View>
            <View>
              <Text
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: theme.saffron }}
              >
                Tap to Call
              </Text>
              <Text
                className="text-lg font-bold"
                style={{ color: theme.primary }}
              >
                {branding.contactPhoneLabel}
              </Text>
            </View>
          </Pressable>

          <Text
            className="mt-4 text-center text-xs"
            style={{ color: theme.textOnPrimary + "CC" }}
          >
            {branding.contactHoursText}
          </Text>

          {/* Optional social / reach actions — each only renders when the
              admin has provided a value in /admin/branding. */}
          <ContactActions branding={branding} theme={theme} />
        </View>
      </View>
      {/* Aahar Daan QR donation card (admin-configurable) */}
      <AaharDaanCard />
    </ScreenContainer>
  );
}

/* ---------- Contact card extras ---------- */

type ContactActionsProps = {
  branding: ReturnType<typeof useBranding>;
  theme: ReturnType<typeof useTheme>;
};

/** Renders a wrap of pill buttons for whichever social / reach links the
 *  admin has filled in. Each button is conditional — empty fields are hidden. */
function ContactActions({ branding, theme }: ContactActionsProps) {
  const items: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
  }> = [];

  if (branding.whatsappNumber) {
    const digits = branding.whatsappNumber.replace(/\D/g, "");
    items.push({
      key: "wa-dm",
      icon: <MessageCircle color="#25D366" size={16} />,
      label: "WhatsApp",
      onPress: () => Linking.openURL(`https://wa.me/${digits}`),
    });
  }
  if (branding.whatsappGroupUrl) {
    items.push({
      key: "wa-group",
      icon: <Users color="#25D366" size={16} />,
      label: "Join Group",
      onPress: () => Linking.openURL(branding.whatsappGroupUrl),
    });
  }
  if (branding.whatsappChannelUrl) {
    items.push({
      key: "wa-channel",
      icon: <Megaphone color="#25D366" size={16} />,
      label: "Channel",
      onPress: () => Linking.openURL(branding.whatsappChannelUrl),
    });
  }
  if (branding.googleMapsUrl) {
    items.push({
      key: "maps",
      icon: <MapPin color="#EA4335" size={16} />,
      label: branding.locationTitle || "Open Map",
      onPress: () => Linking.openURL(branding.googleMapsUrl),
    });
  }
  if (
    branding.phoneNumber &&
    branding.phoneNumber !== branding.contactPhone
  ) {
    items.push({
      key: "phone2",
      icon: <Phone color={theme.primary} size={16} />,
      label: branding.phoneNumber,
      onPress: () => Linking.openURL(`tel:${branding.phoneNumber}`),
    });
  }
  if (branding.youtubeUrl) {
    items.push({
      key: "yt",
      icon: <Video color="#FF0000" size={16} />,
      label: "YouTube",
      onPress: () => Linking.openURL(branding.youtubeUrl),
    });
  }
  if (branding.facebookUrl) {
    items.push({
      key: "fb",
      icon: <Globe color="#1877F2" size={16} />,
      label: "Facebook",
      onPress: () => Linking.openURL(branding.facebookUrl),
    });
  }
  if (branding.instagramUrl) {
    items.push({
      key: "ig",
      icon: <Camera color="#E1306C" size={16} />,
      label: "Instagram",
      onPress: () => Linking.openURL(branding.instagramUrl),
    });
  }

  if (items.length === 0) return null;

  return (
    <View
      style={{
        marginTop: 18,
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {items.map((it) => (
        <Pressable
          key={it.key}
          onPress={it.onPress}
          className="flex-row items-center rounded-full bg-white/95 px-3.5 py-2 active:opacity-80"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          {it.icon}
          <Text
            numberOfLines={1}
            className="ml-1.5 text-[12px] font-semibold"
            style={{ maxWidth: 160, color: theme.primary }}
          >
            {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
