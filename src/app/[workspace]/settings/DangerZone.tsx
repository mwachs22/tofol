"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  workspaceId: string;
  workspaceName: string;
  exportUrl: string;
}

export function DangerZone({ workspaceId, workspaceName, exportUrl }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function deleteWorkspace() {
    if (confirmText !== workspaceName) return;
    setDeleting(true);
    const res = await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
    } else {
      setDeleting(false);
      alert("Failed to delete workspace. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <a
          href={exportUrl}
          className="text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded-md px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          Export all docs (.zip)
        </a>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-md px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            Delete workspace
          </button>
        )}
      </div>

      {confirming && (
        <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 space-y-3">
          <p className="text-sm text-red-700 dark:text-red-300">
            Type <strong>{workspaceName}</strong> to confirm deletion. This cannot be undone.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={workspaceName}
            className="w-full rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={deleteWorkspace}
              disabled={confirmText !== workspaceName || deleting}
              className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-md px-4 py-1.5 transition-colors"
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setConfirmText(""); }}
              className="text-sm text-zinc-500 hover:text-zinc-700 px-4 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
