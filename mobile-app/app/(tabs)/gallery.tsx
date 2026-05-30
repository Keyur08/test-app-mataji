import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "../../components/ScreenContainer";
import { PhotosTab } from "../../components/PhotosTab";
import { PravachansTab } from "../../components/PravachansTab";
import { ReelsTab } from "../../components/ReelsTab";
import { ErrorBoundary } from "../../components/ErrorBoundary";

type Tab = "photos" | "pravachans" | "reels";

export default function GalleryScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [tab, setTab] = useState<Tab>("photos");

  useEffect(() => {
    if (section === "photos" || section === "pravachans" || section === "reels") {
      setTab(section);
    }
  }, [section]);

  return (
    <ScreenContainer>
      {/* Segmented control */}
      <View className="mt-4 flex-row rounded-2xl bg-saffron/15 p-1">
        <SegmentButton
          label="Photos"
          active={tab === "photos"}
          onPress={() => setTab("photos")}
        />
        <SegmentButton
          label="Pravachans"
          active={tab === "pravachans"}
          onPress={() => setTab("pravachans")}
        />
        <SegmentButton
          label="Reels"
          active={tab === "reels"}
          onPress={() => setTab("reels")}
        />
      </View>

      <View className="mt-2 flex-1">
        {tab === "photos" ? (
          <ErrorBoundary label="Photos">
            <PhotosTab />
          </ErrorBoundary>
        ) : tab === "pravachans" ? (
          <ErrorBoundary label="Pravachans">
            <PravachansTab />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary label="Reels">
            <ReelsTab />
          </ErrorBoundary>
        )}
      </View>
    </ScreenContainer>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center justify-center rounded-xl py-2.5 ${
        active ? "bg-white" : ""
      }`}
      style={
        active
          ? {
              // Avoid NativeWind v4's `shadow-sm` upgrade warning which
              // crashes when it tries to stringify the navigation tree.
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 2,
              elevation: 1,
            }
          : undefined
      }
    >
      <Text
        className={`text-sm font-semibold ${
          active ? "text-primary" : "text-zinc-500"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
