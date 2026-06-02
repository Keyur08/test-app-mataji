// Configurable hero carousel shown on Home, below the greeting.
// Auto-plays through slides every ~4.5s and supports manual swipe.
// Slides are loaded from the `home_slides` Firestore collection.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { router } from "expo-router";

import { useCollection } from "../src/lib/useFirestore";
import type { HomeSlide } from "../../shared/types";
import { PhotoLightbox } from "./PhotoLightbox";

const PRIMARY = "#B8336A";
const SAFFRON = "#F4A261";

function handlePress(slide: HomeSlide) {
  const type = slide.linkType;
  const target = (slide.linkTarget || "").trim();
  if (!type || !target) return;

  switch (type) {
    case "tab": {
      const tab = target === "home" ? "" : target;
      router.push(`/${tab}` as never);
      return;
    }
    case "gallery-section": {
      router.push({
        pathname: "/gallery",
        params: { section: target },
      } as never);
      return;
    }
    case "route": {
      router.push(target as never);
      return;
    }
    case "url": {
      Linking.openURL(target).catch(() => {});
      return;
    }
  }
}

export function HomeCarousel() {
  const { data, loading } = useCollection<HomeSlide>("home_slides", {
    orderByField: "order",
    orderDir: "asc",
    limit: 20,
  });

  const slides = useMemo(
    () => (data || []).filter((s) => s.active !== false),
    [data]
  );

  const [width, setWidth] = useState(
    Dimensions.get("window").width - 40 // minus screen px-5 on both sides
  );
  const [index, setIndex] = useState(0);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const listRef = useRef<FlatList<HomeSlide>>(null);

  // Auto-advance every 4.5 seconds.
  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % slides.length;
        listRef.current?.scrollToOffset({
          offset: next * width,
          animated: true,
        });
        return next;
      });
    }, 4500);
    return () => clearInterval(id);
  }, [slides.length, width]);

  if (loading || slides.length === 0) return null;

  function onMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / width);
    if (i !== index) setIndex(i);
  }

  return (
    <View
      className="mt-5"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index: i }) => (
          <Slide
            slide={item}
            width={width}
            onZoom={() => setZoomIndex(i)}
          />
        )}
      />

      {/* Dots */}
      {slides.length > 1 && (
        <View className="mt-2.5 flex-row items-center justify-center">
          {slides.map((_, i) => {
            const active = i === index;
            return (
              <View
                key={i}
                style={{
                  width: active ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  marginHorizontal: 3,
                  backgroundColor: active ? PRIMARY : "rgba(184,51,106,0.25)",
                }}
              />
            );
          })}
        </View>
      )}
      {zoomIndex != null && (
        <PhotoLightbox
          photos={slides.map((s) => ({
            id: s.id,
            imageUrl: s.imageUrl,
            caption: s.title,
          })) as never}
          startIndex={zoomIndex}
          visible={zoomIndex != null}
          onClose={() => setZoomIndex(null)}
        />
      )}
    </View>
  );
}

function Slide({
  slide,
  width,
  onZoom,
}: {
  slide: HomeSlide;
  width: number;
  onZoom: () => void;
}) {
  const tappable = !!(slide.linkType && slide.linkTarget);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!slide.imageUrl) return;
    let cancelled = false;
    Image.getSize(
      slide.imageUrl,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setNaturalRatio(w / h);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [slide.imageUrl]);

  // Card is 16:9. If the natural image is within ~12% of 16:9, use `cover`
  // (no letterboxing). Otherwise fall back to `contain` against a soft
  // saffron-tinted background so nothing is cropped.
  const cardRatio = 16 / 9;
  const closeEnough =
    naturalRatio != null && Math.abs(naturalRatio - cardRatio) / cardRatio < 0.12;
  const resizeMode: "cover" | "contain" =
    naturalRatio == null ? "cover" : closeEnough ? "cover" : "contain";

  const onPress = tappable ? () => handlePress(slide) : onZoom;

  return (
    <Pressable
      onPress={onPress}
      style={{ width }}
      className="active:opacity-90"
    >
      <View
        className="overflow-hidden rounded-2xl"
        style={{
          aspectRatio: cardRatio,
          backgroundColor: "#FFF8F0", // cream fill behind contained images
          shadowColor: PRIMARY,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 4,
          borderWidth: 1,
          borderColor: "rgba(244,162,97,0.35)",
        }}
      >
        {/* Soft blurred-ish backdrop using the same image stretched (only
            shown when we letterbox, to avoid harsh cream bars). */}
        {resizeMode === "contain" && (
          <Image
            source={{ uri: slide.imageUrl }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.18,
            }}
            resizeMode="cover"
            blurRadius={18}
          />
        )}

        <Image
          source={{ uri: slide.imageUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode={resizeMode}
        />

        {(slide.title || slide.subtitle) && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: 14,
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            {slide.title ? (
              <Text
                numberOfLines={2}
                className="text-base font-bold text-white"
                style={{
                  textShadowColor: "rgba(0,0,0,0.4)",
                  textShadowRadius: 4,
                }}
              >
                {slide.title}
              </Text>
            ) : null}
            {slide.subtitle ? (
              <Text
                numberOfLines={2}
                className="mt-0.5 text-xs text-white/90"
                style={{
                  textShadowColor: "rgba(0,0,0,0.4)",
                  textShadowRadius: 4,
                }}
              >
                {slide.subtitle}
              </Text>
            ) : null}
          </View>
        )}

        {/* Decorative saffron corner accent */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: SAFFRON,
            opacity: 0.25,
          }}
        />
      </View>
    </Pressable>
  );
}
