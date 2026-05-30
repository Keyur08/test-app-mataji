// Admin login screen — Firebase email/password, then verifies that the
// signed-in uid has a matching `admins/{uid}` doc. On success it forwards
// to the WebView screen with a short-lived ID token in the URL so the
// hosted dashboard can mint a session cookie without showing its own
// login form.

import { useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Lock, LogIn, Mail, ShieldCheck } from "lucide-react-native";

import { auth, db } from "../src/lib/firebase";
import { useBranding, useTheme } from "../src/lib/useBranding";

export default function AdminLoginScreen() {
  const theme = useTheme();
  const branding = useBranding();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    const e = email.trim();
    if (!e || !password) {
      Alert.alert("Missing info", "Please enter both email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, e, password);
      const uid = cred.user.uid;

      // Gate: must have an admins/{uid} doc.
      const adminSnap = await getDoc(doc(db, "admins", uid));
      if (!adminSnap.exists()) {
        await signOut(auth);
        Alert.alert(
          "Not authorized",
          "This account is not an administrator of " + branding.appName + ".",
        );
        return;
      }

      const token = await cred.user.getIdToken(true);
      router.replace({
        pathname: "/admin-webview",
        params: { token },
      } as never);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not sign in. Try again.";
      Alert.alert("Sign-in failed", msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.cream }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              height: 72,
              width: 72,
              borderRadius: 36,
              backgroundColor: theme.primary + "1A",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: theme.saffron,
            }}
          >
            <ShieldCheck color={theme.primary} size={32} />
          </View>
          <Text
            style={{
              marginTop: 12,
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 3,
              textTransform: "uppercase",
              color: theme.saffron,
            }}
          >
            Administrator Access
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontSize: 22,
              fontWeight: "800",
              color: theme.primary,
              textAlign: "center",
            }}
          >
            {branding.appName}
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "#71717A",
              textAlign: "center",
            }}
          >
            Sign in with your admin email to manage the app.
          </Text>
        </View>

        {/* Card */}
        <View
          style={{
            marginTop: 28,
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.saffron + "55",
            shadowColor: theme.primary,
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
          }}
        >
          <FieldLabel icon={<Mail color={theme.primary} size={16} />} label="Email" />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="admin@example.com"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!submitting}
            style={inputStyle}
          />

          <View style={{ height: 14 }} />

          <FieldLabel icon={<Lock color={theme.primary} size={16} />} label="Password" />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            autoCapitalize="none"
            editable={!submitting}
            style={inputStyle}
          />

          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            style={{
              marginTop: 22,
              backgroundColor: submitting ? theme.primary + "99" : theme.primary,
              borderRadius: 999,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 3,
            }}
          >
            {submitting ? (
              <ActivityIndicator color={theme.textOnPrimary} />
            ) : (
              <LogIn color={theme.textOnPrimary} size={16} />
            )}
            <Text
              style={{
                marginLeft: 8,
                color: theme.textOnPrimary,
                fontWeight: "800",
                fontSize: 15,
              }}
            >
              {submitting ? "Verifying…" : "Sign in"}
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "#9CA3AF",
            paddingHorizontal: 20,
          }}
        >
          Only authorized administrators can sign in. Devotees do not need an
          account here — please use the main app instead.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
      }}
    >
      <View style={{ marginRight: 6 }}>{icon}</View>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "#52525B",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  backgroundColor: "#FAFAFA",
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
  color: "#18181B",
} as const;
