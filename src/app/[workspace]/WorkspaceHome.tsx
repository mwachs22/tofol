"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Doc {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  tags: string[];
}

interface Props {
  workspace: { id: string; name: string; handle: string };
  memberRole: "admin" | "editor" | "viewer";
  initialDocs: Doc[];
  initialStarredIds: string[];
}

export default function WorkspaceHome({
  workspace,
  memberRole,
  initialDocs,
  initialStarredIds,
}: Props) {
  const router = useRouter();
  const [docs] = useState<Doc[]>(initialDocs);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set(initialStarredIds));
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const canEdit = memberRole === "admin" || memberRole === "editor";

  const filtered = search
    ? docs.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : docs;

  const starredDocs = docs.filter((d) => starredIds.has(d.id));
  const unstarredDocs = filtered.filter((d) => !starredIds.has(d.id));

  async function createDoc() {
    setCreating(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled" }),
      });
      if (!res.ok) return;
      const { slug } = await res.json();
      router.push(`/${workspace.handle}/${slug}`);
    } finally {
      setCreating(false);
    }
  }

  async function toggleStar(docId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = new Set(starredIds);
    if (next.has(docId)) next.delete(docId);
    else next.add(docId);
    setStarredIds(next);
    const res = await fetch(`/api/docs/${docId}/star`, { method: "POST" });
    if (!res.ok) {
      // revert on failure
      setStarredIds(starredIds);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {workspace.name}
        </span>
        <div className="flex items-center gap-2">
          {memberRole === "admin" && (
            <Link
              href={`/${workspace.handle}/settings`}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 px-2 py-1"
            >
              Settings
            </Link>
          )}
          {canEdit && (
            <button
              onClick={createDoc}
              disabled={creating}
              className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-1.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "New document"}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>

        {/* Starred section */}
        {starredDocs.length > 0 && !search && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Starred
            </h2>
            <DocList
              docs={starredDocs}
              handle={workspace.handle}
              starredIds={starredIds}
              onToggleStar={toggleStar}
            />
          </section>
        )}

        {/* All / filtered docs */}
        {!search && starredDocs.length > 0 && unstarredDocs.length > 0 && (
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            All documents
          </h2>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            {search ? (
              <p className="text-sm">No documents match &ldquo;{search}&rdquo;</p>
            ) : (
              <div>
                <p className="text-sm mb-3">No documents yet.</p>
                {canEdit && (
                  <button
                    onClick={createDoc}
                    className="text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:underline"
                  >
                    Create your first document
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <DocList
            docs={search ? filtered : unstarredDocs}
            handle={workspace.handle}
            starredIds={starredIds}
            onToggleStar={toggleStar}
          />
        )}
      </main>
    </div>
  );
}

function DocList({
  docs,
  handle,
  starredIds,
  onToggleStar,
}: {
  docs: Doc[];
  handle: string;
  starredIds: Set<string>;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
}) {
  if (docs.length === 0) return null;

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {docs.map((doc) => (
        <li key={doc.id}>
          <Link
            href={`/${handle}/${doc.slug}`}
            className="flex items-center justify-between py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 -mx-2 px-2 rounded-md transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={(e) => onToggleStar(doc.id, e)}
                title={starredIds.has(doc.id) ? "Unstar" : "Star"}
                className={`shrink-0 text-base leading-none transition-colors ${
                  starredIds.has(doc.id)
                    ? "text-amber-400 hover:text-amber-500"
                    : "text-zinc-200 dark:text-zinc-700 hover:text-amber-400"
                }`}
              >
                {starredIds.has(doc.id) ? "★" : "☆"}
              </button>
              <div className="min-w-0">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 block truncate">
                  {doc.title || "Untitled"}
                </span>
                {doc.tags.length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {doc.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <span className="text-xs text-zinc-400 shrink-0 ml-4">
              {new Date(doc.updated_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
