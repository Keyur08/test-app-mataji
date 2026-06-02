// Full-screen PDF reader for a single kratiya.
//   • iOS — WebView renders PDFs natively from the storage URL.
//   • Android — WebView can't render PDFs, so we proxy through the Google
//     Docs viewer (`https://docs.google.com/viewer?...&embedded=true`) which
//     works as long as the PDF URL is public (Firebase Storage download URLs
//     are public-by-token).
//   • Web — `react-native-webview` is not implemented on react-native-web
//     (throws "React Native WebView does not support this platform"), so we
//     render a real `<iframe>` pointing at the PDF URL. Browsers have a
//     built-in PDF viewer, so this just works.
// Top-right action: "Download" → opens the underlying PDF URL in the system
// browser, where the user can save it (browser handles "Save As").

import { useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { Download, FileText } from "lucide-react-native";
import { Stack, useLocalSearchParams } from "expo-router";

// `react-native-webview` throws synchronously when imported on web, so we
// only require it on native platforms.
const WebView: React.ComponentType<any> | null =
  Platform.OS === "web"
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("react-native-webview").WebView;

import { useDoc } from "../../src/lib/useFirestore";
import { useTheme } from "../../src/lib/useBranding";
import type { Kratiya } from "../../../shared/types";

export default function KratiyaReaderScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: kratiya, loading } = useDoc<Kratiya>("kratiyas", id ?? "");

  const viewerUrl = useMemo(() => {
    if (!kratiya?.pdfUrl) return null;
    // Android: route through Google Docs viewer; iOS/Web: load directly.
    if (Platform.OS === "android") {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(
        kratiya.pdfUrl,
      )}&embedded=true`;
    }
    return kratiya.pdfUrl;
  }, [kratiya?.pdfUrl]);

  const onDownload = async () => {
    if (!kratiya?.pdfUrl) return;
    try {
      await Linking.openURL(kratiya.pdfUrl);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: kratiya?.title ?? "Kratiya",
          headerStyle: { backgroundColor: theme.headerBg },
          headerTintColor: theme.primary,
          headerTitleStyle: { fontWeight: "800" },
          headerRight: () =>
            kratiya?.pdfUrl ? (
              <Pressable
                onPress={onDownload}
                accessibilityRole="button"
                accessibilityLabel="Download PDF"
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: theme.primary,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Download color="#FFFFFF" size={14} />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: "800",
                    letterSpacing: 0.4,
                  }}
                >
                  Download
                </Text>
              </Pressable>
            ) : null,
        }}
      />

      <View style={{ flex: 1, backgroundColor: theme.cream }}>
        {loading ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : !kratiya || !viewerUrl ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <FileText color={theme.saffron} size={48} />
            <Text
              style={{
                color: theme.primary,
                fontWeight: "800",
                fontSize: 16,
                marginTop: 12,
              }}
            >
              Kratiya not found
            </Text>
            <Text
              style={{
                color: theme.accent,
                fontSize: 13,
                marginTop: 6,
                textAlign: "center",
              }}
            >
              It may have been removed by the admin.
            </Text>
          </View>
        ) : (
          Platform.OS === "web" ? (
            // Browsers have a built-in PDF viewer — render it directly so
            // we never touch `react-native-webview` (it throws on web).
            // We point at the raw PDF URL, not the Google Docs proxy,
            // because the proxy disallows iframe embedding from
            // arbitrary origins.
            <iframe
              src={kratiya?.pdfUrl ?? viewerUrl}
              title={kratiya?.title ?? "Kratiya"}
              style={{
                flex: 1,
                width: "100%",
                height: "100%",
                border: "none",
                backgroundColor: theme.cream,
              }}
            />
          ) : WebView ? (
            <WebView
              source={{ uri: viewerUrl }}
              style={{ flex: 1, backgroundColor: theme.cream }}
              startInLoadingState
              renderLoading={() => (
                <View
                  style={{
                    ...StyleSheetAbsoluteFill,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator color={theme.primary} />
                </View>
              )}
              originWhitelist={["*"]}
              allowsBackForwardNavigationGestures
            />
          ) : null
        )}
      </View>
    </>
  );
}

// Inline replacement for StyleSheet.absoluteFillObject to avoid extra import.
const StyleSheetAbsoluteFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
