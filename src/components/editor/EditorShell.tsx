"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import Mention from "@tiptap/extension-mention";
import { EditorToolbar } from "./EditorToolbar";
import { FrontmatterPanel } from "./FrontmatterPanel";
import { ShareModal } from "./ShareModal";
import { RevisionHistory } from "./RevisionHistory";
import { buildEntitySuggestion } from "./EntityMentionSuggestion";

const lowlight = createLowlight(all);

const BODY_SIZE_WARN_BYTES = 1_500_000;
const BODY_SIZE_MAX_BYTES = 2_000_000;
const AUTOSAVE_DEBOUNCE_MS = 2_000;

interface DocData {
  id: string;
  title: string;
  slug: string;
  body: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  shareMode: "none" | "public_view" | "public_edit";
  currentRevisionId: string | null;
}

interface Props {
  doc: DocData;
  workspaceId: string;
  workspaceHandle: string;
  workspaceName: string;
  canEdit: boolean;
  isLocked?: boolean;
  userId: string;
}

export function EditorShell({
  doc,
  workspaceId,
  workspaceHandle,
  workspaceName,
  canEdit,
  isLocked = false,
  userId,
}: Props) {
  const [title, setTitle] = useState(doc.title);
  const [slug, setSlug] = useState(doc.slug);
  const [editingSlug, setEditingSlug] = useState(false);
  const [shareMode, setShareMode] = useState(doc.shareMode);
  const [sizeWarning, setSizeWarning] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentRevisionId, setCurrentRevisionId] = useState(doc.currentRevisionId);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: canEdit,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4] },
        link: false,
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
      Mention.configure({
        HTMLAttributes: { class: "entity-mention" },
        renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
        renderHTML: ({ node }) => [
          "span",
          { class: "entity-mention", "data-id": node.attrs.id },
          `@${node.attrs.label ?? node.attrs.id}`,
        ],
        suggestion: buildEntitySuggestion(workspaceId),
      }),
    ],
    content: doc.body || "",
    onUpdate({ editor }) {
      const bytes = new TextEncoder().encode(editor.getText()).length;
      setSizeWarning(bytes > BODY_SIZE_WARN_BYTES);
      if (bytes > BODY_SIZE_MAX_BYTES) {
        editor.commands.undo();
        return;
      }
      scheduleAutosave(editor.getHTML());
    },
  });

  const scheduleAutosave = useCallback((html: string) => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      await fetch(`/api/docs/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: html }),
      });
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [doc.id]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  const saveTitle = useCallback(async () => {
    if (title === doc.title) return;
    await fetch(`/api/docs/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  }, [doc.id, doc.title, title]);

  const saveSlug = useCallback(async () => {
    setEditingSlug(false);
    if (slug === doc.slug) return;
    const res = await fetch(`/api/docs/${doc.id}/slug`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (res.ok) {
      const data = await res.json();
      window.history.replaceState({}, "", `/${workspaceHandle}/${data.slug}`);
      setSlug(data.slug);
    } else {
      setSlug(doc.slug);
    }
  }, [doc.id, doc.slug, slug, workspaceHandle]);

  const uploadImage = useCallback(async (file: File) => {
    const res = await fetch("/api/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    if (!res.ok) return;
    const { uploadUrl, publicUrl } = await res.json();
    await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    editor?.chain().focus().setImage({ src: publicUrl }).run();
  }, [editor]);

  function handleRestore(revisionId: string) {
    setCurrentRevisionId(revisionId);
    setShowHistory(false);
    window.location.reload();
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-950">
      <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-1.5 flex items-center justify-end gap-2 shrink-0">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
            showHistory
              ? "border-zinc-900 dark:border-zinc-50 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900"
              : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
          }`}
        >
          History
        </button>
        {canEdit && (
          <button
            onClick={() => setShowShare(true)}
            className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 transition-colors"
          >
            Share
          </button>
        )}
      </div>

      {canEdit && editor && <EditorToolbar editor={editor} onImageUpload={uploadImage} />}

      {isLocked && (
        <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 px-6 py-1.5 text-xs text-blue-700 dark:text-blue-300 shrink-0">
          Migration in progress — this document is read-only until the migration completes.
        </div>
      )}
      {sizeWarning && (
        <div className="bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800 px-6 py-1.5 text-xs text-red-700 dark:text-red-300 shrink-0">
          This document is approaching the 2 MB size limit.
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[720px] mx-auto px-8 py-10">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              readOnly={!canEdit}
              className="w-full text-4xl font-bold text-zinc-900 dark:text-zinc-50 bg-transparent outline-none mb-6 placeholder:text-zinc-300"
              placeholder="Untitled"
            />

            {canEdit && (
              <div className="flex items-center gap-1.5 mb-5 -mt-3">
                <span className="text-xs text-zinc-400">
                  {workspaceHandle}/
                </span>
                {editingSlug ? (
                  <input
                    autoFocus
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    onBlur={saveSlug}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveSlug();
                      if (e.key === "Escape") { setSlug(doc.slug); setEditingSlug(false); }
                    }}
                    className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-zinc-400 font-mono"
                  />
                ) : (
                  <button
                    onClick={() => setEditingSlug(true)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono hover:underline"
                  >
                    {slug}
                  </button>
                )}
              </div>
            )}

            <FrontmatterPanel
              docId={doc.id}
              workspaceId={workspaceId}
              frontmatter={doc.frontmatter}
              tags={doc.tags}
              canEdit={canEdit}
            />

            <EditorContent
              editor={editor}
              className="prose prose-zinc dark:prose-invert max-w-none focus:outline-none"
            />
          </div>
        </main>

        {showHistory && (
          <RevisionHistory
            docId={doc.id}
            currentRevisionId={currentRevisionId}
            onRestore={handleRestore}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>

      {showShare && (
        <ShareModal
          docId={doc.id}
          workspaceHandle={workspaceHandle}
          docSlug={doc.slug}
          shareMode={shareMode}
          onShareModeChange={setShareMode}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
