// Mandatory one-time devotee registration. Saves to `users/{uid}` and the
// root layout then routes the user to the Home tab.

import { useState } from "react";
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
import { useLocalSearchParams } from "expo-router";
import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Calendar,
  CheckCircle2,
  Heart,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User as UserIcon,
} from "lucide-react-native";

import { db, ensureAnonymousUser } from "../src/lib/firebase";
import { useBranding, useTheme } from "../src/lib/useBranding";
import { setActiveMobile } from "../src/lib/useUserProfile";
import type { Gender, MaritalStatus } from "../../shared/types";

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pretty(d: Date | null) {
  if (!d) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * On web `@react-native-community/datetimepicker` is a no-op, so we render
 * a real HTML `<input type="date">` instead. The styling roughly matches
 * `dateButtonStyle` below.
 */
function WebDateInput({
  value,
  onChange,
  max,
  placeholder,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
  max?: string;
  placeholder?: string;
}) {
  const iso = value ? toISODate(value) : "";
  return (
    <input
      type="date"
      value={iso}
      max={max}
      placeholder={placeholder}
      onChange={(e) => {
        const v = (e.target as HTMLInputElement).value;
        if (!v) return;
        // Parse as local date to avoid TZ shifts.
        const [y, m, d] = v.split("-").map((n) => Number(n));
        onChange(new Date(y, m - 1, d));
      }}
      style={{
        width: "100%",
        boxSizing: "border-box",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "#E5E7EB",
        backgroundColor: "#FAFAFA",
        borderRadius: 14,
        padding: "12px 14px",
        fontSize: 15,
        color: value ? "#18181B" : "#9CA3AF",
        outline: "none",
        fontFamily: "inherit",
      }}
    />
  );
}

export default function RegisterScreen() {
  const theme = useTheme();
  const branding = useBranding();
  // /register may be entered directly (from the gate) or forwarded from
  // /login with a pre-typed mobile number. In the latter case we lock the
  // field so the devotee can't accidentally change it before submitting.
  const params = useLocalSearchParams<{ mobile?: string }>();
  const prefilledMobile =
    typeof params.mobile === "string" && /^[6-9]\d{9}$/.test(params.mobile)
      ? params.mobile
      : "";

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [mobile, setMobile] = useState(prefilledMobile);
  const mobileLocked = prefilledMobile.length === 10;
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | "">("");
  const [dob, setDob] = useState<Date | null>(null);
  const [marriageDate, setMarriageDate] = useState<Date | null>(null);

  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showMarriagePicker, setShowMarriagePicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  function validate(): string | null {
    if (!name.trim()) return "Please enter your name.";
    if (!location.trim()) return "Please enter your city / location.";
    if (!PHONE_RE.test(mobile.trim()))
      return "Please enter a valid 10-digit Indian mobile number.";
    if (email.trim() && !EMAIL_RE.test(email.trim()))
      return "Please enter a valid email address.";
    if (!dob) return "Please choose your date of birth.";
    if (!gender) return "Please select your gender.";
    if (!maritalStatus) return "Please select your marital status.";
    if (maritalStatus === "married" && !marriageDate)
      return "Please choose your marriage date.";
    return null;
  }

  async function onSubmit() {
    const err = validate();
    if (err) {
      Alert.alert("Missing info", err);
      return;
    }
    setSubmitting(true);
    try {
      // Reuse the persisted Firebase user if one already exists on this
      // device; only create a fresh anonymous user when there truly is
      // none. `ensureAnonymousUser` waits for auth persistence to
      // hydrate, which prevents the duplicate-anon-user bug where
      // `auth.currentUser` was still null on the first render.
      const user = await ensureAnonymousUser();
      const uid = user.uid;
      if (!uid) {
        Alert.alert(
          "Connection issue",
          "Please check your internet connection and try again.",
        );
        setSubmitting(false);
        return;
      }
      const mobileKey = mobile.trim();
      const ref = doc(db, "users", mobileKey);
      // Look up by mobile first — if a profile already exists we MERGE so
      // the same devotee on app + web stays as one record. `createdAt` is
      // preserved; only fresh devices get a brand-new doc.
      const existing = await getDoc(ref);

      const payload: Record<string, unknown> = {
        // Keep `uid` as the most-recent claiming UID — handy for debugging.
        uid,
        // `uids` accumulates every anon session that has claimed this
        // profile so rules can authorise updates from any of those devices.
        uids: arrayUnion(uid),
        name: name.trim(),
        location: location.trim(),
        mobile: mobileKey,
        dob: toISODate(dob!),
        gender,
        maritalStatus,
        updatedAt: serverTimestamp(),
      };
      if (!existing.exists()) {
        payload.createdAt = serverTimestamp();
      }
      if (email.trim()) payload.email = email.trim();
      if (maritalStatus === "married" && marriageDate) {
        payload.marriageDate = toISODate(marriageDate);
      }

      await setDoc(ref, payload, { merge: true });

      // Public existence index used by /login to detect known users on
      // brand-new devices without reading the sensitive `users/{mobile}`
      // doc. We only write it for first-time registrations so the
      // `createdAt == request.time` rule passes.
      if (!existing.exists()) {
        try {
          await setDoc(doc(db, "user_mobile_index", mobileKey), {
            createdAt: serverTimestamp(),
          });
        } catch {
          // Non-fatal: if the index write fails the user is still
          // registered; they'll just be asked for the form again on a
          // future fresh-install login. Don't block the happy path.
        }
      }

      // Remember this mobile locally; the root layout's `useUserProfile`
      // re-subscribes to `users/{mobile}` and flips status → "ready",
      // which auto-navigates to the home tabs.
      await setActiveMobile(mobileKey);
    } catch (e) {
      Alert.alert(
        "Could not save",
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
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand hero */}
        <View className="items-center pt-4">
          <View
            style={{
              height: 64,
              width: 64,
              borderRadius: 32,
              backgroundColor: theme.primary + "1A",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: theme.saffron,
            }}
          >
            <Sparkles color={theme.primary} size={28} />
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
          <Text className="mt-1 text-center text-xs text-zinc-500">
            कृपया आगे बढ़ने से पहले अपना परिचय दें
            {"\n"}Please introduce yourself to continue
          </Text>
        </View>

        {/* Form card */}
        <View
          className="mt-6 rounded-3xl bg-white p-5"
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
          <Field
            icon={<UserIcon color={theme.primary} size={16} />}
            label="Full Name • पूरा नाम"
          >
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              style={inputStyle}
            />
          </Field>

          <Field
            icon={<MapPin color={theme.primary} size={16} />}
            label="Location • स्थान"
          >
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="City, state"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              style={inputStyle}
            />
          </Field>

          <Field
            icon={<Phone color={theme.primary} size={16} />}
            label="Mobile • मोबाइल"
          >
            <TextInput
              value={mobile}
              onChangeText={(v) => setMobile(v.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              editable={!mobileLocked}
              style={[
                inputStyle,
                mobileLocked ? { color: "#6B7280", backgroundColor: "#F3F4F6" } : null,
              ]}
            />
          </Field>

          <Field
            icon={<Mail color={theme.primary} size={16} />}
            label="Email (optional) • ईमेल"
          >
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              style={inputStyle}
            />
          </Field>

          <Field
            icon={<Calendar color={theme.primary} size={16} />}
            label="Date of Birth • जन्म तिथि"
          >
            {Platform.OS === "web" ? (
              <WebDateInput
                value={dob}
                onChange={setDob}
                max={toISODate(new Date())}
                placeholder="YYYY-MM-DD"
              />
            ) : (
              <>
                <Pressable
                  onPress={() => setShowDobPicker(true)}
                  style={dateButtonStyle}
                >
                  <Text
                    style={{ color: dob ? "#18181B" : "#9CA3AF", fontSize: 15 }}
                  >
                    {dob ? pretty(dob) : "Tap to choose"}
                  </Text>
                  <Calendar color={theme.primary} size={18} />
                </Pressable>
                {showDobPicker && (
                  <DateTimePicker
                    value={dob ?? new Date(1990, 0, 1)}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    maximumDate={new Date()}
                    onChange={(_, d) => {
                      if (Platform.OS !== "ios") setShowDobPicker(false);
                      if (d) setDob(d);
                    }}
                  />
                )}
              </>
            )}
          </Field>

          {/* Gender */}
          <Field
            icon={<Heart color={theme.primary} size={16} />}
            label="Gender • लिंग"
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(
                [
                  { v: "male" as const, label: "Male" },
                  { v: "female" as const, label: "Female" },
                  { v: "other" as const, label: "Other" },
                ]
              ).map((g) => (
                <Chip
                  key={g.v}
                  active={gender === g.v}
                  label={g.label}
                  onPress={() => setGender(g.v)}
                  theme={theme}
                />
              ))}
            </View>
          </Field>

          {/* Marital status */}
          <Field
            icon={<Heart color={theme.primary} size={16} />}
            label="Marital Status • वैवाहिक स्थिति"
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Chip
                active={maritalStatus === "unmarried"}
                label="Unmarried"
                onPress={() => {
                  setMaritalStatus("unmarried");
                  setMarriageDate(null);
                }}
                theme={theme}
              />
              <Chip
                active={maritalStatus === "married"}
                label="Married"
                onPress={() => setMaritalStatus("married")}
                theme={theme}
              />
            </View>
          </Field>

          {maritalStatus === "married" && (
            <Field
              icon={<Calendar color={theme.primary} size={16} />}
              label="Marriage Date • विवाह तिथि"
            >
              {Platform.OS === "web" ? (
                <WebDateInput
                  value={marriageDate}
                  onChange={setMarriageDate}
                  max={toISODate(new Date())}
                  placeholder="YYYY-MM-DD"
                />
              ) : (
                <>
                  <Pressable
                    onPress={() => setShowMarriagePicker(true)}
                    style={dateButtonStyle}
                  >
                    <Text
                      style={{
                        color: marriageDate ? "#18181B" : "#9CA3AF",
                        fontSize: 15,
                      }}
                    >
                      {marriageDate ? pretty(marriageDate) : "Tap to choose"}
                    </Text>
                    <Calendar color={theme.primary} size={18} />
                  </Pressable>
                  {showMarriagePicker && (
                    <DateTimePicker
                      value={marriageDate ?? new Date()}
                      mode="date"
                      display={Platform.OS === "ios" ? "inline" : "default"}
                      maximumDate={new Date()}
                      onChange={(_, d) => {
                        if (Platform.OS !== "ios") setShowMarriagePicker(false);
                        if (d) setMarriageDate(d);
                      }}
                    />
                  )}
                </>
              )}
            </Field>
          )}
        </View>

        {/* Submit */}
        <Pressable
          onPress={onSubmit}
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
            {submitting ? "Saving…" : "Continue • आगे बढ़ें"}
          </Text>
        </Pressable>

        <Text className="mt-4 text-center text-[11px] text-zinc-500">
          By continuing, you agree that the app may contact you regarding
          spiritual events and updates.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------- field helpers ---------- */

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <View style={{ marginRight: 6 }}>{icon}</View>
        <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Chip({
  active,
  label,
  onPress,
  theme,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: active ? theme.primary : "#FFFFFF",
        borderWidth: 1,
        borderColor: active ? theme.primary : "#E5E7EB",
      }}
    >
      <Text
        style={{
          color: active ? theme.textOnPrimary : "#3F3F46",
          fontWeight: active ? "700" : "600",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
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

const dateButtonStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderWidth: 1,
  borderColor: "#E5E7EB",
  backgroundColor: "#FAFAFA",
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 13,
} as const;
