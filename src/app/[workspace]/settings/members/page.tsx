import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import MembersClient from "./MembersClient";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function MembersPage({ params }: Props) {
  const { workspace: handle } = await params;
  const user = await requireUser();
  const supabase = await createServiceClient();

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name, handle")
    .eq("handle", handle)
    .single();

  if (!ws) notFound();

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", ws.id)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role !== "admin") redirect(`/${handle}`);

  // Load members with user metadata
  const { data: members } = await supabase
    .from("members")
    .select("id, user_id, role, invited_at, accepted_at")
    .eq("workspace_id", ws.id)
    .order("invited_at", { ascending: true });

  const navSections = [
    { href: `/${handle}/settings`, label: "General" },
    { href: `/${handle}/settings/adapter`, label: "Backend adapter" },
    { href: `/${handle}/settings/keys`, label: "API keys" },
    { href: `/${handle}/settings/members`, label: "Members", active: true },
    { href: `/${handle}/settings/migrate`, label: "Migration" },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center gap-4">
        <Link href={`/${handle}`} className="text-sm text-zinc-400 hover:text-zinc-600">
          {ws.name}
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Settings</span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 flex gap-10">
        <nav className="w-48 shrink-0">
          <ul className="space-y-1">
            {navSections.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                    s.active
                      ? "bg-zinc-100 dark:bg-zinc-800 font-medium text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
            Members
          </h1>
          <MembersClient
            workspaceId={ws.id}
            currentUserId={user.id}
            initialMembers={members ?? []}
          />
        </main>
      </div>
    </div>
  );
}
