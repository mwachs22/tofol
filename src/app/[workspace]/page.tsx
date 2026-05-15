import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function WorkspacePage({ params }: Props) {
  const { workspace: handle } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  // Verify the workspace exists
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name, handle")
    .eq("handle", handle)
    .single();

  if (!ws) notFound();

  // Verify the user is a member
  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", ws.id)
    .eq("user_id", user.id)
    .single();

  if (!member) notFound();

  // Load documents
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, slug, updated_at, tags")
    .eq("workspace_id", ws.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Top bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {ws.name}
        </span>
        <NewDocButton workspaceId={ws.id} handle={handle} />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
          Documents
        </h1>

        {!docs || docs.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No documents yet.{" "}
            <NewDocButton workspaceId={ws.id} handle={handle} inline />
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {docs.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/${handle}/${doc.slug}`}
                  className="flex items-center justify-between py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 -mx-2 px-2 rounded-md transition-colors"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {doc.title}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {new Date(doc.updated_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function NewDocButton({
  workspaceId,
  handle,
  inline,
}: {
  workspaceId: string;
  handle: string;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <form action={`/api/workspaces/${workspaceId}/docs`} method="POST">
        <button type="submit" className="font-medium text-zinc-900 dark:text-zinc-50 hover:underline">
          Create your first document
        </button>
      </form>
    );
  }

  return (
    <form action={`/api/workspaces/${workspaceId}/docs`} method="POST">
      <button
        type="submit"
        className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-1.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
      >
        New document
      </button>
    </form>
  );
}
