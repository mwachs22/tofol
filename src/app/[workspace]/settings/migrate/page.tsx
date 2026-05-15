import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import MigrateClient from "./MigrateClient";
import type { Json } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ workspace: string }>;
}

interface ReviewDoc {
  id: string;
  title: string;
  slug: string;
  body: string;
  frontmatter: Record<string, unknown>;
  reasons: string[];
}

export default async function MigratePage({ params }: Props) {
  const { workspace: handle } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name, handle, adapter_type")
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

  const service = await createServiceClient();

  const [{ count: docCount }, { data: latestJob }] = await Promise.all([
    service
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws.id),
    service
      .from("migration_jobs")
      .select("*")
      .eq("workspace_id", ws.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Load review queue docs if job is complete and has flagged items
  let reviewDocs: ReviewDoc[] = [];
  if (latestJob?.status === "complete" && Array.isArray(latestJob.review_queue)) {
    const queue = latestJob.review_queue as Array<{ docId: string; reasons: string[] }>;
    if (queue.length > 0) {
      const ids = queue.map((q) => q.docId);
      const { data: flaggedDocs } = await service
        .from("documents")
        .select("id, title, slug, body, frontmatter")
        .in("id", ids);

      reviewDocs = (flaggedDocs ?? []).map((doc) => {
        const qItem = queue.find((q) => q.docId === doc.id);
        return {
          id: doc.id,
          title: doc.title,
          slug: doc.slug,
          body: doc.body,
          frontmatter: doc.frontmatter as Record<string, unknown>,
          reasons: qItem?.reasons ?? [],
        };
      });
    }
  }

  const navSections = [
    { href: `/${handle}/settings`, label: "General" },
    { href: `/${handle}/settings/adapter`, label: "Backend adapter" },
    { href: `/${handle}/settings/keys`, label: "API keys" },
    { href: `/${handle}/settings/members`, label: "Members" },
    { href: `/${handle}/settings/migrate`, label: "Migration", active: true },
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
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
            Migration
          </h1>
          <p className="text-sm text-zinc-500 mb-6">
            Sync all Tofol documents to your configured backend adapter. The workspace
            enters read-only mode during migration to prevent conflicts.
          </p>

          <MigrateClient
            workspaceId={ws.id}
            adapterType={ws.adapter_type}
            docCount={docCount ?? 0}
            latestJob={latestJob ? {
              id: latestJob.id,
              status: latestJob.status,
              totalDocs: latestJob.total_docs,
              completedDocs: latestJob.completed_docs,
              failedDocs: latestJob.failed_docs,
              isLocked: latestJob.is_workspace_locked,
            } : null}
            reviewDocs={reviewDocs}
          />
        </main>
      </div>
    </div>
  );
}
