import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  type ImageProps,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  BookOpen,
  Calendar,
  MapPin,
  Pause,
  Play,
  Quote,
  Sparkles,
} from "lucide-react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { ScreenContainer } from "../components/ScreenContainer";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { useDoc } from "../src/lib/useFirestore";
import type { Biography, GalleryPhoto } from "../../shared/types";

/** Image wrapper that shows a centered spinner over a cream placeholder until
 *  the remote image finishes loading. Falls back to a small message on error. */
function LoadingImage({
  uri,
  style,
  resizeMode = "cover",
}: {
  uri: string;
  style: ImageProps["style"];
  resizeMode?: ImageProps["resizeMode"];
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  return (
    <View style={[style, { backgroundColor: "#FFF8F0", overflow: "hidden" }]}>
      <Image
        source={{ uri }}
        // Stretch image to fill the wrapper's dimensions.
        style={{ width: "100%", height: "100%" }}
        resizeMode={resizeMode}
        onLoadEnd={() =>
          setStatus((s) => (s === "error" ? "error" : "loaded"))
        }
        onError={() => setStatus("error")}
      />
      {status === "loading" ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="small" color="#B8336A" />
        </View>
      ) : null}
      {status === "error" ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="text-[11px] text-gray-400">Image unavailable</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Convenience: render a centered ornament divider. */
function Divider() {  return (
    <View className="my-6 flex-row items-center">
      <View
        style={{ flex: 1, height: 1, backgroundColor: "rgba(244,162,97,0.5)" }}
      />
      <View
        className="mx-3 h-9 w-9 items-center justify-center rounded-full bg-cream"
        style={{ borderWidth: 1.5, borderColor: "#F4A261" }}
      >
        <Sparkles color="#B8336A" size={16} />
      </View>
      <View
        style={{ flex: 1, height: 1, backgroundColor: "rgba(244,162,97,0.5)" }}
      />
    </View>
  );
}

function SectionTitle({ hindi, english }: { hindi: string; english: string }) {
  return (
    <View className="mb-3">
      <Text className="text-center text-[11px] font-semibold uppercase tracking-[3px] text-saffron">
        ❋ {hindi} ❋
      </Text>
      <Text className="mt-1 text-center text-xl font-bold text-primary">
        {english}
      </Text>
    </View>
  );
}

/** Small inline player for the intro audio. */
function IntroAudioPlayer({ url, title }: { url: string; title?: string }) {
  const player = useAudioPlayer({ uri: url }, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const isPlaying = status?.playing ?? false;

  const toggle = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <View
      className="mt-2 flex-row items-center rounded-2xl bg-white px-4 py-4"
      style={{
        borderWidth: 1.5,
        borderColor: "#F4A261",
        shadowColor: "#B8336A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      <Pressable
        onPress={toggle}
        className="mr-4 h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "#B8336A" }}
      >
        {isPlaying ? (
          <Pause color="#FFF" size={22} fill="#FFF" />
        ) : (
          <Play color="#FFF" size={22} fill="#FFF" />
        )}
      </Pressable>
      <View className="flex-1">
        <Text className="text-[11px] font-semibold uppercase tracking-widest text-saffron">
          परिचय • Intro
        </Text>
        <Text className="mt-0.5 text-base font-semibold text-primary" numberOfLines={2}>
          {title || "Spiritual Introduction"}
        </Text>
      </View>
    </View>
  );
}

/** Single basic-detail row with Devanagari + English label and value. */
function DetailRow({
  hindi,
  english,
  value,
}: {
  hindi: string;
  english: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <View
      className="flex-row px-4 py-3"
      style={{
        borderBottomWidth: 1,
        borderBottomColor: "rgba(244,162,97,0.25)",
      }}
    >
      <View className="w-[42%] pr-2">
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-saffron">
          {english}
        </Text>
        <Text className="text-[12px] text-gray-500">{hindi}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[14px] text-zinc-800" style={{ lineHeight: 20 }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function BiographyScreen() {
  const { data: bio, loading } = useDoc<Biography>(
    "app_config",
    "biography",
  );

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const photos: GalleryPhoto[] = useMemo(
    () =>
      (bio?.achievementImages ?? []).map((img, i) => ({
        id: `ach-${i}`,
        imageUrl: img.url,
        caption: img.caption,
      })),
    [bio?.achievementImages],
  );

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#B8336A" />
          <Text className="mt-3 text-sm text-gray-500">Loading biography…</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!bio) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center py-20">
          <Text className="text-center text-base text-gray-500">
            Biography not yet published.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const basics = bio.basicDetails ?? {};

  return (
    <ScreenContainer scroll>
      {/* Hero image */}
      {bio.heroImageUrl ? (
        <View
          className="mt-4 overflow-hidden rounded-3xl bg-white"
          style={{
            borderWidth: 1.5,
            borderColor: "#F4A261",
            shadowColor: "#B8336A",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          <LoadingImage
            uri={bio.heroImageUrl}
            style={{ width: "100%", aspectRatio: 3 / 4 }}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {/* Designations */}
      {bio.designations && bio.designations.length > 0 ? (
        <View className="mt-6">
          {bio.designations.map((d, i) => (
            <Text
              key={i}
              className="text-center text-[13px] font-semibold uppercase tracking-[2px] text-saffron"
              style={{ marginTop: i === 0 ? 0 : 2 }}
            >
              ✦ {d} ✦
            </Text>
          ))}
        </View>
      ) : null}

      {/* Intro audio */}
      {bio.introAudio?.url ? (
        <View className="mt-6">
          <IntroAudioPlayer
            url={bio.introAudio.url}
            title={bio.introAudio.title}
          />
        </View>
      ) : null}

      <Divider />

      {/* Basic Details table */}
      {Object.values(basics).some(Boolean) ? (
        <>
          <SectionTitle hindi="मूल परिचय" english="Basic Details" />
          <View
            className="overflow-hidden rounded-2xl bg-white"
            style={{
              borderWidth: 1.5,
              borderColor: "#F4A261",
              shadowColor: "#B8336A",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            <DetailRow
              hindi="पूर्व नाम"
              english="Former Name"
              value={basics.formerName}
            />
            <DetailRow
              hindi="माता-पिता"
              english="Parents"
              value={basics.parents}
            />
            <DetailRow hindi="नगर" english="City" value={basics.city} />
            <DetailRow
              hindi="जन्म स्थान"
              english="Birth Place"
              value={basics.birthPlace}
            />
            <DetailRow
              hindi="जन्म तिथि"
              english="Date of Birth"
              value={basics.dob}
            />
            <DetailRow
              hindi="जन्म समय"
              english="Time of Birth"
              value={basics.timeOfBirth}
            />
            <DetailRow
              hindi="शिक्षा"
              english="Education"
              value={basics.education}
            />
            <DetailRow hindi="परिवार" english="Family" value={basics.family} />
            <DetailRow
              hindi="वैराग्य प्रेरणा"
              english="Vairagya Inspiration"
              value={basics.vairagyaInspiration}
            />
            <DetailRow
              hindi="ब्रह्मचर्य व्रत"
              english="Brahmacharya Vrat Date"
              value={basics.brahmacharyaVratDate}
            />
            <DetailRow
              hindi="दीक्षा तिथि"
              english="Diksha Date"
              value={basics.dikshaDate}
            />
            <DetailRow
              hindi="दीक्षा स्थान"
              english="Diksha Place"
              value={basics.dikshaPlace}
            />
            <DetailRow
              hindi="दीक्षा गुरु"
              english="Diksha Guru"
              value={basics.dikshaGuru}
            />
            <DetailRow
              hindi="रुचियाँ"
              english="Interests"
              value={basics.interests}
            />
          </View>
        </>
      ) : null}

      {/* Chaturmas list */}
      {bio.chaturmasList && bio.chaturmasList.length > 0 ? (
        <>
          <Divider />
          <SectionTitle hindi="चातुर्मास सूची" english="Chaturmas List" />
          <View
            className="overflow-hidden rounded-2xl bg-white"
            style={{
              borderWidth: 1.5,
              borderColor: "#F4A261",
            }}
          >
            {[...bio.chaturmasList]
              .sort((a, b) => {
                const ya = parseInt(a.year ?? "", 10);
                const yb = parseInt(b.year ?? "", 10);
                const aNum = Number.isFinite(ya);
                const bNum = Number.isFinite(yb);
                if (aNum && bNum) return yb - ya;
                if (aNum) return -1;
                if (bNum) return 1;
                return 0;
              })
              .map((c, i, arr) => (
              <View
                key={i}
                className="flex-row items-center px-4 py-3"
                style={{
                  borderBottomWidth: i === arr.length - 1 ? 0 : 1,
                  borderBottomColor: "rgba(244,162,97,0.25)",
                }}
              >
                <View
                  className="mr-3 h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(244,162,97,0.18)" }}
                >
                  <Calendar color="#F4A261" size={16} />
                </View>
                <Text className="w-16 text-sm font-bold text-primary">
                  {c.year}
                </Text>
                <View className="flex-1 flex-row items-center">
                  <MapPin color="#B8336A" size={14} />
                  <Text className="ml-1 flex-1 text-sm text-zinc-800">
                    {c.location}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Spiritual Journey */}
      {bio.spiritualJourney && bio.spiritualJourney.length > 0 ? (
        <>
          <Divider />
          <SectionTitle
            hindi="आध्यात्मिक यात्रा"
            english="Spiritual Journey"
          />
          <View>
            {bio.spiritualJourney.map((p, i) => (
              <Text
                key={i}
                className="mt-3 text-[15px] text-zinc-800"
                style={{ lineHeight: 26 }}
              >
                {p}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      {/* Teachings */}
      {bio.teachings && bio.teachings.length > 0 ? (
        <>
          <Divider />
          <SectionTitle hindi="उपदेश" english="Teachings" />
          <View>
            {bio.teachings.map((t, i) => (
              <View
                key={i}
                className="mt-3 flex-row rounded-2xl bg-white p-4"
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(244,162,97,0.4)",
                }}
              >
                <BookOpen color="#B8336A" size={16} />
                <Text
                  className="ml-3 flex-1 text-[14px] text-zinc-800"
                  style={{ lineHeight: 22 }}
                >
                  {t}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Achievements gallery */}
      {photos.length > 0 ? (
        <>
          <Divider />
          <SectionTitle
            hindi="उपलब्धियाँ"
            english="Achievements Gallery"
          />
          <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
            {photos.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => setLightboxIndex(i)}
                style={{ width: "50%", padding: 4 }}
              >
                <View
                  className="overflow-hidden rounded-2xl bg-white"
                  style={{
                    borderWidth: 1,
                    borderColor: "rgba(244,162,97,0.5)",
                  }}
                >
                  <LoadingImage
                    uri={p.imageUrl}
                    style={{ width: "100%", aspectRatio: 1 }}
                    resizeMode="cover"
                  />
                  {p.caption ? (
                    <Text
                      className="px-2 py-1.5 text-[11px] text-zinc-700"
                      numberOfLines={2}
                    >
                      {p.caption}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {/* Footer quote */}
      {bio.footerQuote ? (
        <>
          <Divider />
          <View
            className="mt-2 rounded-3xl px-6 py-7"
            style={{
              backgroundColor: "#B8336A",
              shadowColor: "#B8336A",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 16,
              elevation: 5,
            }}
          >
            <View className="items-center">
              <Quote color="#F4A261" size={28} />
            </View>
            <Text
              className="mt-3 text-center text-base italic text-white"
              style={{ lineHeight: 26 }}
            >
              “{bio.footerQuote}”
            </Text>
            {bio.footerQuoteAuthor ? (
              <Text className="mt-3 text-center text-[12px] font-semibold uppercase tracking-[3px] text-saffron">
                — {bio.footerQuoteAuthor}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}

      <View className="mt-8">
        <Text
          className="text-center text-base"
          style={{ color: "#F4A261", letterSpacing: 6 }}
        >
          ✦ ✦ ✦
        </Text>
      </View>

      <PhotoLightbox
        photos={photos}
        startIndex={lightboxIndex ?? 0}
        visible={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </ScreenContainer>
  );
}
