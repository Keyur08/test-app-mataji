// Renders `LibraryText.body` (and any other field following the same
// convention). Two formats are supported, auto-detected via `looksLikeHtml`:
//
//  - HTML (current) — produced by the admin dashboard's TipTap rich text
//    editor: headings, bold/italic/underline/strikethrough, alignment,
//    lists, blockquote, colored/sized text, highlight, images, horizontal
//    rule. See `shared/richText.ts`.
//  - Legacy plain text (older documents) — the original hand-typed markup:
//      **bold**                 → <Text bold>
//      *italic*                 → <Text italic>
//      ==highlighted==          → <Text with saffron background>
//      ![alt](https://…)        → <Image> block (own paragraph)

import { useEffect, useState, type ReactNode } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
} from "react-native";

import { looksLikeHtml } from "../../shared/richText";
import { PhotoLightbox } from "./PhotoLightbox";

type Props = {
  body: string;
  style?: TextStyle;
  className?: string;
};

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
  if (looksLikeHtml(body)) {
    return <HtmlFormattedBody body={body} style={style} className={className} />;
  }
  return <LegacyFormattedBody body={body} style={style} className={className} />;
}

// ─────────────────────────────────────────────────────────────────────────
// HTML renderer (current format)
// ─────────────────────────────────────────────────────────────────────────

type HtmlNode =
  | { kind: "el"; tag: string; attrs: Record<string, string>; children: HtmlNode[] }
  | { kind: "text"; value: string };

const VOID_TAGS = new Set(["img", "br", "hr"]);

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z-]+)(?:="([^"]*)")?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out[m[1]] = m[2] ?? "";
  }
  return out;
}

function parseStyleAttr(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const decl of raw.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (key && val) out[key] = val;
  }
  return out;
}

/** Small stack-based tokenizer for the constrained HTML TipTap outputs
 *  (well-formed, no scripts/comments) — not a general HTML parser. */
function parseHtmlFragment(html: string): HtmlNode[] {
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*(\/?)>/g;
  const root: HtmlNode = { kind: "el", tag: "root", attrs: {}, children: [] };
  const stack: (HtmlNode & { kind: "el" })[] = [root as HtmlNode & { kind: "el" }];
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  const pushText = (raw: string) => {
    if (!raw) return;
    const decoded = decodeHtmlEntities(raw);
    if (decoded.trim() === "" && !decoded.includes("\n")) return;
    stack[stack.length - 1].children.push({ kind: "text", value: decoded });
  };

  while ((m = tagRe.exec(html)) !== null) {
    const [full, closing, tagRaw, attrsRaw, selfClose] = m;
    const tag = tagRaw.toLowerCase();
    if (m.index > lastIndex) pushText(html.slice(lastIndex, m.index));
    lastIndex = m.index + full.length;

    if (closing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const node: HtmlNode & { kind: "el" } = {
      kind: "el",
      tag,
      attrs: parseAttrs(attrsRaw),
      children: [],
    };
    stack[stack.length - 1].children.push(node);
    if (!VOID_TAGS.has(tag) && !selfClose) {
      stack.push(node);
    }
  }
  if (lastIndex < html.length) pushText(html.slice(lastIndex));
  return root.children;
}

type InlineStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  highlight?: boolean;
  color?: string;
  fontSize?: number;
};

function inlineStyleToTextStyle(s: InlineStyle): TextStyle {
  const out: TextStyle = {};
  if (s.bold) out.fontWeight = "700";
  if (s.italic) out.fontStyle = "italic";
  if (s.underline && s.strike) out.textDecorationLine = "underline line-through";
  else if (s.underline) out.textDecorationLine = "underline";
  else if (s.strike) out.textDecorationLine = "line-through";
  if (s.highlight) {
    out.backgroundColor = "#FDE68A";
    out.color = "#7C2D12";
    out.fontWeight = out.fontWeight ?? "600";
  }
  if (s.color) out.color = s.color;
  if (s.fontSize) out.fontSize = s.fontSize;
  return out;
}

function renderInlineNodes(
  nodes: HtmlNode[],
  inherited: InlineStyle,
  keyPrefix: string,
): ReactNode[] {
  const out: ReactNode[] = [];
  nodes.forEach((node, i) => {
    const key = `${keyPrefix}-${i}`;
    if (node.kind === "text") {
      out.push(
        <Text key={key} style={inlineStyleToTextStyle(inherited)}>
          {node.value}
        </Text>,
      );
      return;
    }
    const { tag, children, attrs } = node;
    if (tag === "br") {
      out.push(<Text key={key}>{"\n"}</Text>);
      return;
    }
    let next: InlineStyle = inherited;
    switch (tag) {
      case "strong":
      case "b":
        next = { ...inherited, bold: true };
        break;
      case "em":
      case "i":
        next = { ...inherited, italic: true };
        break;
      case "u":
        next = { ...inherited, underline: true };
        break;
      case "s":
      case "strike":
      case "del":
        next = { ...inherited, strike: true };
        break;
      case "mark":
        next = { ...inherited, highlight: true };
        break;
      case "span": {
        const css = parseStyleAttr(attrs.style);
        next = { ...inherited };
        if (css.color) next.color = css.color;
        if (css["font-size"]) {
          const px = parseFloat(css["font-size"]);
          if (!Number.isNaN(px)) next.fontSize = px;
        }
        break;
      }
      default:
        // Unknown inline wrapper (e.g. <a>) — render children unstyled-extra.
        next = inherited;
    }
    out.push(...renderInlineNodes(children, next, key));
  });
  return out;
}

