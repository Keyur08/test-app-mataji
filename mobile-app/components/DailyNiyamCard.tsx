// Home-tab card for the admin-published "Daily नियम".
// Reads `daily_niyam/{today}` for the content and lets the devotee opt-in by
// creating `daily_niyam/{today}/accepts/{mobile}`. The acceptance count
// updates live for everyone via an `onSnapshot` subscription.

import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, Modal, ScrollView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // Added for modern safe area support
import { ZoomableImage } from "./ZoomableImage";
import {
    CheckCircle2,
    NotebookPen,
    Sparkles,
    Users as UsersIcon,
    X,
} from "lucide-react-native";
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";

import { db } from "../src/lib/firebase";
import { useTheme } from "../src/lib/useBranding";
import { useUserProfile } from "../src/lib/useUserProfile";
import type { DailyNiyam } from "../../shared/types";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

function todayISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function DailyNiyamCard() {
    const theme = useTheme();
    const insets = useSafeAreaInsets(); // Hook gives us dynamic device notch sizes
    const { profile, uid } = useUserProfile();
    const date = todayISO();

    const [niyam, setNiyam] = useState<DailyNiyam | null>(null);
    const [niyamLoading, setNiyamLoading] = useState(true);

    const [count, setCount] = useState<number>(0);
    const [hasAccepted, setHasAccepted] = useState<boolean>(false);
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [modalVisible, setModalVisible] = useState<boolean>(false);

    // Subscribe to today's niyam doc.
    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, "daily_niyam", date),
            (snap) => {
                if (snap.exists()) {
                    setNiyam({ ...(snap.data() as DailyNiyam) });
                } else {
                    setNiyam(null);
                }
                setNiyamLoading(false);
            },
            () => setNiyamLoading(false),
        );
        return unsub;
    }, [date]);

    // Subscribe to acceptances for live count.
    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "daily_niyam", date, "accepts"),
            (snap) => setCount(snap.size),
            () => {},
        );
        return unsub;
    }, [date]);

    // Check if this devotee has already accepted today.
    useEffect(() => {
        if (!profile?.mobile) {
            setHasAccepted(false);
            return;
        }
        const ref = doc(db, "daily_niyam", date, "accepts", profile.mobile);
        getDoc(ref)
            .then((s) => setHasAccepted(s.exists()))
            .catch(() => setHasAccepted(false));
    }, [date, profile?.mobile]);

    if (niyamLoading) {
        return (
            <View
                className="overflow-hidden rounded-3xl border bg-white p-6"
                style={{ borderColor: theme.saffron + "55" }}
            >
                <ActivityIndicator color={theme.primary} />
            </View>
        );
    }

    if (!niyam) {
        return null;
    }

    async function onAccept() {
        if (!profile?.mobile || !uid) {
            setError("Please complete your profile first.");
            return;
        }
        setAccepting(true);
        setError(null);
        try {
            const ref = doc(db, "daily_niyam", date, "accepts", profile.mobile);
            await setDoc(ref, {
                mobile: profile.mobile,
                name: profile.name,
                uid,
                acceptedAt: serverTimestamp(),
            });
            setHasAccepted(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save. Try again.");
        } finally {
            setAccepting(false);
        }
    }

    // Component structure for the text + button data sheet layout
    const renderTextAndActions = (isFullScreen = false) => (
        <View className={isFullScreen ? "p-6 rounded-t-3xl bg-white" : "p-5"}>
            <View className="flex-row items-center">
                <View
                    className="h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: theme.saffron + "33" }}
                >
                    <NotebookPen color={theme.saffron} size={16} />
                </View>
                <Text
                    className="ml-3 text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: theme.saffron }}
                >
                    आज का नियम · Niyam of the Day
                </Text>
            </View>

            <Text
                className={`mt-3 font-bold ${isFullScreen ? 'text-2xl' : 'text-xl'}`}
                style={{ color: theme.primary }}
            >
                {niyam.title}
            </Text>

            {niyam.body ? (
                <Text className="mt-2 text-[14px] leading-6 text-zinc-700">
                    {niyam.body}
                </Text>
            ) : null}

            {/* Count + CTA */}
            <View
                className="mt-5 flex-row items-center justify-between rounded-2xl p-3"
                style={{ backgroundColor: theme.cream }}
            >
                <View className="flex-row items-center">
                    <View
                        className="h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: theme.primary + "1A" }}
                    >
                        <UsersIcon color={theme.primary} size={14} />
                    </View>
                    <View className="ml-2">
                        <Text
                            className="text-[15px] font-bold"
                            style={{ color: theme.primary }}
                        >
                            {count}
                        </Text>
                        <Text className="text-[10px] uppercase tracking-wider text-zinc-500">
                            Devotees accepted
                        </Text>
                    </View>
                </View>

                {hasAccepted ? (
                    <View
                        className="flex-row items-center rounded-full px-3 py-2"
                        style={{ backgroundColor: "#16A34A" }}
                    >
                        <CheckCircle2 color="#FFFFFF" size={14} />
                        <Text className="ml-1.5 text-[12px] font-bold text-white">
                            Accepted
                        </Text>
                        <View
                            className="ml-2 rounded-full px-2 py-0.5"
                            style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
                        >
                            <Text className="text-[11px] font-extrabold text-white">
                                {count}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <Pressable
                        onPress={(e) => {
                            e.stopPropagation();
                            onAccept();
                        }}
                        disabled={accepting || !profile?.mobile}
                        className="flex-row items-center rounded-full px-4 py-2 active:opacity-90"
                        style={{
                            backgroundColor: accepting
                                ? theme.primary + "99"
                                : theme.primary,
                        }}
                    >
                        {accepting ? (
                            <ActivityIndicator color={theme.textOnPrimary} size="small" />
                        ) : (
                            <Sparkles color={theme.textOnPrimary} size={14} />
                        )}
                        <Text
                            className="ml-1.5 text-[12px] font-bold"
                            style={{ color: theme.textOnPrimary }}
                        >
                            {accepting ? "Saving…" : "नियम स्वीकार करें"}
                        </Text>
                        {!accepting && count > 0 ? (
                            <View
                                className="ml-2 rounded-full px-2 py-0.5"
                                style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
                            >
                                <Text
                                    className="text-[11px] font-extrabold"
                                    style={{ color: theme.textOnPrimary }}
                                >
                                    {count}
                                </Text>
                            </View>
                        ) : null}
                    </Pressable>
                )}
            </View>

            {error ? (
                <Text className="mt-2 text-[11px] text-red-600">{error}</Text>
            ) : null}
        </View>
    );

    // We explicitly calculate the perfect height for the image box.
    // We subtract the dynamic top notch (insets.top), bottom gap (insets.bottom),
    // header bar height (~48px), and leave 45% of the viewport for the text sheet.
    const usableHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 48;
    const calculatedImageHeight = usableHeight * 0.52;

    return (
        <>
            {/* Base Home-tab Card */}
            <Pressable
                onPress={() => setModalVisible(true)}
                className="overflow-hidden rounded-3xl bg-white"
                style={{
                    borderWidth: 1.5,
                    borderColor: theme.saffron,
                    shadowColor: theme.primary,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.1,
                    shadowRadius: 14,
                    elevation: 3,
                }}
            >
                {niyam.imageUrl ? (
                    <ZoomableImage
                        uri={niyam.imageUrl}
                        caption={niyam.title}
                        style={{ width: "100%", height: 180 }}
                        resizeMode="cover"
                    />
                ) : null}
                {renderTextAndActions(false)}
            </Pressable>

            {/* Immersive Full Screen Display */}
            <Modal
                animationType="fade"
                transparent={false}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                {/* Outer container handles top/bottom safe space via dynamic padding */}
                <View
                    className="flex-1 bg-black"
                    style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
                >
                    {/* 1. Header Area */}
                    <View className="flex-row items-center justify-between px-4 py-2 border-b border-zinc-900 bg-black">
                        <View className="rounded-full bg-zinc-900 px-4 py-1.5">
                            <Text className="text-sm font-semibold text-white">
                                नियम विवरण · Niyam Details
                            </Text>
                        </View>

                        <Pressable
                            onPress={() => setModalVisible(false)}
                            className="rounded-full bg-zinc-900 p-2 active:bg-zinc-800"
                        >
                            <X color="#FFFFFF" size={22} />
                        </Pressable>
                    </View>

                    {/* 2. Middle Image Box */}
                    <View
                        className="items-center justify-center bg-zinc-950"
                        style={{ width: SCREEN_WIDTH, height: calculatedImageHeight }}
                    >
                        {niyam.imageUrl ? (
                            <ZoomableImage
                                uri={niyam.imageUrl}
                                caption={niyam.title}
                                style={{ width: SCREEN_WIDTH, height: calculatedImageHeight }}
                                resizeMode="contain"
                            />
                        ) : (
                            <View className="h-20 w-20 items-center justify-center rounded-full bg-zinc-900">
                                <NotebookPen color={theme.saffron} size={32} />
                            </View>
                        )}
                    </View>

                    {/* 3. Bottom Text Sheet Container */}
                    <View className="flex-1 bg-white rounded-t-[32px]">
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                            contentContainerStyle={{ flexGrow: 1 }}
                        >
                            {renderTextAndActions(true)}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}