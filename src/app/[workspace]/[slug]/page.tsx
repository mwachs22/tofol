import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { EditorShellClient } from "@/components/editor/EditorShellClient";
import FolderPage from "./FolderPage";

interface Props {
  params: Promise<{ workspace: string; slug: string }>;
}

export default async function DocumentPage({ params }: Props) {
  const { workspace: handle, slug } = await params;
  const user = await getUser();
  const serviceCli = await createServiceClient();

  const { data: ws } = await serviceCli
    .from("workspaces")
    .select("id, name")
    .eq("handle", handle)
    .single();

  if (!ws) notFound();

  // Check if this slug is a folder slug — if so, show folder listing
  const { data: folder } = await serviceCli
    .from("folders")
    .select("id, name, slug")
    .eq("workspace_id", ws.id)
    .eq("slug", slug)
    .maybeSingle();

  if (folder) {
    if (!user) redirect(`/login?next=/${handle}/${slug}`);
    const { data: member } = await serviceCli
      .from("members")
      .select("role")
      .eq("workspace_id", ws.id)
      .eq("user_id", user.id)
      .single();
    if (!member) notFound();
    const { data: folderDocs } = await serviceCli
      .from("documents")
      .select("id, title, slug, updated_at, tags")
      .eq("workspace_id", ws.id)
      .eq("folder_id", folder.id)
      .order("updated_at", { ascending: false });
    return (
      <FolderPage
        workspace={{ id: ws.id, name: ws.name, handle }}
        folder={folder}
        docs={folderDocs ?? []}
        memberRole={member.role}
      />
    );
  }

  // Check workspace read-only lock (active migration)
  const { data: activeJob } = await serviceCli
    .from("migration_jobs")
    .select("id, is_workspace_locked")
    .eq("workspace_id", ws.id)
    .eq("is_workspace_locked", true)
    .limit(1)
    .maybeSingle();
  const isLocked = !!activeJob;

  // Load doc (use service client so public docs are accessible without auth)
  const { data: doc } = await serviceCli
    .from("documents")
    .select("id, title, slug, body, frontmatter, tags, share_mode, current_revision_id, updated_at")
    .eq("workspace_id", ws.id)
    .eq("slug", slug)
    .single();

  if (!doc) {
    // Check slug redirect table
    const { data: slugRedirect } = await serviceCli
      .from("slug_redirects")
      .select("document_id")
      .eq("workspace_id", ws.id)
      .eq("old_slug", slug)
      .single();

    if (slugRedirect) {
      const { data: targetDoc } = await serviceCli
        .from("documents")
        .select("slug")
        .eq("id", slugRedirect.document_id)
        .single();
      if (targetDoc) redirect(`/${handle}/${targetDoc.slug}`);
    }

    notFound();
  }

  // Determine access level
  const isPublic = doc.share_mode === "public_view" || doc.share_mode === "public_edit";

  if (!user && !isPublic) {
    // Private doc, not logged in — send to login
    redirect(`/login?next=/${handle}/${slug}`);
  }

  let memberRole: "admin" | "editor" | "viewer" | null = null;
  if (user) {
    const { data: member } = await serviceCli
      .from("members")
      .select("role")
      .eq("workspace_id", ws.id)
      .eq("user_id", user.id)
      .single();
    memberRole = member?.role ?? null;
  }

  if (!isPublic && !memberRole) {
    // Private doc, logged-in user is not a member
    notFound();
  }

  let canEdit: boolean;
  if (isLocked) {
    canEdit = false;
  } else if (memberRole === "admin" || memberRole === "editor") {
    canEdit = true;
  } else if (doc.share_mode === "public_edit") {
    canEdit = true;
  } else {
    canEdit = false;
  }

  return (
    <EditorShellClient
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
      userId={user?.id ?? "anonymous"}
    />
  );
}

