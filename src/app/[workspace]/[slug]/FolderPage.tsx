import Link from "next/link";

interface Doc {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  tags: string[];
}

interface Props {
  workspace: { id: string; name: string; handle: string };
  folder: { id: string; name: string; slug: string };
  docs: Doc[];
  memberRole: "admin" | "editor" | "viewer";
}

export default function FolderPage({ workspace, folder, docs, memberRole }: Props) {
  const canEdit = memberRole === "admin" || memberRole === "editor";

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center gap-3">
        <Link
          href={`/${workspace.handle}`}
          className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          {workspace.name}
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">📁 {folder.name}</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{folder.name}</h1>
          {canEdit && (
            <form
              action={`/api/workspaces/${workspace.id}/docs`}
              method="POST"
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch(`/api/workspaces/${workspace.id}/docs`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: "Untitled", folder_id: folder.id }),
                });
                if (res.ok) {
                  const { slug } = await res.json();
                  window.location.href = `/${workspace.handle}/${slug}`;
                }
              }}
            >
              <button
                type="submit"
                className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-1.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
              >
                New document
              </button>
            </form>
          )}
        </div>

        {docs.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-16">
            No documents in this folder yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {docs.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/${workspace.handle}/${doc.slug}`}
                  className="flex items-center justify-between py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 -mx-2 px-2 rounded-md transition-colors group"
                >
                  <div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 group-hover:text-zinc-700 block">
                      {doc.title || "Untitled"}
                    </span>
                    {doc.tags.length > 0 && (
                      <div className="flex gap-1 mt-0.5">
                        {doc.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 shrink-0 ml-4">
                    {new Date(doc.updated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
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
