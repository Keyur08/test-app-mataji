// Instagram-style horizontal "stories" rail shown at the top of Home.
// Items are loaded from the `home_stories` Firestore collection and are
// fully configurable from the admin dashboard.

import { useMemo } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { useCollection } from "../src/lib/useFirestore";
import type { HomeStory } from "../../shared/types";

const PRIMARY = "#B8336A";
const SAFFRON = "#F4A261";

function handlePress(story: HomeStory) {
  const target = (story.linkTarget || "").trim();
  if (!target) return;

  switch (story.linkType) {
    case "tab": {
      // Bottom-tab segments live under /(tabs)/<name>
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

export function HomeStoriesRail() {
  const { data, loading } = useCollection<HomeStory>("home_stories", {
    orderByField: "order",
    orderDir: "asc",
    limit: 30,
  });

  const visible = useMemo(
    () => (data || []).filter((s) => s.active !== false),
    [data]
  );

  // Don't render anything (not even an empty bar) when there are no stories
  // configured yet — keeps the Home screen clean.
  if (loading || visible.length === 0) return null;

  return (
    <View
      className="-mx-5"
      style={{
        // Warm cream background blends seamlessly with the header above,
        // so the rail visually feels like an extension of the topbar
        // rather than a separate white slab.
        backgroundColor: "#FFF8F0",
        // Soft saffron-tinted shadow below acts as the divider between
        // (header + stories) and the page content.
        shadowColor: SAFFRON,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 4,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 12,
        }}
      >
        {visible.map((story) => (
          <StoryCircle key={story.id} story={story} />
        ))}
      </ScrollView>
      {/* Warm bottom hairline matching the saffron theme */}
      <View style={{ height: 1, backgroundColor: "rgba(244,162,97,0.35)" }} />
    </View>
  );
}

function StoryCircle({ story }: { story: HomeStory }) {
  // Two-tone ring: outer colored ring + inner accent ring + white gap.
  // Gives a subtle Instagram-style "gradient" feel without an extra dep.
  const outer = story.ringColor || SAFFRON;
  const inner = PRIMARY;

  return (
    <Pressable
      onPress={() => handlePress(story)}
      className="items-center active:opacity-80"
      style={{ width: 80, marginRight: 8 }}
    >
      {/* Outer ring */}
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          padding: 2.5,
          backgroundColor: outer,
          shadowColor: outer,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
          elevation: 4,
        }}
      >
        {/* Inner accent ring */}
        <View
          style={{
            flex: 1,
            borderRadius: 34,
            padding: 1.5,
            backgroundColor: inner,
          }}
        >
          {/* White gap so the image is clearly separated from the ring */}
          <View
            style={{
              flex: 1,
              borderRadius: 32,
              padding: 2,
              backgroundColor: "#fff",
            }}
          >
            {story.imageUrl ? (
              <Image
                source={{ uri: story.imageUrl }}
                style={{ flex: 1, borderRadius: 30 }}
                resizeMode="cover"
              />
            ) : (
              // Beautiful religious fallback when no image is uploaded —
              // a saffron cream disc with a lotus emoji at the center.
              <View
                style={{
                  flex: 1,
                  borderRadius: 30,
                  backgroundColor: "#FFF1DC",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 28 }}>🪷</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <Text
        numberOfLines={1}
        className="mt-2 text-center text-[11px] font-semibold text-zinc-800"
        style={{ width: 76, letterSpacing: 0.2 }}
      >
        {story.name}
      </Text>
    </Pressable>
  );
}

