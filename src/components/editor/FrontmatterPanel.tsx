"use client";

import { useState } from "react";

interface Props {
  docId: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  canEdit: boolean;
}

export function FrontmatterPanel({ docId, frontmatter, tags, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [localFm, setLocalFm] = useState(frontmatter);
  const [localTags, setLocalTags] = useState(tags.join(", "));

  const hasContent =
    Object.keys(frontmatter).length > 0 || tags.length > 0;

  async function save() {
    const parsedTags = localTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await fetch(`/api/docs/${docId}/meta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frontmatter: localFm, tags: parsedTags }),
    });
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
      >
        <ChevronIcon open={open} />
        {open ? "Hide metadata" : hasContent ? "Show metadata" : "Add metadata"}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Tags</label>
            <input
              value={localTags}
              onChange={(e) => setLocalTags(e.target.value)}
              onBlur={save}
              readOnly={!canEdit}
              placeholder="tag1, tag2, tag3"
              className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          {Object.entries(localFm).map(([key, value]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-zinc-500 mb-1 capitalize">
                {key.replace(/_/g, " ")}
              </label>
              <input
                value={typeof value === "string" ? value : JSON.stringify(value)}
                onChange={(e) =>
                  setLocalFm((fm) => ({ ...fm, [key]: e.target.value }))
                }
                onBlur={save}
                readOnly={!canEdit}
                className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
