// Full-screen WebView that loads the hosted Next.js admin dashboard.
// The mobile app posts a short-lived Firebase ID token to a session-login
// endpoint on the dashboard, which verifies it server-side and mints a
// browser session so the WebView lands directly on /admin.

import { useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { ArrowLeft, RotateCcw } from "lucide-react-native";

import { useTheme } from "../src/lib/useBranding";

// Allow the URL to be configured per-build. Falls back to the production
// domain so EAS builds without an env var still work.
const ADMIN_URL =
  (process.env.EXPO_PUBLIC_ADMIN_URL?.replace(/\/+$/, "") || "") ||
  "https://admin.geymatamata.org";

export default function AdminWebViewScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const token =
    typeof params.token === "string"
      ? params.token
      : Array.isArray(params.token)
        ? params.token[0]
        : "";

  const webviewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState<string>("");

  const source = useMemo(() => {
    if (!token) {
      // Fallback: just open the dashboard; user will see its own login form.
      return { uri: `${ADMIN_URL}/login` };
    }
    const next = encodeURIComponent("/admin");
    return {
      uri: `${ADMIN_URL}/api/session-login?token=${encodeURIComponent(token)}&next=${next}`,
    };
  }, [token]);

  function onClose() {
    if (router.canGoBack()) router.back();
    else router.replace("/" as never);
  }

  function onReload() {
    webviewRef.current?.reload();
  }

  function onNav(e: WebViewNavigation) {
    setCurrentUrl(e.url);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.cream }}>
      {/* Header bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: theme.headerBg,
          borderBottomWidth: 1,
          borderBottomColor: theme.saffron + "55",
        }}
      >
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={{
            height: 36,
            width: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.primary + "12",
          }}
        >
          <ArrowLeft color={theme.primary} size={18} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={{
              color: theme.primary,
              fontWeight: "800",
              fontSize: 15,
            }}
            numberOfLines={1}
          >
            Admin Dashboard
          </Text>
          <Text
            style={{ color: "#71717A", fontSize: 11 }}
            numberOfLines={1}
          >
            {currentUrl || ADMIN_URL}
          </Text>
        </View>
        <Pressable
          onPress={onReload}
          hitSlop={10}
          style={{
            height: 36,
            width: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.primary + "12",
          }}
        >
          <RotateCcw color={theme.primary} size={16} />
        </Pressable>
      </View>

      {/* WebView */}
      <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        <WebView
          ref={webviewRef}
          source={source}
          originWhitelist={["https://*", "http://*"]}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          startInLoadingState
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={onNav}
          // iOS: persistent cookie store
          {...(Platform.OS === "ios" ? { incognito: false } : null)}
        />
        {loading && (
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
              backgroundColor: "#FFFFFFCC",
            }}
          >
            <ActivityIndicator size="large" color={theme.primary} />
            <Text
              style={{
                marginTop: 10,
                color: theme.accent,
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              Loading admin…
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
