// Aahar Daan QR donation card — admin-configurable from app_config/aahar_daan.
// Replaces the older "Aahar Daan Registration" CTA on the Home screen.

import { Image, Linking, Pressable, Text, View } from "react-native";
import { Download, QrCode } from "lucide-react-native";

import { useDoc } from "../src/lib/useFirestore";
import type { AaharDaanConfig } from "../../shared/types";

const DEFAULTS = {
  title: "आहार दान",
  subtitle: "साध्वी माताजी के आहार दान में सहभागी बनें",
  description:
    "आहार दान — दान का सर्वोच्च रूप। QR कोड स्कैन करें और पुण्य के भागी बनें।",
  downloadLabel: "QR डाउनलोड करें",
};

export function AaharDaanCard() {
  const { data } = useDoc<AaharDaanConfig>("app_config", "aahar_daan");

  const title = data?.title?.trim() || DEFAULTS.title;
  const subtitle = data?.subtitle?.trim() || DEFAULTS.subtitle;
  const description = data?.description?.trim() || DEFAULTS.description;
  const downloadLabel = data?.downloadLabel?.trim() || DEFAULTS.downloadLabel;
  const qrUrl = data?.qrImageUrl;

  const onDownload = () => {
    if (qrUrl) Linking.openURL(qrUrl).catch(() => {});
  };

  return (
    <View
      className="mt-8 overflow-hidden rounded-3xl"
      style={{
        backgroundColor: "#FFF8EE",
        borderWidth: 1.5,
        borderColor: "#B8336A",
        shadowColor: "#B8336A",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 5,
      }}
    >
      {/* Decorative saffron blobs */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: -40,
          top: -40,
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: "rgba(244,162,97,0.20)",
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: -30,
          bottom: -30,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: "rgba(184,51,106,0.10)",
        }}
      />

      <View className="px-6 py-7">
        {/* Header ornament */}
        <View className="flex-row items-center justify-center">
          <View
            style={{
              flex: 1,
              height: 1,
              backgroundColor: "rgba(244,162,97,0.5)",
            }}
          />
          <Text className="mx-3 text-2xl">🌸</Text>
          <View
            style={{
              flex: 1,
              height: 1,
              backgroundColor: "rgba(244,162,97,0.5)",
            }}
          />
        </View>

        <Text className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[3px] text-saffron">
          ❋ दान धर्म ❋
        </Text>
        <Text className="mt-1 text-center text-3xl font-bold text-primary">
          {title}
        </Text>
        <Text className="mt-2 text-center text-sm font-medium text-zinc-700">
          {subtitle}
        </Text>
        <Text
          className="mt-3 text-center text-[14px] text-zinc-700"
          style={{ lineHeight: 22 }}
        >
          {description}
        </Text>

        {/* QR frame */}
        {qrUrl ? (
          <View
            className="mt-5 self-center rounded-2xl bg-white p-3"
            style={{
              borderWidth: 2,
              borderColor: "#F4A261",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 10,
              elevation: 3,
            }}
          >
            <Image
              source={{ uri: qrUrl }}
              style={{ width: 220, height: 220, borderRadius: 8 }}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View
            className="mt-5 self-center items-center justify-center rounded-2xl bg-white"
            style={{
              width: 240,
              height: 240,
              borderWidth: 2,
              borderColor: "#F4A261",
              borderStyle: "dashed",
            }}
          >
            <QrCode color="#F4A261" size={48} />
            <Text className="mt-2 text-xs text-zinc-500">QR उपलब्ध नहीं</Text>
          </View>
        )}

        <Text className="mt-4 text-center text-sm font-semibold text-primary">
          📲 स्कैन करें और दान करें
        </Text>

        {qrUrl ? (
          <Pressable
            onPress={onDownload}
            className="mt-5 flex-row items-center justify-center self-center rounded-full bg-primary px-6 py-3 active:opacity-90"
            style={{
              shadowColor: "#B8336A",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <Download color="#fff" size={16} />
            <Text className="ml-2 text-sm font-semibold text-white">
              {downloadLabel}
            </Text>
          </Pressable>
        ) : null}

        <Text
          className="mt-5 text-center text-base"
          style={{ color: "#F4A261", letterSpacing: 6 }}
        >
          ✦ ✦ ✦
        </Text>
      </View>
    </View>
  );
}
