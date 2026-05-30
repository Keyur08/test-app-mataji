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
import { Download, X } from "lucide-react-native";
import type { GalleryPhoto } from "../../shared/types";

type Props = {
  photos: GalleryPhoto[];
  startIndex: number;
  visible: boolean;
  onClose: () => void;
};

/**
 * Full-screen, horizontally paged image viewer.
 * Tap × to dismiss; swipe left/right between photos.
 */
export function PhotoLightbox({ photos, startIndex, visible, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const { width, height } = Dimensions.get("window");

  useEffect(() => {
    if (visible) setIndex(startIndex);
  }, [visible, startIndex]);

  if (!photos.length) return null;

  const current = photos[index];

  const onDownload = () => {
    if (!current?.imageUrl) return;
    if (Platform.OS === "web") {
      if (typeof document !== "undefined") {
        const a = document.createElement("a");
        a.href = current.imageUrl;
        const safeName = (current.caption || current.id || "photo")
          .toString()
          .replace(/[^\w\-]+/g, "_");
        a.download = `${safeName}.jpg`;
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

        {/* top-right controls: download + close */}
        <View
          className="absolute right-3 top-12 flex-row items-center"
          style={{ gap: 10 }}
        >
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
