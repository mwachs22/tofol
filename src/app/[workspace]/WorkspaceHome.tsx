"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Doc {
  id: string;
  title: string;
  slug: string;
  updated_at: string;
  tags: string[];
  folder_id: string | null;
}

interface Folder {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  workspace: { id: string; name: string; handle: string };
  memberRole: "admin" | "editor" | "viewer";
  initialDocs: Doc[];
  initialStarredIds: string[];
  initialFolders: Folder[];
}

export default function WorkspaceHome({
  workspace,
  memberRole,
  initialDocs,
  initialStarredIds,
  initialFolders,
}: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set(initialStarredIds));
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const canEdit = memberRole === "admin" || memberRole === "editor";

  const filtered = search
    ? docs.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : docs;

  const starredDocs = docs.filter((d) => starredIds.has(d.id));

  async function createDoc(folderId?: string) {
    setCreating(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", folder_id: folderId ?? null }),
      });
      if (!res.ok) return;
      const { slug } = await res.json();
      router.push(`/${workspace.handle}/${slug}`);
    } finally {
      setCreating(false);
    }
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const res = await fetch(`/api/workspaces/${workspace.id}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName.trim() }),
    });
    if (res.ok) {
      const folder = await res.json();
      setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName("");
      setCreatingFolder(false);
    }
  }

  async function deleteFolder(folderId: string) {
    await fetch(`/api/workspaces/${workspace.id}/folders/${folderId}`, { method: "DELETE" });
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setDocs((prev) => prev.map((d) => d.folder_id === folderId ? { ...d, folder_id: null } : d));
  }

  async function moveDoc(docId: string, folderId: string | null) {
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, folder_id: folderId } : d));
    await fetch(`/api/docs/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    });
  }

  async function toggleStar(docId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = new Set(starredIds);
    if (next.has(docId)) next.delete(docId);
    else next.add(docId);
    setStarredIds(next);
    const res = await fetch(`/api/docs/${docId}/star`, { method: "POST" });
    if (!res.ok) setStarredIds(starredIds);
  }

  function toggleFolderCollapse(folderId: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  const unfolderedDocs = filtered.filter((d) => !d.folder_id);

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-950">
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>

        {/* Starred section */}
        {starredDocs.length > 0 && !search && (
          <section className="mb-8">
            <SectionHeader label="Starred" />
            <DocList
              docs={starredDocs}
              handle={workspace.handle}
              starredIds={starredIds}
              folders={folders}
              canEdit={canEdit}
              onToggleStar={toggleStar}
              onMoveDoc={moveDoc}
            />
          </section>
        )}

        {/* Folder sections */}
        {!search && folders.map((folder) => {
          const folderDocs = docs.filter((d) => d.folder_id === folder.id);
          const isCollapsed = collapsedFolders.has(folder.id);

          return (
            <section key={folder.id} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => toggleFolderCollapse(folder.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  <svg
                    viewBox="0 0 12 12"
                    className={`w-3 h-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>📁 {folder.name}</span>
                  <span className="font-normal text-zinc-400">({folderDocs.length})</span>
                </button>
                {canEdit && (
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => createDoc(folder.id)}
                      className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      title="New doc in folder"
                    >
                      + doc
                    </button>
                    {memberRole === "admin" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete folder "${folder.name}"? Documents will be moved out.`)) {
                            deleteFolder(folder.id);
                          }
                        }}
                        className="text-[10px] text-zinc-400 hover:text-red-500"
                        title="Delete folder"
                      >
                        delete
                      </button>
                    )}
                  </div>
                )}
              </div>
              {!isCollapsed && (
                folderDocs.length === 0 ? (
                  <p className="text-xs text-zinc-400 pl-4 py-1">No documents in this folder.</p>
                ) : (
                  <DocList
                    docs={folderDocs}
                    handle={workspace.handle}
                    starredIds={starredIds}
                    folders={folders}
                    canEdit={canEdit}
                    onToggleStar={toggleStar}
                    onMoveDoc={moveDoc}
                  />
                )
              )}
            </section>
          );
        })}

        {/* Unfoldered docs */}
        {(unfolderedDocs.length > 0 || search) && (
          <section>
            {folders.length > 0 && !search && <SectionHeader label="All documents" />}
            {search && filtered.length === 0 ? (
              <p className="text-sm text-center py-16 text-zinc-400">
                No documents match &ldquo;{search}&rdquo;
              </p>
            ) : filtered.length === 0 && !search ? (
              <div className="text-center py-16 text-zinc-400">
                <p className="text-sm mb-3">No documents yet.</p>
                {canEdit && (
                  <button
                    onClick={() => createDoc()}
                    className="text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:underline"
                  >
                    Create your first document
                  </button>
                )}
              </div>
            ) : (
              <DocList
                docs={search ? filtered : unfolderedDocs}
                handle={workspace.handle}
                starredIds={starredIds}
                folders={folders}
                canEdit={canEdit}
                onToggleStar={toggleStar}
                onMoveDoc={moveDoc}
              />
            )}
          </section>
        )}

        {/* Create folder button */}
        {canEdit && !search && (
          <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-900">
            {creatingFolder ? (
              <form onSubmit={createFolder} className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                />
                <button
                  type="submit"
                  className="text-sm font-medium text-zinc-900 dark:text-zinc-50 px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}
                  className="text-sm text-zinc-400 hover:text-zinc-600"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingFolder(true)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1"
              >
                <span>+</span> New folder
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{label}</h2>
  );
}

function DocList({
  docs,
  handle,
  starredIds,
  folders,
  canEdit,
  onToggleStar,
  onMoveDoc,
}: {
  docs: Doc[];
  handle: string;
  starredIds: Set<string>;
  folders: Folder[];
  canEdit: boolean;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onMoveDoc: (docId: string, folderId: string | null) => void;
}) {
  if (docs.length === 0) return null;

  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {docs.map((doc) => (
        <li key={doc.id} className="group">
          <Link
            href={`/${handle}/${doc.slug}`}
            className="flex items-center justify-between py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 -mx-2 px-2 rounded-md transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={(e) => onToggleStar(doc.id, e)}
                title={starredIds.has(doc.id) ? "Unstar" : "Star"}
                className={`shrink-0 text-base leading-none transition-colors ${
                  starredIds.has(doc.id)
                    ? "text-amber-400 hover:text-amber-500"
                    : "text-zinc-200 dark:text-zinc-700 group-hover:text-zinc-300 hover:text-amber-400"
                }`}
              >
                {starredIds.has(doc.id) ? "★" : "☆"}
              </button>
              <div className="min-w-0">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 block truncate">
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
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              {canEdit && folders.length > 0 && (
                <select
                  value={doc.folder_id ?? ""}
                  onClick={(e) => e.preventDefault()}
                  onChange={(e) => {
                    e.preventDefault();
                    onMoveDoc(doc.id, e.target.value || null);
                  }}
                  className="text-xs text-zinc-400 bg-transparent border-none outline-none cursor-pointer hover:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Move to folder"
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
              <span className="text-xs text-zinc-400">
                {new Date(doc.updated_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
