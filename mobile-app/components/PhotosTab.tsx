import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ChevronLeft, FolderOpen, Image as ImageIcon } from "lucide-react-native";

import { useCollection } from "../src/lib/useFirestore";
import { PhotoLightbox } from "./PhotoLightbox";
import type { GalleryAlbum, GalleryPhoto } from "../../shared/types";

const NUM_COLS = 3;
const GAP = 6;
const UNCATEGORISED_ID = "__uncategorised__";
const WEB_MAX_WIDTH = 480;
const SCREEN_PADDING = 40; // ScreenContainer uses px-5 on each side

/** Width of the phone-shaped content column (clamped on web). */
function useContentWidth() {
  const { width } = useWindowDimensions();
  const effective = Platform.OS === "web" ? Math.min(width, WEB_MAX_WIDTH) : width;
  return Math.max(0, effective - SCREEN_PADDING);
}

type Album = {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  order: number;
  photoCount: number;
  firstPhotoUrl?: string;
};

export function PhotosTab() {
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);

  const {
    data: photos,
    loading: photosLoading,
    error: photosError,
    refresh: refreshPhotos,
  } = useCollection<GalleryPhoto>("gallery_photos", {
    orderByField: "order",
    orderDir: "asc",
    limit: 500,
  });

  const {
    data: albumsRaw,
    loading: albumsLoading,
    error: albumsError,
    refresh: refreshAlbums,
  } = useCollection<GalleryAlbum>("gallery_albums", {
    orderByField: "order",
    orderDir: "asc",
    limit: 200,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshPhotos(), refreshAlbums()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshPhotos, refreshAlbums]);

  const albums: Album[] = useMemo(() => {
    const list: Album[] = (albumsRaw ?? []).map((a) => {
      const firstPhoto = (photos ?? []).find((p) => p.albumId === a.id);
      const count = (photos ?? []).filter((p) => p.albumId === a.id).length;
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        coverUrl: a.coverUrl,
        order: a.order ?? 0,
        photoCount: count,
        firstPhotoUrl: firstPhoto?.thumbnailUrl ?? firstPhoto?.imageUrl,
      };
    });

    const orphan = (photos ?? []).filter((p) => !p.albumId);
    if (orphan.length > 0) {
      list.push({
        id: UNCATEGORISED_ID,
        name: "Other photos",
        order: 9_999_999,
        photoCount: orphan.length,
        firstPhotoUrl: orphan[0]?.thumbnailUrl ?? orphan[0]?.imageUrl,
      });
    }
    return list;
  }, [albumsRaw, photos]);

  const loading = photosLoading || albumsLoading;
  const error = photosError ?? albumsError;

  const albumPhotos = useMemo(() => {
    if (!openAlbumId || !photos) return [];
    if (openAlbumId === UNCATEGORISED_ID)
      return photos.filter((p) => !p.albumId);
    return photos.filter((p) => p.albumId === openAlbumId);
  }, [openAlbumId, photos]);

  const openAlbum = albums.find((a) => a.id === openAlbumId) ?? null;

  if (loading && !photos && !albumsRaw) {
    return (
      <View className="mt-16 items-center">
        <ActivityIndicator color="#B8336A" />
        <Text className="mt-3 text-sm text-zinc-500">Loading gallery…</Text>
      </View>
    );
  }

  if (error && !photos && !albumsRaw) {
    return (
      <Text className="mt-6 text-sm text-red-500">
        Could not load gallery: {error.message}
      </Text>
    );
  }

  if (openAlbum) {
    return (
      <AlbumPhotosView
        album={openAlbum}
        photos={albumPhotos}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onBack={() => setOpenAlbumId(null)}
      />
    );
  }

  if (albums.length === 0) {
    return (
      <View className="mt-16 items-center">
        <FolderOpen color="#9CA3AF" size={28} />
        <Text className="mt-3 text-sm italic text-zinc-500">
          No albums yet.
        </Text>
      </View>
    );
  }

  return (
    <AlbumGrid
      albums={albums}
      onOpen={setOpenAlbumId}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

/* ----------------------------------------------------------- */
/* Albums grid                                                  */
/* ----------------------------------------------------------- */

function AlbumGrid({
  albums,
  onOpen,
  refreshing,
  onRefresh,
}: {
  albums: Album[];
  onOpen: (id: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const screenWidth = useContentWidth();
  const cols = 2;
  const available = screenWidth - GAP * (cols - 1);
  const cell = Math.floor(available / cols);

  return (
    <FlatList
      data={albums}
      keyExtractor={(a) => a.id}
      numColumns={cols}
      showsVerticalScrollIndicator={false}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{ gap: GAP, paddingTop: 12, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#B8336A"
          colors={["#B8336A", "#F4A261"]}
        />
      }
      renderItem={({ item }) => {
        const cover = item.coverUrl ?? item.firstPhotoUrl;
        return (
          <Pressable
            onPress={() => onOpen(item.id)}
            className="overflow-hidden rounded-2xl bg-white active:opacity-80"
            style={{ width: cell }}
          >
            <View
              style={{ width: cell, height: cell }}
              className="items-center justify-center bg-cream"
            >
              {cover ? (
                <Image
                  source={{ uri: cover }}
                  style={{ width: cell, height: cell }}
                  resizeMode="cover"
                />
              ) : (
                <FolderOpen color="#B8336A" size={36} />
              )}
            </View>
            <View className="p-2">
              <Text
                className="text-sm font-semibold text-primary"
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text className="text-xs text-zinc-500">
                {item.photoCount} photo{item.photoCount === 1 ? "" : "s"}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

/* ----------------------------------------------------------- */
/* Photos inside an album                                       */
/* ----------------------------------------------------------- */

function AlbumPhotosView({
  album,
  photos,
  refreshing,
  onRefresh,
  onBack,
}: {
  album: Album;
  photos: GalleryPhoto[];
  refreshing: boolean;
  onRefresh: () => void;
  onBack: () => void;
}) {
  const screenWidth = useContentWidth();
  const available = screenWidth - GAP * (NUM_COLS - 1);
  const cell = Math.floor(available / NUM_COLS);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <View className="flex-row items-center pt-2">
        <Pressable
          onPress={onBack}
          hitSlop={12}
          className="h-9 w-9 items-center justify-center rounded-full bg-saffron/15 active:opacity-70"
        >
          <ChevronLeft color="#B8336A" size={22} />
        </Pressable>
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-primary" numberOfLines={1}>
            {album.name}
          </Text>
          <Text className="text-xs text-zinc-500">
            {photos.length} photo{photos.length === 1 ? "" : "s"}
            {album.description ? ` · ${album.description}` : ""}
          </Text>
        </View>
      </View>

      {photos.length === 0 ? (
        <View className="mt-16 items-center">
          <ImageIcon color="#9CA3AF" size={28} />
          <Text className="mt-3 text-sm italic text-zinc-500">
            No photos in this album yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLS}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingTop: 12, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#B8336A"
              colors={["#B8336A", "#F4A261"]}
            />
          }
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => setLightboxIndex(index)}
              className="overflow-hidden rounded-xl bg-white active:opacity-80"
              style={{ width: cell, height: cell }}
            >
              <Image
                source={{ uri: item.thumbnailUrl ?? item.imageUrl }}
                style={{ width: cell, height: cell }}
                resizeMode="cover"
              />
            </Pressable>
          )}
        />
      )}

      <PhotoLightbox
        photos={photos}
        startIndex={lightboxIndex ?? 0}
        visible={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  );
}
