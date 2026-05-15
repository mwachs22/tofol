import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function SettingsPage({ params }: Props) {
  const { workspace: handle } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name, handle, adapter_type, theme_config")
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

  const settingsSections = [
    { href: `/${handle}/settings`, label: "General", active: true },
    { href: `/${handle}/settings/adapter`, label: "Backend adapter" },
    { href: `/${handle}/settings/keys`, label: "API keys" },
    { href: `/${handle}/settings/members`, label: "Members" },
    { href: `/${handle}/settings/migrate`, label: "Migration" },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center gap-4">
        <Link
          href={`/${handle}`}
          className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          {ws.name}
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Settings</span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 flex gap-10">
        <nav className="w-48 shrink-0">
          <ul className="space-y-1">
            {settingsSections.map((s) => (
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
            General
          </h1>

          <div className="space-y-6">
            <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-4">
                Workspace details
              </h2>
              <WorkspaceDetailsForm
                workspaceId={ws.id}
                name={ws.name}
                handle={ws.handle}
              />
            </section>

            <section className="rounded-lg border border-red-100 dark:border-red-900 p-5">
              <h2 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                Danger zone
              </h2>
              <p className="text-xs text-zinc-500 mb-4">
                Export all documents before deleting. This action is irreversible.
              </p>
              <div className="flex gap-3">
                <a
                  href={`/api/workspaces/${ws.id}/export`}
                  className="text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded-md px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  Export all docs (.zip)
                </a>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function WorkspaceDetailsForm({
  workspaceId,
  name,
  handle,
}: {
  workspaceId: string;
  name: string;
  handle: string;
}) {
  // Rendered as server component — form submits to API
  return (
    <form
      action={`/api/workspaces/${workspaceId}`}
      method="POST"
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          Workspace name
        </label>
        <input
          name="name"
          defaultValue={name}
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
            name="handle"
            defaultValue={handle}
            className="flex-1 bg-transparent px-1 py-2 text-sm outline-none"
          />
        </div>
      </div>
      <button
        type="submit"
        className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
      >
        Save changes
      </button>
    </form>
  );
}
