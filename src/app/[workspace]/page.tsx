import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHome from "./WorkspaceHome";

interface Props {
  params: Promise<{ workspace: string }>;
}

export default async function WorkspacePage({ params }: Props) {
  const { workspace: handle } = await params;
  const user = await requireUser();
  const supabase = await createClient();

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

  if (!member) notFound();

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, slug, updated_at, tags")
    .eq("workspace_id", ws.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  const { data: stars } = await supabase
    .from("starred_docs")
    .select("document_id")
    .eq("user_id", user.id);

  const starredIds = new Set((stars ?? []).map((s) => s.document_id));

  return (
    <WorkspaceHome
      workspace={{ id: ws.id, name: ws.name, handle: ws.handle }}
      memberRole={member.role}
      initialDocs={docs ?? []}
      initialStarredIds={[...starredIds]}
    />
  );
}
