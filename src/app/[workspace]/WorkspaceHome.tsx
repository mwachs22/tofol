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
}

export default function WorkspaceHome({ workspace, memberRole, initialDocs }: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
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
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/${workspace.handle}/${doc.slug}`}
                  className="flex items-center justify-between py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 -mx-2 px-2 rounded-md transition-colors group"
                >
                  <div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 group-hover:text-zinc-700">
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
        )}
      </main>
    </div>
  );
}
