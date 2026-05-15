import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

interface RouteParams {
  params: Promise<{ id: string; revId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: docId, revId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized", "Sign in required.");

  const { data: doc } = await supabase
    .from("documents")
    .select("id, workspace_id, body, frontmatter")
    .eq("id", docId)
    .single();

  if (!doc) return problem(404, "Not Found", "Document not found.");

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", doc.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role === "viewer") {
    return problem(403, "Forbidden", "Editors and admins can restore revisions.");
  }

  const { data: revision } = await supabase
    .from("revisions")
    .select("id, body, frontmatter")
    .eq("id", revId)
    .eq("document_id", docId)
    .single();

  if (!revision) return problem(404, "Not Found", "Revision not found.");

  const displayName = user.email ?? user.id;

  // Snapshot the current state before restoring
  const { data: snapshot } = await supabase
    .from("revisions")
    .insert({
      document_id: docId,
      body: doc.body,
      frontmatter: doc.frontmatter,
      author_type: "human",
      author_id: user.id,
      author_display_name: displayName,
    })
    .select("id")
    .single();

  // Apply the restored revision
  await supabase
    .from("documents")
    .update({
      body: revision.body,
      frontmatter: revision.frontmatter,
      current_revision_id: snapshot?.id ?? null,
      last_edited_by: user.id,
    })
    .eq("id", docId);

  return NextResponse.json({ ok: true, previousRevisionId: snapshot?.id });
}
