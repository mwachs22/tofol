"use client";

import { useState } from "react";

interface Props {
  docId: string;
  workspaceHandle: string;
  docSlug: string;
  shareMode: "none" | "public_view" | "public_edit";
  onShareModeChange: (mode: "none" | "public_view" | "public_edit") => void;
  onClose: () => void;
}

export function ShareModal({
  docId,
  workspaceHandle,
  docSlug,
  shareMode,
  onShareModeChange,
  onClose,
}: Props) {
  const [mode, setMode] = useState(shareMode);
  const [copying, setCopying] = useState(false);
  const [saving, setSaving] = useState(false);

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/${workspaceHandle}/${docSlug}`;

  async function updateShareMode(newMode: typeof mode) {
    setSaving(true);
    setMode(newMode);
    await fetch(`/api/docs/${docId}/share`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareMode: newMode }),
    });
    onShareModeChange(newMode);
    setSaving(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 w-full max-w-sm p-5 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Share</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
              Link access
            </p>
            <div className="space-y-2">
              {(
                [
                  { value: "none", label: "Private", description: "Only workspace members" },
                  { value: "public_view", label: "Anyone with link can view", description: "Read-only, no account required" },
                  { value: "public_edit", label: "Anyone with link can edit", description: "Full edit access" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    mode === opt.value
                      ? "border-zinc-900 dark:border-zinc-50 bg-zinc-50 dark:bg-zinc-800"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="shareMode"
                    value={opt.value}
                    checked={mode === opt.value}
                    onChange={() => updateShareMode(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {opt.label}
                    </div>
                    <div className="text-xs text-zinc-500">{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {mode !== "none" && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                Public link
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={publicUrl}
                  className="flex-1 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 outline-none font-mono"
                />
                <button
                  onClick={copyLink}
                  className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-3 py-2 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
                >
                  {copying ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>

        {saving && (
          <p className="mt-3 text-xs text-zinc-400 text-center">Saving…</p>
        )}
      </div>
    </div>
  );
}
