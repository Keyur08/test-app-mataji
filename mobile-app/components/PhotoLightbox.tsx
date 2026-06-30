import { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import { Download, Share2, X } from "lucide-react-native";
// Import from the explicit legacy path to bypass modern API restrictions safely
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { GalleryPhoto } from "../../shared/types";

type Props = {
  photos: GalleryPhoto[];
  startIndex: number;
  visible: boolean;
  onClose: () => void;
};

export function PhotoLightbox({ photos, startIndex, visible, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [isSharing, setIsSharing] = useState(false);
  const { width, height } = Dimensions.get("window");

  useEffect(() => {
    if (visible) setIndex(startIndex);
  }, [visible, startIndex]);

  if (!photos.length) return null;

  const current = photos[index];

  const getSafeFilename = () => {
    const safeName = (current.caption || current.id || "photo")
        .toString()
        .replace(/[^\w\-]+/g, "_");
    return `${safeName}.jpg`;
  };

  const onDownload = () => {
    if (!current?.imageUrl) return;
    if (Platform.OS === "web") {
      if (typeof document !== "undefined") {
        const a = document.createElement("a");
        a.href = current.imageUrl;
        a.download = getSafeFilename();
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } else {
      Linking.openURL(current.imageUrl).catch(() => {});
    }
  };

  const onShare = async () => {
    if (!current?.imageUrl || isSharing) return;

    if (Platform.OS === "web") {
      if (navigator.share) {
        try {
          const response = await fetch(current.imageUrl);
          const blob = await response.blob();
          const file = new File([blob], getSafeFilename(), { type: blob.type });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: current.caption || "Shared Photo",
            });
          }
        } catch (error) {
          console.error("Web share failed:", error);
        }
      }
      return;
    }

    try {
      setIsSharing(true);

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        console.warn("Sharing framework is not available on this platform");
        return;
      }

      // 1. Point to your app's temporary sandbox cache
      const localUri = `${FileSystem.cacheDirectory}${getSafeFilename()}`;

      // 2. Safely check and delete old instances to avoid conflicts
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      }

      // 3. Download via the stable legacy download utility
      const { uri } = await FileSystem.downloadAsync(current.imageUrl, localUri);

      // 4. Send the file system path pointer to the share sheet
      await Sharing.shareAsync(uri, {
        mimeType: "image/jpeg",
        dialogTitle: current.caption || "Share this image",
      });
    } catch (error) {
      console.error("Error processing file for share actions:", error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
      <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={onClose}
          statusBarTranslucent
      >
        <StatusBar hidden={visible} />
        <View className="flex-1 bg-black">
          <FlatList
              data={photos}
              keyExtractor={(p) => p.id}
              horizontal
              pagingEnabled
              initialScrollIndex={startIndex}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onMomentumScrollEnd={(e) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / width);
                setIndex(i);
              }}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                  <View style={{ width, height }} className="items-center justify-center">
                    <Image
                        source={{ uri: item.imageUrl }}
                        style={{ width, height: height * 0.85 }}
                        resizeMode="contain"
                    />
                  </View>
              )}
          />

          {/* top-right controls: share + download + close */}
          <View
              className="absolute right-3 top-12 flex-row items-center"
              style={{ gap: 10 }}
          >
            <Pressable
                onPress={onShare}
                disabled={isSharing}
                hitSlop={12}
                accessibilityLabel="Share photo"
                className={`h-10 w-10 items-center justify-center rounded-full bg-white/15 active:opacity-70 ${
                    isSharing ? "opacity-50" : ""
                }`}
            >
              <Share2 color="#fff" size={20} />
            </Pressable>

            <Pressable
                onPress={onDownload}
                hitSlop={12}
                accessibilityLabel="Download photo"
                className="h-10 w-10 items-center justify-center rounded-full bg-white/15 active:opacity-70"
            >
              <Download color="#fff" size={20} />
            </Pressable>
            <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityLabel="Close"
                className="h-10 w-10 items-center justify-center rounded-full bg-white/15 active:opacity-70"
            >
              <X color="#fff" size={22} />
            </Pressable>
          </View>

          {/* counter + caption */}
          <View className="absolute bottom-10 left-0 right-0 items-center px-6">
            <Text className="text-xs font-semibold text-white/70">
              {index + 1} / {photos.length}
            </Text>
            {photos[index]?.caption ? (
                <Text
                    className="mt-2 text-center text-sm text-white"
                    numberOfLines={2}
                >
                  {photos[index].caption}
                </Text>
            ) : null}
          </View>
        </View>
      </Modal>
  );
}