"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface JobSummary {
  id: string;
  status: string;
  totalDocs: number;
  completedDocs: number;
  failedDocs: number;
  isLocked: boolean;
}

interface ReviewDoc {
  id: string;
  title: string;
  slug: string;
  body: string;
  frontmatter: Record<string, unknown>;
  reasons: string[];
}

interface Props {
  workspaceId: string;
  adapterType: string | null;
  docCount: number;
  latestJob: JobSummary | null;
  reviewDocs: ReviewDoc[];
}

export default function MigrateClient({
  workspaceId,
  adapterType,
  docCount,
  latestJob,
  reviewDocs,
}: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: docCount });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewDoc[]>(reviewDocs);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [done, setDone] = useState(latestJob?.status === "complete");

  if (!adapterType) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 text-sm text-zinc-500">
        No adapter configured. Go to{" "}
        <a href="settings/adapter" className="underline">
          Backend adapter
        </a>{" "}
        to set one up first.
      </div>
    );
  }

  async function startMigration() {
    setRunning(true);
    setError(null);
    setDone(false);
    setStatusMessage("Migration starting…");
    setProgress({ completed: 0, total: docCount });

    const res = await fetch(`/api/workspaces/${workspaceId}/migrate`, {
      method: "POST",
    });

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      setError(body.detail ?? "Failed to start migration.");
      setRunning(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const localReview: ReviewDoc[] = [];

    while (true) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));

          if (event.type === "progress" || event.type === "doc") {
            setProgress({ completed: event.completed ?? 0, total: event.total ?? docCount });
          }

          if (event.type === "doc" && event.result && !event.result.pushed) {
            localReview.push({
              id: event.result.docId,
              title: event.result.title,
              slug: event.result.slug,
              body: "",
              frontmatter: {},
              reasons: event.result.reasons,
            });
          }

          if (event.type === "complete") {
            setStatusMessage(event.message);
            setReviewQueue(localReview);
            setDone(true);
          }

          if (event.type === "error") {
            setError(event.message);
          }
        } catch {
          // Malformed SSE line — skip
        }
      }
    }

    setRunning(false);
    router.refresh();
  }

  const pct =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  const currentReviewDoc = reviewQueue[reviewIndex];

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Adapter: <span className="capitalize">{adapterType}</span>
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">{docCount} documents in workspace</p>
          </div>

          {!running && (
            <button
              onClick={startMigration}
              disabled={running || (latestJob?.isLocked ?? false)}
              className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {latestJob?.status === "complete" ? "Re-run migration" : "Start migration"}
            </button>
          )}
        </div>

        {running && (
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
              <span>
                {progress.completed} / {progress.total} docs
              </span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
              <div
                className="bg-zinc-900 dark:bg-zinc-50 h-2 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-zinc-400 mt-2">
              Workspace is read-only during migration. Edits will be available when migration completes.
            </p>
          </div>
        )}

        {!running && latestJob && (
          <div className="text-xs text-zinc-500 flex gap-4">
            <span>Status: <strong>{latestJob.status}</strong></span>
            <span>{latestJob.completedDocs} migrated</span>
            {latestJob.failedDocs > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {latestJob.failedDocs} need review
              </span>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {statusMessage && !running && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{statusMessage}</p>
        )}
      </div>

      {/* Review queue */}
      {done && reviewQueue.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {reviewQueue.length} doc{reviewQueue.length > 1 ? "s" : ""} need your review
            </h2>
            <span className="text-xs text-zinc-400">
              {reviewIndex + 1} / {reviewQueue.length}
            </span>
          </div>

          {currentReviewDoc && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
              {/* Issue sidebar */}
              <div className="bg-amber-50 dark:bg-amber-950 px-4 py-3 border-b border-amber-200 dark:border-amber-800">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  {currentReviewDoc.title || "Untitled"} — {currentReviewDoc.reasons.length} issue
                  {currentReviewDoc.reasons.length !== 1 ? "s" : ""}
                </p>
                <ul className="space-y-1">
                  {currentReviewDoc.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                      · {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="px-4 py-3 bg-white dark:bg-zinc-900 flex gap-3">
                <a
                  href={`../../${currentReviewDoc.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
                >
                  Open doc →
                </a>
                <button
                  onClick={() => setReviewIndex((i) => Math.min(i + 1, reviewQueue.length - 1))}
                  className="text-sm text-zinc-500 hover:text-zinc-700 ml-auto"
                >
                  Skip
                </button>
                <button
                  onClick={async () => {
                    // Mark as approved — push as-is
                    await fetch(`/api/workspaces/${workspaceId}/migrate/approve`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ docId: currentReviewDoc.id }),
                    });
                    setReviewQueue((q) => q.filter((_, i) => i !== reviewIndex));
                    setReviewIndex((i) => Math.min(i, reviewQueue.length - 2));
                  }}
                  className="text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:underline"
                >
                  Approve &amp; push
                </button>
              </div>
            </div>
          )}

          {reviewQueue.length === 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              All docs reviewed. Migration complete.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
