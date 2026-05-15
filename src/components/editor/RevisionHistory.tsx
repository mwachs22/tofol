"use client";

import { useState, useEffect } from "react";

interface Revision {
  id: string;
  author_display_name: string;
  author_type: "human" | "agent";
  created_at: string;
}

interface Props {
  docId: string;
  currentRevisionId: string | null;
  onRestore: (revisionId: string) => void;
  onClose: () => void;
}

export function RevisionHistory({ docId, currentRevisionId, onRestore, onClose }: Props) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/docs/${docId}/revisions`)
      .then((r) => r.json())
      .then((data) => setRevisions(data.data ?? []))
      .finally(() => setLoading(false));
  }, [docId]);

  async function restore(revisionId: string) {
    setRestoring(revisionId);
    await fetch(`/api/docs/${docId}/revisions/${revisionId}/restore`, { method: "POST" });
    onRestore(revisionId);
    setRestoring(null);
  }

  return (
    <aside className="w-72 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Revision history
        </h2>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-xs text-zinc-400">Loading…</div>
        ) : revisions.length === 0 ? (
          <div className="px-4 py-6 text-xs text-zinc-400">No revisions yet.</div>
        ) : (
          <ul className="divide-y divide-zinc-50 dark:divide-zinc-900">
            {revisions.map((rev) => (
              <li
                key={rev.id}
                className={`px-4 py-3 ${
                  rev.id === currentRevisionId
                    ? "bg-zinc-50 dark:bg-zinc-900"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-medium ${
                          rev.author_type === "agent"
                            ? "text-violet-600 dark:text-violet-400"
                            : "text-zinc-900 dark:text-zinc-50"
                        }`}
                      >
                        {rev.author_display_name}
                      </span>
                      {rev.author_type === "agent" && (
                        <span className="text-[10px] text-violet-500 bg-violet-50 dark:bg-violet-950 px-1 rounded">
                          agent
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      {new Date(rev.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {rev.id !== currentRevisionId && (
                    <button
                      onClick={() => restore(rev.id)}
                      disabled={restoring === rev.id}
                      className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shrink-0"
                    >
                      {restoring === rev.id ? "Restoring…" : "Restore"}
                    </button>
                  )}
                  {rev.id === currentRevisionId && (
                    <span className="text-[11px] text-zinc-400 shrink-0">Current</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
