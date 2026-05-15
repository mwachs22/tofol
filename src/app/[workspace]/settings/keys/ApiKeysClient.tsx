"use client";

import { useState } from "react";

interface ApiKey {
  id: string;
  agent_name: string;
  permissions: "read" | "read-write" | "admin";
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

interface Props {
  workspaceId: string;
  initialKeys: ApiKey[];
}

export default function ApiKeysClient({ workspaceId, initialKeys }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [creating, setCreating] = useState(false);
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
  const [form, setForm] = useState({
    agentName: "",
    permissions: "read" as ApiKey["permissions"],
    expiresAt: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const res = await fetch(`/api/workspaces/${workspaceId}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentName: form.agentName,
        permissions: form.permissions,
        expiresAt: form.expiresAt || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.detail ?? "Failed to create key.");
      setCreating(false);
      return;
    }

    setNewKeyPlaintext(data.key);
    setKeys((prev) => [data.record, ...prev]);
    setForm({ agentName: "", permissions: "read", expiresAt: "" });
    setCreating(false);
  }

  async function revokeKey(id: string) {
    await fetch(`/api/workspaces/${workspaceId}/keys/${id}`, { method: "DELETE" });
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  return (
    <div className="space-y-6">
      {newKeyPlaintext && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 p-4">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-2">
            New API key created — copy it now. It won&apos;t be shown again.
          </p>
          <code className="block bg-white dark:bg-zinc-900 rounded px-3 py-2 text-xs font-mono break-all">
            {newKeyPlaintext}
          </code>
          <button
            className="mt-2 text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
            onClick={() => {
              navigator.clipboard.writeText(newKeyPlaintext);
            }}
          >
            Copy to clipboard
          </button>
        </div>
      )}

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-4">
          Create new key
        </h2>
        <form onSubmit={createKey} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Agent name
            </label>
            <input
              required
              value={form.agentName}
              onChange={(e) => setForm((f) => ({ ...f, agentName: e.target.value }))}
              placeholder="Hermes, OpenClaw, Custom Script…"
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Permission scope
            </label>
            <select
              value={form.permissions}
              onChange={(e) =>
                setForm((f) => ({ ...f, permissions: e.target.value as ApiKey["permissions"] }))
              }
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="read">Read</option>
              <option value="read-write">Read + write</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Expires at (optional)
            </label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating…" : "Create key"}
          </button>
        </form>
      </section>

      {keys.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-3">
            Active keys
          </h2>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {key.agent_name}
                  </div>
                  <div className="text-xs text-zinc-400 flex gap-3 mt-0.5">
                    <span className="capitalize">{key.permissions}</span>
                    <span>
                      Created {new Date(key.created_at).toLocaleDateString()}
                    </span>
                    {key.last_used_at && (
                      <span>
                        Last used {new Date(key.last_used_at).toLocaleDateString()}
                      </span>
                    )}
                    {key.expires_at && (
                      <span>Expires {new Date(key.expires_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => revokeKey(key.id)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
