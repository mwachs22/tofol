"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface GBrainConfig {
  repoPath: string;
  remoteUrl: string;
  authorName: string;
  authorEmail: string;
}

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [workspaceName, setWorkspaceName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gbrain, setGbrain] = useState<GBrainConfig>({
    repoPath: "",
    remoteUrl: "",
    authorName: "",
    authorEmail: "",
  });

  function deriveHandle(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
  }

  function validateHandle(h: string) {
    if (h.length < 3) return "Handle must be at least 3 characters.";
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(h))
      return "Only lowercase letters, numbers, and hyphens allowed.";
    const reserved = ["api","app","admin","settings","login","signup","pricing","docs","blog","about","help","www","status","support"];
    if (reserved.includes(h)) return `"${h}" is a reserved name.`;
    return null;
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    const err = validateHandle(handle);
    if (err) { setHandleError(err); return; }
    setHandleError(null);
    setStep(2);
  }

  async function finish() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workspaceName, handle }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.detail ?? "Something went wrong. Try a different handle.");
      setLoading(false);
      return;
    }

    const { id: workspaceId } = await res.json();

    // Configure GBrain adapter if credentials were provided
    if (gbrain.repoPath && gbrain.remoteUrl) {
      await fetch(`/api/workspaces/${workspaceId}/adapter`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adapterType: "gbrain", config: gbrain }),
      });
    }

    router.push(`/${handle}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-zinc-900 dark:bg-zinc-50" : "bg-zinc-200 dark:bg-zinc-800"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Name your workspace
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                This is how your team will identify this space.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Workspace name
                </label>
                <input
                  type="text"
                  required
                  value={workspaceName}
                  onChange={(e) => {
                    setWorkspaceName(e.target.value);
                    if (!handle || handle === deriveHandle(workspaceName)) {
                      setHandle(deriveHandle(e.target.value));
                    }
                  }}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50"
                  placeholder="Acme Inc"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Handle
                </label>
                <div className="flex items-center rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900 dark:focus-within:ring-zinc-50">
                  <span className="pl-3 pr-1 text-sm text-zinc-400">tofol.io/</span>
                  <input
                    type="text"
                    required
                    value={handle}
                    onChange={(e) => {
                      setHandle(e.target.value.toLowerCase());
                      setHandleError(null);
                    }}
                    className="flex-1 bg-transparent px-1 py-2 text-sm outline-none"
                    placeholder="acme"
                  />
                </div>
                {handleError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{handleError}</p>
                )}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                Skip
              </button>
              <button
                type="submit"
                className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-5 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Connect a GBrain repo
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Point Tofol at a local GBrain git repo so your agent can read and
                write documents. You can skip this and configure it later in
                workspace settings.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4">
              {[
                { key: "repoPath" as const, label: "Repo path", placeholder: "/Users/you/brain", description: "Absolute path to your local GBrain git clone" },
                { key: "remoteUrl" as const, label: "Remote URL", placeholder: "git@github.com:you/brain.git", description: "Git remote for push/pull" },
                { key: "authorName" as const, label: "Git author name", placeholder: "Alice", description: "Used in commit metadata" },
                { key: "authorEmail" as const, label: "Git author email", placeholder: "alice@example.com", description: "Used in commit metadata" },
              ].map(({ key, label, placeholder, description }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-0.5">
                    {label}
                  </label>
                  <p className="text-xs text-zinc-400 mb-1">{description}</p>
                  <input
                    type="text"
                    value={gbrain[key]}
                    onChange={(e) => setGbrain((g) => ({ ...g, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-5 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Ready to go
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Your workspace <strong>{workspaceName}</strong> is all set up.
                Create your first document to get started.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={finish}
                disabled={loading}
                className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-5 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
              >
                {loading ? "Creating workspace…" : "Create workspace"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
