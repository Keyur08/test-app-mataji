// Reusable wrapper around `PhotoLightbox` that opens a single image in a
// full-screen viewer when tapped. Has two flavours:
//
//   • <ZoomableImage uri=… style=… resizeMode=…/>      – renders the image
//     itself + handles the tap. Use anywhere you'd use <Image>.
//
//   • <ImageZoomTrigger uri=…>{children}</ImageZoomTrigger> – wraps an
//     arbitrary subtree (e.g. an already-styled <Image> + overlays) and
//     opens the lightbox when that subtree is pressed. Useful when the
//     image area is decorated with badges / gradients.
//
// Tapping the rendered area opens a black full-screen modal with the image
// in `contain` mode plus a download button.

import { useState, type ReactNode } from "react";
import {
  Image,
  Pressable,
  type ImageResizeMode,
  type StyleProp,
  type ImageStyle,
  type ViewStyle,
} from "react-native";

import { PhotoLightbox } from "./PhotoLightbox";
import type { GalleryPhoto } from "../../shared/types";

type SingleProps = {
  uri: string;
  caption?: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** Disable the tap-to-zoom interaction (still renders the image). */
  disabled?: boolean;
  /** Optional press-feedback className for nativewind users. */
  pressableClassName?: string;
  /** Forwarded onLoadEnd to support showing a spinner overlay. */
  onLoadEnd?: () => void;
};

export function ZoomableImage({
  uri,
  caption,
  style,
  resizeMode = "cover",
  disabled,
  pressableClassName,
  onLoadEnd,
}: SingleProps) {
  const [open, setOpen] = useState(false);
  if (!uri) return null;

  return (
    <>
      <Pressable
        onPress={disabled ? undefined : () => setOpen(true)}
        accessibilityRole={disabled ? undefined : "imagebutton"}
        accessibilityLabel={caption || "Open image full screen"}
        className={pressableClassName}
        style={({ pressed }) => [
          { opacity: !disabled && pressed ? 0.85 : 1 },
        ]}
      >
        <Image
          source={{ uri }}
          style={style}
          resizeMode={resizeMode}
          onLoadEnd={onLoadEnd}
        />
      </Pressable>
      {!disabled && open ? (
        <PhotoLightbox
          photos={[
            {
              id: "single",
              imageUrl: uri,
              caption,
            } as GalleryPhoto,
          ]}
          startIndex={0}
          visible={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

type TriggerProps = {
  uri: string;
  caption?: string;
  children: ReactNode;
  /** Disable the tap-to-zoom (e.g. when parent handles navigation). */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Wraps `children` in a Pressable that opens the image lightbox for `uri`.
 * Use when the image is rendered inside a more complex layout (overlays,
 * gradients, badges) and you only want the image area to be tap-to-zoom.
 */
export function ImageZoomTrigger({
  uri,
  caption,
  children,
  disabled,
  style,
}: TriggerProps) {
  const [open, setOpen] = useState(false);
  if (!uri) return <>{children}</>;

  return (
    <>
      <Pressable
        onPress={disabled ? undefined : () => setOpen(true)}
        accessibilityRole={disabled ? undefined : "imagebutton"}
        accessibilityLabel={caption || "Open image full screen"}
        style={({ pressed }) => [
          style,
          { opacity: !disabled && pressed ? 0.9 : 1 },
        ]}
      >
        {children}
      </Pressable>
      {!disabled && open ? (
        <PhotoLightbox
          photos={[
            {
              id: "single",
              imageUrl: uri,
              caption,
            } as GalleryPhoto,
          ]}
          startIndex={0}
          visible={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
