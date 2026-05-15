import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EditorShell } from "@/components/editor/EditorShell";

interface Props {
  params: Promise<{ workspace: string; slug: string }>;
}

export default async function DocumentPage({ params }: Props) {
  const { workspace: handle, slug } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("handle", handle)
    .single();

  // Check workspace read-only lock (active migration)
  const service = (await import("@/lib/supabase/server")).createServiceClient;
  const serviceCli = await service();
  const { data: activeJob } = await serviceCli
    .from("migration_jobs")
    .select("id, is_workspace_locked")
    .eq("workspace_id", ws?.id ?? "")
    .eq("is_workspace_locked", true)
    .limit(1)
    .maybeSingle();
  const isLocked = !!activeJob;

  if (!ws) notFound();

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", ws.id)
    .eq("user_id", user.id)
    .single();

  if (!member) notFound();

  const { data: doc } = await supabase
    .from("documents")
    .select(
      "id, title, slug, body, frontmatter, tags, share_mode, current_revision_id, updated_at"
    )
    .eq("workspace_id", ws.id)
    .eq("slug", slug)
    .single();

  if (!doc) {
    const { data: slugRedirect } = await supabase
      .from("slug_redirects")
      .select("document_id")
      .eq("workspace_id", ws.id)
      .eq("old_slug", slug)
      .single();

    if (slugRedirect) {
      const { data: targetDoc } = await supabase
        .from("documents")
        .select("slug")
        .eq("id", slugRedirect.document_id)
        .single();

      if (targetDoc) redirect(`/${handle}/${targetDoc.slug}`);
    }

    notFound();
  }

  const canEdit = !isLocked && (member.role === "admin" || member.role === "editor");

  return (
    <EditorShell
      doc={{
        id: doc.id,
        title: doc.title,
        slug: doc.slug,
        body: doc.body,
        frontmatter: doc.frontmatter as Record<string, unknown>,
        tags: doc.tags,
        shareMode: doc.share_mode,
        currentRevisionId: doc.current_revision_id,
      }}
      workspaceId={ws.id}
      workspaceHandle={handle}
      workspaceName={ws.name}
      canEdit={canEdit}
      isLocked={isLocked}
      userId={user.id}
    />
  );
}
