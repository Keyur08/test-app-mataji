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
        renderItem={({ item }) => <Slide slide={item} width={width} />}
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
    </View>
  );
}

function Slide({ slide, width }: { slide: HomeSlide; width: number }) {
  const tappable = !!(slide.linkType && slide.linkTarget);
  const Wrapper: React.ElementType = tappable ? Pressable : View;

  return (
    <Wrapper
      onPress={tappable ? () => handlePress(slide) : undefined}
      style={{ width }}
      className={tappable ? "active:opacity-90" : undefined}
    >
      <View
        className="overflow-hidden rounded-2xl bg-white"
        style={{
          aspectRatio: 16 / 9,
          shadowColor: PRIMARY,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 4,
          borderWidth: 1,
          borderColor: "rgba(244,162,97,0.35)",
        }}
      >
        <Image
          source={{ uri: slide.imageUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
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
              // Dark gradient-ish veil for legible text. Two stacked
              // translucent layers approximate a vertical gradient without
              // pulling in expo-linear-gradient.
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
    </Wrapper>
  );
}
