"use client";

import type { Editor } from "@tiptap/react";

interface Props {
  editor: Editor;
}

export function EditorToolbar({ editor }: Props) {
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-1.5 flex items-center gap-1 flex-wrap">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        <strong>B</strong>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Strikethrough"
      >
        <s>S</s>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        title="Inline code"
      >
        {"</>"}
      </ToolbarButton>

      <Divider />

      {([1, 2, 3, 4] as const).map((level) => (
        <ToolbarButton
          key={level}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          active={editor.isActive("heading", { level })}
          title={`Heading ${level}`}
        >
          {`H${level}`}
        </ToolbarButton>
      ))}

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet list"
      >
        •—
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Ordered list"
      >
        1.
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive("taskList")}
        title="Task list"
      >
        ☐
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Blockquote"
      >
        ❝
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="Code block"
      >
        {"{ }"}
      </ToolbarButton>

      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        active={false}
        title="Insert table"
      >
        ⊞
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        active={false}
        title="Undo"
        disabled={!editor.can().undo()}
      >
        ↩
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        active={false}
        title="Redo"
        disabled={!editor.can().redo()}
      >
        ↪
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 rounded text-xs font-mono transition-colors disabled:opacity-30 ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
  );
}
