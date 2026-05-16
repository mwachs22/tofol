"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

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
  initialFolders: Folder[];
  initialStarredIds: string[];
  userEmail: string;
}

export function WorkspaceSidebar({
  workspace,
  memberRole,
  initialDocs,
  initialFolders,
  initialStarredIds,
  userEmail,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [docs, setDocs] = useState(initialDocs);
  const [folders] = useState(initialFolders);
  const [starredIds] = useState(() => new Set(initialStarredIds));
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const canEdit = memberRole === "admin" || memberRole === "editor";
  const isActive = (slug: string) => pathname === `/${workspace.handle}/${slug}`;

  const filtered = search
    ? docs.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : docs;

  const starredDocs = docs.filter((d) => starredIds.has(d.id));
  const unfolderedDocs = filtered.filter((d) => !d.folder_id);

  async function newDoc() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled", folder_id: null }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setDocs((prev) => [
        {
          id: data.id,
          title: "Untitled",
          slug: data.slug,
          updated_at: new Date().toISOString(),
          tags: [],
          folder_id: null,
        },
        ...prev,
      ]);
      router.push(`/${workspace.handle}/${data.slug}`);
    } finally {
      setCreating(false);
    }
  }

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col h-full bg-zinc-900 border-r border-zinc-800 overflow-hidden">
      {/* Workspace name */}
      <div className="px-3 py-3 border-b border-zinc-800 flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
          {workspace.name[0]?.toUpperCase()}
        </div>
        <Link
          href={`/${workspace.handle}`}
          className="text-sm font-semibold text-zinc-100 hover:text-white truncate"
        >
          {workspace.name}
        </Link>
      </div>

      {/* Search */}
      <div className="px-2 pt-2 pb-1">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full bg-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-zinc-600"
        />
      </div>

      {/* New doc */}
      {canEdit && (
        <div className="px-2 pb-2">
          <button
            onClick={newDoc}
            disabled={creating}
            className="w-full flex items-center gap-1.5 rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
          >
            <span className="text-sm leading-none font-light">+</span>
            {creating ? "Creating…" : "New document"}
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {!search && starredDocs.length > 0 && (
          <Section label="Starred" id="starred" collapsed={collapsed} onToggle={toggle}>
            {starredDocs.map((doc) => (
              <DocLink key={doc.id} doc={doc} handle={workspace.handle} active={isActive(doc.slug)} />
            ))}
          </Section>
        )}

        {!search &&
          folders.map((folder) => {
            const folderDocs = docs.filter((d) => d.folder_id === folder.id);
            return (
              <Section
                key={folder.id}
                label={folder.name}
                id={folder.id}
                collapsed={collapsed}
                onToggle={toggle}
                isFolder
              >
                {folderDocs.length === 0 ? (
                  <p className="text-[11px] text-zinc-600 px-3 py-1">Empty</p>
                ) : (
                  folderDocs.map((doc) => (
                    <DocLink key={doc.id} doc={doc} handle={workspace.handle} active={isActive(doc.slug)} />
                  ))
                )}
              </Section>
            );
          })}

        <Section
          label={search ? "Results" : folders.length > 0 ? "All documents" : "Documents"}
          id="all"
          collapsed={collapsed}
          onToggle={toggle}
        >
          {search && filtered.length === 0 ? (
            <p className="text-[11px] text-zinc-600 px-3 py-1">No results</p>
          ) : (
            (search ? filtered : unfolderedDocs).map((doc) => (
              <DocLink key={doc.id} doc={doc} handle={workspace.handle} active={isActive(doc.slug)} />
            ))
          )}
        </Section>
      </nav>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-zinc-800 flex items-center justify-between gap-2">
        <span className="text-[11px] text-zinc-500 truncate">{userEmail}</span>
        {memberRole === "admin" && (
          <Link
            href={`/${workspace.handle}/settings`}
            className="shrink-0 text-zinc-500 hover:text-zinc-300 text-sm"
            title="Settings"
          >
            ⚙
          </Link>
        )}
      </div>
    </aside>
  );
}

function Section({
  label,
  id,
  collapsed,
  onToggle,
  isFolder,
  children,
}: {
  label: string;
  id: string;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  isFolder?: boolean;
  children: React.ReactNode;
}) {
  const isCollapsed = collapsed.has(id);
  return (
    <div>
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-zinc-500 hover:text-zinc-400 uppercase tracking-wider rounded hover:bg-zinc-800/50 transition-colors"
      >
        <svg
          viewBox="0 0 12 12"
          className={`w-2.5 h-2.5 shrink-0 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {isFolder && <span className="shrink-0">📁</span>}
        <span className="flex-1 text-left truncate">{label}</span>
      </button>
      {!isCollapsed && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

function DocLink({
  doc,
  handle,
  active,
}: {
  doc: { title: string; slug: string };
  handle: string;
  active: boolean;
}) {
  return (
    <Link
      href={`/${handle}/${doc.slug}`}
      className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors truncate ${
        active
          ? "bg-zinc-700 text-zinc-50"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
    >
      <span className="shrink-0 opacity-40 text-[9px] leading-none">●</span>
      <span className="truncate">{doc.title || "Untitled"}</span>
    </Link>
  );
}
