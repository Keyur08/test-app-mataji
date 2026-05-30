import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { AudioPlayerProvider } from "../src/lib/AudioPlayerProvider";
import { MiniPlayer } from "../components/MiniPlayer";
import { DailyPopup } from "../components/DailyPopup";
import { useNotificationTapHandler } from "../src/lib/notifications";
import { useUserProfile } from "../src/lib/useUserProfile";
import "../global.css";

/** Phone-like max width when running in a desktop browser. */
const WEB_MAX_WIDTH = 480;

/**
 * Root navigation stack.
 *  - `(tabs)`     — main bottom-tab layout (Home / Library / Audio / Gallery)
 *  - `news/[id]`  — pushed from anywhere; not visible in the tab bar
 *  - `contact`    — modal-style contact form; not visible in the tab bar
 */
export default function RootLayout() {
  const isWeb = Platform.OS === "web";

  // Route to the correct screen when the user taps a push notification.
  useNotificationTapHandler();

  // Gate the app on mandatory profile registration.
  const { status } = useUserProfile();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (status === "loading") return;
    const seg0 = segments[0] as string | undefined;
    const onAuthScreen = seg0 === "login" || seg0 === "register";
    if (status === "missing" && !onAuthScreen) {
      // New device / no saved mobile → start with mobile-only login.
      // If the mobile is registered, login routes home directly; if not,
      // it forwards to /register with the mobile pre-filled.
      router.replace("/login" as never);
    } else if (status === "ready" && onAuthScreen) {
      router.replace("/" as never);
    }
  }, [status, segments, router]);

  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        // On web (desktop browsers), paint the page background a warm
        // saffron-cream so the side gutters around the phone-width app
        // column look intentional rather than empty.
        backgroundColor: isWeb ? "#F1E6D6" : undefined,
      }}
    >
      {/* Web-only: reset html/body margins and paint the page background.
          Kept out of global.css because the NativeWind CSS → RN parser
          fails on plain `html`/`body` selectors during the Android build. */}
      {isWeb ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body,#root{margin:0;padding:0;min-height:100vh;background-color:#F1E6D6;}`,
          }}
        />
      ) : null}
      <SafeAreaProvider>
        <AudioPlayerProvider>
          <StatusBar style="dark" />
          {/* On web, constrain the entire app to a phone-like column and
              center it. On native, this is a transparent flex container. */}
          <View
            style={{
              flex: 1,
              ...(isWeb
                ? {
                    width: "100%",
                    maxWidth: WEB_MAX_WIDTH,
                    alignSelf: "center",
                    backgroundColor: "#FFF8F0",
                    // Soft shadow on both sides for a "phone on desktop" feel.
                    shadowColor: "#B8336A",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.15,
                    shadowRadius: 20,
                  }
                : null),
            }}
          >
            <Stack
              screenOptions={{
                // Native-stack header — warm cream background matches the
                // religious theme. Only a small subset of style props are
                // supported here, so the separator comes from the native
                // `headerShadowVisible` rather than custom shadow styles.
                headerStyle: { backgroundColor: "#FFF8F0" },
                headerTitleStyle: {
                  color: "#B8336A",
                  fontWeight: "700",
                  fontSize: 18,
                },
                headerTintColor: "#B8336A",
                headerShadowVisible: true,
                headerBackTitle: "",
                contentStyle: { backgroundColor: "#FFF8F0" },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="login"
                options={{ headerShown: false, gestureEnabled: false }}
              />
              <Stack.Screen
                name="register"
                options={{ headerShown: false, gestureEnabled: false }}
              />
              <Stack.Screen
                name="profile"
                options={{ title: "My Profile" }}
              />
              <Stack.Screen
                name="news/index"
                options={{ title: "Announcements" }}
              />
              <Stack.Screen name="news/[id]" options={{ title: "News" }} />
              <Stack.Screen
                name="library/[id]"
                options={{ title: "Reading" }}
              />
              <Stack.Screen
                name="library/category/[name]"
                options={{ title: "Category" }}
              />
              <Stack.Screen
                name="contact"
                options={{ title: "Aahar Daan", presentation: "modal" }}
              />
              <Stack.Screen name="biography" options={{ title: "Biography" }} />
            </Stack>
            {status === "loading" && (
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
                <ActivityIndicator size="large" color="#B8336A" />
                <Text
                  style={{
                    marginTop: 12,
                    color: "#A0522D",
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  Connecting…
                </Text>
              </View>
            )}
            {/* Floats above the tab bar, hidden when no track is playing */}
            <MiniPlayer />
            {/* Daily startup popup — shown once per day per device when the
                admin has uploaded an active image. Lives at the root so it
                can overlay every screen including the tab bar. */}
            {status === "ready" && <DailyPopup />}
          </View>
        </AudioPlayerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
