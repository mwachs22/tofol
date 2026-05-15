"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  workspaceId: string;
  name: string;
  handle: string;
}

export function WorkspaceDetailsForm({ workspaceId, name, handle }: Props) {
  const router = useRouter();
  const [formName, setFormName] = useState(name);
  const [formHandle, setFormHandle] = useState(handle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName, handle: formHandle }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.detail ?? "Failed to save changes.");
      setSaving(false);
      return;
    }

    const updated = await res.json();
    setSaved(true);
    setSaving(false);

    // If handle changed, navigate to new settings URL
    if (updated.handle !== handle) {
      router.push(`/${updated.handle}/settings`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          Workspace name
        </label>
        <input
          value={formName}
          onChange={(e) => { setFormName(e.target.value); setSaved(false); }}
          required
          className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          Handle
        </label>
        <div className="flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus-within:ring-2 focus-within:ring-zinc-400">
          <span className="pl-3 pr-1 text-sm text-zinc-400">tofol.io/</span>
          <input
            value={formHandle}
            onChange={(e) => { setFormHandle(e.target.value.toLowerCase()); setSaved(false); }}
            required
            className="flex-1 bg-transparent px-1 py-2 text-sm outline-none"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {saved && <p className="text-xs text-green-600 dark:text-green-400">Saved.</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
