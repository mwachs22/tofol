"use client";

import { useState, useEffect } from "react";
import type { AdapterSchema } from "@/lib/adapter/interface";

interface Props {
  docId: string;
  workspaceId: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  canEdit: boolean;
}

export function FrontmatterPanel({ docId, workspaceId, frontmatter, tags, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [localFm, setLocalFm] = useState(frontmatter);
  const [localTags, setLocalTags] = useState(tags.join(", "));
  const [schema, setSchema] = useState<AdapterSchema | null>(null);

  const hasContent = Object.keys(frontmatter).length > 0 || tags.length > 0;

  useEffect(() => {
    if (!open || schema !== null) return;
    fetch(`/api/workspaces/${workspaceId}/adapter/schema`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setSchema(Array.isArray(data?.frontmatterFields) ? data : null))
      .catch(() => setSchema(null));
  }, [open, workspaceId, schema]);

  async function save() {
    const parsedTags = localTags.split(",").map((t) => t.trim()).filter(Boolean);
    await fetch(`/api/docs/${docId}/meta`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frontmatter: localFm, tags: parsedTags }),
    });
  }

  // Fields to render: schema-defined first, then any extra keys in localFm
  const schemaKeys = new Set(schema?.frontmatterFields?.map((f) => f.key) ?? []);
  const extraKeys = Object.keys(localFm).filter((k) => !schemaKeys.has(k));

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
          {/* Tags always shown first */}
          <FieldRow label="Tags">
            <input
              value={localTags}
              onChange={(e) => setLocalTags(e.target.value)}
              onBlur={save}
              readOnly={!canEdit}
              placeholder="tag1, tag2, tag3"
              className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </FieldRow>

          {/* Schema-defined fields */}
          {schema?.frontmatterFields
            ?.filter((f) => f.key !== "title" && f.key !== "tags")
            .map((field) => (
              <FieldRow key={field.key} label={field.label} badge={field.type === "entity" ? field.entityType : undefined}>
                {field.type === "date" ? (
                  <input
                    type="date"
                    value={typeof localFm[field.key] === "string" ? (localFm[field.key] as string) : ""}
                    onChange={(e) => setLocalFm((fm) => ({ ...fm, [field.key]: e.target.value }))}
                    onBlur={save}
                    readOnly={!canEdit}
                    className="rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-zinc-400"
                  />
                ) : (
                  <input
                    value={typeof localFm[field.key] === "string" ? (localFm[field.key] as string) : localFm[field.key] !== undefined ? JSON.stringify(localFm[field.key]) : ""}
                    onChange={(e) => setLocalFm((fm) => ({ ...fm, [field.key]: e.target.value }))}
                    onBlur={save}
                    readOnly={!canEdit}
                    placeholder={field.type === "entity" ? "Entity name or link" : ""}
                    className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-zinc-400"
                  />
                )}
              </FieldRow>
            ))}

          {/* Extra keys not in schema */}
          {extraKeys.map((key) => (
            <FieldRow key={key} label={key.replace(/_/g, " ")}>
              <input
                value={typeof localFm[key] === "string" ? (localFm[key] as string) : JSON.stringify(localFm[key])}
                onChange={(e) => setLocalFm((fm) => ({ ...fm, [key]: e.target.value }))}
                onBlur={save}
                readOnly={!canEdit}
                className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </FieldRow>
          ))}

          {/* If no schema, fall back to generic view of all keys */}
          {!schema && Object.entries(localFm).map(([key, value]) => (
            <FieldRow key={key} label={key.replace(/_/g, " ")}>
              <input
                value={typeof value === "string" ? value : JSON.stringify(value)}
                onChange={(e) => setLocalFm((fm) => ({ ...fm, [key]: e.target.value }))}
                onBlur={save}
                readOnly={!canEdit}
                className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </FieldRow>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, badge, children }: { label: string; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-xs font-medium text-zinc-500 capitalize">{label}</label>
        {badge && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 font-mono">
            {badge}
          </span>
        )}
      </div>
      {children}
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
