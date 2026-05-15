"use client";

import { useState } from "react";

const ACCENT_PRESETS = [
  { label: "Zinc (default)", value: "#18181b" },
  { label: "Blue", value: "#2563eb" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Rose", value: "#e11d48" },
  { label: "Emerald", value: "#059669" },
  { label: "Amber", value: "#d97706" },
];

interface Props {
  workspaceId: string;
  initialThemeConfig: { accentColor?: string } | null;
}

export function ThemeForm({ workspaceId, initialThemeConfig }: Props) {
  const [accentColor, setAccentColor] = useState(
    initialThemeConfig?.accentColor ?? "#18181b"
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeConfig: { accentColor } }),
    });

    setSaving(false);
    if (res.ok) setSaved(true);
    else {
      const body = await res.json().catch(() => ({}));
      setError(body.detail ?? "Failed to save theme.");
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
          Accent color
        </label>
        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => { setAccentColor(p.value); setSaved(false); }}
              title={p.label}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                accentColor === p.value
                  ? "border-zinc-900 dark:border-zinc-50 scale-110"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: p.value }}
            />
          ))}
          <input
            type="color"
            value={accentColor}
            onChange={(e) => { setAccentColor(e.target.value); setSaved(false); }}
            className="w-7 h-7 rounded-full cursor-pointer border border-zinc-300 dark:border-zinc-600 p-0.5 bg-transparent"
            title="Custom color"
          />
        </div>
        <p className="text-xs text-zinc-400 mt-2">
          Used for buttons and interactive accents. Choose a preset or pick a custom color.
        </p>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {saved && <p className="text-xs text-green-600 dark:text-green-400">Theme saved.</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : "Save theme"}
      </button>
    </form>
  );
}
