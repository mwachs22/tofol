import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import WorkspaceHome from "./WorkspaceHome";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function WorkspacePage({ params }: Props) {
  const { workspace: handle } = await params;
  const user = await requireUser();
  const db = await createServiceClient();

  const { data: ws } = await db
    .from("workspaces")
    .select("id, name, handle")
    .eq("handle", handle)
    .single();

  if (!ws) notFound();

  const { data: member } = await db
    .from("members")
    .select("role")
    .eq("workspace_id", ws.id)
    .eq("user_id", user.id)
    .single();

  if (!member) notFound();

  const [{ data: docs }, { data: folders }, { data: stars }] = await Promise.all([
    db.from("documents")
      .select("id, title, slug, updated_at, tags, folder_id")
      .eq("workspace_id", ws.id)
      .order("updated_at", { ascending: false })
      .limit(100),
    db.from("folders")
      .select("id, name, slug")
      .eq("workspace_id", ws.id)
      .order("name", { ascending: true }),
    db.from("starred_docs")
      .select("document_id")
      .eq("user_id", user.id),
  ]);

  const starredIds = new Set((stars ?? []).map((s) => s.document_id));

  return (
    <WorkspaceHome
      workspace={{ id: ws.id, name: ws.name, handle: ws.handle }}
      memberRole={member.role}
      initialDocs={docs ?? []}
      initialStarredIds={[...starredIds]}
      initialFolders={folders ?? []}
    />
  );
}