function renderBlockNodes(
  nodes: HtmlNode[],
  baseStyle: TextStyle | undefined,
  images: { url: string; alt: string }[],
  onImagePress: (ordinal: number) => void,
  keyPrefix: string,
): ReactNode[] {
  const blocks: ReactNode[] = [];
  const baseSize = baseStyle?.fontSize ?? 16;
  let key = 0;

  for (const node of nodes) {
    if (node.kind === "text") {
      if (node.value.trim()) {
        blocks.push(
          <Text key={`${keyPrefix}-${key++}`} style={baseStyle}>
            {node.value.trim()}
          </Text>,
        );
      }
      continue;
    }

    const { tag, attrs, children } = node;
    const blockKey = `${keyPrefix}-${key++}`;
    const textAlign = parseStyleAttr(attrs.style)["text-align"] as
      | TextStyle["textAlign"]
      | undefined;

    switch (tag) {
      case "p": {
        blocks.push(
          <Text
            key={blockKey}
            selectable
            style={[baseStyle, { marginBottom: baseSize * 0.7 }, textAlign ? { textAlign } : null]}
          >
            {renderInlineNodes(children, {}, blockKey)}
          </Text>,
        );
        break;
      }
      case "h1":
      case "h2":
      case "h3": {
        const scale = tag === "h1" ? 1.5 : tag === "h2" ? 1.3 : 1.15;
        blocks.push(
          <Text
            key={blockKey}
            selectable
            style={[
              baseStyle,
              {
                fontSize: baseSize * scale,
                fontWeight: "800",
                marginTop: baseSize * 0.6,
                marginBottom: baseSize * 0.4,
              },
              textAlign ? { textAlign } : null,
            ]}
          >
            {renderInlineNodes(children, {}, blockKey)}
          </Text>,
        );
        break;
      }
      case "ul":
      case "ol": {
        const items = children.filter(
          (c): c is HtmlNode & { kind: "el" } => c.kind === "el" && c.tag === "li",
        );
        blocks.push(
          <View key={blockKey} style={{ marginBottom: baseSize * 0.7 }}>
            {items.map((li, idx) => (
              <View
                key={`${blockKey}-li${idx}`}
                style={{ flexDirection: "row", marginBottom: baseSize * 0.25 }}
              >
                <Text style={[baseStyle, { width: baseSize * 1.4 }]}>
                  {tag === "ul" ? "•" : `${idx + 1}.`}
                </Text>
                <View style={{ flex: 1 }}>
                  {renderBlockNodes(
                    li.children,
                    baseStyle,
                    images,
                    onImagePress,
                    `${blockKey}-li${idx}`,
                  )}
                </View>
              </View>
            ))}
          </View>,
        );
        break;
      }
      case "blockquote": {
        blocks.push(
          <View
            key={blockKey}
            style={{
              borderLeftWidth: 3,
              borderLeftColor: "#F4A261",
              paddingLeft: 12,
              marginBottom: baseSize * 0.7,
            }}
          >
            {renderBlockNodes(
              children,
              { ...baseStyle, fontStyle: "italic", color: "#52525B" },
              images,
              onImagePress,
              `${blockKey}-bq`,
            )}
          </View>,
        );
        break;
      }
      case "hr": {
        blocks.push(
          <View
            key={blockKey}
            style={{
              height: 2,
              backgroundColor: "rgba(244,162,97,0.4)",
              marginVertical: baseSize * 0.8,
            }}
          />,
        );
        break;
      }
      case "img": {
        const url = attrs.src;
        if (url) {
          const ordinal = images.length;
          images.push({ url, alt: attrs.alt || "" });
          blocks.push(
            <InlineImage
              key={blockKey}
              url={url}
              alt={attrs.alt}
              onPress={() => onImagePress(ordinal)}
            />,
          );
        }
        break;
      }
      default: {
        // Unknown block-level wrapper — flatten and keep rendering its children.
        blocks.push(
          ...renderBlockNodes(children, baseStyle, images, onImagePress, blockKey),
        );
      }
    }
  }
  return blocks;
}

function HtmlFormattedBody({ body, style, className }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const nodes = parseHtmlFragment(body);
  const images: { url: string; alt: string }[] = [];
  const blocks = renderBlockNodes(
    nodes,
    style,
    images,
    (ordinal) => setLightboxIndex(ordinal),
    "b",
  );

  return (
    <View className={className}>
      {blocks}
      {images.length > 0 && (
        <PhotoLightbox
          photos={images.map((img, i) => ({
            id: `inline-${i}`,
            imageUrl: img.url,
            caption: img.alt,
          }))}
          startIndex={lightboxIndex ?? 0}
          visible={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Legacy plain-text renderer (older documents)
// ─────────────────────────────────────────────────────────────────────────

type LegacyToken =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "highlight"; value: string };

/** Parse a single text block into inline tokens. */
function parseLegacyInline(input: string): LegacyToken[] {
  const re = /(\*\*[^*]+\*\*|==[^=]+==|\*[^*\n]+\*)/g;
  const tokens: LegacyToken[] = [];
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

function renderLegacyTextBlock(
  body: string,
  style?: TextStyle,
  className?: string,
  keyPrefix: string = "t",
) {
  const tokens = parseLegacyInline(body);
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

function LegacyFormattedBody({ body, style, className }: Props) {
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
    return renderLegacyTextBlock(body, style, className);
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
        {renderLegacyTextBlock(trimmed, style, undefined, `p${idx}`)}
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
