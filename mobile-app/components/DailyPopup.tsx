// Daily startup popup — full-screen image modal shown when the app opens.
//
// Behaviour:
//  • Reads `app_config/daily_popup` (one shared doc managed by the admin).
//  • If `active` and `imageUrl` is set, shows a modal once per device per
//    day. The "day" key is YYYY-MM-DD combined with the doc's `updatedAt`
//    millis, so updating the image causes devices to show the new one
//    immediately even on the same day.
//  • Dismissing writes the key to AsyncStorage so the modal won't appear
//    again on the same day.
//  • Tap the image to open `linkUrl` if provided.

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { X } from "lucide-react-native";

import { useDoc } from "../src/lib/useFirestore";
import { useTheme } from "../src/lib/useBranding";
import type { DailyPopupConfig, TimestampLike } from "../../shared/types";

const STORAGE_PREFIX = "daily_popup:dismissed:";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function tsMillis(t?: TimestampLike): number {
  try {
    return t?.toMillis?.() ?? 0;
  } catch {
    return 0;
  }
}

export function DailyPopup() {
  const theme = useTheme();
  const { data, loading } = useDoc<DailyPopupConfig>(
    "app_config",
    "daily_popup",
  );
  const [visible, setVisible] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  // Decide whether to show. The dismissal key combines today's date with the
  // image's `updatedAt` so a fresh upload reopens the popup even mid-day.
  useEffect(() => {
    if (loading) return;
    if (!data || !data.active || !data.imageUrl) {
      setVisible(false);
      return;
    }
    const key =
      STORAGE_PREFIX + todayISO() + ":" + tsMillis(data.updatedAt);
    AsyncStorage.getItem(key)
      .then((v) => {
        if (!v) setVisible(true);
      })
      .catch(() => setVisible(true));
  }, [data, loading]);

  async function dismiss() {
    setVisible(false);
    if (!data?.updatedAt) return;
    const key =
      STORAGE_PREFIX + todayISO() + ":" + tsMillis(data.updatedAt);
    try {
      await AsyncStorage.setItem(key, "1");
    } catch {
      /* ignore — worst case the modal shows again next launch */
    }
  }

  function onTapImage() {
    const link = data?.linkUrl?.trim();
    if (link) {
      Linking.openURL(link).catch(() => {});
    }
  }

  if (!visible || !data?.imageUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.78)",
          justifyContent: "center",
          alignItems: "center",
          padding: 18,
        }}
      >
        {/* Close button — top-right */}
        <Pressable
          onPress={dismiss}
          hitSlop={14}
          style={{
            position: "absolute",
            top: Platform.OS === "ios" ? 56 : 36,
            right: 18,
            height: 38,
            width: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.92)",
            zIndex: 2,
          }}
        >
          <X color={theme.primary} size={20} />
        </Pressable>

        {/* Image */}
        <Pressable
          onPress={onTapImage}
          disabled={!data.linkUrl}
          style={{
            width: "100%",
            maxWidth: 460,
            aspectRatio: 3 / 4,
            borderRadius: 22,
            overflow: "hidden",
            backgroundColor: "#fff",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <Image
            source={{ uri: data.imageUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            onLoadEnd={() => setImgLoading(false)}
          />
          {imgLoading && (
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
                backgroundColor: "#FFF8F0",
              }}
            >
              <ActivityIndicator color={theme.primary} />
            </View>
          )}
        </Pressable>

        {/* Helper hint */}
        <Text
          style={{
            marginTop: 14,
            color: "#FFFFFFCC",
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 1,
          }}
        >
          Tap × to close for today
        </Text>
      </View>
    </Modal>
  );
}
