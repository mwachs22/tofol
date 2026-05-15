"use client";

import { useState } from "react";

interface Member {
  id: string;
  user_id: string;
  role: "admin" | "editor" | "viewer";
  invited_at: string;
  accepted_at: string | null;
}

interface Props {
  workspaceId: string;
  currentUserId: string;
  initialMembers: Member[];
}

export default function MembersClient({ workspaceId, currentUserId, initialMembers }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setInviteSuccess(null);

    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    const data = await res.json().catch(() => ({}));
    setInviting(false);

    if (!res.ok) {
      setError(data.detail ?? "Failed to send invite.");
      return;
    }

    setInviteSuccess(`Invite sent to ${inviteEmail}`);
    setInviteEmail("");
  }

  async function removeMember(memberId: string) {
    await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  async function changeRole(memberId: string, newRole: Member["role"]) {
    await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-4">
          Invite by email
        </h2>
        <form onSubmit={invite} className="flex gap-3 flex-wrap">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            className="flex-1 min-w-48 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {inviteSuccess && (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{inviteSuccess}</p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-3">
          Current members
        </h2>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                  {m.user_id.slice(0, 8)}…
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {m.accepted_at ? "Active" : "Pending invite"} ·{" "}
                  {new Date(m.invited_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={m.role}
                  onChange={(e) => changeRole(m.id, e.target.value as Member["role"])}
                  disabled={m.user_id === currentUserId}
                  className="text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 outline-none"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                {m.user_id !== currentUserId && (
                  <button
                    onClick={() => removeMember(m.id)}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
