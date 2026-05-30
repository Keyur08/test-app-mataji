// Lightweight inline markup renderer used by the Library reader (and any
// other place that needs **bold**, *italic*, ==highlight== and inline images).
//
// Supported syntax (intentionally minimal so it's safe to author by hand):
//   **bold**                 → <Text bold>
//   *italic*                 → <Text italic>
//   ==highlighted==          → <Text with saffron background>
//   ![alt](https://…)        → <Image> block (own paragraph)
//
// Line breaks inside text are preserved as-is. Image blocks appear on their
// own line (the admin inserts surrounding blank lines automatically).

import { useEffect, useState, type ReactNode } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
} from "react-native";

import { PhotoLightbox } from "./PhotoLightbox";

type Props = {
  body: string;
  style?: TextStyle;
  className?: string;
};

type Token =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "highlight"; value: string };

/** Parse a single text block into inline tokens. */
function parseInline(input: string): Token[] {
  const re = /(\*\*[^*]+\*\*|==[^=]+==|\*[^*\n]+\*)/g;
  const tokens: Token[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > lastIndex) {
      tokens.push({ type: "text", value: input.slice(lastIndex, m.index) });
    }
    const chunk = m[0];
    if (chunk.startsWith("**")) {
      tokens.push({ type: "bold", value: chunk.slice(2, -2) });
    } else if (chunk.startsWith("==")) {
      tokens.push({ type: "highlight", value: chunk.slice(2, -2) });
    } else {
      tokens.push({ type: "italic", value: chunk.slice(1, -1) });
    }
    lastIndex = m.index + chunk.length;
  }
  if (lastIndex < input.length) {
    tokens.push({ type: "text", value: input.slice(lastIndex) });
  }
  return tokens;
}

function renderTextBlock(
  body: string,
  style?: TextStyle,
  className?: string,
  keyPrefix: string = "t",
) {
  const tokens = parseInline(body);
  return (
    <Text className={className} style={style} selectable>
      {tokens.map((t, i) => {
        if (t.type === "bold") {
          return (
            <Text key={`${keyPrefix}-${i}`} style={{ fontWeight: "700" }}>
              {t.value}
            </Text>
          );
        }
        if (t.type === "italic") {
          return (
            <Text key={`${keyPrefix}-${i}`} style={{ fontStyle: "italic" }}>
              {t.value}
            </Text>
          );
        }
        if (t.type === "highlight") {
          return (
            <Text
              key={`${keyPrefix}-${i}`}
              style={{
                backgroundColor: "#FDE68A",
                color: "#7C2D12",
                fontWeight: "600",
              }}
            >
              {t.value}
            </Text>
          );
        }
        return <Text key={`${keyPrefix}-${i}`}>{t.value}</Text>;
      })}
    </Text>
  );
}

/** Image block that measures the natural aspect ratio so it scales nicely. */
function InlineImage({
  url,
  alt,
  onPress,
}: {
  url: string;
  alt?: string;
  onPress?: () => void;
}) {
  const [ratio, setRatio] = useState<number>(4 / 3);

  // On web, `onLoad`'s nativeEvent doesn't include `source`, so use
  // Image.getSize as a fallback to measure intrinsic dimensions.
  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      url,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setRatio(w / h);
      },
      () => {
        /* ignore — keep default ratio */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  const imgStyle = {
    width: "100%",
    aspectRatio: ratio,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(244,162,97,0.4)",
    backgroundColor: "#FFF8F0",
  } as ImageStyle;

  return (
    <Pressable
      onPress={onPress}
      className="my-3"
      accessible
      accessibilityRole="imagebutton"
      accessibilityLabel={alt || "Open image"}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        alignItems: "center",
      })}
    >
      <Image
        source={{ uri: url }}
        onLoad={(e) => {
          // Native: nativeEvent.source has {width,height}. Web: it doesn't —
          // we already handle that via Image.getSize above, so guard here.
          const src = e?.nativeEvent?.source;
          if (src && src.width > 0 && src.height > 0) {
            setRatio(src.width / src.height);
          }
        }}
        style={imgStyle}
        resizeMode="contain"
      />
    </Pressable>
  );
}

export function FormattedText({ body, style, className }: Props) {
  // Always declare hooks at the top — even if we don't use them in the
  // text-only fast path — so the hook order stays stable across renders.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Find every image token anywhere in the body. They render as block-level
  // <Image> elements; whatever text lies between them becomes a text block.
  //
  // Token: ![alt](url)  — url may contain query strings (?alt=media&token=…)
  // but not literal `)` or whitespace, which is fine for Firebase URLs.
  const imgRe = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

  // Pre-collect all image matches so taps can open the gallery lightbox.
  const allImages: { url: string; alt: string }[] = [];
  {
    const scanRe = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
    let mm: RegExpExecArray | null;
    while ((mm = scanRe.exec(body)) !== null) {
      allImages.push({ alt: mm[1] || "", url: mm[2] });
    }
  }

  // Fast path: no images → render as a single Text (preserves prior behaviour).
  if (allImages.length === 0) {
    return renderTextBlock(body, style, className);
  }

  const paragraphSpacing = (style?.fontSize ?? 16) * 0.8;
  const blocks: ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  let imageOrdinal = 0;

  const pushText = (chunk: string) => {
    // Trim only leading/trailing blank lines around the image; keep inner
    // line breaks intact so verses still flow correctly.
    const trimmed = chunk.replace(/^\n+|\n+$/g, "");
    if (!trimmed) return;
    blocks.push(
      <View
        key={`p-${idx++}`}
        style={{ marginTop: blocks.length === 0 ? 0 : paragraphSpacing }}
      >
        {renderTextBlock(trimmed, style, undefined, `p${idx}`)}
      </View>,
    );
  };

  while ((m = imgRe.exec(body)) !== null) {
    if (m.index > lastIndex) {
      pushText(body.slice(lastIndex, m.index));
    }
    const [, alt, url] = m;
    const ordinal = imageOrdinal++;
    blocks.push(
      <InlineImage
        key={`img-${idx++}`}
        url={url}
        alt={alt}
        onPress={() => setLightboxIndex(ordinal)}
      />,
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < body.length) {
    pushText(body.slice(lastIndex));
  }

  return (
    <View className={className}>
      {blocks}
      <PhotoLightbox
        photos={allImages.map((img, i) => ({
          id: `inline-${i}`,
          imageUrl: img.url,
          caption: img.alt,
        }))}
        startIndex={lightboxIndex ?? 0}
        visible={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </View>
  );
}
