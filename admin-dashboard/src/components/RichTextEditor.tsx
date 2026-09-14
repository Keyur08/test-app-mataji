"use client";

// Reusable TipTap-based rich text editor used by the "Manage Texts" admin
// page. Stores/loads its value as HTML (`editor.getHTML()`), rendered by the
// mobile app's `FormattedText` component. See `shared/richText.ts` for the
// HTML-vs-legacy-plain-text detection shared between admin and mobile.

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Highlighter,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

import { FontSize } from "@/lib/tiptap-font-size";

const HEADING_OPTIONS = [
  { value: "paragraph", label: "Paragraph" },
  { value: "1", label: "Heading 1" },
  { value: "2", label: "Heading 2" },
  { value: "3", label: "Heading 3" },
] as const;

const FONT_SIZE_OPTIONS = [
  "12",
  "14",
  "16",
  "18",
  "20",
  "24",
  "28",
  "32",
  "36",
];

const TEXT_COLOR_PRESETS = [
  "#111827", // near-black (default)
  "#B8336A", // primary
  "#F4A261", // saffron
  "#B45309",
  "#166534",
  "#1D4ED8",
];

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onUploadImage: (file: File) => Promise<string>;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  onUploadImage,
}: Props) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextStyle,
      FontSize,
      Color.configure({ types: ["textStyle"] }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      Image.configure({ HTMLAttributes: { class: "rte-image" } }),
      Placeholder.configure({
        placeholder: placeholder ?? "॥ आत्म-जागृति, अनुशासन और करुणा ॥",
      }),
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "rte-content min-h-[320px] max-w-none px-3 py-3 text-base leading-loose text-neutral-900 outline-none",
        style:
          'font-family: ui-serif, "Noto Serif Devanagari", "Hind", Georgia, serif;',
      },
    },
  });

  // Keep the editor in sync if `value` changes from outside (e.g. switching
  // which document is selected in the master list).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [value, editor]);

  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setImageUploading(true);
    try {
      const url = await onUploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  if (!editor) {
    return (
      <div className="flex min-h-[380px] items-center justify-center rounded-lg border border-neutral-300 bg-white">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  const currentHeading =
    HEADING_OPTIONS.find((h) =>
      h.value === "paragraph"
        ? editor.isActive("paragraph")
        : editor.isActive("heading", { level: Number(h.value) }),
    )?.value ?? "paragraph";

  const currentFontSize: string =
    (editor.getAttributes("textStyle").fontSize as string | undefined)?.replace(
      "px",
      "",
    ) ?? "";

  return (
    <div className="rounded-lg border border-neutral-300 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <Toolbar
        editor={editor}
        currentHeading={currentHeading}
        currentFontSize={currentFontSize}
        colorPickerOpen={colorPickerOpen}
        setColorPickerOpen={setColorPickerOpen}
        imageUploading={imageUploading}
        onPickImageClick={() => imageInputRef.current?.click()}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={onPickImage}
        className="hidden"
      />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({
  editor,
  currentHeading,
  currentFontSize,
  colorPickerOpen,
  setColorPickerOpen,
  imageUploading,
  onPickImageClick,
}: {
  editor: Editor;
  currentHeading: string;
  currentFontSize: string;
  colorPickerOpen: boolean;
  setColorPickerOpen: (v: boolean) => void;
  imageUploading: boolean;
  onPickImageClick: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50/60 px-2 py-1.5">
      <select
        value={currentHeading}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "paragraph") {
            editor.chain().focus().setParagraph().run();
          } else {
            editor
              .chain()
              .focus()
              .setNode("heading", { level: Number(v) as 1 | 2 | 3 })
              .run();
          }
        }}
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 outline-none focus:border-primary"
      >
        {HEADING_OPTIONS.map((h) => (
          <option key={h.value} value={h.value}>
            {h.label}
          </option>
        ))}
      </select>

      <select
        value={currentFontSize}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            editor.chain().focus().unsetFontSize().run();
          } else {
            editor.chain().focus().setFontSize(`${v}px`).run();
          }
        }}
        title="Font size"
        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 outline-none focus:border-primary"
      >
        <option value="">px</option>
        {FONT_SIZE_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <Divider />

      <ToolbarButton
        title="Bold"
        icon={Bold}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        title="Italic"
        icon={Italic}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        title="Underline"
        icon={UnderlineIcon}
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        title="Strikethrough"
        icon={Strikethrough}
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <Divider />

      <ToolbarButton
        title="Align left"
        icon={AlignLeft}
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      />
      <ToolbarButton
        title="Align center"
        icon={AlignCenter}
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      />
      <ToolbarButton
        title="Align right"
        icon={AlignRight}
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      />
      <ToolbarButton
        title="Justify"
        icon={AlignJustify}
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      />

      <Divider />

      <ToolbarButton
        title="Bullet list"
        icon={List}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        title="Numbered list"
        icon={ListOrdered}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        title="Quote"
        icon={Quote}
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        title="Highlight"
        icon={Highlighter}
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      />

      <Divider />

      <div className="relative">
        <ToolbarButton
          title="Text color"
          icon={Palette}
          active={colorPickerOpen}
          onClick={() => setColorPickerOpen(!colorPickerOpen)}
        />
        {colorPickerOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
            {TEXT_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => {
                  editor.chain().focus().setColor(c).run();
                  setColorPickerOpen(false);
                }}
                className="h-6 w-6 rounded-full border border-black/10"
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              onChange={(e) => {
                editor.chain().focus().setColor(e.target.value).run();
              }}
              title="Custom color"
              className="h-6 w-6 cursor-pointer rounded-full border border-black/10 bg-white p-0"
            />
          </div>
        )}
      </div>

      <ToolbarButton
        title="Clear formatting"
        icon={Eraser}
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      />

      <ToolbarButton
        title="Horizontal rule"
        icon={Minus}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />

      <Divider />

      <ToolbarButton
        title="Undo"
        icon={Undo2}
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        title="Redo"
        icon={Redo2}
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />

      <Divider />

      <button
        type="button"
        title="Insert image"
        onClick={onPickImageClick}
        disabled={imageUploading}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-white hover:text-primary disabled:opacity-60"
      >
        {imageUploading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ImageIcon size={14} />
        )}
        {imageUploading ? "Uploading…" : "Image"}
      </button>
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-neutral-300" />;
}

function ToolbarButton({
  title,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-md p-1.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-primary/10 text-primary"
          : "text-neutral-700 hover:bg-white hover:text-primary"
      }`}
    >
      <Icon size={14} />
    </button>
  );
}
