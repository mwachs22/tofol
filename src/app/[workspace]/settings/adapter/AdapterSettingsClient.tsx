"use client";

import { useState } from "react";

interface Props {
  workspaceId: string;
  currentAdapterType: string | null;
}

export default function AdapterSettingsClient({ workspaceId, currentAdapterType }: Props) {
  const [adapterType, setAdapterType] = useState(currentAdapterType ?? "none");
  const [gbrainConfig, setGbrainConfig] = useState({
    repoPath: "",
    remoteUrl: "",
    authorName: "",
    authorEmail: "",
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/adapter/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adapterType, config: gbrainConfig }),
      });
      const data = await res.json();
      setTestResult({ ok: res.ok, message: data.message ?? data.detail ?? "Unknown result" });
    } catch {
      setTestResult({ ok: false, message: "Network error — could not reach test endpoint." });
    } finally {
      setTesting(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await fetch(`/api/workspaces/${workspaceId}/adapter`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adapterType,
        config: adapterType === "gbrain" ? gbrainConfig : null,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.detail ?? "Failed to save adapter settings.");
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-4">
          Adapter
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Backend type
            </label>
            <select
              value={adapterType}
              onChange={(e) => setAdapterType(e.target.value)}
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="none">None (Tofol-only)</option>
              <option value="gbrain">GBrain</option>
            </select>
          </div>

          {adapterType === "gbrain" && (
            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-xs text-zinc-500">
                GBrain syncs documents to a git-tracked markdown repository.
              </p>
              {[
                { key: "repoPath", label: "Local repo path", placeholder: "/home/user/brain" },
                { key: "remoteUrl", label: "Remote URL", placeholder: "git@github.com:org/brain.git" },
                { key: "authorName", label: "Git author name", placeholder: "Tofol Sync" },
                { key: "authorEmail", label: "Git author email", placeholder: "sync@example.com" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {label}
                  </label>
                  <input
                    value={gbrainConfig[key as keyof typeof gbrainConfig]}
                    onChange={(e) =>
                      setGbrainConfig((c) => ({ ...c, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={testConnection}
                disabled={testing}
                className="text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded-md px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors"
              >
                {testing ? "Testing…" : "Test connection"}
              </button>

              {testResult && (
                <p
                  className={`text-xs ${
                    testResult.ok
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {testResult.ok ? "✓ " : "✗ "}
                  {testResult.message}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400">Adapter settings saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : "Save adapter settings"}
      </button>
    </form>
  );
}
