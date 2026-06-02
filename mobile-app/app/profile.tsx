// Devotee profile screen.
//   • View mode  — read-only card with name, location, mobile, email, DOB,
//                  age, gender, marital status (+ marriage date).
//   • Edit mode  — same fields editable. Mobile is locked (it's the doc id).
//                  Saving writes back to `users/{mobile}` via merge so the
//                  same record stays in sync across app + web.

import { useEffect, useState } from "react";
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
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Calendar,
  CheckCircle2,
  Heart,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  X,
} from "lucide-react-native";

import { db } from "../src/lib/firebase";
import { useBranding, useTheme } from "../src/lib/useBranding";
import { setActiveMobile, useUserProfile } from "../src/lib/useUserProfile";
import type { Gender, MaritalStatus } from "../../shared/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(s?: string | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function pretty(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ageFromDob(dob: string | null): number | null {
  const d = parseISODate(dob);
  if (!d) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const md = now.getMonth() - d.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/**
 * Web-only date input. The native picker is a no-op in the browser, so we
 * render an HTML `<input type="date">` instead.
 */
function WebDateInput({
  value,
  onChange,
  max,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
  max?: string;
}) {
  return (
    <input
      type="date"
      value={value ? toISODate(value) : ""}
      max={max}
      onChange={(e) => {
        const v = (e.target as HTMLInputElement).value;
        if (!v) return;
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

export default function ProfileScreen() {
  const theme = useTheme();
  const branding = useBranding();
  const { profile, status } = useUserProfile();

  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Local form state — only used in edit mode.
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | "">("");
  const [dob, setDob] = useState<Date | null>(null);
  const [marriageDate, setMarriageDate] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showMarriagePicker, setShowMarriagePicker] = useState(false);

  // Hydrate form when the profile arrives / changes.
  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setLocation(profile.location ?? "");
    setEmail(profile.email ?? "");
    setGender((profile.gender as Gender) ?? "");
    setMaritalStatus((profile.maritalStatus as MaritalStatus) ?? "");
    setDob(parseISODate(profile.dob));
    setMarriageDate(parseISODate(profile.marriageDate ?? null));
  }, [profile]);

  if (status === "loading") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.cream,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.cream,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text style={{ color: theme.primary, fontWeight: "700", fontSize: 16 }}>
          No profile found.
        </Text>
        <Pressable
          onPress={() => router.replace("/register" as never)}
          style={{
            marginTop: 12,
            backgroundColor: theme.primary,
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: theme.textOnPrimary, fontWeight: "700" }}>
            Register
          </Text>
        </Pressable>
      </View>
    );
  }

  const age = ageFromDob(profile.dob);

  function validate(): string | null {
    if (!name.trim()) return "Please enter your name.";
    if (!location.trim()) return "Please enter your city / location.";
    if (email.trim() && !EMAIL_RE.test(email.trim()))
      return "Please enter a valid email address.";
    if (!dob) return "Please choose your date of birth.";
    if (!gender) return "Please select your gender.";
    if (!maritalStatus) return "Please select your marital status.";
    if (maritalStatus === "married" && !marriageDate)
      return "Please choose your marriage date.";
    return null;
  }

  async function onSave() {
    if (!profile) return;
    const err = validate();
    if (err) {
      Alert.alert("Missing info", err);
      return;
    }
    setSubmitting(true);
    try {
      const ref = doc(db, "users", profile.mobile);
      const payload: Record<string, unknown> = {
        name: name.trim(),
        location: location.trim(),
        dob: toISODate(dob!),
        gender,
        maritalStatus,
        updatedAt: serverTimestamp(),
      };
      if (email.trim()) {
        payload.email = email.trim();
      } else {
        // Allow clearing: write null instead of delete to keep rules simple.
        payload.email = null;
      }
      if (maritalStatus === "married" && marriageDate) {
        payload.marriageDate = toISODate(marriageDate);
      } else {
        payload.marriageDate = null;
      }
      await setDoc(ref, payload, { merge: true });
      setEditing(false);
    } catch (e) {
      Alert.alert(
        "Could not save",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function cancelEdit() {
    // Reset form to last-saved profile values.
    if (profile) {
      setName(profile.name ?? "");
      setLocation(profile.location ?? "");
      setEmail(profile.email ?? "");
      setGender((profile.gender as Gender) ?? "");
      setMaritalStatus((profile.maritalStatus as MaritalStatus) ?? "");
      setDob(parseISODate(profile.dob));
      setMarriageDate(parseISODate(profile.marriageDate ?? null));
    }
    setEditing(false);
  }

  function onSignOut() {
    // `Alert.alert` on react-native-web is a single-button `window.alert`
    // that never fires destructive `onPress` callbacks, so the sign-out
    // never ran from the browser. Use the native `window.confirm` on web
    // and the real Alert dialog on iOS / Android.
    const doSignOut = async () => {
      await setActiveMobile(null);
      router.replace("/login" as never);
    };
    if (Platform.OS === "web") {
      const ok =
        typeof window !== "undefined" &&
        typeof window.confirm === "function"
          ? window.confirm(
              "Sign out of this device? You'll be asked to enter your mobile number again the next time you open the app.",
            )
          : true;
      if (ok) void doSignOut();
      return;
    }
    Alert.alert(
      "Sign out of this device?",
      "You'll be asked to enter your mobile number again the next time you open the app. Your data stays safe on the server.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: doSignOut,
        },
      ],
    );
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
        {/* Hero */}
        <View className="items-center pt-2">
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
            numberOfLines={1}
          >
            {profile.name}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 6,
            }}
          >
            <ShieldCheck color={theme.accent} size={12} />
            <Text className="text-[11px] text-zinc-500">
              Verified devotee of {branding.appName}
            </Text>
          </View>
        </View>

        {/* Card */}
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
          {!editing ? (
            <View>
              <Row
                icon={<UserIcon color={theme.primary} size={16} />}
                label="Full Name"
                value={profile.name}
              />
              <Row
                icon={<MapPin color={theme.primary} size={16} />}
                label="Location"
                value={profile.location}
              />
              <Row
                icon={<Phone color={theme.primary} size={16} />}
                label="Mobile"
                value={profile.mobile}
              />
              <Row
                icon={<Mail color={theme.primary} size={16} />}
                label="Email"
                value={profile.email || "—"}
              />
              <Row
                icon={<Calendar color={theme.primary} size={16} />}
                label="Date of Birth"
                value={
                  parseISODate(profile.dob)
                    ? `${pretty(parseISODate(profile.dob))}${age !== null ? `  •  ${age} yrs` : ""}`
                    : "—"
                }
              />
              <Row
                icon={<Heart color={theme.primary} size={16} />}
                label="Gender"
                value={
                  profile.gender
                    ? profile.gender.charAt(0).toUpperCase() +
                      profile.gender.slice(1)
                    : "—"
                }
              />
              <Row
                icon={<Heart color={theme.primary} size={16} />}
                label="Marital Status"
                value={
                  profile.maritalStatus
                    ? profile.maritalStatus.charAt(0).toUpperCase() +
                      profile.maritalStatus.slice(1)
                    : "—"
                }
              />
              {profile.maritalStatus === "married" && (
                <Row
                  icon={<Calendar color={theme.primary} size={16} />}
                  label="Marriage Date"
                  value={pretty(parseISODate(profile.marriageDate ?? null))}
                  isLast
                />
              )}
            </View>
          ) : (
            <View>
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

              {/* Mobile — read-only because it is the document id. */}
              <Field
                icon={<Phone color={theme.primary} size={16} />}
                label="Mobile • मोबाइल (locked)"
              >
                <View
                  style={{
                    ...inputStyle,
                    backgroundColor: "#F4F4F5",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: "#52525B", fontSize: 15 }}>
                    {profile.mobile}
                  </Text>
                  <ShieldCheck color={theme.accent} size={16} />
                </View>
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
                  />
                ) : (
                  <>
                    <Pressable
                      onPress={() => setShowDobPicker(true)}
                      style={dateButtonStyle}
                    >
                      <Text
                        style={{
                          color: dob ? "#18181B" : "#9CA3AF",
                          fontSize: 15,
                        }}
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
                            if (Platform.OS !== "ios")
                              setShowMarriagePicker(false);
                            if (d) setMarriageDate(d);
                          }}
                        />
                      )}
                    </>
                  )}
                </Field>
              )}
            </View>
          )}
        </View>

        {/* Action buttons */}
        {!editing ? (
          <View style={{ marginTop: 18, gap: 10 }}>
            <Pressable
              onPress={() => setEditing(true)}
              className="flex-row items-center justify-center rounded-full px-5 py-4 active:opacity-90"
              style={{
                backgroundColor: theme.primary,
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 10,
                elevation: 3,
              }}
            >
              <Pencil color={theme.textOnPrimary} size={16} />
              <Text
                className="ml-2 text-base font-bold"
                style={{ color: theme.textOnPrimary }}
              >
                Edit Profile • प्रोफ़ाइल संपादित करें
              </Text>
            </Pressable>

            <Pressable
              onPress={onSignOut}
              className="flex-row items-center justify-center rounded-full px-5 py-3 active:opacity-90"
              style={{
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <LogOut color="#52525B" size={15} />
              <Text
                className="ml-2 text-sm font-semibold"
                style={{ color: "#52525B" }}
              >
                Sign out of this device
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ marginTop: 18, flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={cancelEdit}
              disabled={submitting}
              className="flex-1 flex-row items-center justify-center rounded-full px-5 py-4 active:opacity-90"
              style={{
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <X color="#52525B" size={16} />
              <Text
                className="ml-2 text-sm font-semibold"
                style={{ color: "#52525B" }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={submitting}
              className="flex-1 flex-row items-center justify-center rounded-full px-5 py-4 active:opacity-90"
              style={{
                backgroundColor: submitting
                  ? theme.primary + "99"
                  : theme.primary,
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
                <CheckCircle2 color={theme.textOnPrimary} size={16} />
              )}
              <Text
                className="ml-2 text-sm font-bold"
                style={{ color: theme.textOnPrimary }}
              >
                {submitting ? "Saving…" : "Save changes"}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------- helpers ---------- */

function Row({
  icon,
  label,
  value,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#F4F4F5",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View style={{ width: 24 }}>{icon}</View>
      <View style={{ flex: 1, marginLeft: 4 }}>
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </Text>
        <Text
          className="mt-0.5 text-[15px] font-medium text-zinc-900"
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

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
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}
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
