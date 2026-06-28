// Mobile-number-first login screen.
//
// Flow
// ----
// 1. User types a 10-digit Indian mobile number and taps Continue.
// 2. We do a SERVER-side existence check on `user_mobile_index/{mobile}`
//    (a public lookup collection — see firestore.rules). This tells us
//    whether the devotee has ever registered without needing to read the
//    sensitive `users/{mobile}` doc.
//      • If the index doc does NOT exist → brand-new user. We do NOT sign
//        in anonymously here; we just forward to /register with the
//        mobile pre-filled. The anonymous auth user is created only when
//        the registration form is submitted.
//      • If the index doc DOES exist → returning user. We lazily sign in
//        anonymously, write a claim-only merge to `users/{mobile}` so
//        this device's UID is added to the doc's `uids[]`, persist the
//        mobile locally, and let the root layout route to home.
//
// This guarantees the previous bug — where setDoc resolved locally
// before the server rejected a create, sending new users to home — can
// never happen, because we now make the routing decision from a true
// server read.

import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  arrayUnion,
  doc,
  getDocFromServer,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { CheckCircle2, Phone, Sparkles } from "lucide-react-native";

import { db, ensureAnonymousUser } from "../src/lib/firebase";
import { useBranding, useTheme } from "../src/lib/useBranding";
import { setActiveMobile } from "../src/lib/useUserProfile";

const PHONE_RE = /^[6-9]\d{9}$/;

export default function LoginScreen() {
  const theme = useTheme();
  const branding = useBranding();
  const router = useRouter();

  const [mobile, setMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onContinue() {
    const mobileKey = mobile.trim();
    if (!PHONE_RE.test(mobileKey)) {
      Alert.alert(
        "Invalid number",
        "Please enter a valid 10-digit Indian mobile number.",
      );
      return;
    }
    setSubmitting(true);
    try {
      // 1) Authoritative server check: is this mobile registered?
      //    We use `getDocFromServer` (not the cache) so a stale cached
      //    "missing" snapshot can never send a returning user to /register.
      const indexRef = doc(db, "user_mobile_index", mobileKey);
      const indexSnap = await getDocFromServer(indexRef);

      if (!indexSnap.exists()) {
        // Brand-new user → registration form. Do NOT sign in anonymously
        // here; the register screen will create the auth session lazily
        // when (and only if) the devotee submits the form.
        router.replace({
          pathname: "/register",
          params: { mobile: mobileKey },
        } as never);
        return;
      }

      // 2) Returning user → reuse the existing persisted Firebase user
      //    if one exists; only create a fresh anonymous user when the
      //    device truly has no prior session. This avoids duplicate
      //    anonymous UIDs on cold starts where AsyncStorage hasn't yet
      //    finished hydrating `auth.currentUser`.
      const user = await ensureAnonymousUser();
      const uid = user.uid;

      // 3) Claim this device on the existing user doc by adding our UID to
      //    `uids[]` via arrayUnion. Because the doc already exists, this
      //    is an UPDATE; the rules pass and required fields are inherited
      //    from the existing document.
      await setDoc(
        doc(db, "users", mobileKey),
        {
          uid,
          uids: arrayUnion(uid),
          mobile: mobileKey,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // 4) Remember locally — root layout's `useUserProfile` flips to
      //    "ready" and routes to the home tabs.
      await setActiveMobile(mobileKey);
    } catch (e) {
      Alert.alert(
        "Could not continue",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.cream }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
        {/* Brand hero */}
        <View className="items-center">
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
            <Sparkles color={theme.primary} size={32} />
          </View>
          <Text
            className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[3px]"
            style={{ color: theme.saffron }}
          >
            🙏 जय जिनेन्द्र 🙏
          </Text>
          <Text
            className="mt-1 text-center text-2xl font-bold"
            style={{ color: theme.primary }}
          >
            {branding.appName}
          </Text>
          <Text className="mt-2 text-center text-xs text-zinc-500">
            कृपया अपना मोबाइल नंबर दर्ज करें
            {"\n"}Enter your mobile number to continue
          </Text>
        </View>

        {/* Mobile input card */}
        <View
          className="mt-8 rounded-3xl bg-white p-5"
          style={{
            borderWidth: 1,
            borderColor: theme.saffron + "55",
            shadowColor: theme.primary,
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Phone color={theme.primary} size={16} />
            <Text className="ml-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Mobile • मोबाइल
            </Text>
          </View>
          <TextInput
            value={mobile}
            onChangeText={(v) => setMobile(v.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit mobile number"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            autoFocus
            editable={!submitting}
            onSubmitEditing={onContinue}
            returnKeyType="go"
            style={{
              borderWidth: 1,
              borderColor: "#E5E7EB",
              backgroundColor: "#FAFAFA",
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 17,
              letterSpacing: 1.2,
              color: "#18181B",
            }}
          />
        </View>

        {/* Continue */}
        <Pressable
          onPress={onContinue}
          disabled={submitting}
          className="mt-5 flex-row items-center justify-center rounded-full px-5 py-4 active:opacity-90"
          style={{
            backgroundColor: submitting ? theme.primary + "99" : theme.primary,
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
            <CheckCircle2 color={theme.textOnPrimary} size={18} />
          )}
          <Text
            className="ml-2 text-base font-bold"
            style={{ color: theme.textOnPrimary }}
          >
            {submitting ? "Checking…" : "Continue • आगे बढ़ें"}
          </Text>
        </Pressable>

        <Text className="mt-4 text-center text-[11px] text-zinc-500">
          New here? We'll ask for a few details after this step.
          {"\n"}नए हैं? अगले चरण में कुछ जानकारी लेंगे।
        </Text>
      </View>
        <View style={{
            bottom:20,
            alignItems:"center",
        }}>
        </View>
    </KeyboardAvoidingView>
  );
}
