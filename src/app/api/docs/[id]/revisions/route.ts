// Internal route — requires session auth, not API key auth.
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized", "Sign in required.");

  const service = await createServiceClient();
  const { data: doc } = await service
    .from("documents")
    .select("id, workspace_id")
    .eq("id", id)
    .single();

  if (!doc) return problem(404, "Not Found", "Document not found.");

  const { data: member } = await service
    .from("members")
    .select("role")
    .eq("workspace_id", doc.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (!member) return problem(403, "Forbidden", "Not a member of this workspace.");

  const limit = 50;
  const { data: revisions } = await service
    .from("revisions")
    .select("id, author_type, author_display_name, created_at")
    .eq("document_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return NextResponse.json({ data: revisions ?? [] });
}

/** POST /api/docs/:id/revisions — create a manual snapshot */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized", "Sign in required.");

  const service = await createServiceClient();
  const { data: doc } = await service
    .from("documents")
    .select("id, workspace_id, body, frontmatter")
    .eq("id", id)
    .single();

  if (!doc) return problem(404, "Not Found", "Document not found.");

  const { data: member } = await service
    .from("members")
    .select("role")
    .eq("workspace_id", doc.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role === "viewer") {
    return problem(403, "Forbidden", "Editors and admins can create revisions.");
  }

  const displayName = user.email ?? user.id ?? "Unknown";

  const { data: revision } = await service
    .from("revisions")
    .insert({
      document_id: id,
      body: doc.body,
      frontmatter: doc.frontmatter,
      author_type: "human",
      author_id: user.id,
      author_display_name: displayName,
    })
    .select("id")
    .single();

  await service
    .from("documents")
    .update({ current_revision_id: revision?.id ?? null })
    .eq("id", id);

  return NextResponse.json({ id: revision?.id }, { status: 201 });
}
