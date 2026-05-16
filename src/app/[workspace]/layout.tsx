import { getUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";

interface Props {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}

export default async function WorkspaceLayout({ children, params }: Props) {
  const { workspace: handle } = await params;
  const user = await getUser();

  // No sidebar for unauthenticated visitors (public doc views handled by children)
  if (!user) return <>{children}</>;

  const db = await createServiceClient();

  const { data: ws } = await db
    .from("workspaces")
    .select("id, name, handle")
    .eq("handle", handle)
    .single();

  if (!ws) return <>{children}</>;

  const { data: member } = await db
    .from("members")
    .select("role")
    .eq("workspace_id", ws.id)
    .eq("user_id", user.id)
    .single();

  // Not a member (e.g. public doc visitor) — let the page handle access control
  if (!member) return <>{children}</>;

  const [{ data: docs }, { data: folders }, { data: stars }] = await Promise.all([
    db
      .from("documents")
      .select("id, title, slug, updated_at, tags, folder_id")
      .eq("workspace_id", ws.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    db
      .from("folders")
      .select("id, name, slug")
      .eq("workspace_id", ws.id)
      .order("name", { ascending: true }),
    db.from("starred_docs").select("document_id").eq("user_id", user.id),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <WorkspaceSidebar
        workspace={{ id: ws.id, name: ws.name, handle: ws.handle }}
        memberRole={member.role as "admin" | "editor" | "viewer"}
        initialDocs={docs ?? []}
        initialFolders={folders ?? []}
        initialStarredIds={(stars ?? []).map((s) => s.document_id)}
        userEmail={user.email ?? ""}
      />
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
