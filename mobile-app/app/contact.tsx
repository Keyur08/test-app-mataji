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
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Calendar,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  User,
} from "lucide-react-native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "../src/lib/firebase";
import { openMaps, openWhatsApp, openDialer } from "../src/lib/links";
import { ORG } from "../../shared/constants";

const todayISO = () => new Date().toISOString().slice(0, 10);
const isoToDate = (s: string) => new Date(`${s}T00:00:00`);
const dateToISO = (d: Date) => d.toISOString().slice(0, 10);
const prettyDate = (s: string) =>
  isoToDate(s).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function ContactScreen() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!name.trim() || !phone.trim() || !location.trim() || !date) {
      Alert.alert("Missing info", "Please fill in name, phone, date and location.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) {
      Alert.alert("Invalid phone", "Please enter a valid phone number.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "registrations"), {
        kind: "aahar_daan",
        name: name.trim(),
        phone: phone.trim(),
        location: location.trim(),
        date,
        notes: notes.trim() || null,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      Alert.alert(
        "🙏 Registration received",
        "Thank you for your Aahar Daan. We'll contact you shortly."
      );
      router.back();
    } catch (e) {
      Alert.alert(
        "Submission failed",
        e instanceof Error ? e.message : "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1 bg-cream"
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-sm font-medium uppercase tracking-widest text-saffron">
          Seva Registration
        </Text>
        <Text className="mt-1 text-2xl font-bold text-primary">
          Aahar Daan Registration
        </Text>
        <Text className="mt-2 text-sm leading-5 text-zinc-600">
          Offer your seva by sharing a few details below. You may also reach us
          directly via WhatsApp or phone.
        </Text>

        {/* Quick actions */}
        <View className="mt-5 flex-row gap-3">
          <ActionPill
            icon={<MessageCircle color="#25D366" size={18} />}
            label="WhatsApp"
            onPress={() =>
              openWhatsApp({
                phone: ORG.whatsappNumber,
                message:
                  "🙏 Jai Shree Mataji 🙏\n\nI would like to register for Aahar Daan.",
              })
            }
          />
          <ActionPill
            icon={<MapPin color="#B8336A" size={18} />}
            label="Open Map"
            onPress={() => openMaps(ORG.address)}
          />
          <ActionPill
            icon={<Phone color="#B8336A" size={18} />}
            label="Call"
            onPress={() => openDialer(ORG.phone)}
          />
        </View>

        {/* Form card */}
        <View className="mt-6 rounded-3xl border border-primary/10 bg-white p-5">
          <Field
            icon={<User color="#B8336A" size={16} />}
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            autoCapitalize="words"
          />
          <Field
            icon={<Phone color="#B8336A" size={16} />}
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98765 43210"
            keyboardType="phone-pad"
          />

          {/* Date */}
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <Calendar color="#B8336A" size={12} />  Date
          </Text>
          <Pressable
            onPress={() => setShowPicker(true)}
            className="mb-4 flex-row items-center justify-between rounded-2xl border border-primary/15 bg-cream px-4 py-3.5 active:opacity-80"
          >
            <Text className="text-base text-zinc-900">{prettyDate(date)}</Text>
            <Calendar color="#B8336A" size={18} />
          </Pressable>
          {showPicker ? (
            <DateTimePicker
              value={isoToDate(date)}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              minimumDate={new Date()}
              onChange={(_, selected) => {
                if (Platform.OS !== "ios") setShowPicker(false);
                if (selected) setDate(dateToISO(selected));
              }}
            />
          ) : null}

          <Field
            icon={<MapPin color="#B8336A" size={16} />}
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="City, area or full address"
            autoCapitalize="words"
          />

          <Field
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything else we should know?"
            multiline
          />
        </View>

        {/* Submit */}
        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          className={`mt-5 flex-row items-center justify-center rounded-2xl px-5 py-4 ${
            submitting ? "bg-primary/60" : "bg-primary active:opacity-90"
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Send color="#fff" size={18} />
          )}
          <Text className="ml-2 text-base font-semibold text-white">
            {submitting ? "Submitting…" : "Submit Registration"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------- helpers ---------- */

function ActionPill({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center justify-center rounded-2xl border border-primary/15 bg-white py-3 active:opacity-80"
    >
      {icon}
      <Text className="ml-1.5 text-xs font-semibold text-zinc-900">{label}</Text>
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  icon?: React.ReactNode;
};

function Field({ label, multiline, icon, ...rest }: FieldProps) {
  return (
    <View className="mb-4">
      <View className="mb-1.5 flex-row items-center">
        {icon ? <View className="mr-1.5">{icon}</View> : null}
        <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </Text>
      </View>
      <TextInput
        {...rest}
        multiline={multiline}
        placeholderTextColor="#9CA3AF"
        className={`rounded-2xl border border-primary/15 bg-cream px-4 py-3 text-base text-zinc-900 ${
          multiline ? "min-h-[90px]" : ""
        }`}
        style={multiline ? { textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}
