import { FlatList, Image, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { ArrowRight, CalendarDays, Megaphone, Newspaper } from "lucide-react-native";
import type { NewsEvent } from "../../../shared/types";

type Kind = "announcement" | "event" | "news";
type Props = {
  items: NewsEvent[] | null;
  loading: boolean;
  /** When set, only items of this kind are shown. */
  filterKind?: Kind;
  /** Section heading override. */
  title?: string;
  /** Custom empty-state copy. */
  emptyText?: string;
  /** Hide the "See all" link (e.g. for filtered subsections). */
  hideSeeAll?: boolean;
};

const KIND_META: Record<
  Kind,
  { title: string; tint: string; tintBg: string; Icon: typeof Megaphone }
> = {
  announcement: { title: "Announcement", tint: "#B8336A", tintBg: "#FCE7F0", Icon: Megaphone },
  event:        { title: "Event",        tint: "#A4470C", tintBg: "#FBE6CE", Icon: CalendarDays },
  news:         { title: "News",         tint: "#0F766E", tintBg: "#D1FAE5", Icon: Newspaper },
};

const formatDate = (ts: NewsEvent["publishedAt"]) => {
  try {
    return ts
      .toDate()
      .toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch {
    return "";
  }
};

/** Horizontally scrolling list of latest announcements. */
export function AnnouncementsRail({
  items,
  loading,
  filterKind,
  title = "Latest Announcements",
  emptyText = "No announcements yet.",
  hideSeeAll = false,
}: Props) {
  const filtered = filterKind
    ? (items ?? []).filter((it) => (it.kind ?? "news") === filterKind)
    : items;

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-zinc-900">{title}</Text>
        {hideSeeAll ? null : (
          <Link
            href={
              filterKind
                ? { pathname: "/news", params: { kind: filterKind } }
                : ("/news" as never)
            }
            asChild
          >
            <Pressable
              hitSlop={12}
              className="flex-row items-center rounded-full bg-primary/10 px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-xs font-semibold text-primary">See all</Text>
              <ArrowRight color="#B8336A" size={14} style={{ marginLeft: 4 }} />
            </Pressable>
          </Link>
        )}
      </View>

      {loading ? (
        <View className="h-44 items-center justify-center rounded-3xl bg-white">
          <Text className="text-sm italic text-zinc-500">Loading…</Text>
        </View>
      ) : !filtered || filtered.length === 0 ? (
        <View className="h-44 items-center justify-center rounded-3xl bg-white">
          <Megaphone color="#9CA3AF" size={22} />
          <Text className="mt-2 text-sm italic text-zinc-500">
            {emptyText}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Extra vertical & left padding so the cards' soft shadow / Android
          // elevation isn't clipped against the surrounding section edges.
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: 16,
            paddingLeft: 2,
            paddingRight: 8,
            gap: 14,
          }}
          renderItem={({ item }) => {
            const kind: Kind = ((item.kind ?? "news") as Kind) in KIND_META
              ? ((item.kind ?? "news") as Kind)
              : "news";
            const meta = KIND_META[kind];
            const KindIcon = meta.Icon;
            return (
              <Link href={{ pathname: "/news/[id]", params: { id: item.id } }} asChild>
                <Pressable
                  className="w-72 rounded-3xl bg-white active:opacity-85"
                  style={{
                    // iOS soft drop shadow
                    shadowColor: "#0F172A",
                    shadowOpacity: 0.12,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 8 },
                    // Android elevation — keep modest so the bottom edge
                    // stays soft instead of a harsh black line.
                    elevation: 3,
                    // Subtle border helps Android where elevation alone
                    // can look flat against the cream background.
                    borderWidth: 1,
                    borderColor: "rgba(15,23,42,0.05)",
                  }}
                >
                  {/* Inner clipper so the image + tint badge stay inside
                      the rounded corners, while the parent keeps its shadow
                      visible (overflow-hidden on the shadow host clips it
                      on Android). */}
                  <View className="overflow-hidden rounded-3xl">
                  {item.imageUrl ? (
                    <View>
                      <Image
                        source={{ uri: item.imageUrl }}
                        className="h-36 w-full"
                        resizeMode="cover"
                      />
                      <View className="absolute inset-0 bg-black/15" />
                      <View
                        className="absolute left-3 top-3 flex-row items-center rounded-full px-2.5 py-1"
                        style={{ backgroundColor: meta.tintBg }}
                      >
                        <KindIcon color={meta.tint} size={10} />
                        <Text
                          className="ml-1 text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: meta.tint }}
                        >
                          {meta.title}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View
                      className="h-36 w-full items-center justify-center"
                      style={{ backgroundColor: meta.tintBg }}
                    >
                      <KindIcon color={meta.tint} size={36} />
                    </View>
                  )}
                  <View className="p-4">
                    {!item.imageUrl && (
                      <View
                        className="mb-2 flex-row items-center self-start rounded-full px-2.5 py-1"
                        style={{ backgroundColor: meta.tintBg }}
                      >
                        <KindIcon color={meta.tint} size={10} />
                        <Text
                          className="ml-1 text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: meta.tint }}
                        >
                          {meta.title}
                        </Text>
                      </View>
                    )}
                    <Text
                      className="text-sm font-bold leading-5 text-zinc-900"
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    {item.summary ? (
                      <Text
                        className="mt-1 text-[12px] leading-5 text-zinc-600"
                        numberOfLines={2}
                      >
                        {item.summary}
                      </Text>
                    ) : null}
                    <Text className="mt-3 text-[11px] font-medium text-zinc-400">
                      {formatDate(item.publishedAt)}
                    </Text>
                  </View>
                  </View>
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </View>
  );
}
