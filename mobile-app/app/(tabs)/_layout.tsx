import { Tabs, router } from "expo-router";
import { Image, Platform, Pressable, Text, View } from "react-native";
import {
  Home,
  BookOpen,
  Music,
  Image as ImageIcon,
  Images,
  ChevronLeft,
  UserCircle2,
  Disc3,
  type LucideIcon,
} from "lucide-react-native";

import { useBranding, useTheme } from "../../src/lib/useBranding";

// Shared brand logo — same asset used by the website and the mobile app.
// Used as a local fallback when the admin hasn't uploaded a remote logo yet.
const LOGO = require("../../../shared/logo/logo.avif");

const INACTIVE = "#9CA3AF"; // gray-400 — tab bar inactive icon

/** Custom back button used on non-Home tabs (Library / Audio / Gallery).
 *  These tabs don't have a real navigation stack, so the button just
 *  switches to the Home tab. */
function TabBackButton() {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push("/")}
      hitSlop={12}
      accessibilityLabel="Back to Home"
      style={{
        marginLeft: Platform.OS === "ios" ? 8 : 4,
        paddingHorizontal: 6,
        paddingVertical: 6,
      }}
    >
      <ChevronLeft color={theme.primary} size={26} />
    </Pressable>
  );
}

/** Header action button that opens the user's profile screen. */
function ProfileHeaderButton() {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push("/profile" as never)}
      hitSlop={12}
      accessibilityLabel="My Profile"
      style={{
        marginRight: Platform.OS === "ios" ? 8 : 12,
        paddingHorizontal: 6,
        paddingVertical: 6,
      }}
    >
      <UserCircle2 color={theme.primary} size={26} />
    </Pressable>
  );
}

/** Branded Home title: logo + Devanagari name + small English subtitle. */
function HomeHeaderTitle() {
  const { appName, appSubtitle, logoUrl } = useBranding();
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: theme.cream,
          borderWidth: 1.5,
          borderColor: theme.saffron + "8C",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
          overflow: "hidden",
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <Image
          source={logoUrl ? { uri: logoUrl } : LOGO}
          style={{ width: 32, height: 32 }}
          resizeMode="contain"
        />
      </View>
      <View
        style={{ alignItems: "flex-start", flexShrink: 1 }}
      >
        <Text
          style={{
            color: theme.primary,
            fontWeight: "800",
            fontSize: 18,
            letterSpacing: 0.2,
          }}
          numberOfLines={1}
        >
          {appName}
        </Text>
        <Text
          style={{
            color: theme.accent,
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 0.3,
            marginTop: 1,
          }}
          numberOfLines={1}
        >
          {appSubtitle}
        </Text>
      </View>
    </View>
  );
}

/** Branded tab header: small saffron icon badge + title + subtitle.
 *  Used for Library / Audio / Gallery so each tab doesn't repeat the
 *  same heading inside its own screen body. */
function TabHeaderTitle({
  Icon,
  title,
  subtitle,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: theme.saffron + "33",
          borderWidth: 1,
          borderColor: theme.saffron + "59",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        <Icon color={theme.saffron} size={20} />
      </View>
      <View style={{ alignItems: "flex-start", flexShrink: 1 }}>
        <Text
          style={{
            color: theme.primary,
            fontWeight: "800",
            fontSize: 18,
            letterSpacing: 0.2,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={{
            color: "#71717A",
            fontSize: 11,
            fontWeight: "500",
            marginTop: 1,
          }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        // App-wide header — warm cream background fits the religious theme;
        // the soft saffron-tinted shadow acts as a separator from content.
        headerStyle: {
          backgroundColor: theme.headerBg,
          shadowColor: theme.saffron,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 4,
        },
        headerTitleStyle: {
          color: theme.primary,
          fontWeight: "700",
          fontSize: 20,
          letterSpacing: 0.2,
        },
        headerTitleAlign: Platform.OS === "ios" ? "center" : "left",
        headerTintColor: theme.primary,
        headerShadowVisible: true,

        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#F1E6D6",
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          // Custom branded title (logo + name) on the Home tab.
          headerTitle: () => <HomeHeaderTitle />,
          // Force left alignment on iOS so the logo+text block isn't
          // clipped when centered.
          headerTitleAlign: "left",
          headerRight: () => <ProfileHeaderButton />,
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          headerTitle: () => (
            <TabHeaderTitle
              Icon={BookOpen}
              title="Library"
              subtitle="Poojan, Aarti, Chalisa & more"
            />
          ),
          headerTitleAlign: "left",
          headerLeft: () => <TabBackButton />,
          headerRight: () => <ProfileHeaderButton />,
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="audio"
        options={{
          title: "Audio",
          headerTitle: () => (
            <TabHeaderTitle
              Icon={Music}
              title="Bhajans"
              subtitle="Devotional music — plays in background"
            />
          ),
          headerTitleAlign: "left",
          headerLeft: () => <TabBackButton />,
          headerRight: () => <ProfileHeaderButton />,
          tabBarIcon: ({ color, size }) => <Music color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="jaap"
        options={{
          title: "Jaap",
          headerTitle: () => (
            <TabHeaderTitle
              Icon={Disc3}
              title="Jaap"
              subtitle="जप / माला — tap to count"
            />
          ),
          headerTitleAlign: "left",
          headerLeft: () => <TabBackButton />,
          headerRight: () => <ProfileHeaderButton />,
          tabBarIcon: ({ color, size }) => <Disc3 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: "Gallery",
          headerTitle: () => (
            <TabHeaderTitle
              Icon={Images}
              title="Gallery"
              subtitle="Photos, pravachans & reels"
            />
          ),
          headerTitleAlign: "left",
          headerLeft: () => <TabBackButton />,
          headerRight: () => <ProfileHeaderButton />,
          tabBarIcon: ({ color, size }) => (
            <ImageIcon color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
