"use client";

import { useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { all, createLowlight } from "lowlight";
import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCursor } from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { EditorToolbar } from "./EditorToolbar";
import { FrontmatterPanel } from "./FrontmatterPanel";

const lowlight = createLowlight(all);

const BODY_SIZE_WARN_BYTES = 1_500_000;
const BODY_SIZE_MAX_BYTES = 2_000_000;

interface DocData {
  id: string;
  title: string;
  slug: string;
  body: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
}

interface Props {
  doc: DocData;
  workspaceHandle: string;
  workspaceName: string;
  canEdit: boolean;
  userId: string;
}

export function EditorShell({
  doc,
  workspaceHandle,
  workspaceName,
  canEdit,
  userId,
}: Props) {
  const [title, setTitle] = useState(doc.title);
  const [sizeWarning, setSizeWarning] = useState(false);
  const [connected, setConnected] = useState(false);

  const ydoc = useState(() => new Y.Doc())[0];
  const provider = useState(() => {
    const hocuspocusUrl = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ?? "ws://localhost:1234";
    return new HocuspocusProvider({
      url: hocuspocusUrl,
      name: doc.id,
      document: ydoc,
      token: userId,
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    });
  })[0];

  const editor = useEditor({
    editable: canEdit,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight
        heading: { levels: [1, 2, 3, 4] },
      }),
      Highlight,
      Typography,
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: userId, color: stringToColor(userId) },
      }),
    ],
    content: doc.body,
    onUpdate({ editor }) {
      const bytes = new TextEncoder().encode(editor.getText()).length;
      setSizeWarning(bytes > BODY_SIZE_WARN_BYTES);
      if (bytes > BODY_SIZE_MAX_BYTES) {
        // Prevent further input at limit
        editor.commands.undo();
      }
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      provider.destroy();
    };
  }, [provider]);

  const saveTitle = useCallback(async () => {
    await fetch(`/api/docs/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  }, [doc.id, title]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      {/* Top bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-2 flex items-center gap-4">
        <a
          href={`/${workspaceHandle}`}
          className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          {workspaceName}
        </a>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate max-w-xs">
          {title}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <ConnectionBadge connected={connected} />
        </div>
      </header>

      {/* Toolbar */}
      {canEdit && editor && <EditorToolbar editor={editor} />}

      {/* Offline / size warnings */}
      {!connected && (
        <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-6 py-2 text-xs text-amber-700 dark:text-amber-300">
          You are offline. Edits will sync when you reconnect.
        </div>
      )}
      {sizeWarning && (
        <div className="bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800 px-6 py-2 text-xs text-red-700 dark:text-red-300">
          This document is approaching the 2 MB size limit.
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[720px] mx-auto px-8 py-10">
            {/* Editable title */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              readOnly={!canEdit}
              className="w-full text-4xl font-bold text-zinc-900 dark:text-zinc-50 bg-transparent outline-none mb-6 placeholder:text-zinc-300"
              placeholder="Untitled"
            />

            {/* Frontmatter panel */}
            <FrontmatterPanel
              docId={doc.id}
              frontmatter={doc.frontmatter}
              tags={doc.tags}
              canEdit={canEdit}
            />

            {/* Editor body */}
            <EditorContent
              editor={editor}
              className="prose prose-zinc dark:prose-invert max-w-none focus:outline-none"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
      <div
        className={`w-1.5 h-1.5 rounded-full ${
          connected ? "bg-green-500" : "bg-amber-400"
        }`}
      />
      {connected ? "Live" : "Offline"}
    </div>
  );
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 65%, 50%)`;
}
